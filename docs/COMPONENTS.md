# Consultation Module - Component API Reference

## Table of Contents

1. [RequestFormView](#requestformview)
2. [RequestListView](#requestlistview)
3. [ConsultationDashboardView](#consultationdashboardview)
4. [RequestTimeline](#requesttimeline)
5. [QuickActionBar](#quickactionbar)
6. [ActivityInputModal](#activityinputmodal)
7. [StatusUpdateModal](#statusupdatemodal)
8. [TrackingDateModal](#trackingdatemodal)
9. [ConsultationDashboard](#consultationdashboard)
10. [FormErrorAlert](#formerrovalert)

---

## RequestFormView

**File:** `src/views/consultation/RequestFormView.vue`

Main page for creating and editing consultations.

### Overview

This is the primary interface for consultation management. It displays a form with all consultation fields from the R_Request table, an activity timeline, quick actions, and attachment management.

### Props

None - uses route parameters instead:
- `route.params.id`: Consultation ID (if editing)

### Events

None - this is a top-level view component

### Usage Example

```vue
<!-- In router -->
{
  path: '/consultation/:id',
  component: RequestFormView,
  meta: { requiresAuth: true }
}

<!-- Navigate to -->
<router-link :to="`/consultation/${consultationId}`">Edit</router-link>
```

### Features

**Create Mode (no ID in URL):**
- Displays "新增諮詢" header
- Initializes form with defaults from AD metadata
- No timeline or quick actions shown
- Submit button: "儲存"

**Edit Mode (ID in URL):**
- Displays "編輯諮詢" header
- Loads existing record via API
- Shows activity timeline
- Shows quick action bar (sticky bottom)
- Attachment section available

**Validation:**
- Mandatory fields (from AD_Column) enforced
- Real-time validation feedback
- Prevents submission if validation fails
- Displays error banner above submit button

### Mobile Considerations

- Form fields stack vertically
- Modal dialogs take full viewport (mobile-friendly)
- QuickActionBar is sticky at bottom (easy thumb access)
- Attachment thumbnails scale to device width
- Font sizes increased for readability on small screens

### Error Handling

**Page Loading Error:**
```
// Error banner shown
"無法載入諮詢記錄，請稍後重試"
```

**Form Validation Error:**
```
// Above submit button
"請填寫必填欄位: [field1], [field2]"
```

**Save Error:**
```
// Form error banner
"保存失敗: [error details from API]"
```

**Attachment Error:**
```
// Below file input
"檔案上傳失敗: [error message]"
```

### State Management

**Local State:**
```typescript
const formData = ref({})           // Current form values
const isEdit = computed(() => !!requestId)
const pageLoading = ref(false)
const pageError = ref('')
const submitting = ref(false)
const showStatusModal = ref(false)
const showTrackingModal = ref(false)
const attachments = ref([])
const uploading = ref(false)
const attachError = ref('')
```

### Key Methods

**`handleSubmit()`**
- Validates form data
- Calls `getUpdatePayload()` or `getFormPayload()` from useDocumentForm
- Sends PUT/POST to API
- Reloads record on success
- Shows error on failure

**`handleAddActivity()`**
- Called by QuickActionBar
- Opens ActivityInputModal
- Receives activity data from modal
- Adds to Description JSON
- Saves automatically

**`handleUpdateStatus()`**
- Called by StatusUpdateModal
- Updates R_Status_ID
- Adds status change to activity
- Saves via API

**`handleSetTracking()`**
- Called by TrackingDateModal
- Creates tracking activity
- Updates DateNextAction
- Saves via API

**`handleFileSelect()`**
- File input change handler
- Validates file type (images only)
- Uploads via API attachment endpoint
- Shows upload progress

---

## RequestListView

**File:** `src/views/consultation/RequestListView.vue`

List page showing all consultations with search and filtering.

### Props

None

### Features

- Table display of all consultations
- Search by customer name or reference
- Sort by various columns
- Click row to edit consultation
- "New" button to create consultation
- Pagination (if many records)
- Mobile-friendly card view on small screens

### Usage Example

```vue
<router-link to="/consultation/list">View Consultations</router-link>
```

---

## ConsultationDashboardView

**File:** `src/views/consultation/ConsultationDashboardView.vue`

Executive dashboard showing business metrics and analytics.

### Props

None

### Features

- Fetches all R_Request records (last 90 days)
- Calculates comprehensive statistics
- Displays metrics cards
- Shows risk indicators
- Rankings of top customers
- Mobile-responsive grid layout

### Usage Example

```vue
<router-link to="/consultation/dashboard">Dashboard</router-link>
```

### Mobile Considerations

- Metrics cards stack on small screens
- Charts are touch-friendly
- Customer ranking scrolls horizontally if needed
- Font sizes scale appropriately

---

## RequestTimeline

**File:** `src/components/RequestTimeline.vue`

Displays activity timeline from JSON storage.

### Props

```typescript
props = {
  activities: {
    type: String,        // JSON array string
    required: true,
    default: '[]'
  }
}
```

### Events

None

### Usage Example

```vue
<RequestTimeline
  :activities="formData.Description || '[]'"
/>
```

### Features

- Parses JSON activity array
- Displays activities in reverse chronological order (newest first)
- Color-codes activities by type
- Shows timestamp with relative time ("2 hours ago")
- Shows user who created activity
- Empty state message when no activities
- Responsive card layout

### Data Format Expected

```json
[
  {
    "timestamp": "2026-02-19T14:30:00Z",
    "type": "活動",
    "actionType": "來電",
    "content": "客戶詢問產品資訊",
    "createdBy": "12345"
  }
]
```

### Mobile Considerations

- Cards scale to full width on mobile
- Timestamps use relative format ("2 hours ago")
- Content wraps automatically
- Large touch targets for readability

### Error Handling

**Invalid JSON:**
```
// Silent failure, returns empty array
// Error logged: "Failed to parse activities: ..."
```

**Empty Activities:**
```
// Shown: "沒有活動記錄"
```

---

## QuickActionBar

**File:** `src/components/QuickActionBar.vue`

Sticky bottom action bar for rapid operations.

### Props

```typescript
props = {
  requestId: {
    type: Number,
    required: true
  },
  currentStatus: {
    type: String,
    required: true     // Display name of current status
  },
  disabled: {
    type: Boolean,
    default: false     // Disable when form saving
  }
}
```

### Events

```typescript
emit('add-activity', {
  type: 'phone' | 'message',
  content: string,
  createdBy: number
})

emit('update-status', {
  newStatusId: string,
  comment?: string
})

emit('set-tracking', {
  date: string,           // YYYY-MM-DD
  time: string,           // HH:MM
  description: string
})
```

### Usage Example

```vue
<QuickActionBar
  :request-id="consultationId"
  :current-status="statusName"
  :disabled="isSaving"
  @add-activity="handleAddActivity"
  @update-status="handleUpdateStatus"
  @set-tracking="handleSetTracking"
/>
```

### Features

**Phone Button (來電)**
- Opens ActivityInputModal
- Pre-fills actionType: "來電"
- User describes the call

**Message Button (訊息)**
- Opens ActivityInputModal
- Pre-fills actionType: "發送訊息"
- User describes message content

**Status Button (改變狀態)**
- Opens StatusUpdateModal
- Shows available statuses
- User selects new status

**Tracking Button (預約追蹤)**
- Opens TrackingDateModal
- User sets date (0-90 days)
- User sets time (08:00-19:59)
- User adds optional description

### Mobile Considerations

**Sticky Positioning:**
- Fixed at bottom of screen (safe area on iPhone)
- Doesn't overlap important content
- Keyboard dismissal handled automatically

**Button Layout:**
- Icon-only on small screens (<400px)
- Icon + label on larger screens
- Buttons full-width for easy tapping
- Touch-friendly 48px+ minimum height

**Disabled State:**
- Buttons become semi-transparent
- Cursor changes to not-allowed
- Prevents interaction while saving

---

## ActivityInputModal

**File:** `src/components/ActivityInputModal.vue`

Modal dialog for logging phone calls or messages.

### Props

```typescript
props = {
  requestId: {
    type: Number,
    required: true
  },
  type: {
    type: String as PropType<'phone' | 'message'>,
    required: true
  }
}
```

### Events

```typescript
emit('add-activity', {
  content: string,
  createdBy: number
})

emit('close')
```

### Usage Example

```vue
<ActivityInputModal
  v-if="showModal"
  :request-id="consultationId"
  type="phone"
  @add-activity="handleAddActivity"
  @close="showModal = false"
/>
```

### Features

**Input Field:**
- Textarea with auto-expanding height
- Max 500 characters
- Real-time character counter

**Validation:**
- Checks content is not empty
- Checks length not exceeding 500
- Error messages under input field
- Submit button disabled if validation fails

**Submission:**
- Sends activity data to parent via event
- Automatically sets timestamp (current time)
- Automatically sets createdBy (from authStore)
- Closes modal on success

### Validation Rules

| Rule | Error Message |
|------|---------------|
| Content required | "請輸入活動內容" |
| Max 500 chars | "活動內容不能超過500字" |

### Mobile Considerations

- Modal takes 90% of viewport on mobile
- Textarea scrolls independently if content long
- Cancel/Submit buttons at bottom
- Keyboard-friendly input handling

---

## StatusUpdateModal

**File:** `src/components/StatusUpdateModal.vue`

Modal dialog for changing consultation status.

### Props

```typescript
props = {
  requestId: {
    type: Number,
    required: true
  },
  currentStatusId: {
    type: String,
    required: true
  },
  statuses: {
    type: Array,
    required: true
    // [{R_Status_ID: string, Name: string}, ...]
  }
}
```

### Events

```typescript
emit('status-selected', {
  statusId: string,
  statusName: string
})

emit('close')
```

### Usage Example

```vue
<StatusUpdateModal
  v-if="showStatusModal"
  :request-id="consultationId"
  :current-status-id="currentStatus"
  :statuses="availableStatuses"
  @status-selected="handleStatusSelected"
  @close="showStatusModal = false"
/>
```

### Features

**Status Dropdown:**
- Lists all available statuses
- Shows current status (highlighted/disabled)
- Prevents selecting same status
- Full status name displayed

**Validation:**
- Checks new status differs from current
- Shows error if same status selected
- Submit button disabled if validation fails

**Submission:**
- Sends status change via event
- Parent handles API call
- Modal closes on success

### Mobile Considerations

- Modal centered on screen
- Dropdown takes up mobile viewport
- Touch-friendly dropdown options
- Large text for readability

---

## TrackingDateModal

**File:** `src/components/TrackingDateModal.vue`

Modal dialog for scheduling follow-up date and time.

### Props

```typescript
props = {
  requestId: {
    type: Number,
    required: true
  }
}
```

### Events

```typescript
emit('tracking-set', {
  date: string,           // YYYY-MM-DD
  time: string,           // HH:MM
  description: string
})

emit('close')
```

### Usage Example

```vue
<TrackingDateModal
  v-if="showTrackingModal"
  :request-id="consultationId"
  @tracking-set="handleTrackingSet"
  @close="showTrackingModal = false"
/>
```

### Features

**Date Picker:**
- HTML5 `<input type="date">`
- Min: Today (0 days)
- Max: 90 days from today
- Validates automatically

**Time Picker:**
- HTML5 `<input type="time">`
- Business hours: 08:00-19:59
- Validation on blur

**Description Field:**
- Optional text input
- Max 200 characters
- Character counter
- Optional - can be left blank

**Validation:**

| Field | Rule | Error |
|-------|------|-------|
| Date | Required | "請選擇日期" |
| Date | Not past | "日期不能是過去的日期" |
| Date | Max 90 days | "日期不能超過90天後" |
| Time | Required | "請選擇時間" |
| Time | 08:00-19:59 | "時間必須在08:00-20:00之間" |
| Description | Max 200 | "追蹤說明不能超過200字" |

**Submission:**
- Validates all fields
- Shows error banner if validation fails
- Sends tracking data via event
- Parent handles API call
- Modal closes on success

### Mobile Considerations

- Full-screen modal on mobile
- Date/time pickers use native mobile controls
- Input fields stack vertically
- Cancel/Submit buttons at bottom
- Large button touch targets

---

## ConsultationDashboard

**File:** `src/components/ConsultationDashboard.vue`

Executive dashboard component showing metrics and analytics.

### Props

None

### Events

None

### Usage Example

```vue
<ConsultationDashboard />
```

### Features

**Metrics Cards:**
- Consultations This Month
- Conversion Rate (%)
- Avg Response Time (hours)
- Pending Consultations
- Silent Consultations (red alert)
- Lost Customers (red alert)

**Status Distribution:**
- Pie or bar chart
- Shows breakdown by status
- Clickable segments (optional drill-down)

**Top 10 Customers:**
- Ranked by consultation count
- Shows customer name and count
- Helps identify key accounts

**Risk Indicators:**
- Silent consultations highlighted in red
- Lost customers highlighted in red
- Pending consultations in yellow
- Color coding for quick scanning

**Auto-Refresh:**
- Data refreshes on component mount
- Optional: Auto-refresh every 5 minutes
- Manual refresh button available

### Responsive Design

**Desktop (>1200px):**
- 3-column layout for metrics
- Large charts
- Full customer table

**Tablet (768-1200px):**
- 2-column layout
- Medium charts
- Customer rankings

**Mobile (<768px):**
- 1-column layout (stacked)
- Charts stack below metrics
- Customer rankings scroll horizontally

### Data Dependencies

Requires GET call to `/api/v1/models/R_Request` (no filter - loads all records for last 90 days in calculateStats).

### Error Handling

**Data Load Error:**
```
"無法載入儀表板資料，請稍後重試"
```

**Calculation Error:**
```
"計算指標時發生錯誤，請重試"
```

---

## FormErrorAlert

**File:** `src/components/FormErrorAlert.vue`

Reusable error alert banner for form validation errors.

### Props

```typescript
props = {
  errors: {
    type: Array as PropType<string[]>,
    required: true
  },
  visible: {
    type: Boolean,
    default: true
  }
}
```

### Events

```typescript
emit('dismiss')
```

### Usage Example

```vue
<FormErrorAlert
  :errors="mandatoryErrors"
  :visible="mandatoryErrors.length > 0"
  @dismiss="mandatoryErrors = []"
/>
```

### Features

- Displays list of validation errors
- Dismissible with X button
- Color-coded (red background)
- Smooth fade in/out animation
- Icon indicating error severity
- Responsive on all screen sizes

### Mobile Considerations

- Alert takes full width on mobile
- Dismissible by swiping
- Error text wraps properly
- Large dismiss button for touch

---

## Component Dependency Tree

```
RequestFormView
├─ DynamicForm
│  ├─ DynamicField
│  │  └─ SearchSelector
│  └─ FormErrorAlert
├─ RequestTimeline
├─ QuickActionBar
│  ├─ ActivityInputModal
│  ├─ StatusUpdateModal
│  └─ TrackingDateModal
└─ Attachment section

RequestListView
└─ Consultation table
   ├─ Search/Filter
   └─ Pagination

ConsultationDashboardView
├─ ConsultationDashboard
   ├─ MetricsCard
   ├─ Chart component
   └─ CustomerRankings
```

---

## Shared Patterns

### Modal Pattern

All modals follow this pattern:

```vue
<script setup lang="ts">
const emit = defineEmits(['close', 'submit'])

const isValid = ref(true)
const errors = ref<Record<string, string>>({})

const handleSubmit = () => {
  // Validate
  // Emit result
  // Close
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <!-- Form fields -->
      <!-- Error display -->
      <!-- Buttons: Cancel, Submit -->
    </div>
  </div>
</template>
```

### Validation Pattern

```typescript
const errors = ref<Record<string, string>>({})

const validate = () => {
  errors.value = {}

  if (!field) errors.value.field = '此欄位為必填'
  if (field.length > 100) errors.value.field = '超過長度限制'

  return Object.keys(errors.value).length === 0
}

const handleSubmit = () => {
  if (!validate()) return
  // Submit...
}
```

### Loading State Pattern

```typescript
const loading = ref(false)
const error = ref('')

const loadData = async () => {
  loading.value = true
  error.value = ''
  try {
    // API call
  } catch (err) {
    error.value = 'Failed to load'
  } finally {
    loading.value = false
  }
}
```

---

## Testing Components

All components have accompanying test files in `__tests__/` subdirectories.

**Example test:**
```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FormErrorAlert from '@/components/FormErrorAlert.vue'

describe('FormErrorAlert', () => {
  it('displays error messages', () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: ['Error 1', 'Error 2']
      }
    })
    expect(wrapper.text()).toContain('Error 1')
    expect(wrapper.text()).toContain('Error 2')
  })
})
```

Run tests:
```bash
npm run test                              # All tests
npm run test src/components/__tests__/   # Component tests only
npm run test:watch                       # Watch mode
```
