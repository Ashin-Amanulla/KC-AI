# ShiftCare API Support Request - Shifts Endpoint Access

---

**To:** ShiftCare API Support  
**Subject:** API Key Permission Issue - Unable to Access /v3/shifts Endpoint  
**Account ID:** 16916  

---

Dear ShiftCare Support Team,

I am writing to request assistance with our API integration. We are currently experiencing an authorization issue with the **Shifts endpoint** while other endpoints work correctly.

## Issue Summary

| Endpoint | Status | Response |
|----------|--------|----------|
| `/v3/staff` | ✅ Working | Returns data successfully |
| `/v3/clients` | ✅ Working | Returns data successfully |
| `/v3/shifts` | ❌ Failing | Returns `401 Unauthorized` |
| `/v3/timesheets` | ✅ Working | Returns data successfully |

All endpoints use the same API credentials (Account ID: 16916), but only the `/v3/shifts` endpoint returns an unauthorized error.

## Data Requirements

We are building an internal operations dashboard and require access to the Shifts API for the following critical business needs:

### 1. Shift Notes for Assessment
- Access to shift notes and observations recorded by staff
- Documentation attached to shifts for care quality review
- Progress notes and client feedback

### 2. Clock In / Clock Out Data
- Actual start and end times for attendance tracking
- Variance between scheduled vs actual shift times
- GPS/location data if available for compliance

### 3. Timesheet & Reporting
- Shift duration and billable hours
- Break times recorded during shifts
- Approved vs pending shift status

### 4. Operational Automation & Quality Checks
- Real-time shift status monitoring
- Automated compliance reporting
- Shift assignment and staff allocation data
- Service delivery metrics for quality assurance

## Request

Could you please review and update our API key permissions to include **read access to the Shifts endpoint** (`/v3/shifts`)?

This access is essential for our operations team to:
- Monitor service delivery in real-time
- Generate accurate compliance reports
- Automate quality assurance processes
- Improve overall care management efficiency

## Technical Details

```
Account ID: 16916
API Base URL: https://api.shiftcare.com/api
Affected Endpoint: GET /v3/shifts
Error Response: {"error": "Unauthorized"}
HTTP Status: 401
```

Please let us know if you require any additional information or verification to process this request.

Thank you for your assistance.

Kind regards,

---

**[Your Name]**  
**[Your Position]**  
**[Company Name]**  
**[Contact Email]**  
**[Contact Phone]**

---

*This request was generated on: 13 January 2026*
