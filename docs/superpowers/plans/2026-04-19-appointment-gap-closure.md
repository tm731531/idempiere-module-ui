# Appointment Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every UX gap identified in the nczz comparison report — service presets, resource-type grouping, status color management UI, sidebar admin shortcuts, resource deactivation, BPartner phone/email in search, and calendar date-jump search.

**Architecture:** All new data (service presets, status color overrides) stored in existing iDempiere infrastructure — AD_Reference/AD_Ref_List for service presets (same pattern as AppointmentStatus), localStorage for status color overrides (avoids AD permission requirement). Resource grouping loaded from existing S_ResourceType. No new API endpoints required.

**Tech Stack:** Vue 3, TypeScript, FullCalendar v6, iDempiere REST OData, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/api/bpartner.ts` | Modify | Add Phone, EMail to searchCustomers $select |
| `src/api/resource.ts` | Modify | Add S_ResourceType_ID to Resource interface + listResources; add listResourceTypes(); add deactivateResource() |
| `src/composables/useAppointmentServices.ts` | **Create** | Load service presets from AD_Reference "AppointmentService" |
| `src/composables/useAppointmentStatuses.ts` | Modify | Store ad_ref_list id per status; add updateStatusColor()/updateStatusName() saving to localStorage |
| `src/views/appointment/CalendarView.vue` | Modify | Sidebar: service filter, resource-type grouping, admin buttons, date-jump search |
| `src/views/appointment/AppointmentForm.vue` | Modify | Service dropdown + auto end-time calculation |
| `src/composables/__tests__/useAppointmentServices.spec.ts` | **Create** | Unit tests for service composable |
| `src/api/__tests__/resource.test.ts` | **Create** | Unit tests for deactivateResource, listResourceTypes |

---

## Task 1: BPartner 搜尋補 Phone / Email

**Files:**
- Modify: `src/api/bpartner.ts` line 82–90
- Modify: `src/views/appointment/AppointmentForm.vue` (bp-dropdown-item)

- [ ] **Step 1: Modify searchCustomers to include Phone and EMail**

In `src/api/bpartner.ts`, change the `$select` in `searchCustomers`:

```typescript
export async function searchCustomers(query: string): Promise<any[]> {
  const safe = escapeODataString(query)
  const resp = await apiClient.get('/api/v1/models/C_BPartner', {
    params: {
      '$filter': `IsCustomer eq true and IsActive eq true and (contains(Name,'${safe}') or contains(TaxID,'${safe}'))`,
      '$select': 'C_BPartner_ID,Name,TaxID,Phone,EMail',
      '$orderby': 'Name',
      '$top': 50,
    },
  })
  return resp.data.records || []
}
```

- [ ] **Step 2: Find BPartner dropdown item in AppointmentForm.vue**

Search for `bp-dropdown-item` or the BPartner search result rendering in `AppointmentForm.vue`. It will look similar to:

```html
<div class="bp-dropdown-item" @click="selectBp(bp)">
  {{ bp.Name }}
</div>
```

Replace with:

```html
<div class="bp-dropdown-item" @click="selectBp(bp)">
  <div class="bp-name">{{ bp.Name }}</div>
  <div v-if="bp.Phone || bp.EMail" class="bp-contact">
    <span v-if="bp.Phone">{{ bp.Phone }}</span>
    <span v-if="bp.Phone && bp.EMail"> · </span>
    <span v-if="bp.EMail">{{ bp.EMail }}</span>
  </div>
</div>
```

- [ ] **Step 3: Add CSS for bp-contact in AppointmentForm.vue `<style scoped>`**

```css
.bp-contact {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 1px;
}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/api/bpartner.ts src/views/appointment/AppointmentForm.vue
git commit -m "feat: show phone and email in appointment BPartner search results"
```

---

## Task 2: 搜尋「跳到日期」功能

**Files:**
- Modify: `src/views/appointment/CalendarView.vue`

When the user types in the sidebar search box and there are matching events, clicking a result should jump the calendar to that event's date.

- [ ] **Step 1: Add searchResults computed to CalendarView.vue**

In the `<script setup>` section, after the `calendarEvents` computed, add:

```typescript
// ─── Search results for date-jump ─────────────────────────────────────────────
const searchResults = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q || q.length < 2) return []
  return calendarEvents.value
    .filter(e =>
      e.title.toLowerCase().includes(q) ||
      (e.extendedProps.desc?.bpartner_name ?? '').toLowerCase().includes(q) ||
      (e.extendedProps.desc?.service ?? '').toLowerCase().includes(q)
    )
    .slice(0, 8)
})

function jumpToEvent(event: { start: string | Date }) {
  const api = calendarRef.value?.getApi()
  if (!api || !event.start) return
  api.gotoDate(new Date(event.start))
  searchQuery.value = ''
}
```

- [ ] **Step 2: Add search results dropdown in template**

In `CalendarView.vue` template, after the search input inside `.sidebar-section`, add:

```html
<!-- Search results for date-jump -->
<div v-if="searchResults.length > 0" class="search-results">
  <div
    v-for="evt in searchResults"
    :key="evt.id"
    class="search-result-item"
    @click="jumpToEvent(evt)"
  >
    <span class="result-dot" :style="{ backgroundColor: evt.backgroundColor }"></span>
    <span class="result-title">{{ evt.title }}</span>
    <span class="result-date">{{ formatEventDate(evt.start) }}</span>
  </div>
