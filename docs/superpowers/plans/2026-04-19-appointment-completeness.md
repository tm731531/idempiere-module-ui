# 預約模組完整度補齊 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 補齊 nczz/idempiere-appointment 對比後發現的所有缺口，讓預約模組流程完整、用戶體驗無疑惑點。

**Architecture:** 六個獨立可測的任務，每個 commit 後測試可通過。所有改動都在現有架構內進行：AppointmentForm.vue (表單 UX)、CopyAssignmentDialog.vue (複製邏輯)、CalendarView.vue (行事曆 + 資源不可用)、api/resource.ts (不可用 API)、api/order.ts (已存在，直接呼叫)。

**Tech Stack:** Vue 3 + TypeScript + FullCalendar 6 + Vitest + iDempiere REST OData

---

## 缺口清單（對比 nczz）

| # | 缺口 | 影響 |
|---|------|------|
| T1 | 單筆儲存無 toast | 用戶不確定有沒有存 |
| T2 | 編輯模式時間欄位無說明 | 用戶以為是 bug |
| T3 | 複製 dialog 遇衝突全部中止 | 一人有衝突導致全部失敗 |
| T4 | 多資源/複製失敗不指名是誰 | 用戶不知道哪個失敗 |
| T5 | 無資源不可用灰色塊 | 醫師請假時段仍可預約 |
| T6 | 無從預約建立訂單按鈕 | 完診後帳務流程斷掉 |

---

## File Map

| 檔案 | 動作 |
|------|------|
| `webapp/src/views/appointment/AppointmentForm.vue` | T1+T2+T4+T6: toast、時間說明、失敗詳情、訂單按鈕 |
| `webapp/src/components/CopyAssignmentDialog.vue` | T3+T4: 改為部分成功 + 顯示誰失敗 |
| `webapp/src/api/resource.ts` | T5: 新增 `listResourceUnavailability()` |
| `webapp/src/api/__tests__/resource.test.ts` | T5: 新增 unavailability 測試 |
| `webapp/src/views/appointment/CalendarView.vue` | T5: fetch unavailability → background events |

---

## Task 1: 單筆儲存成功 toast

**Files:**
- Modify: `webapp/src/views/appointment/AppointmentForm.vue`

目前 `handleSave()` 在 edit mode 和 single-resource create mode 都沒有 toast。只有多資源模式有 `multiResultSummary` banner。

- [ ] **Step 1: 找到 handleSave 的成功路徑**

在 AppointmentForm.vue 約 line 700：

```typescript
// Edit mode success (line ~707):
await updateAssignment(props.editingAppt.id, { ... })
// ...after this block, saving.value = false then emit('saved')

// Single create success (line ~749):
const newAssignment = await createAssignment({ ... })
// ...then emit('saved')
```

- [ ] **Step 2: import useToast 並在成功時 toast**

在 `<script setup>` 頂部找到 import 區，加入 `useToast`（已在 CalendarView.vue 使用，可直接用）：

```typescript
import { useToast } from '@/composables/useToast'
const toast = useToast()
```

然後在 edit mode 成功後（`saving.value = false` 之後，`emit('saved')` 之前）加：

```typescript
// Edit mode: 約在 line 708 之後
await updateAssignment(props.editingAppt.id, {
  Name: nameStr || form.name.trim(),
  Description: descStr,
})
void setAssignmentColorOverride(props.editingAppt.id, form.colorOverride)
// ↓ 新增這行
toast.show('預約已更新', 'success')
```

在 single-resource create 成功後（`newAssignment` 建立之後）加：

```typescript
// Single create: 約在 line 760 之後，emit('saved') 之前
if (newId && form.colorOverride) {
  void setAssignmentColorOverride(newId, form.colorOverride)
}
// ↓ 新增這行
toast.show('預約已建立', 'success')
```

- [ ] **Step 3: 確認 useToast 介面**

執行：`grep -n "show\|toast" webapp/src/composables/useToast.ts | head -20`

若 `toast.show(message, type)` API 不存在，改用實際的 API（可能是 `toast(message)` 或 `addToast(...)` — 看 CalendarView.vue 怎麼呼叫的）。

- [ ] **Step 4: 執行測試**

