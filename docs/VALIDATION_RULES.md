# Validation Rules Reference

## Table of Contents

1. [Activity Content Validation](#activity-content-validation)
2. [Tracking Date Validation](#tracking-date-validation)
3. [Tracking Time Validation](#tracking-time-validation)
4. [Tracking Description Validation](#tracking-description-validation)
5. [Consultation Form Validation](#consultation-form-validation)
6. [Error Messages (Chinese)](#error-messages-chinese)
7. [Validation Implementation](#validation-implementation)

---

## Activity Content Validation

### Rules

| Rule | Value | Type | Required |
|------|-------|------|----------|
| **Required** | Must not be empty | Logical | Yes |
| **Whitespace Trimming** | Leading/trailing spaces removed | String | Yes |
| **Max Length** | 500 characters | Numeric | Yes |
| **Character Set** | UTF-8 (no restrictions) | Semantic | Yes |
| **Emoji Support** | Allowed (counted as 1 char each) | Semantic | Yes |

### Error Messages

| Condition | Error Message | Severity |
|-----------|---------------|----------|
| Empty content | "請輸入活動內容" | Error |
| Only whitespace | "請輸入活動內容" | Error |
| Exceeds 500 chars | "活動內容不能超過500字" | Error |

### Examples

**Valid:**
```
"客戶來電詢問價格" (20 chars) ✅
"Called at 2:30 PM to discuss treatment plans" (45 chars) ✅
"客戶要求下週三下午3點回電，有興趣購買療程" (22 chars) ✅
```

**Invalid:**
```
"" (empty) ❌ → "請輸入活動內容"
"   " (whitespace only) ❌ → "請輸入活動內容"
"[500+ character string]..." ❌ → "活動內容不能超過500字"
```

### Character Counter

- Displayed as: "Content: 0/500"
- Updates in real-time as user types
- Chinese characters count as 1 each
- Emoji count as 1 each
- Form submission disabled if >500

---

## Tracking Date Validation

### Rules

| Rule | Value | Type | Required |
|------|-------|------|----------|
| **Required** | Must select a date | Logical | Yes |
| **Minimum Date** | Today (0 days from now) | Date | Yes |
| **Maximum Date** | 90 days from today | Date | Yes |
| **Date Format** | YYYY-MM-DD | Format | Yes (HTML5 enforces) |
| **Timezone** | User's local timezone | Semantic | Yes |

### Calculation

```
Today = 2026-02-19
Min Date = 2026-02-19 (today)
Max Date = 2026-05-20 (today + 90 days)

Valid Range: 2026-02-19 to 2026-05-20
```

### Error Messages

| Condition | Error Message | Severity |
|-----------|---------------|----------|
| No date selected | "請選擇日期" | Error |
| Past date selected | "日期不能是過去的日期" | Error |
| >90 days in future | "日期不能超過90天後" | Error |

### Examples

**Valid (Today: 2026-02-19):**
```
2026-02-19 (today) ✅
2026-02-20 (tomorrow) ✅
2026-03-19 (30 days) ✅
2026-05-20 (90 days) ✅
```

**Invalid (Today: 2026-02-19):**
```
2026-02-18 (yesterday) ❌ → "日期不能是過去的日期"
2026-02-01 (3 weeks ago) ❌ → "日期不能是過去的日期"
2026-05-21 (91 days) ❌ → "日期不能超過90天後"
2026-12-31 (too far) ❌ → "日期不能超過90天後"
```

### Implementation

```typescript
const today = new Date()
today.setHours(0, 0, 0, 0)

const selected = new Date(dateStr)
selected.setHours(0, 0, 0, 0)

const maxDate = new Date(today)
maxDate.setDate(today.getDate() + 90)

// Validation
if (selected < today) error = "日期不能是過去的日期"
if (selected > maxDate) error = "日期不能超過90天後"
```

---

## Tracking Time Validation

### Rules

| Rule | Value | Type | Required |
|------|-------|------|----------|
| **Required** | Must select a time | Logical | Yes |
| **Business Hours Start** | 08:00 (8 AM) | Time | Yes |
| **Business Hours End** | 19:59 (8 PM, before 20:00) | Time | Yes |
| **Time Format** | HH:MM (24-hour) | Format | Yes (HTML5 enforces) |
| **Minutes** | Any minutes (00-59) allowed | Numeric | Yes |

### Hour Validation

| Hour | Allowed? | Reason |
|------|----------|--------|
| 00-07 | ❌ No | Before business hours |
| 08 | ✅ Yes | 8 AM - start of day |
| 09-18 | ✅ Yes | Regular business hours |
| 19 | ✅ Yes | 7 PM - end of business hours |
| 20-23 | ❌ No | After business hours (8 PM+) |

### Error Messages

| Condition | Error Message | Severity |
|-----------|---------------|----------|
| No time selected | "請選擇時間" | Error |
| Before 08:00 | "時間必須在08:00-20:00之間" | Error |
| At or after 20:00 | "時間必須在08:00-20:00之間" | Error |
| Invalid format | "時間格式無效" | Error |

### Examples

**Valid:**
```
08:00 ✅
08:15 ✅
12:30 ✅
17:45 ✅
19:30 ✅
19:59 ✅
```

**Invalid:**
```
07:30 ❌ → "時間必須在08:00-20:00之間"
00:00 ❌ → "時間必須在08:00-20:00之間"
20:00 ❌ → "時間必須在08:00-20:00之間"
21:45 ❌ → "時間必須在08:00-20:00之間"
25:00 ❌ → "時間格式無效"
```

### Implementation

```typescript
const [hoursStr, minutesStr] = timeStr.split(':')
const hours = parseInt(hoursStr, 10)
const minutes = parseInt(minutesStr, 10)

// Validation
if (isNaN(hours) || isNaN(minutes)) error = "時間格式無效"
if (hours < 8 || hours >= 20) error = "時間必須在08:00-20:00之間"
```

---

## Tracking Description Validation

### Rules

| Rule | Value | Type | Required |
|------|-------|------|----------|
| **Required** | Optional (can be empty) | Logical | No |
| **Max Length** | 200 characters | Numeric | Yes (if provided) |
| **Character Set** | UTF-8 (no restrictions) | Semantic | Yes |

### Error Messages

| Condition | Error Message | Severity |
|-----------|---------------|----------|
| Exceeds 200 chars | "追蹤說明不能超過200字" | Error |

### Examples

**Valid:**
```
"" (empty, optional) ✅
"Call back on Monday" (19 chars) ✅
"客戶要求下週三下午3點回電確認是否購買" (20 chars) ✅
"A" (1 char) ✅
"[200 character string]" (200 chars) ✅
```

**Invalid:**
```
"[201+ character string]..." ❌ → "追蹤說明不能超過200字"
```

### Character Counter

- Displayed as: "Description: 0/200" (if provided)
- Updates in real-time
- Empty state shows "0/200"
- Submit allowed even if empty (optional field)

---

## Consultation Form Validation

### Mandatory Fields (from AD_Column)

The form displays mandatory fields with asterisk (*) indicator. Mandatory fields are defined in iDempiere's Application Dictionary (AD_Column.IsMandatory).

**Common Mandatory Fields:**
- `R_RequestType_ID`: Type of consultation
- `C_BPartner_ID`: Customer/client
- `Priority`: Priority level
- Any other field marked mandatory in AD

### Field-Specific Rules

**R_RequestType_ID (Consultation Type):**
- Required: Yes
- Type: Reference (dropdown)
- Must select one type from list
- Error: "請選擇諮詢類型" (if empty)

**C_BPartner_ID (Customer):**
- Required: Yes
- Type: Search reference
- Can search by name or number
- QuickCreate available if user has permission
- Error: "請選擇客戶" (if empty)

**Priority:**
- Required: Usually yes
- Type: List (dropdown)
- Values: Low, Medium, High, Urgent
- Error: "請選擇優先級" (if empty)

**Description (Activity Timeline):**
- Required: No
- Type: Stored as JSON
- Not shown in form (auto-managed)
- Hidden from user

**DateNextAction (Tracking Date):**
- Required: No
- Type: DateTime
- Set via TrackingDateModal
- Format: YYYY-MM-DD HH:MM:SS

### Validation Flow

```
User submits form
    ↓
useDocumentForm validates
    ↓
Check each mandatory field
    ↓
If field empty → add to mandatoryErrors
    ↓
If mandatoryErrors.length > 0
    ├─ Show error banner
    ├─ Disable submit button
    └─ User must fill required fields
    ↓
Else (all fields valid)
    ├─ Enable submit
    └─ User can submit
```

---

## Error Messages (Chinese)

### Complete Reference

| English Description | Chinese Error Message | Context |
|---|---|---|
| Activity content empty | 請輸入活動內容 | ActivityInputModal |
| Activity exceeds 500 chars | 活動內容不能超過500字 | ActivityInputModal |
| Tracking date not selected | 請選擇日期 | TrackingDateModal |
| Tracking date is past | 日期不能是過去的日期 | TrackingDateModal |
| Tracking date >90 days | 日期不能超過90天後 | TrackingDateModal |
| Tracking time not selected | 請選擇時間 | TrackingDateModal |
| Tracking time outside hours | 時間必須在08:00-20:00之間 | TrackingDateModal |
| Tracking time invalid format | 時間格式無效 | TrackingDateModal |
| Tracking description >200 chars | 追蹤說明不能超過200字 | TrackingDateModal |
| Mandatory field missing | 請填寫必填欄位: [field names] | RequestFormView |
| Customer not selected | 請選擇客戶 | DynamicForm |
| Consultation type not selected | 請選擇諮詢類型 | DynamicForm |

---

## Validation Implementation

### In TypeScript

**Activity Content:**
```typescript
export function validateActivityContent(content: string): ValidationResult {
  const errors: Record<string, string> = {}

  if (!content || !content.trim()) {
    errors.content = '請輸入活動內容'
  }

  if (content && content.length > 500) {
    errors.content = '活動內容不能超過500字'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
```

**Tracking Date:**
```typescript
export function validateTrackingDate(dateStr: string): ValidationResult {
  const errors: Record<string, string> = {}

  if (!dateStr) {
    errors.date = '請選擇日期'
    return { isValid: false, errors }
  }

  const selected = new Date(dateStr)
  const today = new Date()

  selected.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  if (selected < today) {
    errors.date = '日期不能是過去的日期'
  }

  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + 90)
  if (selected > maxDate) {
    errors.date = '日期不能超過90天後'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
```

**Tracking Time:**
```typescript
export function validateTrackingTime(timeStr: string): ValidationResult {
  const errors: Record<string, string> = {}

  if (!timeStr) {
    errors.time = '請選擇時間'
    return { isValid: false, errors }
  }

  const [hoursStr, minutesStr] = timeStr.split(':')
  const hours = parseInt(hoursStr, 10)
  const minutes = parseInt(minutesStr, 10)

  if (isNaN(hours) || isNaN(minutes)) {
    errors.time = '時間格式無效'
    return { isValid: false, errors }
  }

  if (hours < 8 || hours >= 20) {
    errors.time = '時間必須在08:00-20:00之間'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
```

**Tracking Description:**
```typescript
export function validateTrackingDescription(description: string): ValidationResult {
  const errors: Record<string, string> = {}

  if (!description || !description.trim()) {
    errors.description = '請輸入追蹤說明'
  }

  if (description && description.length > 200) {
    errors.description = '追蹤說明不能超過200字'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
```

### In Vue Components

**Usage Pattern:**
```vue
<script setup lang="ts">
import { validateActivityContent } from '@/utils/validation'

const content = ref('')
const errors = ref<Record<string, string>>({})

const handleSubmit = () => {
  const result = validateActivityContent(content.value)
  errors.value = result.errors

  if (!result.isValid) {
    return  // Don't submit
  }

  // Submit...
}
</script>

<template>
  <textarea v-model="content" />
  <div v-if="errors.content" class="field-error">
    {{ errors.content }}
  </div>
  <button :disabled="!content" @click="handleSubmit">
    提交
  </button>
</template>
```

---

## Testing Validation

### Unit Tests

Located in `src/utils/__tests__/validation.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateActivityContent } from '@/utils/validation'

describe('validateActivityContent', () => {
  it('should reject empty content', () => {
    const result = validateActivityContent('')
    expect(result.isValid).toBe(false)
    expect(result.errors.content).toBe('請輸入活動內容')
  })

  it('should accept valid content', () => {
    const result = validateActivityContent('Some activity')
    expect(result.isValid).toBe(true)
    expect(result.errors.content).toBeUndefined()
  })

  it('should reject content exceeding 500 chars', () => {
    const longContent = 'a'.repeat(501)
    const result = validateActivityContent(longContent)
    expect(result.isValid).toBe(false)
    expect(result.errors.content).toBe('活動內容不能超過500字')
  })
})
```

Run tests:
```bash
npm run test                              # All tests
npm run test src/utils/__tests__/validation.spec.ts  # Specific file
npm run test:watch                       # Watch mode
```

---

## Validation Performance

### Client-Side Only

- Validation runs instantly (no API call)
- Feedback is immediate (real-time)
- Prevents sending invalid data to server

### Server-Side Backup

- iDempiere API validates again (authoritative)
- If client validation bypassed, API will reject
- Returns detailed error messages
- Client displays errors from API response

### Recommended Practice

1. Always validate on client before submission
2. Handle API validation errors gracefully
3. Show user-friendly error messages
4. Let user correct and resubmit

---

## Future Enhancements

### Potential Additions

**Custom Validators:**
```typescript
// If needed in future
const customRules: ValidationRule[] = [
  {
    field: 'content',
    pattern: /^[a-zA-Z0-9\u4e00-\u9fff\s]*$/,  // Allow only certain chars
    message: '內容包含不允許的字符'
  }
]
```

**Server-Side Rule Sync:**
```typescript
// Fetch validation rules from AD_Val_Rule
const rules = await fetchValidationRules(tableId)
```

**Async Validation:**
```typescript
// Check if customer exists
const isCustomerValid = await validateCustomer(customerId)
```

**Date Range Validation:**
```typescript
// Validate date range (not just individual dates)
const isValidRange = startDate < endDate
```

---

## Summary Table

| Validation | Type | Required | Max | Min | Error |
|---|---|---|---|---|---|
| Activity Content | String | Yes | 500 chars | 1 char | "請輸入活動內容" |
| Tracking Date | Date | Yes | +90 days | today | "日期不能是過去的日期" |
| Tracking Time | Time | Yes | 19:59 | 08:00 | "時間必須在08:00-20:00之間" |
| Tracking Description | String | No | 200 chars | — | "追蹤說明不能超過200字" |