</div>
```

- [ ] **Step 3: Add formatEventDate helper**

In the `<script setup>` section:

```typescript
function formatEventDate(start: string | Date | undefined): string {
  if (!start) return ''
  const d = new Date(start)
  const mo = d.getMonth() + 1
  const day = d.getDate()
  return `${mo}/${day}`
}
```

- [ ] **Step 4: Add CSS in CalendarView.vue `<style scoped>`**

```css
.search-results {
  margin-top: 0.25rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: white;
  overflow: hidden;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  cursor: pointer;
  font-size: 0.75rem;
  border-bottom: 1px solid #f1f5f9;
}

.search-result-item:last-child { border-bottom: none; }
.search-result-item:hover { background: #f8fafc; }

.result-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.result-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-date {
  color: #94a3b8;
  flex-shrink: 0;
}
```

- [ ] **Step 5: Run tests**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test
```

Expected: all tests pass (no existing tests cover CalendarView directly).

- [ ] **Step 6: Commit**

```bash
git add src/views/appointment/CalendarView.vue
git commit -m "feat: add search results with date-jump in appointment sidebar"
```

---

## Task 3: Sidebar 管理快捷按鈕

**Files:**
- Modify: `src/views/appointment/CalendarView.vue`

Add "管理資源" and "管理狀態" buttons at the bottom of the sidebar, routing to the existing admin pages.

- [ ] **Step 1: Import useRouter in CalendarView.vue**

At the top of `<script setup>` in CalendarView.vue, add:

```typescript
import { useRouter } from 'vue-router'
const router = useRouter()
```

- [ ] **Step 2: Add admin nav functions**

```typescript
function goManageResources() {
  router.push({ name: 'admin-reference-data' })
}

function goManageStatuses() {
  router.push({ name: 'admin-reference-data' })
}
```

Check the actual route name for admin-reference-data in `src/router/index.ts`. The route at `/admin/reference-data` should have a `name` property — use that name.

- [ ] **Step 3: Add admin section at bottom of sidebar template**

After the last `<div class="sidebar-section">` (the show-cancelled toggle), add:

```html
<!-- Admin shortcuts -->
<div class="sidebar-section sidebar-admin">
  <button class="admin-shortcut-btn" @click="goManageResources">
    管理資源
  </button>
  <button class="admin-shortcut-btn" @click="goManageStatuses">
    管理狀態設定
  </button>
</div>
```

- [ ] **Step 4: Add CSS**

```css
.sidebar-admin {
  margin-top: auto;
  padding-top: 0.5rem;
}

.admin-shortcut-btn {
  display: block;
  width: 100%;
  padding: 0.375rem 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
}

.admin-shortcut-btn:hover {
  background: #f1f5f9;
  color: #334155;
}
```

- [ ] **Step 5: Verify router name**

```bash
grep -n "name:" /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp/src/router/index.ts | grep -i "admin\|reference"
```

Update the `router.push` calls with the correct route name from the output.

- [ ] **Step 6: Run tests**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test
```

- [ ] **Step 7: Commit**

```bash
git add src/views/appointment/CalendarView.vue
git commit -m "feat: add admin shortcut buttons to appointment sidebar"
```

---

## Task 4: 資源停用功能

**Files:**
- Modify: `src/api/resource.ts`
- Modify: `src/views/appointment/CalendarView.vue`

- [ ] **Step 1: Add listResourceTypes and deactivateResource to resource.ts**

```typescript
export interface ResourceType {
  id: number
  Name: string
}

export async function listResourceTypes(): Promise<ResourceType[]> {
  const resp = await apiClient.get('/api/v1/models/S_ResourceType', {
    params: {
      '$select': 'S_ResourceType_ID,Name',
      '$filter': 'IsActive eq true',
      '$orderby': 'Name',
    },
  })
  return (resp.data.records || []).map((r: any) => ({
    id: r.id ?? r.S_ResourceType_ID,
    Name: r.Name,
  }))
}

export async function deactivateResource(id: number): Promise<void> {
  await apiClient.put(`/api/v1/models/S_Resource/${id}`, { IsActive: false })
}
```

Also update the `Resource` interface to include `S_ResourceType_ID`:

```typescript
export interface Resource {
  id: number
  Name: string
  IsActive: boolean
  resourceTypeId: number | null
}
```

And update `listResources` to fetch and map S_ResourceType_ID:

```typescript
export async function listResources(): Promise<Resource[]> {
  const resp = await apiClient.get('/api/v1/models/S_Resource', {
    params: {
      '$select': 'S_Resource_ID,Name,IsActive,S_ResourceType_ID',
      '$filter': 'IsActive eq true',
      '$orderby': 'Name',
    },
  })
  return (resp.data.records || []).map((r: any) => ({
    id: r.id,
    Name: r.Name,
    IsActive: r.IsActive,
    resourceTypeId: typeof r.S_ResourceType_ID === 'object'
      ? (r.S_ResourceType_ID?.id ?? null)
      : (r.S_ResourceType_ID ?? null),
  }))
}
```

- [ ] **Step 2: Write tests for new resource functions**

Create `src/api/__tests__/resource.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'
import { listResourceTypes, deactivateResource, listResources } from '@/api/resource'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), put: vi.fn() },
}))

