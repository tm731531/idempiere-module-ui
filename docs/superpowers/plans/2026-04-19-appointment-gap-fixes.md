# Appointment Gap Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 real gaps found during nczz comparison: time editing in edit mode, service duration recalc, order line item, silent error swallowing, and multi-resource partial-failure UX.

**Architecture:** All changes are in the appointment UI layer (AppointmentForm.vue, CalendarView.vue) and api/order.ts. No new files needed. Each task is independently releasable. Time editing is re-enabled optimistically — if iDempiere REST rejects it, the existing error catch shows the message and the user sees a clear failure rather than a silently disabled field.

**Tech Stack:** Vue 3 + TypeScript, Vitest, iDempiere REST API (OData)

---

## File Map

| File | Changes |
|------|---------|
| `webapp/src/views/appointment/AppointmentForm.vue` | Task 1 (time unlock), Task 2 (duration watcher), Task 3 (order line), Task 4 (error toasts), Task 5 (partial-fail close) |
| `webapp/src/views/appointment/CalendarView.vue` | Task 1 (drag-drop re-enable) |
| `webapp/src/api/order.ts` | Task 3 (addOrderLineByName helper) — no: addOrderLine already exists, call it from AppointmentForm |
| `webapp/src/views/appointment/__tests__/AppointmentForm.spec.ts` | Task 1, 2, 3, 4, 5 tests |
| `webapp/src/api/__tests__/order.test.ts` | Verify addOrderLine already tested |

---

### Task 1: Re-enable time editing in edit mode + drag-drop

**Context:** AppointmentForm currently disables dateFrom/dateTo in edit mode, assuming iDempiere REST rejects AssignDateFrom/To updates. nczz allows time editing. We unlock optimistically — if the API rejects, the existing catch in handleSave shows the error message. Drag-drop in CalendarView was removed for the same (unverified) reason; add it back.

**Files:**
- Modify: `webapp/src/views/appointment/AppointmentForm.vue`
- Modify: `webapp/src/views/appointment/CalendarView.vue`
- Modify: `webapp/src/views/appointment/__tests__/AppointmentForm.spec.ts`

- [ ] **Step 1: Write failing tests for time unlock**

In `webapp/src/views/appointment/__tests__/AppointmentForm.spec.ts`, after the existing mock block, add inside the `describe('AppointmentForm', ...)`:

```typescript
describe('edit mode — time fields', () => {
  it('time inputs are enabled in edit mode', async () => {
    const editingAppt = {
      id: 99,
      Name: 'Test',
      S_Resource_ID: { id: 1 },
      AssignDateFrom: '2026-04-19T10:00:00Z',
      AssignDateTo:   '2026-04-19T11:00:00Z',
      Description: '{}',
    }
    const wrapper = mount(AppointmentForm, {
      props: { resources: [], existingAssignments: [], editingAppt },
      global: { plugins: [router] },
    })
    await flushPromises()
    const dateFromInput = wrapper.find('input[type="datetime-local"]')
    expect(dateFromInput.attributes('disabled')).toBeUndefined()
  })

  it('handleSave in edit mode sends AssignDateFrom and AssignDateTo', async () => {
    const { updateAssignment } = await import('@/api/assignment')
    vi.mocked(updateAssignment).mockResolvedValue({})

    const editingAppt = {
      id: 99,
      Name: 'Test',
      S_Resource_ID: { id: 1 },
      AssignDateFrom: '2026-04-19T10:00:00Z',
      AssignDateTo:   '2026-04-19T11:00:00Z',
      Description: '{}',
    }
    const wrapper = mount(AppointmentForm, {
      props: { resources: [], existingAssignments: [], editingAppt },
      global: { plugins: [router] },
    })
    await flushPromises()
    await wrapper.find('button.btn-primary').trigger('click')
    await flushPromises()
    expect(updateAssignment).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ AssignDateFrom: expect.any(String), AssignDateTo: expect.any(String) }),
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp
npm run test -- --reporter=verbose src/views/appointment/__tests__/AppointmentForm.spec.ts 2>&1 | grep -E "FAIL|PASS|✓|✗|×" | head -20
```

Expected: FAIL — inputs are still disabled, updateAssignment payload missing time fields.