```bash
cd webapp && npm run test 2>&1 | tail -10
```
Expected: all tests pass (toast.show 是 composable，不需要新測試)

- [ ] **Step 5: Commit**

```bash
git add webapp/src/views/appointment/AppointmentForm.vue
git commit -m "feat: show success toast after single appointment save/update"
```

---

## Task 2: 編輯模式時間欄位說明 banner

**Files:**
- Modify: `webapp/src/views/appointment/AppointmentForm.vue`

目前時間欄位只有 `title` tooltip，很多用戶看不到 tooltip 會以為是 bug。

- [ ] **Step 1: 在時間欄位下方加說明 banner**

在 AppointmentForm.vue 的 template，找到 `<!-- endTime form-group -->` 結束的 `</div>` 之後（約 line 109），插入：

```vue
<!-- Edit mode: time-field explanation -->
<div v-if="editingAppt" class="time-locked-info">
  ℹ️ iDempiere 不允許修改已儲存預約的時間。如需更改時間，請先「取消預約」再重新建立。
</div>
```

- [ ] **Step 2: 加 CSS**

在 `<style scoped>` 找到合適位置加：

```css
.time-locked-info {
  font-size: 0.75rem;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  line-height: 1.4;
}
```

- [ ] **Step 3: 執行測試**

```bash
cd webapp && npm run test 2>&1 | tail -5
```
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add webapp/src/views/appointment/AppointmentForm.vue
git commit -m "ux: add explanation banner for locked time fields in edit mode"
```

---

## Task 3: CopyAssignmentDialog 改為部分成功

**Files:**
- Modify: `webapp/src/components/CopyAssignmentDialog.vue`

目前 `handleCopy()` 用 `for...of` 迴圈，遇到第一個衝突或錯誤就 `return` 中止。要改為：
1. 先平行檢查所有資源的衝突
2. 衝突的資源跳過（記錄到失敗清單）
3. 非衝突的資源繼續建立（`Promise.allSettled`）
4. 顯示 "X 成功、Y 失敗" 摘要 + 哪些資源失敗

- [ ] **Step 1: 新增 result summary state**

在 `<script setup>` 的 state 宣告區新增：

```typescript
const resultSummary = ref<{ text: string; hasError: boolean } | null>(null)
```

- [ ] **Step 2: 改寫 handleCopy()**

將整個 `handleCopy()` 函數替換為：

```typescript
async function handleCopy() {
  errorMsg.value = ''
  resultSummary.value = null

  if (selectedResourceIds.size === 0) {
    errorMsg.value = '請至少選擇一個服務人員'
    return
  }
  if (!selectedStartTime.value || !selectedEndTime.value) {
    errorMsg.value = '請選擇開始和結束時間'
    return
  }

  const startDate = new Date(selectedStartTime.value)
  const endDate = new Date(selectedEndTime.value)
  if (startDate >= endDate) {
    errorMsg.value = '結束時間必須晚於開始時間'
    return
  }

  saving.value = true

  try {
    const resourceIdList = [...selectedResourceIds]
    const sourceResId = typeof props.sourceAppt.S_Resource_ID === 'object'
      ? props.sourceAppt.S_Resource_ID.id
      : props.sourceAppt.S_Resource_ID

    // Step A: check conflicts for all resources in parallel
    const conflictChecks = await Promise.allSettled(
      resourceIdList.map(async (resourceId) => {
        const excludeId = resourceId === sourceResId ? props.sourceAppt.id : undefined
        const hasConflict = await checkConflict(resourceId, startDate, endDate, excludeId)
        return { resourceId, hasConflict }
      }),
    )

    const conflictIds = new Set<number>()
    const checkFailIds = new Set<number>()
    for (const r of conflictChecks) {
      if (r.status === 'rejected') {
        // Could not check — treat as conflict (safe default)
        const idx = conflictChecks.indexOf(r)
        checkFailIds.add(resourceIdList[idx]!)
      } else if (r.value.hasConflict) {
        conflictIds.add(r.value.resourceId)
      }
    }

    const eligibleIds = resourceIdList.filter(id => !conflictIds.has(id) && !checkFailIds.has(id))

    if (eligibleIds.length === 0) {
      const names = resourceIdList
        .map(id => props.resources.find(r => r.id === id)?.Name ?? `#${id}`)
        .join('、')
      errorMsg.value = `所有選擇的服務人員（${names}）在此時段均有衝突，無法複製`
      return
    }

    // Step B: create for eligible resources in parallel
    const payload = {
      AssignDateFrom: toIdempiereDateTime(startDate),
      AssignDateTo: toIdempiereDateTime(endDate),
      Name: copyName.value || props.sourceAppt.Name,
      AD_Org_ID: props.sourceAppt.AD_Org_ID,
      ...(props.sourceAppt.Description ? { Description: props.sourceAppt.Description } : {}),
    } as Record<string, unknown>

    const createResults = await Promise.allSettled(
      eligibleIds.map(async (resourceId) => {
        await createAssignment({ ...payload, S_Resource_ID: resourceId } as any)
        return resourceId
      }),
    )

    const succeeded = createResults.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<number>).value)
    const failed = [
      ...conflictIds,
      ...checkFailIds,
      ...createResults.filter(r => r.status === 'rejected').map((_, i) => eligibleIds[i]!),
    ]

    const successCount = succeeded.length
    const failCount = failed.length

    if (failCount === 0) {
      resultSummary.value = { text: `${successCount} 筆預約已複製`, hasError: false }
      setTimeout(() => emit('success'), 800)
    } else {
      const failedNames = failed
        .map(id => props.resources.find(r => r.id === id)?.Name ?? `#${id}`)
        .join('、')
      const conflictNote = [...conflictIds].length > 0 ? '（有時段衝突）' : ''
      resultSummary.value = {
        text: `${successCount} 成功、${failCount} 失敗 ${conflictNote}：${failedNames}`,
        hasError: true,
      }
      if (successCount > 0) {
        // Partial success — give user a chance to see summary, then notify parent
        setTimeout(() => emit('success'), 2000)
      }
    }
  } catch (error: any) {
    errorMsg.value = '複製時發生錯誤，請重試'
  } finally {
    saving.value = false
  }
}
```

- [ ] **Step 3: 在 template 加 resultSummary 顯示**

在 `<!-- Error message -->` div 之後加：

```vue
<!-- Result summary -->
<div
  v-if="resultSummary"
  class="result-summary"
  :class="resultSummary.hasError ? 'summary-partial' : 'summary-ok'"
