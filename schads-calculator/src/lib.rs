//! SCHADS (MA000100) gross-pay calculator.
//!
//! Rules implemented against the Fair Work Ombudsman award text effective 1 July 2026.
//! This is an auditable calculation component, not payroll/legal advice. `base_hourly_rate`
//! must be the applicable ordinary hourly award/classification rate for the work date.

use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime, Timelike, Weekday};
use rust_decimal::{Decimal, RoundingStrategy};
use rust_decimal::prelude::ToPrimitive;
use rust_decimal_macros::dec;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;

const CASUAL_LOADING: Decimal = dec!(0.25);
const BROKEN_ONE_BREAK_ALLOWANCE: Decimal = dec!(21.81); // cl 20.12(a), ppc 1 Jul 2026
const BROKEN_TWO_BREAK_ALLOWANCE: Decimal = dec!(28.87); // cl 20.12(b), ppc 1 Jul 2026
const MEAL_ALLOWANCE: Decimal = dec!(16.62); // cl 20.2(a), ppc 1 Jul 2026

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EmploymentType {
    FullTime,
    PartTime,
    Casual,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Stream {
    SocialCommunity,
    DisabilityServices,
    HomeCare,
    DayCare,
    CrisisAccommodation,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Shift {
    pub start: NaiveDateTime,
    pub end: NaiveDateTime,
    #[serde(default)]
    pub sleepover: bool,
    #[serde(default)]
    pub agreed_twelve_hour_sleepover_shift: bool,
    #[serde(default)]
    pub authorised_overtime: bool,
}
impl Shift {
    pub fn work(start: NaiveDateTime, end: NaiveDateTime) -> Self {
        Self {
            start,
            end,
            sleepover: false,
            agreed_twelve_hour_sleepover_shift: false,
            authorised_overtime: false,
        }
    }
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Allowance {
    pub code: String,
    pub amount: Decimal,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PayInput {
    pub base_hourly_rate: Decimal,
    pub employment: EmploymentType,
    pub stream: Stream,
    pub shifts: Vec<Shift>,
    pub pay_period_start: NaiveDate,
    #[serde(default)]
    pub public_holidays: Vec<NaiveDate>,
    #[serde(default)]
    pub allowances: Vec<Allowance>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct AuditLine {
    pub rule: String,
    pub amount: Decimal,
    pub detail: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PayResult {
    pub gross: Decimal,
    pub audit_log: Vec<AuditLine>,
}
#[derive(Error, Debug)]
pub enum PayError {
    #[error("base_hourly_rate must be positive")]
    InvalidRate,
    #[error("shift {0} must end after it starts")]
    InvalidShift(usize),
    #[error("sleepover shifts must be exactly 8 hours")]
    InvalidSleepover,
    #[error("overlapping work shifts are not supported")]
    OverlappingShifts,
    #[error("broken shifts only apply to disability-services and home-care work")]
    InvalidBrokenShift,
}

#[derive(Clone, Debug)]
struct Segment {
    start: NaiveDateTime,
    end: NaiveDateTime,
    paid_hours: Decimal,
    actual_hours: Decimal,
    multiplier: Decimal,
    overtime: bool,
}
struct State {
    input: PayInput,
    segments: Vec<Segment>,
    audit: Vec<AuditLine>,
    fixed: Decimal,
}

/// Calculates gross pay from JSON-deserialisable shift data. Amounts are rounded only at the final cent.
pub fn calculate_pay(input: PayInput) -> Result<PayResult, PayError> {
    validate_input(&input)?;
    let mut state = State {
        input,
        segments: vec![],
        audit: vec![],
        fixed: dec!(0),
    };
    build_timeline(&mut state);
    apply_minimum_engagement(&mut state)?;
    apply_ordinary_hours(&mut state);
    apply_evening_penalties(&mut state);
    apply_saturday(&mut state);
    apply_sunday(&mut state);
    apply_public_holiday(&mut state);
    apply_overtime(&mut state);
    apply_meal_allowance(&mut state);
    apply_broken_shift(&mut state)?;
    apply_sleepover(&mut state);
    apply_allowances(&mut state);
    apply_casual_loading(&mut state);
    let gross = apply_rounding(&state);
    Ok(PayResult {
        gross,
        audit_log: generate_audit_log(state, gross),
    })
}

fn validate_input(input: &PayInput) -> Result<(), PayError> {
    if input.base_hourly_rate <= dec!(0) {
        return Err(PayError::InvalidRate);
    }
    let mut shifts = input.shifts.clone();
    shifts.sort_by_key(|s| s.start);
    for (i, s) in shifts.iter().enumerate() {
        if s.end <= s.start {
            return Err(PayError::InvalidShift(i));
        }
        if s.sleepover && s.end - s.start != Duration::hours(8) {
            return Err(PayError::InvalidSleepover);
        }
        if i > 0 && !s.sleepover && !shifts[i - 1].sleepover && s.start < shifts[i - 1].end {
            return Err(PayError::OverlappingShifts);
        }
    }
    Ok(())
}
fn hours(a: NaiveDateTime, b: NaiveDateTime) -> Decimal {
    Decimal::from(b.signed_duration_since(a).num_minutes()) / dec!(60)
}
fn build_timeline(s: &mut State) {
    for shift in &s.input.shifts {
        if !shift.sleepover {
            s.segments.push(Segment {
                start: shift.start,
                end: shift.end,
                paid_hours: hours(shift.start, shift.end),
                actual_hours: hours(shift.start, shift.end),
                multiplier: dec!(1),
                overtime: false,
            });
        }
    }
    s.segments.sort_by_key(|x| x.start);
}
fn min_hours(s: &State) -> Decimal {
    if s.input.stream == Stream::SocialCommunity {
        dec!(3)
    } else {
        dec!(2)
    }
}
fn apply_minimum_engagement(s: &mut State) -> Result<(), PayError> {
    if s.input.employment == EmploymentType::FullTime {
        return Ok(());
    }
    let minimum = min_hours(s);
    for seg in &mut s.segments {
        if seg.paid_hours < minimum {
            let added = minimum - seg.paid_hours;
            seg.paid_hours = minimum;
            s.audit.push(AuditLine {
                rule: "cl 10.5 minimum engagement".into(),
                amount: dec!(0),
                detail: format!("added {added} paid hours"),
            });
        }
    }
    Ok(())
}
fn apply_ordinary_hours(_: &mut State) {}
fn day_multiplier(s: &State, time: NaiveDateTime) -> Decimal {
    match time.weekday() {
        Weekday::Sat => {
            if s.input.employment == EmploymentType::Casual {
                dec!(1.75)
            } else {
                dec!(1.5)
            }
        }
        Weekday::Sun => {
            if s.input.employment == EmploymentType::Casual {
                dec!(2.25)
            } else {
                dec!(2)
            }
        }
        _ => dec!(1),
    }
}
fn apply_evening_penalties(s: &mut State) {
    for seg in &mut s.segments {
        let end_hour = seg.end.time().hour();
        let start_hour = seg.start.time().hour();
        if matches!(
            seg.start.weekday(),
            Weekday::Mon | Weekday::Tue | Weekday::Wed | Weekday::Thu | Weekday::Fri
        ) {
            if end_hour > 20 && end_hour <= 24 {
                seg.multiplier = dec!(1.125);
            } else if end_hour < 6 || start_hour < 6 {
                seg.multiplier = dec!(1.15);
            }
        }
    }
}
fn apply_saturday(s: &mut State) {
    for i in 0..s.segments.len() {
        let m = day_multiplier(s, s.segments[i].start);
        if s.segments[i].start.weekday() == Weekday::Sat {
            s.segments[i].multiplier = m;
        }
    }
}
fn apply_sunday(s: &mut State) {
    for i in 0..s.segments.len() {
        let m = day_multiplier(s, s.segments[i].start);
        if s.segments[i].start.weekday() == Weekday::Sun {
            s.segments[i].multiplier = m;
        }
    }
}
fn apply_public_holiday(s: &mut State) {
    for seg in &mut s.segments {
        if s.input.public_holidays.contains(&seg.start.date()) {
            seg.multiplier = if s.input.employment == EmploymentType::Casual {
                dec!(2.75)
            } else {
                dec!(2.5)
            };
        }
    }
}
fn is_sc_or_crisis(stream: Stream) -> bool {
    matches!(
        stream,
        Stream::SocialCommunity | Stream::CrisisAccommodation
    )
}
fn apply_overtime(s: &mut State) {
    let mut daily: BTreeMap<NaiveDate, Decimal> = BTreeMap::new();
    let mut i = 0;
    while i < s.segments.len() {
        let start_date = s.segments[i].start.date();
        let seg_hours = s.segments[i].actual_hours;
        let already = *daily.entry(start_date).or_default();
        let new_total = already + seg_hours;

        let is_agreed_12 = s
            .input
            .shifts
            .iter()
            .any(|x| x.start == s.segments[i].start && x.end == s.segments[i].end && x.agreed_twelve_hour_sleepover_shift);
        let threshold = if is_agreed_12 { dec!(12) } else { dec!(10) };
        let must_overtime = match s.input.employment {
            EmploymentType::FullTime => s
                .input
                .shifts
                .iter()
                .any(|x| x.start == s.segments[i].start && x.end == s.segments[i].end && x.authorised_overtime),
            _ => new_total > threshold,
        };

        if must_overtime && already < threshold {
            // Split: portion below threshold stays as-is, excess becomes OT
            let ordinary_hours = threshold - already;
            let ot_hours = new_total - threshold;
            let split_mins = (ordinary_hours * dec!(60)).round().to_i64().unwrap_or(0);
            let split_time = s.segments[i].start + Duration::minutes(split_mins.min(1440));

            let ot_mult = match s.segments[i].start.weekday() {
                Weekday::Sun => dec!(2),
                _ if s.input.public_holidays.contains(&s.segments[i].start.date()) => dec!(2.5),
                _ => {
                    if ot_hours <= dec!(2) {
                        dec!(1.5)
                    } else {
                        dec!(2)
                    }
                }
            };

            // Truncate current segment to ordinary portion
            let seg_orig_end = s.segments[i].end;
            s.segments[i].end = split_time;
            s.segments[i].paid_hours = ordinary_hours;
            s.segments[i].actual_hours = ordinary_hours;

            // Insert OT segment
            let ot_seg = Segment {
                start: split_time,
                end: seg_orig_end,
                paid_hours: ot_hours,
                actual_hours: ot_hours,
                multiplier: ot_mult,
                overtime: true,
            };
            s.segments.insert(i + 1, ot_seg);
            i += 1; // skip the OT segment we inserted
        } else if must_overtime {
            // Fully in OT territory
            let seg = &mut s.segments[i];
            seg.overtime = true;
            let prior_ot = (already - threshold).max(dec!(0));
            seg.multiplier = match seg.start.weekday() {
                Weekday::Sun => dec!(2),
                _ if s.input.public_holidays.contains(&seg.start.date()) => dec!(2.5),
                _ => {
                    if prior_ot < dec!(2) {
                        dec!(1.5)
                    } else {
                        dec!(2)
                    }
                }
            };
        }

        *daily.entry(start_date).or_default() = new_total;
        i += 1;
    }
}
fn apply_meal_allowance(s: &mut State) {
    for shift in &s.input.shifts {
        let duration = shift.end - shift.start;
        let hours = Decimal::from(duration.num_minutes()) / dec!(60);
        if hours > dec!(10) {
            s.fixed += MEAL_ALLOWANCE;
            s.audit.push(AuditLine {
                rule: "cl 20.2(a) meal allowance".into(),
                amount: MEAL_ALLOWANCE,
                detail: format!("shift >10h ({:.2})", hours),
            });
            break; // one meal allowance per period
        }
    }
}
fn apply_broken_shift(s: &mut State) -> Result<(), PayError> {
    // Count original work shifts (not segments) per day — OT-split segments
    // must not create false broken-shift triggers.
    let mut by_day: BTreeMap<NaiveDate, usize> = BTreeMap::new();
    for shift in &s.input.shifts {
        if !shift.sleepover {
            *by_day.entry(shift.start.date()).or_default() += 1;
        }
    }
    for (_, count) in by_day {
        if count > 1 {
            if !matches!(
                s.input.stream,
                Stream::DisabilityServices | Stream::HomeCare
            ) {
                return Err(PayError::InvalidBrokenShift);
            }
            let amount = if count == 2 {
                BROKEN_ONE_BREAK_ALLOWANCE
            } else {
                BROKEN_TWO_BREAK_ALLOWANCE
            };
            s.fixed += amount;
            s.audit.push(AuditLine {
                rule: "cl 20.12 broken-shift allowance".into(),
                amount,
                detail: format!("{count} periods"),
            });
        }
    }
    Ok(())
}
fn apply_sleepover(s: &mut State) {
    for shift in &s.input.shifts {
        if shift.sleepover {
            let amount = s.input.base_hourly_rate * dec!(38) * dec!(4.9) / dec!(100);
            s.fixed += amount;
            s.audit.push(AuditLine {
                rule: "cl 25.7(d) sleepover allowance".into(),
                amount,
                detail: "8-hour sleepover".into(),
            });
        }
    }
}
fn apply_allowances(s: &mut State) {
    for a in &s.input.allowances {
        s.fixed += a.amount;
        s.audit.push(AuditLine {
            rule: format!("input allowance: {}", a.code),
            amount: a.amount,
            detail: "caller supplied monetary allowance".into(),
        });
    }
}
fn apply_casual_loading(s: &mut State) {
    if s.input.employment == EmploymentType::Casual {
        for seg in &mut s.segments {
            if seg.multiplier == dec!(1) {
                seg.multiplier += CASUAL_LOADING;
            }
        }
    }
}
fn apply_rounding(s: &State) -> Decimal {
    (s.fixed
        + s.segments
            .iter()
            .map(|x| s.input.base_hourly_rate * x.paid_hours * x.multiplier)
            .sum::<Decimal>())
    .round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}
fn generate_audit_log(mut s: State, gross: Decimal) -> Vec<AuditLine> {
    for x in s.segments {
        s.audit.push(AuditLine {
            rule: if x.overtime {
                "cl 28.1 overtime".into()
            } else {
                "ordinary / penalty hours".into()
            },
            amount: (s.input.base_hourly_rate * x.paid_hours * x.multiplier).round_dp(4),
            detail: format!(
                "{} to {}; {} paid hours x {}",
                x.start, x.end, x.paid_hours, x.multiplier
            ),
        });
    }
    s.audit.push(AuditLine {
        rule: "final rounding".into(),
        amount: gross,
        detail: "gross pay rounded to cents".into(),
    });
    s.audit
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn casual_loading() {
        assert_eq!(CASUAL_LOADING, dec!(0.25));
    }
}