- [ ] **Step 3: Unlock time inputs in AppointmentForm template**

In `webapp/src/views/appointment/AppointmentForm.vue`, change the time input block at line ~89:

```vue
      <div class="form-group">
        <label class="form-label">開始時間</label>
        <input
          v-model="form.dateFrom"
          type="datetime-local"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label class="form-label">結束時間</label>
        <input
          v-model="form.dateTo"
          type="datetime-local"
          class="form-input"
        />
      </div>
```

Remove the old time-locked-info banner that was below (the `<div v-if="editingAppt" class="time-locked-info">` block).

- [ ] **Step 4: Include time fields in edit-mode save payload**

In `handleSave()` in AppointmentForm.vue, find the edit branch (around line 771):

```typescript
    if (props.editingAppt) {
      await updateAssignment(props.editingAppt.id, {
        AssignDateFrom: toIdempiereDateTime(new Date(form.dateFrom)),
        AssignDateTo: toIdempiereDateTime(new Date(form.dateTo)),
        Name: nameStr || form.name.trim(),
        Description: descStr,
      })
      void setAssignmentColorOverride(props.editingAppt.id, form.colorOverride)
      toast.add({ severity: 'success', summary: '預約已更新', life: 3000 })
```

- [ ] **Step 5: Re-enable drag-drop in CalendarView**

In `webapp/src/views/appointment/CalendarView.vue`:

**Add imports back** (around line 191):
```typescript
import type { CalendarOptions, DateSelectArg, EventClickArg, DatesSetArg, EventDropArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { listAssignments, updateAssignment } from '@/api/assignment'
```

**Change `editable: false` back to `editable: true`** and **add back handlers** in calendarOptions:
```typescript
  editable: true,
  selectable: true,
  height: '100%',
  events: calendarEvents.value as any[],
  select: handleSelect,
  eventClick: handleEventClick,
  eventDrop: handleEventDrop,
  eventResize: handleEventResize,
  datesSet: handleDatesSet,
```

**Add back the two handler functions** before `handleDatesSet`:
```typescript
async function handleEventDrop(info: EventDropArg) {
  if (!info.event.extendedProps.assignment) { info.revert(); return }
  const a = info.event.extendedProps.assignment
  const newStart = info.event.start!
  const newEnd = info.event.end ?? new Date(newStart.getTime() + 30 * 60 * 1000)
  try {
    await updateAssignment(a.id, {
      AssignDateFrom: toIdempiereDateTime(newStart),
      AssignDateTo: toIdempiereDateTime(newEnd),
    })
    await loadAssignments()
  } catch {
    info.revert()
    toast.add({
      severity: 'error',
      summary: '拖拉更新失敗',
      detail: 'iDempiere 不允許修改已儲存預約的時間，請點選事件編輯',
      life: 5000,
    })
  }
}

async function handleEventResize(info: EventResizeDoneArg) {
  if (!info.event.extendedProps.assignment) { info.revert(); return }
  const a = info.event.extendedProps.assignment
  const newEnd = info.event.end
  if (!newEnd) { info.revert(); return }
  try {
    await updateAssignment(a.id, {
      AssignDateTo: toIdempiereDateTime(newEnd),
    })
    await loadAssignments()
  } catch {
    info.revert()
    toast.add({
      severity: 'error',
      summary: '調整時間失敗',
      detail: 'iDempiere 不允許修改已儲存預約的時間，請點選事件編輯',
      life: 5000,
    })
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp
npm run test -- src/views/appointment/__tests__/AppointmentForm.spec.ts 2>&1 | tail -8
```

Expected: all tests pass.

- [ ] **Step 7: Type-check**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run type-check 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul
git add webapp/src/views/appointment/AppointmentForm.vue \
        webapp/src/views/appointment/CalendarView.vue \
        webapp/src/views/appointment/__tests__/AppointmentForm.spec.ts