>
  {{ resultSummary.text }}
</div>
```

在 `<style scoped>` 加：

```css
.result-summary {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
}
.summary-ok {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.summary-partial {
  background: #fef9c3;
  color: #713f12;
  border: 1px solid #fde047;
}
```

- [ ] **Step 4: 執行測試**

```bash
cd webapp && npm run test 2>&1 | tail -10
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/CopyAssignmentDialog.vue
git commit -m "fix: copy dialog uses partial success — skips conflicting resources instead of aborting"
```

---

## Task 4: 多資源失敗顯示具體資源名稱

**Files:**
- Modify: `webapp/src/views/appointment/AppointmentForm.vue`

目前多資源建立失敗時只顯示 "X 成功、Y 失敗"，不指名哪個失敗。

- [ ] **Step 1: 找到 multiResultSummary 建立的位置（約 line 722）**

```typescript
if (failCount === 0) {
  multiResultSummary.value = { text: `${successCount} 筆預約已建立`, hasError: false }
} else {
  multiResultSummary.value = {
    text: `${successCount} 成功、${failCount} 失敗`,
    hasError: true,
  }
}
```

- [ ] **Step 2: 將失敗訊息改為列出失敗的資源名稱**

```typescript
if (failCount === 0) {
  multiResultSummary.value = { text: `${successCount} 筆預約已建立`, hasError: false }
} else {
  const failedNames = results
    .filter(r => r.error !== undefined)
    .map(r => effectiveResources.value.find(res => res.id === r.resourceId)?.Name ?? `#${r.resourceId}`)
    .join('、')
  multiResultSummary.value = {
    text: `${successCount} 成功、${failCount} 失敗：${failedNames}`,
    hasError: true,
  }
}
```

- [ ] **Step 3: 執行測試**

```bash
cd webapp && npm run test 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/views/appointment/AppointmentForm.vue
git commit -m "ux: show failed resource names in multi-resource submit summary"
```

---

## Task 5: 資源不可用灰色塊（S_ResourceUnAvailable）

**Files:**
- Modify: `webapp/src/api/resource.ts`
- Modify: `webapp/src/api/__tests__/resource.test.ts`
- Modify: `webapp/src/views/appointment/CalendarView.vue`

### 子任務 A — API 函數

- [ ] **Step 1: 寫失敗測試**

在 `webapp/src/api/__tests__/resource.test.ts` 尾端加：

```typescript
describe('listResourceUnavailability', () => {
  it('returns empty array when no records', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [] } })
    const result = await listResourceUnavailability([1, 2], new Date('2026-04-01'), new Date('2026-04-30'))
    expect(result).toEqual([])
  })

  it('maps DateFrom and DateTo correctly', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        records: [
          { id: 10, S_Resource_ID: { id: 1 }, DateFrom: '2026-04-21T00:00:00Z', DateTo: '2026-04-21T23:59:59Z', Name: '請假' },
        ],
      },
    })
    const result = await listResourceUnavailability([1], new Date('2026-04-01'), new Date('2026-04-30'))
    expect(result).toHaveLength(1)
    expect(result[0]!.resourceId).toBe(1)
    expect(result[0]!.name).toBe('請假')
  })

  it('handles S_Resource_ID as plain number', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        records: [{ id: 20, S_Resource_ID: 3, DateFrom: '2026-04-22T00:00:00Z', DateTo: null, Name: '休診' }],
      },
    })
    const result = await listResourceUnavailability([3], new Date('2026-04-01'), new Date('2026-04-30'))
    expect(result[0]!.resourceId).toBe(3)
    expect(result[0]!.dateTo).toBeNull()
  })
})
```

確認要 import `listResourceUnavailability`：
```typescript
import { listResources, listResourceTypes, deactivateResource, createResource, listResourceUnavailability } from '@/api/resource'
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
cd webapp && npm run test src/api/__tests__/resource.test.ts 2>&1 | tail -15
```
Expected: FAIL with "listResourceUnavailability is not a function"

- [ ] **Step 3: 實作 listResourceUnavailability()**

在 `webapp/src/api/resource.ts` 末尾加：

```typescript
export interface ResourceUnavailability {
  id: number
  resourceId: number
  dateFrom: string   // ISO date string (YYYY-MM-DD)
  dateTo: string | null
  name: string       // reason / description
}

