# Client Discussion — LMS & Video Generation System

**Date:** 29 June 2026  
**Topic:** Learning Management System (LMS) and automated video generation for staff training  
**Project:** KCAI Platform (future module)  
**Status:** Requirements captured; integration approach pending decision  

---

## Attendees

| Role | Name / Team |
|------|-------------|
| Client | *(to be confirmed)* |
| Delivery / Product | *(to be confirmed)* |

---

## Purpose

Review the client’s need for a **staff training and compliance LMS** within the KCAI ecosystem, and agree on a direction for **video content production** — specifically how training modules could be created at scale without relying entirely on manual video editing.

---

## Background

The client operates in the NDIS / disability support sector where staff must complete recurring training (induction, mandatory compliance, policy updates, and role-specific modules). Current training delivery is largely manual or external. The client wants:

- A central place to assign, track, and audit staff completion of training.
- Faster turnaround when policies or procedures change.
- Branded, consistent training videos rather than ad-hoc recordings.

This discussion scoped a **new LMS module** and an associated **hybrid video generation pipeline** — separate from the payroll, roster, and CRM work delivered in June, but flagged as **high priority** to begin soon.

---

## Discussion Summary

### 1. LMS scope — staff training & compliance

**Agreed:** Primary audience is **internal staff**, not participants/clients.

The LMS should support:

- **Induction** — onboarding modules for new hires.
- **Mandatory / compliance training** — NDIS-related and organisational policy requirements.
- **Role-based assignments** — different modules per role (e.g. support worker vs coordinator).
- **Completion tracking & audit trail** — who completed what, when, and any re-certification deadlines.
- **Administration** — ability for HR/training leads to assign courses, set due dates, and run completion reports.

Participant-facing education was **not** in scope for this phase.

### 2. Video generation — hybrid approach

**Agreed:** A **hybrid model** combining AI-assisted content creation with templated, branded video output.

| Layer | Description |
|-------|-------------|
| **AI script generation** | Draft module scripts, summaries, and quiz questions from source material (policies, SOPs, slide outlines). Human review before publish. |
| **Templated branded videos** | Programmatic video assembly (e.g. slide/scene templates, logo, colours, captions) with voiceover — consistent look across all modules. |
| **Manual override** | Option to upload existing videos or replace generated segments where quality or sensitivity requires it. |

**Rationale discussed:**

- Pure AI avatar / text-to-video alone may not meet brand or compliance standards for all content.
- Pure manual production does not scale when policies change frequently.
- Hybrid keeps humans in the loop for accuracy while reducing production time.

**Not in scope for initial discussion:** specific vendor selection (e.g. ElevenLabs, HeyGen, Remotion, etc.) — to be evaluated during technical design.

### 3. Integration with KCAI — undecided

**Status:** No final decision on how the LMS connects to the existing platform.

Options raised:

| Option | Pros | Cons |
|--------|------|------|
| **Embedded in KCAI** (shared auth, permissions, nav) | Single sign-on; unified staff records; completion visible alongside HR/roster data | Larger build; tied to KCAI release cycle |
| **Standalone system, linked from KCAI** | Faster to pilot; can swap LMS vendor later | Duplicate user management; weaker audit integration |
| **Third-party LMS** (Moodle, TalentLMS, etc.) with API sync | Mature feature set out of the box | Ongoing licence cost; limited customisation; sync complexity |

**Next step:** Client and delivery team to compare embedded vs third-party after a short technical spike (see Action Items).

### 4. Priority & timeline — urgent

**Agreed:** Treat LMS + video generation as **high priority** — **start soon**, not deferred to a later phase after payroll/roster work.

Implications noted:

- Parallel track recommended: core KCAI maintenance continues while LMS discovery and pilot planning begin.
- A **pilot module** (one mandatory training course end-to-end) was suggested as the first deliverable to validate the hybrid video pipeline before full LMS build.

---

## Client requirements (consolidated)

1. Staff-only LMS for induction and mandatory compliance training.  
2. Role-based course assignment and completion reporting.  
3. Hybrid video pipeline: AI-assisted scripts + templated branded output + manual upload fallback.  
4. Audit-friendly completion records (who, what, when, expiry if applicable).  
5. Urgent start — pilot before full platform commitment.  

---

## Open questions

- [ ] Embedded in KCAI vs standalone vs third-party LMS?  
- [ ] Which staff roles map to which mandatory modules at launch?  
- [ ] Voiceover: synthetic TTS vs recorded human voice vs both?  
- [ ] Hosting / storage for video assets (S3, CDN, size limits)?  
- [ ] Integration with existing HR Requirements page / CRM staffing data?  
- [ ] Budget for third-party AI/video API usage per module?  

---

## Action items

| # | Action | Owner | Target |
|---|--------|-------|--------|
| 1 | Document LMS functional requirements (modules, roles, reporting) | Delivery | TBD |
| 2 | Technical spike: embedded vs third-party LMS (1–2 page comparison) | Delivery | TBD |
| 3 | Pilot scope: select one mandatory training module for hybrid video proof-of-concept | Client + Delivery | TBD |
| 4 | Evaluate templated video stack (e.g. Remotion / similar) for branded output | Delivery | TBD |
| 5 | Confirm attendee names and sign-off on this summary | Client | TBD |

---

## Decisions log

| Date | Decision |
|------|----------|
| 2026-06-29 | LMS primary scope = **staff training & compliance** (not participant-facing). |
| 2026-06-29 | Video approach = **hybrid** (AI scripts + templated branded videos + manual upload). |
| 2026-06-29 | Priority = **urgent** — begin planning/pilot without waiting for other modules to finish. |
| 2026-06-29 | KCAI integration model = **undecided** — spike required. |

---

## Next meeting / follow-up

- Review technical spike results (integration options).  
- Confirm pilot module selection and success criteria.  
- Agree Phase 1 delivery timeline and resourcing.  

---

*Document created: 3 July 2026. Based on client discussion held 29 June 2026. Update attendee names and action-item dates when confirmed.*