git commit -m "feat: re-enable time editing in edit mode and drag-drop on calendar"
```

---

### Task 2: Fix service duration recalc when start time changes

**Context:** `onServiceChange()` recalculates `form.dateTo` when a service is selected, but only fires on service selection. If the user selects a service and then changes the start time, the end time is not updated. Fix: watch `form.dateFrom` in create mode and recalc when a service with duration is active.

**Files:**
- Modify: `webapp/src/views/appointment/AppointmentForm.vue`
- Modify: `webapp/src/views/appointment/__tests__/AppointmentForm.spec.ts`

- [ ] **Step 1: Write failing test**

Add to `AppointmentForm.spec.ts` in the `describe('AppointmentForm', ...)` block:

```typescript
describe('service duration recalc on start time change', () => {
  it('recalculates dateTo when dateFrom changes after service selection with duration', async () => {
    const { useAppointmentServices } = await import('@/composables/useAppointmentServices')
    // stub services with a duration
    vi.mocked(useAppointmentServices).mockReturnValue({
      services: { value: [{ Value: 'SVC1', Name: '諮詢', durationMinutes: 60 }] },
      load: vi.fn(),
    } as any)

    const wrapper = mount(AppointmentForm, {
      props: { resources: [{ id: 1, Name: '醫師A' }], existingAssignments: [] },
      global: { plugins: [router] },
    })
    await flushPromises()

    // select service
    await wrapper.find('select.form-input').setValue('諮詢')
    // set start time
    const inputs = wrapper.findAll('input[type="datetime-local"]')
    await inputs[0]!.setValue('2026-04-20T09:00')
    await nextTick()
    // dateTo should be start + 60 min
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('2026-04-20T10:00')
  })
})
```

Also add `import { nextTick } from 'vue'` at the top of the test file if not already there.

- [ ] **Step 2: Run to verify fail**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp
npm run test -- src/views/appointment/__tests__/AppointmentForm.spec.ts 2>&1 | grep -E "duration|FAIL|PASS" | head -10
```

Expected: FAIL.

- [ ] **Step 3: Add watcher in AppointmentForm**

In `webapp/src/views/appointment/AppointmentForm.vue`, after the existing `onServiceChange()` function (around line 472), add:

```typescript
// Recalculate end time when start time changes in create mode, if a service with duration is selected
watch(() => form.dateFrom, (newFrom) => {
  if (props.editingAppt || !form.service || !newFrom) return
  const matched = appointmentServices.value.find(s => s.Name === form.service)
  const duration = matched?.durationMinutes ?? 0
  if (duration <= 0) return
  const from = new Date(newFrom)
  if (isNaN(from.getTime())) return
  const to = new Date(from.getTime() + duration * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  form.dateTo = `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}T${pad(to.getHours())}:${pad(to.getMinutes())}`
})
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp
npm run test -- src/views/appointment/__tests__/AppointmentForm.spec.ts 2>&1 | tail -8
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul
git add webapp/src/views/appointment/AppointmentForm.vue \
        webapp/src/views/appointment/__tests__/AppointmentForm.spec.ts
git commit -m "fix: recalculate appointment end time when start time changes after service selection"
```

---

### Task 3: Add OrderLine when creating order from appointment

**Context:** `handleCreateOrder()` only creates a C_Order header. nczz also creates a C_OrderLine with the service product. Fix: after creating the order, look up M_Product by the service name (`form.service`). If found, call `addOrderLine`. If not found, silently skip — order is still created and useful.

**Files:**
- Modify: `webapp/src/views/appointment/AppointmentForm.vue`
- Modify: `webapp/src/views/appointment/__tests__/AppointmentForm.spec.ts`

- [ ] **Step 1: Add mock for api/product and addOrderLine in test file**

At the top of `AppointmentForm.spec.ts`, add to the vi.mock block:

```typescript
vi.mock('@/api/product', () => ({
  listProducts: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/order', () => ({
  createOrder: vi.fn(),
  addOrderLine: vi.fn(),
}))
```

- [ ] **Step 2: Write failing test for order line creation**

