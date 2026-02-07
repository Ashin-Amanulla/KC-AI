# ShiftCare API Support Request - Progress Notes & Events Data Access

---

**To:** ShiftCare API Support  
**Subject:** Request for Progress Notes / Events Detail Report API Endpoint Access  
**Account ID:** 16916  
**Date:** 13 January 2026

---

Dear ShiftCare Support Team,

We are writing to request API access to **Progress Notes and Events Detail data** that is currently only available through manual CSV export from the ShiftCare application.

## Current Situation

We currently have API access to:

- ✅ `/v3/staff` - Working
- ✅ `/v3/clients` - Working
- ✅ `/v3/timesheets` - Working
- ⚠️ `/v3/shifts` - Returns 401 Unauthorized (separate request submitted)
- ❌ **Progress Notes / Events Detail** - Not available via API (manual CSV export only)

## Business Need

We are building an automated operations dashboard that analyzes shift notes for:

1. **Exception Detection**: Early leave, overtime, staff changes
2. **Incident Tracking**: Behaviour alerts, medication concerns, incidents
3. **Special Requests**: Client/family requests, dietary needs, preferences
4. **Night Stay Tracking**: Sleepover shifts, overnight care patterns
5. **Expense Management**: Expense claims and reimbursement tracking
6. **Quality Assurance**: Lazy notes detection, compliance monitoring

Currently, we must manually export CSV reports from the ShiftCare app, which is:

- Time-consuming and error-prone
- Not scalable for real-time monitoring
- Prevents automated quality checks
- Limits our ability to provide timely insights

## Data Format Required

Based on our manual CSV exports (EventsDetail Report), we need access to:

| Field        | Description                | Example                                                                            |
| ------------ | -------------------------- | ---------------------------------------------------------------------------------- |
| `Client`     | Client name                | "Danny Barsby"                                                                     |
| `Created at` | Note creation date         | "13-01-2026"                                                                       |
| `Category`   | Note type                  | "Notes" or "Incident"                                                              |
| `Summary`    | Brief summary              | "Staff added Note for Client @ 12/01/2026 10:00 pm - 06:00 am"                     |
| `Message`    | Full progress note content | Detailed shift notes with sections for Behaviour, Personal Care, Medications, etc. |

## Requested Endpoint

We request access to one of the following:

**Option 1:** New endpoint for progress notes

```
GET /v3/shifts/{shift_id}/notes
GET /v3/events
GET /v3/progress_notes
```

**Option 2:** Include notes in existing shifts endpoint

```
GET /v3/shifts?include_notes=true
```

**Option 3:** Bulk export endpoint (if real-time API not available)

```
GET /v3/reports/events_detail?from_date={date}&to_date={date}
```

## Use Cases

### 1. Real-Time Exception Monitoring

- Detect early leave/overtime immediately after shift completion
- Alert management to staff changes or incidents
- Track medication concerns in real-time

### 2. Automated Quality Assurance

- Flag incomplete or low-effort notes
- Identify patterns in behaviour incidents
- Monitor compliance with documentation standards

### 3. Client Care Analytics

- Track special requests and preferences
- Analyze night stay patterns
- Monitor expense trends

### 4. Compliance Reporting

- Generate automated reports for audits
- Track incident frequency and severity
- Monitor staff documentation quality

## Technical Requirements

**Authentication:** Basic Auth (Account ID + API Key) - same as existing endpoints  
**Response Format:** JSON preferred, CSV acceptable  
**Rate Limits:** Please specify any rate limits for this endpoint  
**Pagination:** Required for bulk data retrieval  
**Date Filtering:** Filter by shift date or note creation date

## Proposed Data Schema

```json
{
  "id": "string",
  "shift_id": "string",
  "client_id": "string",
  "client_name": "string",
  "staff_id": "string",
  "staff_name": "string",
  "created_at": "ISO8601 datetime",
  "category": "Notes|Incident",
  "summary": "string",
  "message": "string (full progress note content)",
  "shift_start": "ISO8601 datetime",
  "shift_end": "ISO8601 datetime"
}
```

## Alternative Solutions

If a dedicated API endpoint is not available, we would appreciate:

1. **Webhook Support**: Push notifications when notes are created
2. **Scheduled Exports**: Automated daily CSV exports to a configured endpoint
3. **API Documentation**: Clarification on whether this data exists in an undocumented endpoint

## Impact Assessment

**Without API Access:**

- Manual CSV export required daily (15-30 minutes)
- No real-time monitoring capabilities
- Delayed exception detection (24+ hours)
- Limited scalability for multiple clients

**With API Access:**

- Automated real-time monitoring
- Immediate exception alerts
- Scalable to hundreds of clients
- Enhanced quality assurance capabilities

## Technical Details

```
Account ID: 16916
API Base URL: https://api.shiftcare.com/api
Current API Version: v3
Authentication Method: Basic Auth
Existing Working Endpoints: /v3/staff, /v3/clients, /v3/timesheets
```

## Questions

1. Does a progress notes/events API endpoint currently exist?
2. If not, is this feature planned for a future API release?
3. Are there any workarounds or alternative methods to access this data programmatically?
4. What is the recommended approach for bulk data export if real-time API is not available?

## Next Steps

We are happy to:

- Participate in beta testing if this feature is in development
- Provide feedback on API design if you're planning this endpoint
- Work with your team to find an interim solution

Please let us know if you require any additional information or clarification.

Thank you for your assistance.

---

**Contact Information:**

**[Your Name]**  
**[Your Position]**  
**[Company Name]**  
**[Contact Email]**  
**[Contact Phone]**

---

_This request was generated on: 13 January 2026_  
_Related Request: ShiftCare API Support Request - Shifts Endpoint Access_
