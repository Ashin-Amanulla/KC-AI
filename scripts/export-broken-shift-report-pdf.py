#!/usr/bin/env python3
"""Generate broken-shift overnight miss incident report PDF."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)

OUT = Path(
    "/home/cntrlx/Code/Xyvin/KCXyvin/kcai/docs/reports/"
    "2026-07-14-broken-shift-overnight-miss.pdf"
)

NAVY = colors.HexColor("#0f2744")
RED = colors.HexColor("#b42318")
AMBER = colors.HexColor("#b54708")
GREEN = colors.HexColor("#067647")
LIGHT = colors.HexColor("#f5f7fa")
BORDER = colors.HexColor("#d0d7de")
MUTED = colors.HexColor("#57606a")


def styles():
    s = getSampleStyleSheet()
    s.add(
        ParagraphStyle(
            name="TitleMain",
            parent=s["Title"],
            fontSize=18,
            textColor=NAVY,
            spaceAfter=6,
            leading=22,
            alignment=TA_LEFT,
        )
    )
    s.add(
        ParagraphStyle(
            name="Sub",
            parent=s["Normal"],
            fontSize=9,
            textColor=MUTED,
            spaceAfter=12,
            leading=12,
        )
    )
    s.add(
        ParagraphStyle(
            name="H",
            parent=s["Heading2"],
            fontSize=12,
            textColor=NAVY,
            spaceBefore=14,
            spaceAfter=8,
            leading=15,
        )
    )
    s.add(
        ParagraphStyle(
            name="H3",
            parent=s["Heading3"],
            fontSize=10,
            textColor=NAVY,
            spaceBefore=10,
            spaceAfter=6,
            leading=13,
        )
    )
    s.add(
        ParagraphStyle(
            name="Body",
            parent=s["Normal"],
            fontSize=9.5,
            leading=13,
            spaceAfter=6,
            textColor=colors.HexColor("#1f2328"),
        )
    )
    s.add(
        ParagraphStyle(
            name="CalloutDanger",
            parent=s["Normal"],
            fontSize=9,
            leading=12,
            textColor=RED,
            backColor=colors.HexColor("#fef3f2"),
            borderPadding=8,
            spaceAfter=10,
        )
    )
    s.add(
        ParagraphStyle(
            name="CalloutWarn",
            parent=s["Normal"],
            fontSize=9,
            leading=12,
            textColor=AMBER,
            spaceAfter=10,
        )
    )
    s.add(
        ParagraphStyle(
            name="Small",
            parent=s["Normal"],
            fontSize=8,
            textColor=MUTED,
            leading=10,
            spaceAfter=6,
        )
    )
    s.add(
        ParagraphStyle(
            name="Cell",
            parent=s["Normal"],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#1f2328"),
        )
    )
    s.add(
        ParagraphStyle(
            name="CellHead",
            parent=s["Normal"],
            fontSize=8,
            leading=10,
            textColor=colors.white,
            fontName="Helvetica-Bold",
        )
    )
    s.add(
        ParagraphStyle(
            name="StatVal",
            parent=s["Normal"],
            fontSize=16,
            textColor=NAVY,
            fontName="Helvetica-Bold",
            alignment=1,
        )
    )
    s.add(
        ParagraphStyle(
            name="StatLabel",
            parent=s["Normal"],
            fontSize=8,
            textColor=MUTED,
            alignment=1,
            leading=10,
        )
    )
    return s


def para_table(headers, rows, sty, col_widths=None):
    head = [Paragraph(h, sty["CellHead"]) for h in headers]
    body = [[Paragraph(str(c), sty["Cell"]) for c in row] for row in rows]
    data = [head] + body
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def callout_box(text, sty, fill, border_c):
    inner = Paragraph(text, sty["Body"])
    t = Table([[inner]], colWidths=[170 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("BOX", (0, 0), (-1, -1), 1, border_c),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return t


def stats_row(sty):
    data = [
        [
            Paragraph("8.0h", sty["StatVal"]),
            Paragraph("False negative", sty["StatVal"]),
            Paragraph("2 files", sty["StatVal"]),
        ],
        [
            Paragraph("Rest Julie had (need 10h)", sty["StatLabel"]),
            Paragraph("Detector outcome today", sty["StatLabel"]),
            Paragraph("Must change for fix", sty["StatLabel"]),
        ],
    ]
    t = Table(data, colWidths=[56 * mm, 56 * mm, 56 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return t


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sty = styles()
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="Broken-shift overnight miss — root cause & fix plan",
        author="KC AI / kcai engineering",
    )

    story = []
    story.append(Paragraph("Broken-shift overnight miss — root cause &amp; fix plan", sty["TitleMain"]))
    story.append(
        Paragraph(
            "Client report: Harrison Richards · 24 Jun 2026 · Julie-Anne Seager inadequate rest · "
            "Verified against live ShiftCare data 14 Jul 2026",
            sty["Sub"],
        )
    )

    story.append(
        callout_box(
            "<b>Verdict.</b> Root cause is not the June 15 boundary fix. Overnight inadequate rest "
            "(&lt;10h) that spans two local calendar days is excluded by a calendar-day gate in both "
            "import detection and pay-hours span collection. Julie-Anne’s 19→20 Jun case is a "
            "confirmed false negative.",
            sty,
            colors.HexColor("#fef3f2"),
            RED,
        )
    )
    story.append(Spacer(1, 8))
    story.append(stats_row(sty))

    story.append(Paragraph("1. What the client saw", sty["H"]))
    story.append(
        Paragraph(
            "Harrison reported AI Studio failed to flag that Julie-Anne Seager (19 Jun) did not get "
            "the required 10-hour rest between shifts. OnCall moved to KC Studio as a workaround. "
            "Live ShiftCare (staff 1016147) confirms the inadequate rest sits across 19 Jun evening → "
            "20 Jun morning — commonly described as “the 19th”.",
            sty["Body"],
        )
    )

    story.append(Paragraph("2. Confirmed ShiftCare evidence", sty["H"]))
    story.append(
        para_table(
            ["Date", "ShiftCare ID", "Start (AEST)", "End (AEST)", "Gap to next"],
            [
                ["Fri 19 Jun 2026", "148393041", "16:00", "22:00", "—"],
                ["Sat 20 Jun 2026", "148388885", "06:00", "14:00", "8.0 h (BROKEN)"],
                ["Sun 21 Jun 2026", "156698330", "07:30", "14:00", "17.5 h (OK)"],
            ],
            sty,
            col_widths=[32 * mm, 28 * mm, 28 * mm, 28 * mm, 42 * mm],
        )
    )
    story.append(
        Paragraph(
            "Source: ShiftCare GET /users/areas.json?start=2026-06-15&amp;end=2026-06-22 · filtered title Julie-Anne Seager",
            sty["Small"],
        )
    )

    story.append(Paragraph("3. Why the issue came (timeline)", sty["H"]))
    story.append(
        para_table(
            ["When", "What", "Effect"],
            [
                ["8 Apr 2026", "Initial detect used gap &lt; 10h/8h", "Correct exclusive boundary"],
                [
                    "8 Jun 2026 (e3981f3)",
                    "Added cross-midnight day gate + flipped to gap &gt; threshold",
                    "Good idea (cross-midnight), bad operator → false positives at exactly 10h",
                ],
                [
                    "15 Jun 2026 (ebdcbc2)",
                    "Restored gap &lt; threshold / gap ≥ threshold exit",
                    "Fixed exact-10h false positives; kept day gate unchanged",
                ],
                [
                    "19–20 Jun 2026",
                    "Julie-Anne 22:00 → 06:00 (8h rest)",
                    "Day gate rejects overnight case → client-visible miss",
                ],
                [
                    "24 Jun 2026",
                    "Harrison email + team leaves AI Studio",
                    "Trust damage; looks like “same bug came back”",
                ],
            ],
            sty,
            col_widths=[38 * mm, 72 * mm, 58 * mm],
        )
    )
    story.append(Paragraph("Why it felt like a regression", sty["H3"]))
    story.append(
        Paragraph(
            "Same SCHADS rest feature failed twice with opposite polarity: first too many flags "
            "(≤10h inclusive), then misses on true overnight shortfalls. Stakeholders experience both "
            "as “broken-shift validation is unreliable.”",
            sty["Body"],
        )
    )

    story.append(Paragraph("4. Technical root cause", sty["H"]))
    story.append(
        Paragraph(
            "<b>Functions:</b> <font face='Courier'>calculateIsBrokenShift</font> / "
            "<font face='Courier'>collectBrokenShiftSpanPrevious</font>",
            sty["Body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Step 1 — gap check (correct after Jun 15).</b> Broken only when 0 &lt; gap &lt; "
            "threshold (10h Personal Care / 8h sleepover).",
            sty["Body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Step 2 — calendar-day gate (the bug).</b> Even if gap is short, return false unless "
            "<font face='Courier'>sameStartDay</font> OR <font face='Courier'>spansOntoCurrentDay</font>. "
            "Overnight 22:00 Day N → 06:00 Day N+1 has neither, so it is skipped.",
            sty["Body"],
        )
    )
    story.append(
        Paragraph(
            "Files: <font face='Courier'>backend/modules/shifts/shiftCsvParser.js</font> · "
            "<font face='Courier'>backend/modules/pay-hours/services/payHoursCalculator.js</font>",
            sty["Small"],
        )
    )
    story.append(
        para_table(
            ["Check", "Julie 19→20 Jun", "Passes?"],
            [
                ["gap (8h) &lt; 10h", "22:00 → 06:00", "Yes"],
                ["sameStartDay", "starts 19 Jun vs starts 20 Jun", "No"],
                ["spansOntoCurrentDay", "ends 19 Jun vs starts 20 Jun", "No"],
                ["Final isBrokenShift", "gate fails", "No — FALSE NEGATIVE"],
            ],
            sty,
            col_widths=[45 * mm, 75 * mm, 48 * mm],
        )
    )
    story.append(Spacer(1, 6))
    story.append(
        callout_box(
            "The day gate was added to support cross-midnight shifts that end early morning Day N "
            "with a follow-on later that same morning. That case needs covering — but not by "
            "excluding ordinary overnight shortfalls between two separate shifts.",
            sty,
            colors.HexColor("#eff6ff"),
            colors.HexColor("#2563eb"),
        )
    )

    story.append(Paragraph("5. How we solve it", sty["H"]))
    story.append(Paragraph("Recommended fix (P0)", sty["H3"]))
    story.append(
        Paragraph(
            "<b>Treat inadequate rest as broken regardless of calendar day.</b> After the gap "
            "threshold check succeeds, return true. Remove (or demote) the "
            "sameStartDay/spansOntoCurrentDay requirement for standard previous→next pairs. "
            "Clearer rule: any chronological previous→next pair with 0 &lt; gap &lt; threshold is broken.",
            sty["Body"],
        )
    )
    story.append(
        para_table(
            ["Change", "Where"],
            [
                ["Drop day-gate (or make gap-only)", "shiftCsvParser.calculateIsBrokenShift"],
                ["Same change for OT/allowance spans", "payHoursCalculator.collectBrokenShiftSpanPrevious"],
                ["Add fixture: 22:00 Day1 → 06:00 Day2 = 8h → broken", "payHoursCalculator.test.js (+ CSV/import tests)"],
                ["Keep exact-10h NOT broken tests", "Existing Jun 15 boundary tests stay"],
                ["Re-upload timesheet + Compute Pay Hours", "Ops — refresh persisted flags"],
            ],
            sty,
            col_widths=[85 * mm, 83 * mm],
        )
    )

    story.append(Paragraph("Proposed rule (BR-BS)", sty["H3"]))
    story.append(
        para_table(
            ["Previous type", "Broken when"],
            [
                ["Personal Care", "0 &lt; gap &lt; 10 hours to next shift"],
                ["Nursing Support", "0 &lt; gap &lt; 10 hours"],
                ["Sleepover", "0 &lt; gap &lt; 8 hours"],
                ["Exactly at threshold", "Adequate rest — NOT broken"],
                ["gap ≤ 0 (overlap/contiguous)", "Not broken via this rule"],
            ],
            sty,
            col_widths=[50 * mm, 118 * mm],
        )
    )

    story.append(Paragraph("Test cases that must pass", sty["H3"]))
    story.append(
        para_table(
            ["Case", "Expected"],
            [
                ["Julie pattern: Day N 22:00 → Day N+1 06:00 (8h)", "Broken"],
                ["8 PM → 6 AM next day (exactly 10h)", "Not broken"],
                ["9h 59m overnight", "Broken"],
                ["Same calendar day 2h gap", "Broken"],
                ["Sleepover predecessor, exactly 8h overnight", "Not broken"],
                ["Sleepover predecessor, 7.5h overnight", "Broken"],
            ],
            sty,
            col_widths=[118 * mm, 50 * mm],
        )
    )

    story.append(Paragraph("6. Related issues from same email", sty["H"]))
    story.append(
        para_table(
            ["Issue", "Status", "Note"],
            [
                [
                    "Vacant upload appends",
                    "Fixed 26 Jun (a53732d)",
                    "Stale rows soft-cancelled; confirm UI hides cancelled",
                ],
                [
                    "48h vs 76h staff",
                    "Still open",
                    "ShiftCare Max fortnightly for Julie = 0 / not enforced; roster defaults 76; pay hard-codes 76",
                ],
            ],
            sty,
            col_widths=[40 * mm, 40 * mm, 88 * mm],
        )
    )

    story.append(Paragraph("7. Rollout checklist", sty["H"]))
    for item in [
        "1. Patch both detection functions + tests (gap-only overnight).",
        "2. Run backend suite; add Julie-Anne fixture from ShiftCare IDs above.",
        "3. Deploy backend.",
        "4. Re-import fortnight timesheet CSV covering 15–21 Jun; recompute pay hours.",
        "5. Confirm exception report flags Julie-Anne 20 Jun shift as broken.",
        "6. Reply to client with before/after on this named case.",
    ]:
        story.append(Paragraph(item, sty["Body"]))

    story.append(Spacer(1, 6))
    story.append(
        callout_box(
            "<b>Warning.</b> Do not only “recompute” without code change — current code will keep "
            "missing overnight shortfalls by design. Existing Mongo may also lack the Jun 19–20 rows "
            "until re-import.",
            sty,
            colors.HexColor("#fffb ea") if False else colors.HexColor("#fffbeb"),
            AMBER,
        )
    )

    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=12, spaceAfter=8))
    story.append(
        Paragraph(
            "Evidence: live ShiftCare session · shifts 148393041 / 148388885 · code paths in "
            "shiftCsvParser.js + payHoursCalculator.js · prior boundary report "
            "scripts/output/broken-shift-boundary-regression-report.md",
            sty["Small"],
        )
    )

    def footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, 10 * mm, "KC AI · Broken-shift overnight miss · Confidential")
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUT)


if __name__ == "__main__":
    build()