```typescript
describe('handleCreateOrder — adds order line when service matches a product', () => {
  it('calls addOrderLine when a M_Product matches the service name', async () => {
    const { createOrder, addOrderLine } = await import('@/api/order')
    const { listProducts } = await import('@/api/product')
    vi.mocked(createOrder).mockResolvedValue({ id: 200 })
    vi.mocked(addOrderLine).mockResolvedValue({})
    vi.mocked(listProducts).mockResolvedValue([
      { id: 50, Name: '諮詢', C_UOM_ID: { id: 100 } },
    ])

    const editingAppt = {
      id: 99, Name: '王小明 - 諮詢',
      S_Resource_ID: { id: 1 },
      AssignDateFrom: '2026-04-19T10:00:00Z',
      AssignDateTo:   '2026-04-19T11:00:00Z',
      Description: '{"status":"DON","bpartner_id":1001,"bpartner_name":"王小明","service":"諮詢"}',
    }
    // stub parseDesc to return service = '諮詢'
    const { parseDesc } = await import('@/composables/useAppointmentDesc')
    vi.mocked(parseDesc).mockReturnValue({ status: 'DON', bpartner_id: 1001, bpartner_name: '王小明', service: '諮詢' })

    const wrapper = mount(AppointmentForm, {
      props: { resources: [], existingAssignments: [], editingAppt },
      global: { plugins: [router] },
    })
    await flushPromises()

    // simulate clicking 建立帳單
    const orderBtn = wrapper.findAll('button').find(b => b.text().includes('建立帳單'))
    expect(orderBtn).toBeTruthy()
    await orderBtn!.trigger('click')
    await flushPromises()

    expect(addOrderLine).toHaveBeenCalledWith(200, expect.objectContaining({ M_Product_ID: 50, QtyOrdered: 1 }))
  })

  it('skips addOrderLine when no product matches service name', async () => {
    const { createOrder, addOrderLine } = await import('@/api/order')
    const { listProducts } = await import('@/api/product')
    vi.mocked(createOrder).mockResolvedValue({ id: 201 })
    vi.mocked(addOrderLine).mockResolvedValue({})
    vi.mocked(listProducts).mockResolvedValue([]) // no match

    const editingAppt = {
      id: 99, Name: 'Test',
      S_Resource_ID: { id: 1 },
      AssignDateFrom: '2026-04-19T10:00:00Z',
      AssignDateTo:   '2026-04-19T11:00:00Z',
      Description: '{"status":"DON","service":"未知服務"}',
    }
    const { parseDesc } = await import('@/composables/useAppointmentDesc')
    vi.mocked(parseDesc).mockReturnValue({ status: 'DON', service: '未知服務' })

    const wrapper = mount(AppointmentForm, {
      props: { resources: [], existingAssignments: [], editingAppt },
      global: { plugins: [router] },
    })
    await flushPromises()
    const orderBtn = wrapper.findAll('button').find(b => b.text().includes('建立帳單'))
    await orderBtn!.trigger('click')
    await flushPromises()

    expect(createOrder).toHaveBeenCalled()
    expect(addOrderLine).not.toHaveBeenCalled() // skipped gracefully
  })
})
```

- [ ] **Step 3: Run to verify fail**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp
npm run test -- src/views/appointment/__tests__/AppointmentForm.spec.ts 2>&1 | grep -E "order line|FAIL|addOrderLine" | head -10
```

Expected: FAIL.

- [ ] **Step 4: Add import and implement in AppointmentForm**

In `AppointmentForm.vue` script block, add import:
```typescript
import { addOrderLine } from '@/api/order'
import { listProducts } from '@/api/product'
```

In `handleCreateOrder()`, after `linkedOrderId.value = orderId` and the Description write-back, add:

```typescript
    // Attempt to add an order line for the service product (non-blocking)
    const serviceName = form.service.trim()
    if (serviceName) {
      try {
        const products = await listProducts(`Name eq '${serviceName}' and IsActive eq true`)
        if (products.length > 0) {
          const product = products[0]!
          const productId: number = product.id ?? product.M_Product_ID
          const uomId: number | undefined =
            typeof product.C_UOM_ID === 'object' ? (product.C_UOM_ID?.id ?? undefined) : (product.C_UOM_ID ?? undefined)
          await addOrderLine(orderId, {
            M_Product_ID: productId,
            C_UOM_ID: uomId,
            QtyOrdered: 1,
            PriceEntered: 0,
            Description: `來自預約：${props.editingAppt!.Name}`,
          })
        }
      } catch {
        // Non-fatal: order is created, line is optional
      }
    }
