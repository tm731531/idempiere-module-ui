# Consultation Module - Architecture & Design

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Flow](#data-flow)
3. [Component Hierarchy](#component-hierarchy)
4. [State Management](#state-management)
5. [API Layer](#api-layer)
6. [Activity Timeline Format](#activity-timeline-format)
7. [Validation Strategy](#validation-strategy)
8. [Error Handling](#error-handling)
9. [Performance Considerations](#performance-considerations)
10. [Security Considerations](#security-considerations)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Vue 3 SPA Frontend                      │
│              (Aesthetics UI Module)                      │
├─────────────────────────────────────────────────────────┤
│  Views          Components         Utils        Stores   │
│  ├─ Request     ├─ QuickActionBar  ├─ validation ├─ auth │
│  │ FormView    ├─ Timeline        ├─ requestActivity │
│  ├─ List       ├─ Modals          ├─ dashboardStats  │
│  └─ Dashboard  ├─ DynamicForm     └─ apiErrorHandler │
│                └─ ErrorBanners                        │
├─────────────────────────────────────────────────────────┤
│          Pinia State Management + Axios Client           │
├─────────────────────────────────────────────────────────┤
│              iDempiere REST API Layer                    │
│  (OData-style queries, JWT authentication)              │
├─────────────────────────────────────────────────────────┤
│          iDempiere 12 Server (Java/SQL)                 │
│  ├─ Database: R_Request, R_Status, R_RequestType       │
│  ├─ AD_Column, AD_Field, AD_Reference metadata         │
│  └─ Document workflow engine                           │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Vue 3 | Reactive UI components |
| Build | Vite 7 | Fast dev server, optimized builds |
| Language | TypeScript 5.9 | Type safety, IDE support |
| UI Framework | PrimeVue 4 | Unstyled components (custom CSS) |
| State | Pinia 3 | Global auth context |
| HTTP | Axios | API client with interceptors |
| Testing | Vitest | Fast unit/integration tests |
| CSS | SCSS | Styling |
| Package Mgr | npm 10+ | Dependency management |

### Deployment Architecture

```
Development
  └─ npm run dev (Vite dev server @ :5173)
     └─ Proxies /api to backend

Build
  └─ npm run build
     └─ Vite bundles Vue → dist/

Package
  └─ build.sh
     └─ Creates JAR with bundled assets

Deploy
  └─ build.sh --deploy
     └─ Uploads JAR to Felix Web Console
        └─ Updates bundle 458 in-place
           └─ Available at https://host:8443/aesthetics/#/
```

---

## Data Flow

### Consultation Lifecycle

```
┌─ CREATE NEW ──────────────────────────────────────────┐
│                                                        │
│  1. User navigates to /consultation/new              │
│     ↓                                                  │
│  2. RequestFormView component mounts                 │
│     ↓                                                  │
│  3. useDocumentForm loads metadata (AD_Field/Column) │
│     ↓                                                  │
│  4. DynamicForm renders empty form fields            │
│     ↓                                                  │
│  5. User fills required fields (C_BPartner, etc.)   │
│     ↓                                                  │
│  6. User clicks "儲存" (Save)                        │
│     ↓                                                  │
│  7. useDocumentForm validates (mandatory check)     │
│     ↓                                                  │
│  8. POST /api/v1/models/R_Request with formData     │
│     ↓                                                  │
│  9. API returns R_Request_ID (consultation created)  │
│     ↓                                                  │
│ 10. App navigates to /consultation/{id} (edit mode) │
│                                                        │
└────────────────────────────────────────────────────────┘

┌─ EDIT & ADD ACTIVITY ─────────────────────────────────┐
│                                                        │
│  1. User views existing consultation (edit mode)    │
│     ↓                                                  │
│  2. RequestTimeline displays activities from JSON   │
│     ↓                                                  │
│  3. User clicks "來電" in QuickActionBar           │
│     ↓                                                  │
│  4. ActivityInputModal opens                        │
│     ↓                                                  │
│  5. User enters activity description                │
│     ↓                                                  │
│  6. Modal validates (required, max length)          │
│     ↓                                                  │
│  7. Modal emits activity data to RequestFormView    │
│     ↓                                                  │
│  8. RequestFormView adds activity to Description:  │
│     parseActivities() → push new activity           │
│     → stringifyActivities() → formData.Description  │
│     ↓                                                  │
│  9. PUT /api/v1/models/R_Request/{id} with updated │
│     Description JSON                                  │
│     ↓                                                  │
│ 10. Timeline refreshes, shows new activity         │
│                                                        │
└────────────────────────────────────────────────────────┘

┌─ CHANGE STATUS ───────────────────────────────────────┐
│                                                        │
│  1. User clicks "改變狀態" in QuickActionBar       │
│     ↓                                                  │
│  2. StatusUpdateModal opens with available statuses  │
│     ↓                                                  │
│  3. User selects new status (e.g., "已完成")        │
│     ↓                                                  │
│  4. Modal validates (new status != current status)  │
│     ↓                                                  │
│  5. Modal emits status selection to RequestFormView │
│     ↓                                                  │
│  6. RequestFormView updates:                         │
│     - formData.R_Status_ID = new status            │
│     - Adds activity: "狀態改變: 改為已完成"         │
│     ↓                                                  │
│  7. PUT /api/v1/models/R_Request/{id} with updated │
│     R_Status_ID and Description                     │
│     ↓                                                  │
│  8. Form refreshes, shows new status               │
│                                                        │
└────────────────────────────────────────────────────────┘

┌─ SCHEDULE FOLLOW-UP ──────────────────────────────────┐
│                                                        │
│  1. User clicks "預約追蹤" in QuickActionBar       │
│     ↓                                                  │
│  2. TrackingDateModal opens (date/time pickers)    │
│     ↓                                                  │
│  3. User selects date (today to +90 days)          │
│     ↓                                                  │
│  4. User selects time (08:00-19:59)                │
│     ↓                                                  │
│  5. User optionally adds description               │
│     ↓                                                  │
│  6. Modal validates:                                 │
│     - Date not past                                 │
│     - Date not >90 days future                      │
│     - Time in business hours                        │
│     ↓                                                  │
│  7. Modal emits tracking data to RequestFormView    │
│     ↓                                                  │
│  8. RequestFormView updates:                         │
│     - formData.DateNextAction = selected date/time  │
│     - Adds activity: "預約追蹤: {description}"      │
│     ↓                                                  │
│  9. PUT /api/v1/models/R_Request/{id} with updated │
│     DateNextAction and Description                  │
│     ↓                                                  │
│ 10. Dashboard next refresh will show scheduled date │
│                                                        │
└────────────────────────────────────────────────────────┘

┌─ VIEW DASHBOARD ──────────────────────────────────────┐
│                                                        │
│  1. User navigates to /consultation/dashboard      │
│     ↓                                                  │
│  2. ConsultationDashboardView mounts                │
│     ↓                                                  │
│  3. GET /api/v1/models/R_Request (no filter)       │
│     → Loads all consultation records                 │
│     ↓                                                  │
│  4. calculateStats() runs on all records:           │
│     - Filters by last 90 days for metrics           │
│     - Counts this month's consultations            │
│     - Calculates conversion rate                    │
│     - Finds silent consultations (>7 days, wait)   │
│     - Identifies lost customers (>90 days quiet)   │
│     ↓                                                  │
│  5. ConsultationDashboard renders:                  │
│     - Metrics cards                                 │
│     - Risk indicators (red/yellow)                  │
│     - Top 10 customers by count                     │
│     ↓                                                  │
│  6. Manager reviews metrics                         │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

### View Components

```
RequestListView (Route: /consultation/list)
  ├─ Fetch R_Request list via API
  ├─ Display in table
  ├─ Provide search/filter
  └─ Navigate to RequestFormView on click

RequestFormView (Route: /consultation/:id or /consultation/new)
  ├─ Load consultation record (edit) or init defaults (create)
  ├─ DynamicForm (renders all fields from AD metadata)
  │  ├─ DynamicField (per field, by AD_Reference_ID type)
  │  │  ├─ Text inputs (Ref 10)
  │  │  ├─ Numbers (Ref 11, 12, 29)
  │  │  ├─ Dates (Ref 15)
  │  │  ├─ DateTimes (Ref 16)
  │  │  ├─ Dropdowns (Ref 17 - from AD_Ref_List)
  │  │  ├─ SearchSelector (Ref 18, 19, 30, 31)
  │  │  ├─ Checkboxes (Ref 20)
  │  │  └─ Textareas (Ref 14, 38)
  │  └─ FormErrorAlert (validation errors)
  ├─ RequestTimeline (activity timeline from Description JSON)
  ├─ QuickActionBar (sticky bottom)
  │  ├─ ActivityInputModal (phone/message)
  │  ├─ StatusUpdateModal (status change)
  │  └─ TrackingDateModal (schedule follow-up)
  └─ Attachment section (upload images)

ConsultationDashboardView (Route: /consultation/dashboard)
  └─ ConsultationDashboard
      ├─ MetricsCards (6 metrics displayed)
      ├─ RiskIndicators (silent, pending, lost)
      ├─ StatusDistributionChart
      └─ TopCustomersRanking
```

### Reusable Component Structure

```
Pure Presentational Components (No API calls, props-driven):
  ├─ RequestTimeline (displays activities)
  ├─ FormErrorAlert (displays errors)
  ├─ StatusBadge (shows status color)
  └─ QuickActionBar (button bar)

Container Components (Manage state, make API calls):
  ├─ RequestFormView (form container)
  ├─ RequestListView (list container)
  ├─ ConsultationDashboardView (dashboard container)
  └─ ConsultationDashboard (metrics container)

Modal Components (Input dialogs):
  ├─ ActivityInputModal
  ├─ StatusUpdateModal
  └─ TrackingDateModal

Shared Utility Components:
  ├─ DynamicForm (from core module)
  ├─ DynamicField (from core module)
  └─ SearchSelector (from core module)
```

---

## State Management

### Pinia Stores

**useAuthStore** (Global state - persistent across routes)
```typescript
{
  // Authentication
  isAuthenticated: boolean
  token: string              // JWT token
  user: { id: number, name: string }

  // Context
  organization: { id: number, name: string }
  warehouse: { id: number, name: string }

  // Methods
  login(username, password): Promise<void>
  logout(): void
  refreshToken(): Promise<void>
}
```

Consultation module doesn't have its own Pinia store - uses local component state instead.

### Local Component State

**RequestFormView:**
```typescript
const formData = ref({})           // Form field values
const activities = ref([])         // Parsed from Description
const isLoading = ref(false)       // Page load state
const isSaving = ref(false)        // Form submit state
const showStatusModal = ref(false) // Modal visibility
const showTrackingModal = ref(false)
const attachments = ref([])        // Uploaded files
const errors = ref({})             // Field-level errors
```

**RequestTimeline:**
```typescript
const activities = computed(() => {
  return parseActivities(props.activities)
})
```

**QuickActionBar:**
```typescript
// Stateless - only emits events
```

**ConsultationDashboard:**
```typescript
const stats = ref<RequestStats>({
  totalThisMonth: 0,
  conversionRate: '0%',
  avgResponseTime: '0h',
  // ... more fields
})
const loading = ref(false)
const error = ref('')
```

### Data Caching Strategy

**No Pinia cache** - API calls are fresh on each page load.

**Why:**
- Consultations change frequently (activities added constantly)
- Dashboard needs real-time data
- Small dataset (typically <500 consultations per user)
- Performance is acceptable (API returns in <500ms typically)

**Fallback caching (if needed in future):**
- Could add 5-minute cache to ConsultationDashboard
- Could cache R_Status list (rarely changes)
- Could cache R_RequestType list (rarely changes)

---

## API Layer

### Endpoints Used

**Consultations (Core domain)**
```
GET    /api/v1/models/R_Request              # List consultations
GET    /api/v1/models/R_Request/{id}        # Get single
PUT    /api/v1/models/R_Request/{id}        # Update
POST   /api/v1/models/R_Request             # Create
```

**Reference Data**
```
GET    /api/v1/models/R_Status              # Available statuses
GET    /api/v1/models/R_RequestType         # Consultation types
GET    /api/v1/models/R_Category            # Categories (if used)
GET    /api/v1/models/C_BPartner            # Customer lookup
```

**Metadata (for form field definitions)**
```
GET    /api/v1/swagger/api/AD_Field         # Field definitions
GET    /api/v1/swagger/api/AD_Column        # Column metadata
GET    /api/v1/swagger/api/AD_Reference     # Reference types
```

**Files (attachments)**
```
GET    /api/v1/models/AD_Attachment         # List attachments
POST   /api/v1/models/AD_Attachment         # Upload
DELETE /api/v1/models/AD_Attachment/{id}    # Delete
```

### Request/Response Format

**DateTime Format:**
- Send: `yyyy-MM-dd'T'HH:mm:ss'Z'` (e.g., `2026-02-19T14:30:00Z`)
- Receive: Same format, but represents **local time** (not UTC)
- Parsing: Use `parseIdempiereDateTime()` to handle Z suffix correctly

**FK Fields:**
- Response format: `{"id": "...", "identifier": "..."}` (object)
- Extract: Use `.id` for value, `.identifier` for display
- Request: Send just the ID: `{"R_Status_ID": "已完成"}`

**Lists:**
- Response wraps array in object: `{"value": [...]}`
- Pagination: Use `$top` and `$skip` parameters
- Sorting: Use `$orderby=FieldName asc|desc`

**Filtering:**
- OData syntax: `$filter=Name eq 'John'`
- Operators: `eq`, `neq`, `gt`, `ge`, `lt`, `le`, `in`, `contains()`, `startswith()`, `endswith()`
- **Never use `ne`** — always use `neq`
- Boolean: `Active eq true` (not `'Y'`)

### Error Handling

**401 Unauthorized:**
```typescript
// No auto-logout - set sessionExpired flag instead
authStore.sessionExpired = true
// Show banner: "Your session has expired. Please log in again."
// User clicks to re-login
```

**400 Bad Request:**
```typescript
// Return detailed validation errors from API
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mandatory field missing",
    "details": {
      "C_BPartner_ID": "Customer is required"
    }
  }
}
```

**404 Not Found:**
```typescript
// Record deleted or invalid ID
// Show error: "Consultation not found"
// Navigate back to list
```

**500 Server Error:**
```typescript
// Unexpected error on server
// Show error: "Server error occurred. Please try again later."
// Provide "Retry" button
```

---

## Activity Timeline Format

### JSON Structure

Activities are stored as JSON array in `R_Request.Description` field.

```json
[
  {
    "timestamp": "2026-02-19T14:30:00Z",
    "type": "活動",
    "actionType": "來電",
    "content": "Customer called to ask about product pricing",
    "createdBy": "12345"
  },
  {
    "timestamp": "2026-02-19T15:00:00Z",
    "type": "狀態改變",
    "actionType": "預約追蹤",
    "content": "預約追蹤: Call back on Monday 3pm",
    "createdBy": "12345"
  },
  {
    "timestamp": "2026-02-24T14:00:00Z",
    "type": "活動",
    "actionType": "發送訊息",
    "content": "Sent follow-up message with pricing sheet",
    "createdBy": "54321"
  }
]
```

### Field Descriptions

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `timestamp` | String (ISO) | Yes | When activity occurred (local time with Z suffix) |
| `type` | String | Yes | Category: "活動", "狀態改變", "建立" |
| `actionType` | String | Yes | Specific action: "來電", "發送訊息", "預約追蹤", etc. |
| `content` | String | Yes | Description of what happened (max 500 chars) |
| `createdBy` | String or Number | Yes | User ID who created the activity |

### Storage Constraints

- **Max Size:** ~10KB per consultation
- **Typical Activities:** ~50 activities per 10KB
- **Format:** Plain UTF-8 JSON (no compression)
- **Backup:** Handled by iDempiere backup process

### Parsing & Serializing

```typescript
import {
  parseActivities,       // String → Activity[]
  stringifyActivities,   // Activity[] → String
  addActivity,          // Add to existing JSON
  getLastActivityTime,  // Get most recent timestamp
  getActivitiesByType,  // Filter by type
} from '@/utils/requestActivity'

// Usage
const activities = parseActivities(consultation.Description || '[]')
const lastTime = getLastActivityTime(consultation.Description)
const newJson = addActivity(consultation.Description, {
  type: '活動',
  actionType: '來電',
  content: 'Called customer',
  createdBy: authStore.user.id
})
```

---

## Validation Strategy

### Client-Side Validation (Immediate feedback)

**Where it happens:**
1. In modal components (before submission)
2. In form components (real-time)
3. Before API calls (prevents bad requests)

**What it validates:**
- Required fields present
- String lengths within limits
- Date ranges valid (not past, not >90 days future)
- Time within business hours
- Numeric values within bounds
- Email/phone format (if applicable)

**Error display:**
- Inline under field (modal/input)
- Banner above submit button (form)
- Prevents submission if invalid

### Server-Side Validation (Authoritative)

**What iDempiere enforces:**
- Mandatory field checking (from AD_Column)
- FK referential integrity (customer exists, status valid)
- Business logic rules (from Process endpoints)
- Audit trail enforcement

**Error handling:**
- If API returns 400, display specific field errors
- If API returns 409 (conflict), show concurrency message
- If API returns 500, show generic error + retry

### Validation Rules by Field

**Activity Content:**
```typescript
validateActivityContent(content: string): ValidationResult {
  const errors = {}
  if (!content?.trim()) errors.content = '請輸入活動內容'
  if (content?.length > 500) errors.content = '活動內容不能超過500字'
  return { isValid: !Object.keys(errors).length, errors }
}
```

**Tracking Date:**
```typescript
validateTrackingDate(dateStr: string): ValidationResult {
  const today = new Date()
  const selected = new Date(dateStr)
  const maxDate = new Date(today)
  maxDate.setDate(today.getDate() + 90)

  const errors = {}
  if (!dateStr) errors.date = '請選擇日期'
  if (selected < today) errors.date = '日期不能是過去的日期'
  if (selected > maxDate) errors.date = '日期不能超過90天後'
  return { isValid: !Object.keys(errors).length, errors }
}
```

**Tracking Time:**
```typescript
validateTrackingTime(timeStr: string): ValidationResult {
  const [h, m] = timeStr.split(':').map(Number)

  const errors = {}
  if (!timeStr) errors.time = '請選擇時間'
  if (h < 8 || h >= 20) errors.time = '時間必須在08:00-20:00之間'
  return { isValid: !Object.keys(errors).length, errors }
}
```

---

## Error Handling

### Error Types

**Network Errors:**
- Connection timeout
- No internet connectivity
- Server unreachable

**API Errors:**
- 400: Validation failed (return field-specific messages)
- 401: Unauthorized (token expired)
- 403: Forbidden (permission denied)
- 404: Not found (record deleted)
- 500: Server error (unexpected)

**Client Errors:**
- Form validation failed
- Invalid input format
- Missing required data
- Modal closed without save

### Error Display Strategy

**Page-Level Errors:**
```vue
<div v-if="pageError" class="page-error">
  {{ pageError }}
  <button @click="retry">重試</button>
</div>
```

**Form-Level Errors:**
```vue
<FormErrorAlert
  :errors="mandatoryErrors"
  :visible="mandatoryErrors.length > 0"
/>
```

**Field-Level Errors:**
```vue
<div v-if="errors[fieldName]" class="field-error">
  {{ errors[fieldName] }}
</div>
```

**Modal Errors:**
```vue
<div v-if="modalError" class="modal-error">
  {{ modalError }}
</div>
```

### Recovery Strategies

**401 Unauthorized:**
1. Clear stored token
2. Set `sessionExpired` flag
3. Show banner with "Re-login" button
4. On button click, navigate to login

**500 Server Error:**
1. Show error message with "Retry" button
2. User can retry same operation
3. If repeated failures, suggest contacting support

**Form Validation:**
1. Show which fields are invalid
2. User corrects and resubmits
3. Prevents submission until valid

**Modal Validation:**
1. Show error under form field
2. Submit button remains disabled
3. User corrects and resubmits

---

## Performance Considerations

### Optimization Techniques Used

**1. Lazy Loading:**
- Views only loaded when routed to
- Modals only rendered when visible
- Images lazy-loaded (if applicable)

**2. Memoization:**
- `computed()` properties cached
- Filter/sort operations cached
- Expensive calculations memoized

**3. Pagination:**
- List views use `$top=50` API parameter
- Next page loads on scroll
- Prevents loading all records at once

**4. Virtual Scrolling (if needed):**
- For dashboard with many customers in ranking
- Can add virtual scroller for performance

**5. Debouncing:**
- Search inputs debounced (wait for user to stop typing)
- Prevents API spam during fast typing

**6. No Unnecessary Re-renders:**
- Props are strictly defined
- Watchers only where needed
- Key attributes on lists prevent DOM thrashing

### Metrics

**Load Time:**
- Page load: ~1-2 seconds (Vue + metadata fetch)
- API response: ~200-500ms typical
- Modal open: ~100ms (instant)

**Memory:**
- Bundle size: ~200KB (gzipped)
- Runtime footprint: ~5MB typical
- One page: <1MB for data

**API Calls:**
- Create consultation: 2 calls (POST + GET metadata)
- Edit consultation: 2 calls (GET record + GET metadata)
- Save activity: 1 call (PUT description)
- View dashboard: 1 call (GET all requests)

---

## Security Considerations

### Authentication

**JWT Token Flow:**
1. Login sends credentials → API returns JWT token
2. Token stored in localStorage (persistent across sessions)
3. Token sent in Authorization header on all API calls
4. Token expires after ~24 hours (server-side enforcement)
5. Expired token returns 401 → user must re-login

**No Auto-Logout:**
- User sees "Session expired" banner (not automatic logout)
- User clicks to re-login manually
- Prevents loss of unsaved work

### Authorization

**Row-Level Security:**
- iDempiere enforces via OData API
- Users can only see consultations in their org/warehouse
- API returns 403 if user lacks permission

**Feature-Level Security:**
- Can check user roles before showing features
- `usePermission()` composable available
- Hides buttons if user lacks permission

### Input Validation

**XSS Prevention:**
- Vue auto-escapes all template data
- No `v-html` used (only `v-text`)
- User input never evaluated as code

**CSRF Prevention:**
- Not needed (JWT in Authorization header)
- Form data sent as JSON (not x-www-form-urlencoded)

**Sensitive Data:**
- Token stored securely in localStorage (not cookies)
- No sensitive data logged to console
- Error messages don't expose internal details

### Data Privacy

**GDPR Compliance:**
- User can delete their consultation records
- Activity history maintained (audit trail)
- Can export consultation data if needed

**Field-Level Privacy:**
- Confidential consultations can be marked
- Form respects `Confidential` flag
- ACL controls can restrict viewing

---

## Extensibility

### Adding New Features

**New Quick Action:**
1. Add button to `QuickActionBar.vue`
2. Create corresponding modal component
3. Emit event from modal
4. Handle in `RequestFormView`
5. Update activity JSON

**New Dashboard Metric:**
1. Update `RequestStats` interface
2. Add calculation in `calculateStats()`
3. Add display card in `ConsultationDashboard`
4. Add test case

**New Validation Rule:**
1. Add function to `validation.ts`
2. Use in component validation
3. Add error message in Chinese
4. Add test case

**New Modal Dialog:**
1. Create component in `src/components/`
2. Follow modal pattern (props, events, submit)
3. Add to RequestFormView
4. Add test file

---

## Diagrams

### State Flow Diagram

```
User Input
    ↓
Modal Component (input validation)
    ↓ (valid)
Event Emission
    ↓
RequestFormView Handler
    ↓
Update formData / Description JSON
    ↓
API Call (PUT or POST)
    ↓ (success)
Form Refresh / Timeline Update
    ↓
Visual Feedback to User
```

### Activity Timeline State

```
R_Request.Description (Database)
    ↓ (JSON string)
RequestFormView loads
    ↓
parseActivities(json) → Activity[]
    ↓
RequestTimeline renders array
    ↓
User adds activity via modal
    ↓
addActivity(json, ...) → new JSON string
    ↓
formData.Description = new JSON
    ↓
PUT /api/v1/models/R_Request
    ↓
Form refreshes, timeline updates
```

### Error Recovery Flow

```
API Call
    ↓
Error Response (4xx, 5xx)
    ↓
apiErrorHandler catches
    ↓
Parse error code
    ↓
401? → Show "Re-login" banner
400? → Show validation errors per field
500? → Show "Retry" button
    ↓
User action (re-login, correct, retry)
    ↓
API Call again
```