describe('resource API', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('listResources', () => {
    it('maps S_ResourceType_ID object to resourceTypeId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          records: [
            { id: 1, Name: '醫師A', IsActive: true, S_ResourceType_ID: { id: 10 } },
          ],
        },
      })
      const result = await listResources()
      expect(result[0]!.resourceTypeId).toBe(10)
    })

    it('handles numeric S_ResourceType_ID', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          records: [{ id: 2, Name: '醫師B', IsActive: true, S_ResourceType_ID: 20 }],
        },
      })
      const result = await listResources()
      expect(result[0]!.resourceTypeId).toBe(20)
    })
  })

  describe('listResourceTypes', () => {
    it('returns mapped resource types', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          records: [{ id: 10, S_ResourceType_ID: 10, Name: '治療師' }],
        },
      })
      const result = await listResourceTypes()
      expect(result).toHaveLength(1)
      expect(result[0]!.Name).toBe('治療師')
    })
  })

  describe('deactivateResource', () => {
    it('calls PUT with IsActive false', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} })
      await deactivateResource(42)
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/models/S_Resource/42',
        { IsActive: false }
      )
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test -- src/api/__tests__/resource.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 4: Add deactivate button to resource chips in CalendarView.vue**

Import `deactivateResource` in CalendarView.vue:

```typescript
import { listResources, deactivateResource } from '@/api/resource'
```

Add a deactivate handler:

```typescript
async function handleDeactivateResource(resourceId: number, resourceName: string) {
  if (!confirm(`確定要停用「${resourceName}」嗎？停用後將不再顯示於行事曆。`)) return
  try {
    await deactivateResource(resourceId)
    selectedResourceIds.delete(resourceId)
    await reloadResources()
    toast.add({ severity: 'success', summary: `已停用 ${resourceName}`, life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: '停用失敗', life: 3000 })
  }
}
```

In the template, update the resource chip to include a deactivate button (shown only on hover via CSS):

```html
<label
  v-for="res in resources"
  :key="res.id"
  class="resource-chip"
  :class="{ selected: selectedResourceIds.has(res.id) }"
  @click.prevent="toggleResource(res.id)"
  @contextmenu.prevent="openChipColorPicker($event, res.id)"
  :title="`${res.Name}（右鍵可更改顏色）`"
>
  <span class="chip-dot" :style="{ backgroundColor: getResourceColor(res.id) }"></span>
  <span class="chip-name">{{ res.Name }}</span>
  <button
    class="chip-deactivate"
    title="停用此資源"
    @click.stop="handleDeactivateResource(res.id, res.Name)"
  >×</button>
</label>
```

Add CSS:

```css
.chip-deactivate {
  display: none;
  margin-left: auto;
  padding: 0 3px;
  font-size: 0.75rem;
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  line-height: 1;
}

.resource-chip:hover .chip-deactivate {
  display: inline-block;
}

.chip-deactivate:hover {
  color: #ef4444;
}
```

- [ ] **Step 5: Run all tests**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/api/resource.ts src/api/__tests__/resource.test.ts src/views/appointment/CalendarView.vue
git commit -m "feat: add resource deactivation and resource type data to appointment calendar"
```

---

## Task 5: useAppointmentServices composable

**Files:**
- Create: `src/composables/useAppointmentServices.ts`
- Create: `src/composables/__tests__/useAppointmentServices.spec.ts`

Service presets are stored in iDempiere as:
- `AD_Reference` with `Name = 'AppointmentService'`
- `AD_Ref_List` entries: `Value` = service key, `Name` = display name, `Description` = duration in minutes (e.g. "30")

If the AD_Reference doesn't exist, the composable returns an empty list (no hardcoded defaults — services are clinic-specific).

- [ ] **Step 1: Write the failing test**

Create `src/composables/__tests__/useAppointmentServices.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn() },
}))

import {
  loadAppointmentServices,
  clearAppointmentServiceCache,
  getServiceDuration,
} from '@/composables/useAppointmentServices'

