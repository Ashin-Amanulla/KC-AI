use chrono::{NaiveDate, NaiveDateTime};
use rust_decimal_macros::dec;
use schads_calculator::{calculate_pay, EmploymentType, PayInput, Shift, Stream};

fn at(s: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M").unwrap()
}
fn input(shifts: Vec<Shift>) -> PayInput {
    PayInput {
        base_hourly_rate: dec!(30),
        employment: EmploymentType::Casual,
        stream: Stream::HomeCare,
        shifts,
        pay_period_start: NaiveDate::from_ymd_opt(2026, 7, 6).unwrap(),
        public_holidays: vec![],
        allowances: vec![],
    }
}

#[test]
fn casual_saturday_is_175_percent_inclusive_of_casual_loading() {
    let pay = calculate_pay(input(vec![Shift::work(
        at("2026-07-11T09:00"),
        at("2026-07-11T11:00"),
    )]))
    .unwrap();
    assert_eq!(pay.gross, dec!(105));
}

#[test]
fn casual_public_holiday_is_275_percent_inclusive_of_casual_loading() {
    let mut i = input(vec![Shift::work(
        at("2026-07-07T09:00"),
        at("2026-07-07T11:00"),
    )]);
    i.public_holidays
        .push(NaiveDate::from_ymd_opt(2026, 7, 7).unwrap());
    let pay = calculate_pay(i).unwrap();
    assert_eq!(pay.gross, dec!(165));
}

#[test]
fn home_care_casual_shift_has_two_hour_minimum_engagement() {
    let pay = calculate_pay(input(vec![Shift::work(
        at("2026-07-06T09:00"),
        at("2026-07-06T10:00"),
    )]))
    .unwrap();
    assert_eq!(pay.gross, dec!(75)); // 2h x $30 x 125%
}