/**
 * Fetch S_ResourceUnAvailable records for the given resources and date range.
 * Used to display grey "unavailable" blocks on the calendar.
 */
export async function listResourceUnavailability(
  resourceIds: number[],
  dateFrom: Date,
  dateTo: Date,
): Promise<ResourceUnavailability[]> {
  if (resourceIds.length === 0) return []

  const fromStr = dateFrom.toISOString().slice(0, 10)
  const toStr = dateTo.toISOString().slice(0, 10)

  // Filter: unavailability overlapping the calendar view range
  const idList = resourceIds.join(',')
  const filter = `S_Resource_ID in (${idList}) and DateFrom le '${toStr}T23:59:59Z'`

  try {
    const resp = await apiClient.get('/api/v1/models/S_ResourceUnAvailable', {
      params: {
        '$filter': filter,
        '$select': 'S_ResourceUnAvailable_ID,S_Resource_ID,DateFrom,DateTo,Name',
        '$top': '200',
      },
    })
    const records: any[] = resp.data?.records ?? []
    return records
      .filter(r => {
        // Include only records that end on or after dateFrom
        const endDate = r.DateTo ? r.DateTo.slice(0, 10) : r.DateFrom.slice(0, 10)
        return endDate >= fromStr
      })
      .map(r => ({
        id: r.id ?? r.S_ResourceUnAvailable_ID,
        resourceId: typeof r.S_Resource_ID === 'object' ? (r.S_Resource_ID.id ?? 0) : (r.S_Resource_ID ?? 0),
        dateFrom: r.DateFrom ? r.DateFrom.slice(0, 10) : fromStr,
        dateTo: r.DateTo ? r.DateTo.slice(0, 10) : null,
        name: String(r.Name ?? '不可用'),
      }))
  } catch {
    // Non-fatal — calendar still works without unavailability blocks
    return []
  }
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
cd webapp && npm run test src/api/__tests__/resource.test.ts 2>&1 | tail -15
```
Expected: PASS

### 子任務 B — CalendarView 整合

- [ ] **Step 5: 在 CalendarView.vue 加 unavailability state**

在 import 區加：
```typescript
import { listResources, listResourceTypes, deactivateResource, listResourceUnavailability } from '@/api/resource'
import type { ResourceUnavailability, ResourceType } from '@/api/resource'
```

在 `// ─── Resources ───` 段落找到 `resourceTypes = ref<ResourceType[]>([])` 之後加：
```typescript
const unavailabilityBlocks = ref<ResourceUnavailability[]>([])
```

- [ ] **Step 6: 在 reloadResources() 中順帶載入不可用記錄**

找到 `async function reloadResources()` 函數。在函數末尾，resources 載入完成之後加：

```typescript
// Load unavailability for current calendar view range
try {
  const calApi = calendarRef.value?.getApi?.()
  if (calApi && resources.value.length > 0) {
    const viewStart = calApi.view.activeStart
    const viewEnd = calApi.view.activeEnd
    const allIds = resources.value.map(r => r.id)
    unavailabilityBlocks.value = await listResourceUnavailability(allIds, viewStart, viewEnd)
  }
} catch {
  // non-fatal
}
```

- [ ] **Step 7: 加 backgroundEvents computed**

找到 `const calendarEvents = computed(...)` 或 `calendarOptions`。在 `calendarOptions` 的 `events` 屬性位置，FullCalendar 支援多個 event source array。

找到 `const calendarOptions = computed(() => ({` 區塊，在 `events:` 的值之後，確認是否有 `eventSources`。若 events 是一個 computed array，我們要加 background events 到同一個 array：

在 `calendarEvents` computed（或等效位置）找到 return 前，加入背景事件：

```typescript
// 在 calendarEvents computed 底部，return events 之前
const bgEvents = unavailabilityBlocks.value
  .filter(u => selectedResourceIds.has(u.resourceId))
  .map(u => {
    const resName = resources.value.find(r => r.id === u.resourceId)?.Name ?? ''
    return {
      id: `unavail-${u.id}`,
      title: resName ? `${resName}: ${u.name}` : u.name,
      start: u.dateFrom,
      end: u.dateTo
        ? new Date(new Date(u.dateTo).getTime() + 86400000).toISOString().slice(0, 10)  // DateTo inclusive → exclusive
        : new Date(new Date(u.dateFrom).getTime() + 86400000).toISOString().slice(0, 10),
      display: 'background' as const,
      color: '#e2e8f0',
      classNames: ['unavail-block'],
    }
  })
return [...events, ...bgEvents]
```

**注意**: 若 `calendarEvents` 的 return 是 `events`（過濾後），把上面的 bgEvents 加到 return statement：
```typescript
return [...filteredEvents, ...bgEvents]
```

- [ ] **Step 8: 在 datesSet callback 重新載入不可用記錄**

找到 `calendarOptions` 內的 `datesSet` callback。若不存在，加入：

```typescript
datesSet: async (arg) => {
  if (resources.value.length > 0) {
    const allIds = resources.value.map(r => r.id)
    unavailabilityBlocks.value = await listResourceUnavailability(allIds, arg.start, arg.end)
  }
},
```

若已有 `datesSet`，在裡面加上上述邏輯。

- [ ] **Step 9: 執行測試**

```bash
cd webapp && npm run test 2>&1 | tail -10
```
Expected: all pass

- [ ] **Step 10: Commit**

```bash
git add webapp/src/api/resource.ts webapp/src/api/__tests__/resource.test.ts webapp/src/views/appointment/CalendarView.vue
git commit -m "feat: display resource unavailability as grey background blocks on calendar"
```

---

## Task 6: 從預約建立訂單（status=DON）

**Files:**
- Modify: `webapp/src/views/appointment/AppointmentForm.vue`

nczz 在 status=DON 時顯示「建立帳單」按鈕，點擊後建立 C_Order 並將 order_id 寫回 Description JSON。

### 邏輯

- 只在 **edit mode** (editingAppt 存在) 且 status=DON 時顯示
- 若 Description.order_id 已存在 → 顯示「查看訂單」按鈕（navigate to `/order/:id`）
- 若 order_id 不存在 → 顯示「建立帳單」按鈕（需要 bpartner_id，否則 disabled + tooltip）
- 建立後：PUT Description（加入 order_id）+ toast + 顯示「查看訂單」

- [ ] **Step 1: import createOrder**

```typescript
import { createOrder } from '@/api/order'
```

- [ ] **Step 2: 加 state**

在 `const cancelling = ref(false)` 之後加：

```typescript
const creatingOrder = ref(false)
const linkedOrderId = ref<number | null>(null)
```

- [ ] **Step 3: 在 onMounted edit mode 區塊讀取 order_id**

找到 `if (props.editingAppt)` 的 onMounted 區塊，在 `parseDesc` 那行之後加：

```typescript
const desc = parseDesc(existingDescRaw.value)
// ... existing lines ...
linkedOrderId.value = desc.order_id ?? null
```

- [ ] **Step 4: 實作 handleCreateOrder()**

在 `handleSave()` 函數之前加：

```typescript
async function handleCreateOrder() {
  if (!selectedBp.value?.id && !form.bpartnerId) {
    errorMsg.value = '請先選擇客戶才能建立訂單'
    return
  }
  const bpId = selectedBp.value?.id ?? form.bpartnerId!
  const orgId = authStore.context?.organizationId ?? 0
  const whId = authStore.context?.warehouseId ?? 0

  creatingOrder.value = true
  errorMsg.value = ''
  try {
    const order = await createOrder({
      C_BPartner_ID: bpId,
      AD_Org_ID: orgId,
      M_Warehouse_ID: whId,
      IsSOTrx: true,
      Description: `來自預約：${props.editingAppt!.Name}`,
      username: authStore.user?.name ?? '',
    })
    const orderId: number = order.id ?? order.C_Order_ID
    linkedOrderId.value = orderId

    // Write order_id back into Description JSON
    const desc = parseDesc(existingDescRaw.value)
    desc.order_id = orderId
    const newDesc = serializeDesc(desc)
    existingDescRaw.value = newDesc
    await updateAssignment(props.editingAppt!.id, { Description: newDesc })

    toast.show('訂單已建立，可在訂單管理查看', 'success')
  } catch (e: any) {
    errorMsg.value = e.message || '建立訂單失敗'
  } finally {
    creatingOrder.value = false
  }
}
```

- [ ] **Step 5: 在 template 加訂單按鈕**

在 `<div class="form-actions">` 內的「取消預約」按鈕之後，`<div class="actions-right">` 之前加：

```vue
<!-- Order: only shown in edit mode when status is DON -->
<template v-if="editingAppt && form.status === 'DON'">
  <a
    v-if="linkedOrderId"
    class="btn btn-secondary"
    @click="router.push({ name: 'order-edit', params: { id: linkedOrderId } })"
  >
    查看訂單
  </a>
  <button
    v-else
    type="button"
    class="btn btn-order"
    :disabled="creatingOrder || (!selectedBp && !form.bpartnerId)"
    :title="(!selectedBp && !form.bpartnerId) ? '請先選擇客戶' : ''"
    @click="handleCreateOrder"
  >
    {{ creatingOrder ? '建立中...' : '建立帳單' }}
  </button>
</template>
```

- [ ] **Step 6: 加 CSS**

```css
.btn-order {
  background: #0ea5e9;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
}
.btn-order:hover:not(:disabled) { background: #0284c7; }
.btn-order:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 7: 執行測試**

```bash
cd webapp && npm run test 2>&1 | tail -10
```
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add webapp/src/views/appointment/AppointmentForm.vue
git commit -m "feat: add order creation button in appointment edit form when status is DON"
```

---

## Task 7: Type-check + Full Test + Build + Deploy

- [ ] **Step 1: Type-check**

```bash
cd webapp && npm run type-check 2>&1 | tail -20
```
Expected: no errors. 若有 TS 錯誤，逐一修正。

- [ ] **Step 2: Full test run**

```bash
cd webapp && npm run test 2>&1 | tail -15
```
Expected: all tests pass

- [ ] **Step 3: Build**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul && bash build.sh 2>&1 | tail -15
```
Expected: "✓ built in ..." + "JAR built: org.idempiere.ui.aesthetics_1.0.0.XXXXXXXXXX.jar"

- [ ] **Step 4: Deploy to Felix**

```bash
JAR=$(ls -t /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/*.jar 2>/dev/null | head -1)
FELIX_BASE="https://localhost:8443/osgi"
BUNDLE_SYM="org.idempiere.ui.aesthetics.v2"

# Login
CSRF=$(curl -ks -c /tmp/felix-deploy -b /tmp/felix-deploy "$FELIX_BASE/login.jsp" | grep -oP 'name="csrfToken"\s+value="\K[^"]+')
curl -ks -c /tmp/felix-deploy -b /tmp/felix-deploy -L \
    -d "username=SuperUser&password=System&csrfToken=$CSRF&returnUrl=/osgi/system/console/bundles" \
    "$FELIX_BASE/login" -o /dev/null

# Find + uninstall existing bundle
BUNDLE_ID=$(curl -ks -b /tmp/felix-deploy "$FELIX_BASE/system/console/bundles.json" | \
    python3 -c "import json,sys;data=json.load(sys.stdin);ids=[str(b['id']) for b in data.get('data',[]) if b.get('symbolicName')=='$BUNDLE_SYM'];print(ids[0] if ids else '')")
if [ -n "$BUNDLE_ID" ]; then
  curl -ks -b /tmp/felix-deploy -X POST "$FELIX_BASE/system/console/bundles/$BUNDLE_ID?action=stop" -o /dev/null
  sleep 1
  curl -ks -b /tmp/felix-deploy -X POST "$FELIX_BASE/system/console/bundles/$BUNDLE_ID?action=uninstall" -o /dev/null
  sleep 2
fi

# Install
curl -ks -b /tmp/felix-deploy -X POST \
    -F "action=install" -F "bundlestart=start" -F "bundlefile=@$JAR" \
    "$FELIX_BASE/system/console/bundles" -o /dev/null

sleep 3
NEW_ID=$(curl -ks -b /tmp/felix-deploy "$FELIX_BASE/system/console/bundles.json" | \
    python3 -c "import json,sys;data=json.load(sys.stdin);ids=[str(b['id']) for b in data.get('data',[]) if b.get('symbolicName')=='$BUNDLE_SYM'];print(ids[0] if ids else '')")
echo "Deployed bundle: $NEW_ID"
```

Expected: "Deployed bundle: 735" (or next ID)

- [ ] **Step 5: Verify active**

```bash
curl -ks -b /tmp/felix-deploy "https://localhost:8443/osgi/system/console/bundles.json" | \
  python3 -c "import json,sys;data=json.load(sys.stdin);[print(b['id'],b['symbolicName'],b['state']) for b in data.get('data',[]) if 'aesthetics' in b.get('symbolicName','')]"
```
Expected: `735 org.idempiere.ui.aesthetics.v2 Active`

---

## Self-Review

**1. Spec coverage:**
- T1 ✅ 單筆 toast — 在 edit + single-create 兩條路徑都加了
- T2 ✅ 時間說明 — banner 在 editingAppt 條件下顯示
- T3 ✅ 複製部分成功 — 完整重寫 handleCopy()
- T4 ✅ 失敗詳情 — multi-resource summary 顯示名稱；copy summary 顯示名稱
- T5 ✅ 不可用灰色塊 — API + CalendarView 整合 + datesSet 更新
- T6 ✅ 訂單按鈕 — DON 狀態觸發，order_id 寫回 Description，查看訂單導航

**2. Placeholder scan:**
- 所有步驟都有實際程式碼 ✅
- 無 TBD / TODO ✅

**3. Type consistency:**
- `ResourceUnavailability` 介面在 resource.ts 定義，CalendarView.vue import 使用 ✅
- `listResourceUnavailability` 函數名稱在 test 和實作一致 ✅
- `linkedOrderId` ref 在 state 宣告後，在 onMounted、handleCreateOrder、template 三處使用一致 ✅