describe('useAppointmentServices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAppointmentServiceCache()
  })

  it('returns empty list when AD_Reference does not exist', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [] } })
    const result = await loadAppointmentServices()
    expect(result).toEqual([])
  })

  it('loads services from AD_Ref_List when reference exists', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { records: [{ id: 100, AD_Reference_ID: 100 }] } })
      .mockResolvedValueOnce({
        data: {
          records: [
            { Value: 'CONSULT', Name: '諮詢', Description: '30' },
            { Value: 'TREAT', Name: '療程', Description: '60' },
          ],
        },
      })
    const result = await loadAppointmentServices()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ Value: 'CONSULT', Name: '諮詢', durationMinutes: 30 })
    expect(result[1]).toEqual({ Value: 'TREAT', Name: '療程', durationMinutes: 60 })
  })

  it('caches results on second call', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [] } })
    await loadAppointmentServices()
    await loadAppointmentServices()
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it('getServiceDuration returns 0 when service not found', () => {
    expect(getServiceDuration('UNKNOWN')).toBe(0)
  })

  it('getServiceDuration returns duration after load', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { records: [{ id: 5, AD_Reference_ID: 5 }] } })
      .mockResolvedValueOnce({
        data: { records: [{ Value: 'FACIAL', Name: '臉部護理', Description: '45' }] },
      })
    await loadAppointmentServices()
    expect(getServiceDuration('FACIAL')).toBe(45)
  })

  it('handles non-numeric Description gracefully', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { records: [{ id: 3 }] } })
      .mockResolvedValueOnce({
        data: { records: [{ Value: 'SVC', Name: '服務', Description: 'invalid' }] },
      })
    const result = await loadAppointmentServices()
    expect(result[0]!.durationMinutes).toBe(0)
  })

  it('falls back to empty list on network error', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('network'))
    const result = await loadAppointmentServices()
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to see it fail**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test -- src/composables/__tests__/useAppointmentServices.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useAppointmentServices.ts**

Create `src/composables/useAppointmentServices.ts`:

```typescript
import { ref } from 'vue'
import { apiClient } from '@/api/client'

export interface AppointmentService {
  Value: string          // e.g. "CONSULT", "TREAT"
  Name: string           // display name in zh-TW
  durationMinutes: number  // 0 = no preset duration
}

// Module-level cache
let cached: AppointmentService[] | null = null
let loadingPromise: Promise<AppointmentService[]> | null = null

export async function loadAppointmentServices(): Promise<AppointmentService[]> {
  if (cached !== null) return cached
  if (loadingPromise !== null) return loadingPromise

  loadingPromise = (async () => {
    try {
      const refResp = await apiClient.get('/api/v1/models/AD_Reference', {
        params: {
          '$filter': "Name eq 'AppointmentService'",
          '$select': 'AD_Reference_ID',
          '$top': '1',
        },
      })
      const refRecords: any[] = refResp.data?.records ?? []
      if (refRecords.length === 0) {
        cached = []
        return cached
      }

      const refId: number = refRecords[0]!.id ?? refRecords[0]!.AD_Reference_ID
      if (!refId) {
        cached = []
        return cached
      }

      const listResp = await apiClient.get('/api/v1/models/AD_Ref_List', {
        params: {
          '$filter': `AD_Reference_ID eq ${refId}`,
          '$select': 'Value,Name,Description',
          '$orderby': 'Name',
          '$top': '100',
        },
      })
      const listRecords: any[] = listResp.data?.records ?? []
      cached = listRecords.map((r) => ({
        Value: String(r.Value ?? ''),
        Name: String(r.Name ?? r.Value ?? ''),
        durationMinutes: parseDuration(r.Description),
      }))
      return cached
    } catch {
      cached = []
      return cached
    } finally {
      loadingPromise = null
    }
  })()

  return loadingPromise
}

function parseDuration(val: unknown): number {
  const n = Number(val)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

export function getServiceDuration(value: string): number {
  if (!cached) return 0
  return cached.find((s) => s.Value === value)?.durationMinutes ?? 0
}

export function getServiceName(value: string): string {
  if (!cached) return value
  return cached.find((s) => s.Value === value)?.Name ?? value
}

export function clearAppointmentServiceCache(): void {
  cached = null
  loadingPromise = null
}

export function useAppointmentServices() {
  const services = ref<AppointmentService[]>(cached ?? [])

  async function load() {
    services.value = await loadAppointmentServices()
  }

  return { services, load, getServiceDuration, getServiceName }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test -- src/composables/__tests__/useAppointmentServices.spec.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Clear cache on logout**

In `src/stores/auth.ts`, add `clearAppointmentServiceCache` to both `logout()` and `switchContext()`:

```typescript
import { clearAppointmentServiceCache } from '@/composables/useAppointmentServices'
```

In `logout()` function body, add:
```typescript
clearAppointmentServiceCache()
```

In `switchContext()` function body (near the other clear calls), add:
```typescript
clearAppointmentServiceCache()
```

- [ ] **Step 6: Run all tests**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/composables/useAppointmentServices.ts src/composables/__tests__/useAppointmentServices.spec.ts src/stores/auth.ts
git commit -m "feat: add useAppointmentServices composable loading from AD_Reference AppointmentService"
```

---

## Task 6: AppointmentForm 服務項目下拉 + 自動結束時間

**Files:**
- Modify: `src/views/appointment/AppointmentForm.vue`
- Modify: `src/composables/useAppointmentDesc.ts` (if service field is plain text currently)

The current form has a free-text service input. This task replaces it with a `<select>` that loads from `useAppointmentServices`. When a service is selected AND `form.dateFrom` is set AND the service has a non-zero duration, auto-calculate `form.dateTo`.

- [ ] **Step 1: Find current service field in AppointmentForm.vue**

Read `src/views/appointment/AppointmentForm.vue` and find where the service field is rendered. It will be something like:

```html
<input v-model="form.service" ... />
```

or a similar pattern.

- [ ] **Step 2: Import useAppointmentServices in AppointmentForm.vue**

In the `<script setup>` section:

```typescript
import { useAppointmentServices } from '@/composables/useAppointmentServices'
const { services, load: loadServices } = useAppointmentServices()
```

