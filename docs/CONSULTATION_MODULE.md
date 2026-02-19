# CRM Consultation Module Documentation

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Component Guide](#component-guide)
5. [API Reference](#api-reference)
6. [Database Schema](#database-schema)
7. [Workflow & User Journey](#workflow--user-journey)
8. [Developer Guide](#developer-guide)
9. [Validation Rules](#validation-rules)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Consultation Module is a complete CRM (Customer Relationship Management) system for tracking customer consultations in a healthcare or clinic environment. It's designed to help frontdesk staff, nurses, and managers efficiently manage customer interactions, track consultation status, schedule follow-ups, and analyze business metrics.

### Key Capabilities

- **Track Consultation Timeline**: Record all customer interactions with timestamps and activity details
- **Quick Actions**: Fast operations like phone calls, messages, status updates, and tracking date scheduling
- **Executive Dashboard**: Real-time metrics including consultations, conversion rates, response times, and risk indicators
- **Mobile-First Design**: Fully responsive interface optimized for all device sizes (phones, tablets, desktops)
- **Chinese UX**: All labels, error messages, and instructions in Traditional Chinese (zh-TW)
- **Activity JSON Storage**: All consultation activities are stored as JSON in the R_Request.Description field

### Who Uses This

- **Frontdesk Staff**: Create consultations, add quick notes, handle customer inquiries
- **Nurses/Doctors**: View consultation history, add activities, update status
- **Managers/Administrators**: View dashboard, analyze metrics, identify at-risk customers
- **Supervisors**: Monitor team performance, track lost customers, manage SLAs

---

## Features

### 1. Activity Timeline

The consultation timeline is a JSON-based activity history stored in the `R_Request.Description` field.

**Activity JSON Structure:**
```json
[
  {
    "timestamp": "2026-02-19T14:30:00Z",
    "type": "活動",
    "actionType": "來電",
    "content": "客戶詢問產品資訊",
    "createdBy": "12345"
  },
  {
    "timestamp": "2026-02-19T14:45:00Z",
    "type": "狀態改變",
    "actionType": "預約追蹤",
    "content": "預約追蹤: 下週二下午3點回電",
    "createdBy": "12345"
  }
]
```

**Activity Type Categories:**
- `活動`: Regular activity/interaction
- `狀態改變`: Status change event
- `建立`: Initial consultation creation

**Activity Types (actionType):**
- `來電`: Incoming phone call
- `發送訊息`: Message sent
- `狀態改變`: Status changed
- `預約追蹤`: Follow-up scheduled

**Key Properties:**
- `timestamp`: ISO format datetime (local time, stored with Z suffix per iDempiere convention)
- `type`: Activity category
- `actionType`: Specific action taken
- `content`: Activity description (max 500 characters)
- `createdBy`: User ID who created the activity

### 2. Quick Action Bar

The sticky bottom action bar provides rapid access to common operations:

**Phone Call** - Log an incoming or outgoing phone call
- Records activity with timestamp
- Marks interaction with type "來電"
- Updates Last Activity timestamp

**Send Message** - Log a message interaction
- Creates activity record
- Records message type interaction
- Updates consultation timestamp

**Status Update** - Change consultation status
- Modal dialog with available status options
- Updates R_Request.R_Status_ID
- Records status change in activity timeline

**Set Tracking Date** - Schedule follow-up date/time
- Modal with date picker (0-90 days from today)
- Time picker (08:00-19:59 business hours)
- Optional description field (max 200 characters)
- Creates automatic tracking activity
- Stores tracking data in activity timeline

### 3. Consultation Dashboard

Executive-level metrics and analytics dashboard.

**Metrics Displayed:**
- **Consultations This Month**: Count of consultations created in current calendar month
- **Conversion Rate**: Percentage of completed consultations vs. total
- **Avg Response Time**: Average hours from consultation creation to first activity
- **Pending Consultations**: Count of consultations not yet marked complete
- **Silent Consultations**: Consultations in "等待回應" (Waiting for Response) status with no activity >7 days
- **Lost Customers**: Customers with no consultation activity in 90+ days

**Risk Indicators:**
- Silent consultations (red): 7+ days without activity in "等待回應" status
- Pending (yellow): Consultations waiting for action
- Lost customers (red): No activity for 90+ days

**Customer Rankings:**
- Top 10 customers by consultation count
- Shows customer name and total consultations
- Helps identify key account relationships and engagement patterns

### 4. Form Fields

The consultation form includes standard fields from the R_Request table:

**Core Fields:**
- `DocumentNo`: Unique consultation reference number (read-only)
- `R_RequestType_ID`: Type of consultation (e.g., Sales Inquiry, Support, etc.)
- `C_BPartner_ID`: Customer/client being consulted
- `R_Status_ID`: Current status (Waiting for Response, In Progress, Completed, etc.)
- `R_Category_ID`: Consultation category/topic
- `Priority`: Priority level (Low, Medium, High, Urgent)
- `Description`: Activity timeline in JSON format (hidden from form, shown in RequestTimeline component)
- `Confidential`: Whether consultation details are confidential
- `DateStart`: When the consultation was created
- `DateNextAction`: Next action due date

**System Fields (Hidden):**
- `DocumentStatus`: Workflow state (Draft, In Progress, Completed)
- `Created`, `CreatedBy`: System audit fields
- `Updated`, `UpdatedBy`: System audit fields

---

## Architecture

### Data Flow Diagram

```
User Interface Layer
    ↓
Request List View (RequestListView.vue)
    ├─ Fetches R_Request list via API
    ├─ Filters by criteria
    └─ Shows consultation table

Request Form View (RequestFormView.vue)
    ├─ Load mode: Fetches existing consultation record
    ├─ Create mode: Initializes new record with defaults
    ├─ DynamicForm renders fields from AD metadata
    ├─ RequestTimeline displays activity JSON
    └─ QuickActionBar provides quick operations

Activity Input Modal
    ├─ ActivityInputModal (add phone/message)
    └─ Saves activity to Description field via parseActivities/stringifyActivities

Status Update Modal
    ├─ StatusUpdateModal
    ├─ Fetches available statuses from R_Status table
    └─ Updates R_Request.R_Status_ID via API

Tracking Date Modal
    ├─ TrackingDateModal
    ├─ Validates date (0-90 days from today)
    ├─ Validates time (08:00-19:59)
    └─ Adds tracking activity to Description field

Dashboard View (ConsultationDashboardView.vue)
    ├─ Fetches all R_Request records (no filter)
    ├─ Calls calculateStats() for metrics
    ├─ Displays business metrics + risk indicators
    └─ Shows customer rankings
```

### Component Hierarchy

```
ConsultationDashboardView.vue
├─ ConsultationDashboard.vue (component)
├─ MetricsCard (subcomponent)
├─ RiskIndicators (subcomponent)
└─ CustomerRankings (subcomponent)

RequestListView.vue
├─ Consultation table with search/sort
├─ Create button
└─ Row click → navigate to RequestFormView

RequestFormView.vue
├─ DynamicForm.vue (field rendering)
│  ├─ DynamicField.vue (per-field component)
│  │  └─ SearchSelector.vue (FK picker)
│  └─ FormErrorAlert.vue (validation errors)
├─ RequestTimeline.vue (activity display)
├─ QuickActionBar.vue (sticky bottom)
│  ├─ ActivityInputModal.vue (phone/message)
│  ├─ StatusUpdateModal.vue (status change)
│  └─ TrackingDateModal.vue (scheduling)
└─ Attachment section (file upload)
```

### State Management

**Pinia Stores:**
- `useAuthStore`: User context, token, organization, warehouse
- No dedicated Consultation store (uses local component state + API calls)

**Local Component State:**
- `formData`: Current form values (two-way bound to DynamicForm)
- `activities`: Parsed from Description field as Activity[] array
- Modal visibility flags: `showStatusModal`, `showTrackingModal`, `showActivityModal`
- Loading states: `pageLoading`, `submitting`, `uploading`

**API Calls:**
- GET `/api/v1/models/R_Request`: List consultations
- GET `/api/v1/models/R_Request/{id}`: Load single consultation
- PUT `/api/v1/models/R_Request/{id}`: Update consultation
- GET `/api/v1/models/R_Status`: Fetch available statuses
- GET `/api/v1/models/R_RequestType`: Fetch consultation types

### Activity Timeline Format

Activities are stored as JSON array in `R_Request.Description` field. Max ~10KB storage allows ~50 activities per consultation.

**Parsing & Stringifying:**
```typescript
import {
  parseActivities,     // JSON string → Activity[]
  stringifyActivities, // Activity[] → JSON string
  addActivity,         // Add new activity to existing JSON
  getLastActivityTime, // Get timestamp of most recent activity
} from '@/utils/requestActivity'
```

**Adding Activity Example:**
```typescript
const newJson = addActivity(
  formData.Description || '[]',
  {
    type: '活動',
    actionType: '來電',
    content: '客戶來電詢問',
    createdBy: auth.user?.id || '0',
  }
)
// newJson now contains updated JSON string with new activity
```

---

## Component Guide

### RequestFormView.vue

Main consultation form view - create and edit consultations.

**Props:** None (uses route params)

**Key Methods:**
- `handleSubmit()`: Save form via POST/PUT API
- `handleAddActivity()`: Called from QuickActionBar when adding phone/message
- `handleUpdateStatus()`: Called from StatusUpdateModal
- `handleSetTracking()`: Called from TrackingDateModal
- `goBack()`: Navigate back to list view

**Mobile Considerations:**
- QuickActionBar is sticky/fixed at bottom (mobile UX priority)
- Form fields stack vertically on small screens
- Modal dialogs take full viewport on mobile

**Error Handling:**
- Form-level errors displayed above submit button
- Field-level errors shown in FormErrorAlert
- API errors caught and displayed as user-friendly messages

### RequestTimeline.vue

Displays activity timeline from JSON.

**Props:**
```typescript
props = {
  activities: string  // JSON string from R_Request.Description
}
```

**Features:**
- Parses JSON activities array
- Sorts by timestamp (newest first or oldest first, configurable)
- Shows activity card for each entry
- Color-codes by activity type
- Shows user who created activity
- Handles empty state gracefully

### QuickActionBar.vue

Sticky bottom action bar for rapid operations.

**Props:**
```typescript
props = {
  requestId: number         // R_Request.R_Request_ID
  currentStatus: string     // Display name of current status
  disabled: boolean         // Disable all actions when true
}
```

**Events:**
- `@add-activity`: User clicked phone/message button
- `@update-status`: User selected new status
- `@set-tracking`: User scheduled follow-up

**Features:**
- Sticky positioned at bottom (mobile-first)
- Buttons for Phone, Message, Status, Tracking
- Disabled state when form is submitting
- Icon-based buttons (compact mobile layout)

### ActivityInputModal.vue

Modal for logging phone calls or messages.

**Props:**
```typescript
props = {
  requestId: number   // Which consultation to add activity to
  type: 'phone'|'message'  // Type of activity
}
```

**Features:**
- Text input for activity description (max 500 chars)
- Character counter display
- Real-time validation
- Error messages if validation fails
- Timestamp automatically set to current time
- User ID automatically set from authStore

### StatusUpdateModal.vue

Modal for changing consultation status.

**Props:**
```typescript
props = {
  requestId: number       // Which consultation
  currentStatusId: string // Current R_Status_ID
  statuses: Array        // Available status options from AD
}
```

**Features:**
- Dropdown list of available statuses
- Shows current status (highlighted)
- Validates that new status differs from current
- Confirmation before save
- Handles API errors with user-friendly messages

### TrackingDateModal.vue

Modal for scheduling follow-up date/time.

**Props:**
```typescript
props = {
  requestId: number  // Which consultation to schedule
}
```

**Validation Rules:**
- Date: 0-90 days from today (no past dates)
- Time: 08:00-19:59 (business hours)
- Description: Optional, max 200 characters

**Features:**
- Date picker (HTML5 `<input type="date">`)
- Time picker (HTML5 `<input type="time">`)
- Optional description field
- Real-time validation with error display
- Prevents submission if validation fails

### ConsultationDashboard.vue

Executive dashboard showing metrics and analytics.

**Props:** None

**Features:**
- Metrics cards: consultations, conversion, response time, pending, silent, lost
- Status distribution pie/bar chart
- Top 10 customers ranking
- Risk indicators with color coding
- Auto-refresh on component mount
- Responsive grid layout for all screen sizes

### FormErrorAlert.vue

Displays form-level validation errors.

**Props:**
```typescript
props = {
  errors: string[]      // Array of error messages
  visible: boolean      // Show/hide alert
}
```

**Features:**
- Dismissible alert banner
- Lists all validation errors
- Color-coded for urgency
- Smooth fade in/out animation

---

## API Reference

### GET /api/v1/models/R_Request

Fetch consultation list with optional filtering.

**Parameters:**
```
$filter=C_BPartner_ID/id eq 100004      // Filter by customer
$filter=R_Status_ID/id eq '等待回應'     // Filter by status
$filter=Created ge 2026-02-01T00:00:00Z // Filter by date range
$orderby=Created desc                    // Sort (descending = newest first)
$top=50                                  // Pagination
$skip=0
```

**Response:**
```json
{
  "@odata.context": "...",
  "value": [
    {
      "R_Request_ID": 100001,
      "DocumentNo": "RQ-001",
      "C_BPartner_ID": {
        "id": 100004,
        "identifier": "John Smith"
      },
      "R_Status_ID": {
        "id": "等待回應",
        "identifier": "Waiting for Response"
      },
      "R_RequestType_ID": { ... },
      "Description": "[{...}]",  // JSON array of activities
      "Created": "2026-02-19T08:00:00Z",
      "DateStart": "2026-02-19T08:00:00Z",
      "DateNextAction": "2026-02-26T00:00:00Z",
      "Priority": "High",
      "Confidential": false,
      "DocumentStatus": "Completed"
    }
  ]
}
```

### GET /api/v1/models/R_Request/{id}

Fetch single consultation record.

**Response:** Same as list, but single object instead of array.

### PUT /api/v1/models/R_Request/{id}

Update consultation record.

**Request Body:**
```json
{
  "R_Status_ID": "已完成",
  "Description": "[{...}]",  // Updated activities JSON
  "DateNextAction": "2026-03-01T00:00:00Z"
}
```

**Response:** Updated record object.

### GET /api/v1/models/R_Status

Fetch all available consultation statuses.

**Response:**
```json
{
  "value": [
    {
      "R_Status_ID": "待處理",
      "Name": "待處理",
      "Value": "待處理"
    },
    {
      "R_Status_ID": "等待回應",
      "Name": "等待回應",
      "Value": "等待回應"
    },
    {
      "R_Status_ID": "已完成",
      "Name": "已完成",
      "Value": "已完成"
    }
  ]
}
```

### GET /api/v1/models/R_RequestType

Fetch consultation types.

**Response:**
```json
{
  "value": [
    {
      "R_RequestType_ID": 50001,
      "Name": "Sales Inquiry"
    },
    {
      "R_RequestType_ID": 50002,
      "Name": "Support Request"
    }
  ]
}
```

---

## Database Schema

### R_Request Table

Main consultation record.

| Column | Type | PK | FK | Description |
|--------|------|----|----|-------------|
| `R_Request_ID` | Integer | Y | | Unique consultation ID |
| `R_RequestType_ID` | Integer | | Y | Type of consultation |
| `C_BPartner_ID` | Integer | | Y | Customer/client |
| `R_Status_ID` | String | | Y | Current status |
| `R_Category_ID` | Integer | | Y | Consultation category |
| `Priority` | String | | | Priority level (Low/Medium/High/Urgent) |
| `Description` | Text | | | **Activity timeline (JSON format)** |
| `Confidential` | Boolean | | | Is confidential |
| `DateStart` | DateTime | | | When consultation created |
| `DateNextAction` | DateTime | | | Next action due date |
| `DocumentStatus` | String | | | Workflow state (Draft/In Progress/Completed) |
| `DocumentNo` | String | | | Reference number |
| `Created` | DateTime | | | System audit - creation time |
| `CreatedBy` | Integer | | Y | System audit - created by user |
| `Updated` | DateTime | | | System audit - last update time |
| `UpdatedBy` | Integer | | Y | System audit - updated by user |

### R_Status Table

Status reference data.

| Column | Type | Description |
|--------|------|-------------|
| `R_Status_ID` | String | Status code (待處理, 等待回應, 已完成, etc.) |
| `Name` | String | Display name |
| `Value` | String | Value (same as ID) |

### R_RequestType Table

Consultation type reference data.

| Column | Type | Description |
|--------|------|-------------|
| `R_RequestType_ID` | Integer | Type ID |
| `Name` | String | Display name |

---

## Workflow & User Journey

### Create Consultation (Frontdesk)

1. Click "新增諮詢" button
2. Select consultation type (R_RequestType_ID)
3. Select customer (C_BPartner_ID)
4. Fill in priority, category, etc.
5. Click "儲存"
6. Form saved as Draft
7. New R_Request_ID assigned
8. Ready for frontdesk to add activities

### First Activity - Phone Call

1. User clicks "來電" in QuickActionBar
2. ActivityInputModal opens
3. User enters what was discussed
4. Clicks "新增"
5. Activity added to Description JSON
6. R_Request.Updated updated
7. Timestamp recorded automatically

### Status Change - Waiting Response

1. User clicks "改變狀態"
2. StatusUpdateModal shows available statuses
3. User selects "等待回應"
4. Modal validates (must differ from current)
5. API call updates R_Request.R_Status_ID
6. Activity automatically logged: "狀態改變: 改為等待回應"
7. Form refreshes with new status

### Schedule Follow-up

1. User clicks "預約追蹤"
2. TrackingDateModal opens
3. User selects date (within 0-90 days)
4. User selects time (within 08:00-19:59)
5. User enters optional description
6. Clicks "確認"
7. Validation runs:
   - Date not past
   - Date not >90 days future
   - Time within business hours
8. If valid, activity added:
   - Type: "狀態改變"
   - ActionType: "預約追蹤"
   - Content: "預約追蹤: {description}"
9. DateNextAction updated on R_Request
10. Form saved automatically

### Complete Consultation

1. User reviews consultation record
2. Clicks "改變狀態"
3. Selects "已完成"
4. R_Status_ID updated to "已完成"
5. DocumentStatus remains Completed
6. Consultation closed

### View Dashboard (Manager)

1. Click "諮詢儀表板" button
2. Page loads all R_Request records
3. calculateStats() runs:
   - Filters records created in last 90 days
   - Calculates metrics
   - Identifies silent consultations (>7 days, "等待回應" status)
   - Identifies lost customers (>90 days since any activity)
4. Dashboard displays:
   - Metrics cards
   - Risk indicators
   - Customer rankings
5. Manager can drill down to specific consultation

---

## Developer Guide

### Setting Up Local Development

```bash
cd /home/tom/idempiere-module-ui/webapp
npm install
npm run dev                # Start dev server at http://localhost:5173
npm run test              # Run tests
npm run test:watch       # Watch mode for TDD
npm run type-check       # TypeScript validation
npm run lint             # Code style check
```

### Adding New Quick Action

**File: `src/components/QuickActionBar.vue`**

1. Add new button with icon
2. Add event emission: `emit('action-name')`
3. In RequestFormView, add handler: `@action-name="handleActionName"`
4. Handler updates form, adds activity, or opens modal

**Example:**

```vue
<button @click="emit('email-sent')">
  <EmailIcon />
  發送郵件
</button>
```

### Adding New Validation Rule

**File: `src/utils/validation.ts`**

1. Create validation function:
```typescript
export function validateNewField(value: string): ValidationResult {
  const errors: Record<string, string> = {}
  if (!value) errors.field = '此欄位為必填'
  return { isValid: Object.keys(errors).length === 0, errors }
}
```

2. Use in component:
```typescript
const result = validateNewField(formData.field)
if (!result.isValid) {
  formErrors.value = result.errors
}
```

### Adding New Dashboard Metric

**File: `src/utils/dashboardStats.ts`**

1. Update `RequestStats` interface:
```typescript
export interface RequestStats {
  // ... existing fields
  newMetric: number
}
```

2. Add calculation in `calculateStats()`:
```typescript
export function calculateStats(requests: any[], daysBefore: number = 90): RequestStats {
  // ... existing code

  const newMetric = requests.filter(r => /* logic */).length

  return {
    // ... existing fields
    newMetric,
  }
}
```

3. Display in ConsultationDashboard:
```vue
<MetricsCard label="新指標" :value="stats.newMetric" icon="icon-name" />
```

### Writing Tests

Consultation module tests are in `src/**/__tests__/` directories.

**Example test file: `src/utils/__tests__/validation.spec.ts`**

```typescript
import { validateActivityContent } from '@/utils/validation'

describe('validation', () => {
  it('should reject empty content', () => {
    const result = validateActivityContent('')
    expect(result.isValid).toBe(false)
    expect(result.errors.content).toBe('請輸入活動內容')
  })
})
```

**Run tests:**
```bash
npm run test                  # Run all tests once
npm run test:watch          # Watch mode
npm run test src/...test.ts # Specific test file
```

### Key Utilities

**requestActivity.ts:**
- `parseActivities(json)`: Convert JSON string to Activity[]
- `stringifyActivities(activities)`: Convert Activity[] to JSON string
- `addActivity(json, activity)`: Add activity to existing JSON
- `getLastActivityTime(json)`: Get timestamp of last activity
- `getActivitiesByType(json, type)`: Filter activities by type

**dashboardStats.ts:**
- `calculateStats(requests, daysBefore)`: Calculate all metrics
- `calculateConversionRate(requests)`: Completion percentage
- `calculateAvgResponseTime(requests)`: Hours to first activity

**validation.ts:**
- `validateActivityContent(content)`: Check activity text
- `validateTrackingDate(date)`: Check date is valid (0-90 days)
- `validateTrackingTime(time)`: Check time in business hours
- `validateTrackingForm(data)`: Combined validation

---

## Validation Rules

### Activity Content

| Rule | Value | Error Message |
|------|-------|---------------|
| Required | Yes | "請輸入活動內容" |
| Max Length | 500 chars | "活動內容不能超過500字" |
| Empty string allowed | No | Must have content |
| Whitespace stripped | Yes | Trimmed before validation |

### Tracking Date

| Rule | Value | Error Message |
|------|-------|---------------|
| Required | Yes | "請選擇日期" |
| Min Date | Today (0 days) | "日期不能是過去的日期" |
| Max Date | 90 days from today | "日期不能超過90天後" |
| Format | YYYY-MM-DD | (HTML5 enforces) |

### Tracking Time

| Rule | Value | Error Message |
|------|-------|---------------|
| Required | Yes | "請選擇時間" |
| Business Hours Start | 08:00 | "時間必須在08:00-20:00之間" |
| Business Hours End | 19:59 (before 20:00) | Same |
| Format | HH:MM (24-hour) | "時間格式無效" |

### Tracking Description

| Rule | Value | Error Message |
|------|-------|---------------|
| Required | No (optional) | N/A |
| Max Length | 200 chars | "追蹤說明不能超過200字" |

---

## Troubleshooting

### Issue: "Please fill in required fields" error appears

**Cause:** Form validation failed on fields from AD metadata.

**Solution:**
1. Check which fields are marked as mandatory in AD_Column (MandatoryFieldCheck)
2. Verify all mandatory fields have values before submit
3. Look at mandatoryErrors array in console to see which fields need values
4. Note: Some FK fields show #ID instead of name if lookups fail

### Issue: Activity timeline shows "[object Object]" or parse error

**Cause:** Description field is not valid JSON or contains malformed data.

**Solution:**
1. Check R_Request.Description in database directly
2. Verify it's valid JSON array format
3. If corrupted, delete activities and start fresh
4. Check logs for "Failed to parse activities" warnings

### Issue: Tracking date modal says "Date cannot be in the past"

**Cause:** Selected date is before today (in user's timezone).

**Solution:**
1. Verify device date/time is correct
2. Select a date that is today or later
3. Remember: 0-90 days forward only (no past dates)
4. Check browser console for timezone issues

### Issue: Time picker shows error "Time must be between 08:00-20:00"

**Cause:** Selected time is outside business hours.

**Solution:**
1. Select time between 08:00 and 19:59
2. Note: 20:00 and later are not allowed
3. Business hours are 8 AM to 8 PM (before 20:00)

### Issue: Dashboard shows blank metrics or "NaN"

**Cause:** API call failed or data is malformed.

**Solution:**
1. Open browser DevTools → Network tab
2. Check if API calls to /api/v1/models/R_Request succeeded
3. Verify response contains valid data
4. Check browser console for calculation errors
5. Try refreshing dashboard page

### Issue: Quick Action Bar doesn't appear on mobile

**Cause:** Browser cache or viewport issue.

**Solution:**
1. Hard refresh: Ctrl+Shift+R (Chrome) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Check device orientation (landscape may hide bottom bar)
4. Verify screen size >320px width (minimum mobile width)

### Issue: Status update doesn't save

**Cause:** Status chosen is same as current status.

**Solution:**
1. Modal validates new status differs from current
2. Select a different status from dropdown
3. Verify you have permission to change status
4. Check network tab for API errors

### Issue: Character counter shows incorrect count

**Cause:** Multi-byte UTF-8 characters counted differently.

**Solution:**
1. The counter counts JavaScript string length (characters, not bytes)
2. Some Chinese characters may count as 1 even if multiple bytes
3. This is correct behavior for display purposes
4. Validation uses same counting method

### Issue: Form fields show "0" or "false" instead of proper value

**Cause:** JavaScript falsy value check using `!value` instead of `=== null`.

**Solution:**
1. This is a known issue with numeric 0 values
2. Form should treat 0 as valid
3. Check if component uses strict equality (`===`) checks
4. Numeric fields should allow 0 as valid input

### Issue: Can't create consultation - "Customer is required"

**Cause:** C_BPartner_ID is mandatory but not filled.

**Solution:**
1. Click on C_BPartner_ID field
2. SearchSelector opens - search for customer name
3. If no customers exist, create in Customer module first
4. Select customer from dropdown
5. Then save consultation

### Issue: Activities not showing in timeline

**Cause:** Description field is null or empty array.

**Solution:**
1. Add at least one activity via QuickActionBar
2. Click "來電" or "發送訊息" button
3. Enter activity description
4. Click "新增"
5. Timeline should refresh with new activity

---

## Support & Contact

For issues, feature requests, or questions:

1. Check this troubleshooting section first
2. Review test files for usage examples
3. Check browser console for error messages
4. Contact: [Internal Support Channel]

---

## Release History

### v1.0.0 (2026-02-19)

Initial release with:
- Activity timeline with JSON storage
- Quick action bar (phone, message, status, tracking)
- Consultation dashboard with metrics
- Full mobile responsiveness
- 355 tests with 100% pass rate

---

## Appendix: File Structure

```
webapp/src/
├── views/consultation/
│   ├── RequestListView.vue          # Consultation list page
│   ├── RequestFormView.vue          # Consultation form (create/edit)
│   ├── ConsultationDashboardView.vue # Dashboard page
│   └── __tests__/
│       └── RequestFormView.spec.ts  # Form tests
├── components/
│   ├── RequestTimeline.vue          # Activity timeline display
│   ├── QuickActionBar.vue           # Bottom action buttons
│   ├── ActivityInputModal.vue       # Phone/message input
│   ├── StatusUpdateModal.vue        # Status picker modal
│   ├── TrackingDateModal.vue        # Date/time scheduling
│   ├── ConsultationDashboard.vue    # Dashboard component
│   ├── FormErrorAlert.vue           # Error banner
│   └── __tests__/
│       ├── RequestTimeline.spec.ts
│       ├── QuickActionBar.spec.ts
│       ├── ConsultationDashboard.spec.ts
│       └── FormErrorAlert.spec.ts
├── utils/
│   ├── requestActivity.ts           # Activity parsing/management
│   ├── dashboardStats.ts            # Metrics calculation
│   ├── validation.ts                # Form validation rules
│   └── __tests__/
│       ├── requestActivity.spec.ts
│       ├── dashboardStats.spec.ts
│       └── validation.spec.ts
└── api/
    ├── request.ts                   # R_Request API calls
    └── __tests__/
        └── request.test.ts
```