```

Full `handleCreateOrder` after the change:

```typescript
async function handleCreateOrder() {
  const bpId = selectedBp.value?.id ?? form.bpartnerId
  if (!bpId) {
    errorMsg.value = '請先選擇客戶才能建立訂單'
    return
  }
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

    // Attempt order line for the service product (non-fatal if no match)
    const serviceName = form.service.trim()
    if (serviceName) {
      try {
        const products = await listProducts(`Name eq '${serviceName}' and IsActive eq true`)
        if (products.length > 0) {
          const product = products[0]!
          const productId: number = product.id ?? product.M_Product_ID
          const uomId: number | undefined =
            typeof product.C_UOM_ID === 'object' ? (product.C_UOM_ID?.id ?? undefined) : (product.C_UOM_ID ?? undefined)
          await addOrderLine(orderId, {
            M_Product_ID: productId,
            C_UOM_ID: uomId,
            QtyOrdered: 1,
            PriceEntered: 0,
            Description: `來自預約：${props.editingAppt!.Name}`,
          })
        }
      } catch { /* non-fatal */ }
    }

    // Write order_id back into Description JSON
    const desc = parseDesc(existingDescRaw.value)
    desc.order_id = orderId
    const newDesc = serializeDesc(desc)
    existingDescRaw.value = newDesc
    try {
      await updateAssignment(props.editingAppt!.id, { Description: newDesc })
    } catch {
      toast.add({ severity: 'warn', summary: '訂單已建立，但關聯寫回失敗', life: 5000 })
    }

    toast.add({ severity: 'success', summary: '訂單已建立', detail: '可至訂單管理查看', life: 4000 })
  } catch (e: any) {
    errorMsg.value = e.message || '建立訂單失敗'
  } finally {
    creatingOrder.value = false
  }
}
```

Note: this also adds error handling for the Description write-back (covers Task 4 for this path).

- [ ] **Step 5: Run tests to verify pass**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp
npm run test -- src/views/appointment/__tests__/AppointmentForm.spec.ts 2>&1 | tail -8
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul
git add webapp/src/views/appointment/AppointmentForm.vue \
        webapp/src/views/appointment/__tests__/AppointmentForm.spec.ts
git commit -m "feat: add C_OrderLine for service product when creating order from appointment"
```

---

### Task 4: Fix silent error swallowing

**Context:** Three silent failure paths identified: (a) resource load failure in CalendarView shows empty sidebar with no explanation; (b) customer search API failure shows empty dropdown with no message; (c) conflict detection API failure silently treats conflict as absent. Fix all three with visible user feedback.

**Files:**
- Modify: `webapp/src/views/appointment/CalendarView.vue`
- Modify: `webapp/src/views/appointment/AppointmentForm.vue`

No test changes needed for these (they are UI-only toast/error message additions to error paths).

- [ ] **Step 1: Fix resource load error in CalendarView**

In `onMounted` of `CalendarView.vue`, the resource load block is:

```typescript
  resourcesLoading.value = true
  try {
    const [resList, typeList] = await Promise.all([listResources(), listResourceTypes()])
    resources.value = resList
    resourceTypes.value = typeList
    resources.value.forEach(r => selectedResourceIds.add(r.id))
  } catch {
    resources.value = []
  } finally {
    resourcesLoading.value = false
  }
```

Change the catch to:

```typescript
  } catch {
    resources.value = []
    toast.add({ severity: 'error', summary: '無法載入服務人員', detail: '請重新整理頁面', life: 5000 })
  } finally {
```

- [ ] **Step 2: Fix customer search failure in AppointmentForm**

In `AppointmentForm.vue`, `handleBpSearch()`:

```typescript
  bpDebounce = setTimeout(async () => {
    bpDebounce = null
    try {
      const results = await searchCustomers(bpSearch.value.trim())
      bpResults.value = results.map((r: any) => ({
        id: r.id ?? r.C_BPartner_ID,
        Name: r.Name ?? r.identifier ?? '',
        Phone: r.Phone || undefined,
        EMail: r.EMail || undefined,
      }))
    } catch {
      bpResults.value = []
      errorMsg.value = '客戶搜尋失敗，請稍後再試'
    }
  }, 300)
```

- [ ] **Step 3: Fix conflict detection API failure in AppointmentForm**

In the multi-resource conflict watcher (around line 492), the failure path currently sets `[id, false, id]` which silently treats the conflict as absent. Change to mark the resource as unknown and show an error:

Find:
```typescript
          } catch {
            return [id, false, id] as [number, boolean, number]
          }
```

Change to:
```typescript
          } catch {
            return [id, false, id] as [number, boolean, number]
          }
```
Then in the section after the loop that processes `failedIds`:

```typescript
      if (failedIds.length > 0) {
        const failedNames = failedIds
          .map(id => effectiveResources.value.find(r => r.id === id)?.Name ?? `#${id}`)
          .join('、')
        errorMsg.value = `無法確認衝突狀態的服務人員：${failedNames}，請手動確認`
      }
```

This already exists at line ~516 but uses a confusing message. Change the message to:

```typescript
        errorMsg.value = `衝突偵測失敗（${failedNames}）— 請手動確認是否有時段衝突`
```

- [ ] **Step 4: Type-check and full test suite**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp
npm run type-check 2>&1 | tail -5
npm run test 2>&1 | tail -8
```

Expected: 0 TypeScript errors, all 514+ tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul
git add webapp/src/views/appointment/AppointmentForm.vue \
        webapp/src/views/appointment/CalendarView.vue
git commit -m "fix: show error toasts for resource load failure, customer search failure, and conflict detection failure"
```

---

### Task 5: Multi-resource partial failure — auto-close after summary

**Context:** When a multi-resource create has partial failures, the form stays open forever showing a summary. The user has no guided path to close. Fix: after showing the partial-success summary for 3 seconds, auto-emit `'saved'` to close the modal and let the calendar reload (showing the successful ones). Also apply same pattern in CopyAssignmentDialog if it doesn't already close.

**Files:**
- Modify: `webapp/src/views/appointment/AppointmentForm.vue`

- [ ] **Step 1: Write failing test**

In `AppointmentForm.spec.ts`:

```typescript
describe('multi-resource partial failure — auto-close', () => {
  it('emits saved after 3 seconds on partial failure', async () => {
    vi.useFakeTimers()
    const { createMultipleAssignments } = await import('@/api/assignment')
    vi.mocked(createMultipleAssignments).mockResolvedValue([
      { resourceId: 1, result: { id: 10 } },
      { resourceId: 2, error: new Error('conflict') },
    ])

    const wrapper = mount(AppointmentForm, {
      props: {
        resources: [{ id: 1, Name: 'A' }, { id: 2, Name: 'B' }],
        existingAssignments: [],
      },
      global: { plugins: [router] },
    })
    await flushPromises()

    // Switch to multi mode and select both resources
    const modeBtns = wrapper.findAll('button.mode-btn')
    await modeBtns[1]!.trigger('click') // 多資源同時
    const checkboxes = wrapper.findAll('input[type="checkbox"].resource-checkbox')
    for (const cb of checkboxes) await cb.setValue(true)

    // Fill mandatory fields
    const nameInput = wrapper.find('input[placeholder="預約名稱"]')
    await nameInput.setValue('Test')
    const dtInputs = wrapper.findAll('input[type="datetime-local"]')
    await dtInputs[0]!.setValue('2026-04-20T10:00')
    await dtInputs[1]!.setValue('2026-04-20T11:00')

    await wrapper.find('button.btn-primary').trigger('click')
    await flushPromises()

    // Should not have emitted yet
    expect(wrapper.emitted('saved')).toBeFalsy()

    // Advance 3s
    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(wrapper.emitted('saved')).toBeTruthy()

    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp
npm run test -- src/views/appointment/__tests__/AppointmentForm.spec.ts 2>&1 | grep -E "auto-close|FAIL|saved" | head -10
```

Expected: FAIL.

- [ ] **Step 3: Implement auto-close in AppointmentForm**

In `handleSave()`, the multi-resource partial-failure section (around line 796):

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

      saving.value = false
      if (failCount === 0) {
        if (linkedConsultationId.value) {
          router.push({ name: 'consultation-edit', params: { id: linkedConsultationId.value } })
        } else {
          emit('saved')
        }
      }
      // On partial failure: stay open so the user can see the summary
      return
```

Replace the entire block with:

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

      saving.value = false

      // Close after showing the summary (3s on partial, 800ms on full success)
      const delay = failCount > 0 ? 3000 : 800
      setTimeout(() => {
        if (linkedConsultationId.value) {
          router.push({ name: 'consultation-edit', params: { id: linkedConsultationId.value } })
        } else {
          emit('saved')
        }
      }, delay)
      return
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp
npm run test 2>&1 | tail -8
```

Expected: all tests pass.

- [ ] **Step 5: Type-check**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run type-check 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul
git add webapp/src/views/appointment/AppointmentForm.vue \
        webapp/src/views/appointment/__tests__/AppointmentForm.spec.ts
git commit -m "fix: auto-close multi-resource form after partial failure (3s summary display)"
```

---

### Task 6: Build, deploy, and verify

- [ ] **Step 1: Full test suite**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp
npm run test 2>&1 | tail -8
```

Expected: all tests pass (≥514).

- [ ] **Step 2: Type-check**

```bash
npm run type-check 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul
bash build.sh 2>&1 | tail -10
```

Expected: `JAR built: org.idempiere.ui.aesthetics_1.0.0.YYYYMMDDHHMI.jar`

- [ ] **Step 4: Deploy**

```bash
# Login
CSRF=$(curl -ks -c /tmp/felix-deploy -b /tmp/felix-deploy "https://localhost:8443/osgi/login.jsp" | grep -oP 'name="csrfToken"\s+value="\K[^"]+')
curl -ks -c /tmp/felix-deploy -b /tmp/felix-deploy -L \
    -d "username=SuperUser&password=System&csrfToken=$CSRF&returnUrl=/osgi/system/console/bundles" \
    "https://localhost:8443/osgi/login" -o /dev/null

# Find current bundle
BUNDLE_ID=$(curl -ks -b /tmp/felix-deploy "https://localhost:8443/osgi/system/console/bundles.json" | \
    python3 -c "import json,sys;data=json.load(sys.stdin);[print(b['id']) for b in data.get('data',[]) if 'aesthetics' in b.get('symbolicName','')]")

# Stop + uninstall + install new
JAR=$(ls -t org.idempiere.ui.aesthetics_*.jar | head -1)
curl -ks -b /tmp/felix-deploy -X POST "https://localhost:8443/osgi/system/console/bundles/${BUNDLE_ID}?action=stop" -o /dev/null
sleep 1
curl -ks -b /tmp/felix-deploy -X POST "https://localhost:8443/osgi/system/console/bundles/${BUNDLE_ID}?action=uninstall" -o /dev/null
sleep 2
curl -ks -b /tmp/felix-deploy -X POST -F "action=install" -F "bundlestart=start" -F "bundlefile=@$JAR" \
    "https://localhost:8443/osgi/system/console/bundles" -o /dev/null
sleep 2

# Verify Active
curl -ks -b /tmp/felix-deploy "https://localhost:8443/osgi/system/console/bundles.json" | \
    python3 -c "import json,sys;data=json.load(sys.stdin);[print(b['id'],'→',b['state']) for b in data.get('data',[]) if 'aesthetics' in b.get('symbolicName','')]"
```

Expected: `<new_id> → Active`

- [ ] **Step 5: Dispatch UX team + Test team for comparison**

After confirming Active bundle, dispatch two parallel agents:
1. **UX walkthrough agent** — walks through every scenario from the nczz comparison list, reports what works vs. broken
2. **Test agent** — runs the test suite and checks for regressions

---

## Self-Review

**Spec coverage:**
- ✅ Task 1: Time editing re-enabled, drag-drop re-enabled
- ✅ Task 2: Service duration recalc on start time change
- ✅ Task 3: OrderLine added for service product
- ✅ Task 4: Silent errors now shown (resource load, customer search, conflict detection, desc write-back)
- ✅ Task 5: Multi-resource partial failure auto-closes after 3s summary
- ✅ Task 6: Build + deploy + verify

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:**
- `addOrderLine(orderId, { M_Product_ID, C_UOM_ID, QtyOrdered, PriceEntered, Description })` matches `OrderLineData` interface in `api/order.ts:42`
- `listProducts(filter)` returns `any[]` with `.id ?? .M_Product_ID` and `.C_UOM_ID` — matches existing product API pattern
- `handleEventDrop(info: EventDropArg)` and `handleEventResize(info: EventResizeDoneArg)` match FullCalendar type imports