In `onMounted`, add:
```typescript
await loadServices()
```

- [ ] **Step 3: Replace service text input with smart dropdown**

Replace the service `<input>` with:

```html
<div class="form-group">
  <label class="form-label">服務項目</label>
  <div class="service-selector">
    <select
      v-if="services.length > 0"
      v-model="form.service"
      class="form-input"
      @change="onServiceChange"
    >
      <option value="">（請選擇）</option>
      <option v-for="s in services" :key="s.Value" :value="s.Name">
        {{ s.Name }}{{ s.durationMinutes ? ` (${s.durationMinutes}分鐘)` : '' }}
      </option>
    </select>
    <!-- Fallback: free-text input when no presets configured -->
    <input
      v-else
      v-model="form.service"
      type="text"
      class="form-input"
      placeholder="服務項目"
      maxlength="100"
    />
  </div>
</div>
```

Note: we store `s.Name` (not `s.Value`) in `form.service` to keep backward compatibility with the Description JSON that already stores service as display name.

- [ ] **Step 4: Add onServiceChange auto end-time logic in AppointmentForm.vue script**

```typescript
import { getServiceDuration } from '@/composables/useAppointmentServices'

function onServiceChange() {
  if (!form.service || !form.dateFrom) return
  // Find the service by name to get its duration
  const matched = services.value.find(s => s.Name === form.service)
  const duration = matched?.durationMinutes ?? 0
  if (duration <= 0) return
  // Calculate dateTo = dateFrom + duration minutes
  const from = new Date(form.dateFrom)
  if (isNaN(from.getTime())) return
  const to = new Date(from.getTime() + duration * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  form.dateTo = `${to.getFullYear()}-${pad(to.getMonth()+1)}-${pad(to.getDate())}T${pad(to.getHours())}:${pad(to.getMinutes())}`
}
```

- [ ] **Step 5: Run tests**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/views/appointment/AppointmentForm.vue
git commit -m "feat: replace free-text service with dropdown + auto end-time calculation"
```

---

## Task 7: Sidebar 服務篩選

**Files:**
- Modify: `src/views/appointment/CalendarView.vue`

Add service filter checkboxes to the sidebar. Only visible when services are loaded and non-empty.

- [ ] **Step 1: Import useAppointmentServices in CalendarView.vue**

```typescript
import { useAppointmentServices } from '@/composables/useAppointmentServices'
const { services: appointmentServices, load: loadServices } = useAppointmentServices()
const selectedServices = reactive(new Set<string>()) // Set of service Names
const allServicesSelected = computed(() =>
  appointmentServices.value.length === 0 ||
  appointmentServices.value.every(s => selectedServices.has(s.Name))
)
```

In `onMounted`, add:
```typescript
void loadServices()
```

- [ ] **Step 2: Add service filter to calendarEvents computed**

In the `calendarEvents` computed filter chain, after the terminal status check, add:

```typescript
// Service filter (only when some services are explicitly deselected)
if (appointmentServices.value.length > 0 && !allServicesSelected.value) {
  const svc = desc.service ?? ''
  if (svc && !selectedServices.has(svc)) return false
}
```

- [ ] **Step 3: Add service filter section to sidebar template**

After the status legend `<div class="sidebar-section">`, add:

```html
<!-- Service filter (only shown when presets exist) -->
<div v-if="appointmentServices.length > 0" class="sidebar-section">
  <div class="selector-header">
    <span class="selector-title">服務項目</span>
    <button class="btn-toggle-all" @click="toggleAllServices">
      {{ allServicesSelected ? '取消全選' : '全選' }}
    </button>
  </div>
  <div class="service-chips">
    <label
      v-for="s in appointmentServices"
      :key="s.Value"
      class="service-chip"
      :class="{ selected: selectedServices.has(s.Name) }"
      @click.prevent="toggleService(s.Name)"
    >
      <span class="chip-name">{{ s.Name }}</span>
    </label>
  </div>
</div>
```

- [ ] **Step 4: Add toggle functions**

```typescript
function toggleService(name: string) {
  if (selectedServices.has(name)) {
    selectedServices.delete(name)
  } else {
    selectedServices.add(name)
  }
}

function toggleAllServices() {
  if (allServicesSelected.value) {
    selectedServices.clear()
  } else {
    appointmentServices.value.forEach(s => selectedServices.add(s.Name))
  }
}
```

Initialize selected services when services load — watch for services becoming available:

```typescript
import { watch } from 'vue'
watch(appointmentServices, (newServices) => {
  // Auto-select all newly loaded services
  newServices.forEach(s => selectedServices.add(s.Name))
})
```

- [ ] **Step 5: Add CSS for service chips**

```css
.service-chips {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.service-chip {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.8125rem;
  color: #475569;
  background: #f8fafc;
  border: 1px solid transparent;
  user-select: none;
}

.service-chip.selected {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1e40af;
}
```

- [ ] **Step 6: Run tests**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/views/appointment/CalendarView.vue
git commit -m "feat: add service preset filter to appointment sidebar"
```

---

## Task 8: 資源類型分組 (Sidebar)

**Files:**
- Modify: `src/views/appointment/CalendarView.vue`

Group resource chips in the sidebar by S_ResourceType. Resources without a type (resourceTypeId = null) go in an "其他" group at the bottom.

- [ ] **Step 1: Import listResourceTypes in CalendarView.vue**

```typescript
import { listResources, listResourceTypes, deactivateResource } from '@/api/resource'
import type { ResourceType } from '@/api/resource'

const resourceTypes = ref<ResourceType[]>([])
```

In `onMounted`, load resource types in parallel:

```typescript
void listResourceTypes().then(types => { resourceTypes.value = types })
```

Also update `reloadResources` to reload types:

```typescript
async function reloadResources() {
  try {
    const [newList, newTypes] = await Promise.all([listResources(), listResourceTypes()])
    for (const r of newList) {
      if (!resources.value.find((x: any) => x.id === r.id)) {
        selectedResourceIds.add(r.id)
      }
    }
    resources.value = newList
    resourceTypes.value = newTypes
  } catch { /* silent */ }
}
```

- [ ] **Step 2: Add groupedResources computed**

```typescript
const groupedResources = computed(() => {
  if (resourceTypes.value.length === 0) {
    // No type data — return flat single group
    return [{ typeId: null, typeName: null, resources: resources.value }]
  }

  const typeMap = new Map<number, { typeId: number; typeName: string; resources: typeof resources.value }>()
  const ungrouped: typeof resources.value = []

  for (const r of resources.value) {
    if (r.resourceTypeId === null) {
      ungrouped.push(r)
    } else {
      if (!typeMap.has(r.resourceTypeId)) {
        const typeName = resourceTypes.value.find(t => t.id === r.resourceTypeId)?.Name ?? '其他'
        typeMap.set(r.resourceTypeId, { typeId: r.resourceTypeId, typeName, resources: [] })
      }
      typeMap.get(r.resourceTypeId)!.resources.push(r)
    }
  }

  const groups = [...typeMap.values()]
  if (ungrouped.length > 0) {
    groups.push({ typeId: null as any, typeName: '其他', resources: ungrouped })
  }
  return groups
})
```

- [ ] **Step 3: Update sidebar template to use groupedResources**

Replace the current flat resource-chips section with grouped rendering:

```html
<!-- Resource filter (grouped by type) -->
<div class="sidebar-section">
  <div class="selector-header">
    <span class="selector-title">服務人員</span>
    <button class="btn-toggle-all" @click="toggleAll">
      {{ allSelected ? '取消全選' : '全選' }}
    </button>
  </div>
  <div v-if="resourcesLoading" class="selector-loading">載入中...</div>
  <div v-else-if="resources.length === 0" class="empty-state">
    <p>尚未設定任何資源</p>
    <p>請至管理員設定新增資源</p>
  </div>
  <div v-else class="resource-groups">
    <div v-for="group in groupedResources" :key="group.typeId ?? 'ungrouped'" class="resource-group">
      <!-- Group header (only shown when there are multiple types) -->
      <div v-if="groupedResources.length > 1 && group.typeName" class="resource-group-header">
        {{ group.typeName }}
      </div>
      <div class="resource-chips">
        <label
          v-for="res in group.resources"
          :key="res.id"
          class="resource-chip"
          :class="{ selected: selectedResourceIds.has(res.id) }"
          @click.prevent="toggleResource(res.id)"
          @contextmenu.prevent="openChipColorPicker($event, res.id)"
          :title="`${res.Name}（右鍵可更改顏色）`"
        >
          <span class="chip-dot" :style="{ backgroundColor: getResourceColor(res.id) }"></span>
          <span class="chip-name">{{ res.Name }}</span>
          <button
            class="chip-deactivate"
            title="停用此資源"
            @click.stop="handleDeactivateResource(res.id, res.Name)"
          >×</button>
        </label>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Add CSS for groups**

```css
.resource-groups {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.resource-group-header {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.375rem 0.25rem 0.125rem;
  margin-top: 0.25rem;
}

.resource-group:first-child .resource-group-header {
  margin-top: 0;
}
```

- [ ] **Step 5: Run all tests**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/views/appointment/CalendarView.vue src/api/resource.ts
git commit -m "feat: group resources by type in appointment sidebar"
```

---

## Task 9: 狀態顏色/名稱 UI 管理（localStorage override）

**Files:**
- Modify: `src/composables/useAppointmentStatuses.ts`
- Modify: `src/views/appointment/CalendarView.vue`

Allow non-technical users to override status names and colors from within the UI. Overrides are stored in `localStorage` under key `appointmentStatusOverrides` as `{ [Value]: { name?: string; color?: string } }`. On load, overrides are merged on top of AD values.

- [ ] **Step 1: Extend useAppointmentStatuses.ts with override support**

Add these functions at the bottom of `src/composables/useAppointmentStatuses.ts`:

```typescript
const OVERRIDE_KEY = 'appointmentStatusOverrides'

interface StatusOverride { name?: string; color?: string }
type OverrideMap = Record<string, StatusOverride>

function readOverrides(): OverrideMap {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeOverrides(map: OverrideMap): void {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map))
}

function applyOverrides(statuses: AppointmentStatus[]): AppointmentStatus[] {
  const overrides = readOverrides()
  return statuses.map(s => {
    const ov = overrides[s.Value]
    if (!ov) return s
    return {
      ...s,
      Name: ov.name ?? s.Name,
      color: ov.color ?? s.color,
    }
  })
}

/** Save a color override for a status. Pass null to remove override. */
export function saveStatusColorOverride(value: string, color: string | null): void {
  const map = readOverrides()
  if (!map[value]) map[value] = {}
  if (color === null) {
    delete map[value]!.color
  } else {
    map[value]!.color = color
  }
  writeOverrides(map)
  // Invalidate cache so next load picks up the override
  if (cached) {
    cached = applyOverrides(cached)
  }
}

/** Save a name override for a status. Pass null to remove override. */
export function saveStatusNameOverride(value: string, name: string | null): void {
  const map = readOverrides()
  if (!map[value]) map[value] = {}
  if (name === null) {
    delete map[value]!.name
  } else {
    map[value]!.name = name
  }
  writeOverrides(map)
  if (cached) {
    cached = applyOverrides(cached)
  }
}
```

Also update `loadAppointmentStatuses()` — at the end of the success path, before `return cached`, apply overrides:

```typescript
// after: cached = listRecords.map(...)
cached = applyOverrides(cached)
```

And for the DEFAULT_STATUSES fallback:
```typescript
// after: cached = DEFAULT_STATUSES
cached = applyOverrides([...DEFAULT_STATUSES])
```

Also clear localStorage override key in `clearAppointmentStatusCache()` only if explicitly full-reset (do NOT clear overrides — they are permanent user preferences).

- [ ] **Step 2: Add StatusManager inline panel in CalendarView.vue**

Add state for showing the status manager:

```typescript
const showStatusManager = ref(false)
import { saveStatusColorOverride, saveStatusNameOverride, loadAppointmentStatuses } from '@/composables/useAppointmentStatuses'

async function reloadStatuses() {
  // Force cache refresh
  clearAppointmentStatusCache()
  statusesLoading.value = true
  try {
    const result = await loadAppointmentStatuses()
    statuses.value = result
  } finally {
    statusesLoading.value = false
  }
}
```

Where `clearAppointmentStatusCache` must be imported. Note: the cache is invalidated by `saveStatusColorOverride`/`saveStatusNameOverride` — but for the UI reactive update, call `reloadStatuses()` after saving.

- [ ] **Step 3: Add StatusManager to template**

After the status legend in CalendarView.vue sidebar:

```html
<!-- Status Manager -->
<div v-if="showStatusManager" class="status-manager">
  <div v-for="s in statuses" :key="s.Value" class="status-manager-row">
    <input
      type="color"
      :value="s.color"
      class="status-color-input"
      @change="onStatusColorChange(s.Value, ($event.target as HTMLInputElement).value)"
    />
    <input
      type="text"
      :value="s.Name"
      class="status-name-input"
      maxlength="20"
      @blur="onStatusNameChange(s.Value, ($event.target as HTMLInputElement).value)"
      @keyup.enter="($event.target as HTMLInputElement).blur()"
    />
  </div>
  <button class="status-manager-reset" @click="resetAllOverrides">重設</button>
</div>
<!-- Toggle button in status legend header -->
```

Update the status legend section header to include a toggle button:

```html
<div class="sidebar-section">
  <div class="selector-header" style="margin-bottom: 0.5rem;">
    <span class="selector-title">狀態圖例</span>
    <button class="btn-toggle-all" @click="showStatusManager = !showStatusManager">
      {{ showStatusManager ? '完成' : '編輯' }}
    </button>
  </div>
  <!-- existing status legend items -->
  <div v-if="statusesLoading" class="selector-loading">載入中...</div>
  <div v-else class="status-legend">
    <div v-for="s in statuses" :key="s.Value" class="legend-item">
      <span class="legend-dot" :style="{ backgroundColor: s.color }"></span>
      <span class="legend-name">{{ s.Name }}</span>
    </div>
  </div>
  <!-- Status manager (inline edit mode) -->
  <div v-if="showStatusManager" class="status-manager">
    <div v-for="s in statuses" :key="s.Value" class="status-manager-row">
      <input
        type="color"
        :value="s.color"
        class="status-color-input"
        @change="onStatusColorChange(s.Value, ($event.target as HTMLInputElement).value)"
      />
      <input
        type="text"
        :value="s.Name"
        class="status-name-input"
        maxlength="20"
        @blur="onStatusNameChange(s.Value, ($event.target as HTMLInputElement).value.trim())"
        @keyup.enter="($event.target as HTMLInputElement).blur()"
      />
    </div>
    <button class="status-manager-reset" @click="resetAllOverrides">重設為預設</button>
  </div>
</div>
```

- [ ] **Step 4: Add handler functions**

```typescript
async function onStatusColorChange(value: string, color: string) {
  saveStatusColorOverride(value, color)
  await reloadStatuses()
  refreshCalendar()
}

async function onStatusNameChange(value: string, name: string) {
  if (!name) return
  saveStatusNameOverride(value, name)
  await reloadStatuses()
}

async function resetAllOverrides() {
  if (!confirm('確定要重設所有狀態設定嗎？')) return
  localStorage.removeItem('appointmentStatusOverrides')
  await reloadStatuses()
  refreshCalendar()
}
```

Import `clearAppointmentStatusCache` in CalendarView:

```typescript
import { useAppointmentStatuses, isTerminalStatus, clearAppointmentStatusCache } from '@/composables/useAppointmentStatuses'
```

- [ ] **Step 5: Add CSS**

```css
.status-manager {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #f1f5f9;
}

.status-manager-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.375rem;
}

.status-color-input {
  width: 28px;
  height: 24px;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
}

.status-name-input {
  flex: 1;
  padding: 0.25rem 0.375rem;
  font-size: 0.8125rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
}

.status-name-input:focus {
  outline: none;
  border-color: #93c5fd;
}

.status-manager-reset {
  display: block;
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.25rem;
  font-size: 0.75rem;
  color: #ef4444;
  background: none;
  border: 1px solid #fecaca;
  border-radius: 4px;
  cursor: pointer;
}

.status-manager-reset:hover {
  background: #fef2f2;
}
```

- [ ] **Step 6: Run all tests**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/composables/useAppointmentStatuses.ts src/views/appointment/CalendarView.vue
git commit -m "feat: add status color and name override UI with localStorage persistence"
```

---

## Task 10: Build & Deploy

- [ ] **Step 1: Full type-check**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run type-check
```

Fix any TypeScript errors before proceeding.

- [ ] **Step 2: Run full test suite**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/webapp && npm run test
```

Expected: all tests pass.

- [ ] **Step 3: Build and deploy**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul && bash build.sh
```

Deploy JAR via Felix Web Console:

```bash
FELIX_BASE="https://localhost:8443/osgi"
JAR=$(ls -t /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul/org.idempiere.ui.aesthetics_*.jar | head -1)
BUNDLE_SYM="org.idempiere.ui.aesthetics.v2"

CSRF=$(curl -ks -c /tmp/felix-deploy -b /tmp/felix-deploy "$FELIX_BASE/login.jsp" | grep -oP 'name="csrfToken"\s+value="\K[^"]+')
curl -ks -c /tmp/felix-deploy -b /tmp/felix-deploy -L \
    -d "username=SuperUser&password=System&csrfToken=$CSRF&returnUrl=/osgi/system/console/bundles" \
    "$FELIX_BASE/login" -o /dev/null

BUNDLE_ID=$(curl -ks -b /tmp/felix-deploy "$FELIX_BASE/system/console/bundles.json" | \
    python3 -c "import json,sys;data=json.load(sys.stdin);[print(b['id']) for b in data.get('data',[]) if b.get('symbolicName')=='$BUNDLE_SYM']")
[ -n "$BUNDLE_ID" ] && curl -ks -b /tmp/felix-deploy -X POST "$FELIX_BASE/system/console/bundles/$BUNDLE_ID?action=stop" -o /dev/null && sleep 1
[ -n "$BUNDLE_ID" ] && curl -ks -b /tmp/felix-deploy -X POST "$FELIX_BASE/system/console/bundles/$BUNDLE_ID?action=uninstall" -o /dev/null && sleep 2

curl -ks -b /tmp/felix-deploy -X POST -F "action=install" -F "bundlestart=start" -F "bundlefile=@$JAR" "$FELIX_BASE/system/console/bundles" -o /dev/null
sleep 2

NEW_ID=$(curl -ks -b /tmp/felix-deploy "$FELIX_BASE/system/console/bundles.json" | \
    python3 -c "import json,sys;data=json.load(sys.stdin);[print(b['id'],b.get('state','?')) for b in data.get('data',[]) if b.get('symbolicName')=='$BUNDLE_SYM']")
echo "Bundle: $NEW_ID"
```

- [ ] **Step 4: Commit anything remaining**

```bash
cd /home/tom/idempiere-module-ui/.worktrees/consultation-overhaul
git add -A
git commit -m "chore: gap closure complete — all nczz feature gaps addressed"
```

---

## Self-Review

**Spec coverage against comparison report:**
- ✅ BPartner 搜尋補電話/Email — Task 1
- ✅ 搜尋「跳到日期」 — Task 2
- ✅ Sidebar 管理快捷按鈕 — Task 3
- ✅ 資源停用 — Task 4
- ✅ 服務項目管理（composable + AD_Reference pattern） — Task 5
- ✅ AppointmentForm 服務下拉 + 自動結束時間 — Task 6
- ✅ Sidebar 服務篩選 — Task 7
- ✅ 資源類型分組 — Task 8
- ✅ 狀態顏色/名稱 UI 管理 — Task 9
- ✅ Build + deploy — Task 10

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" placeholders found.

**Type consistency:** `AppointmentService.Value/Name/durationMinutes` consistent across Tasks 5, 6, 7. `Resource.resourceTypeId` defined in Task 4, used in Task 8. `saveStatusColorOverride`/`saveStatusNameOverride` defined in Task 9 step 1, used in step 4.

**iDempiere setup note:** For Tasks 5/6/7 to provide service presets, an admin must create `AD_Reference` named `AppointmentService` with `AD_Ref_List` entries in iDempiere. The UI gracefully degrades to free-text input when no presets exist — no setup required to keep existing functionality.
