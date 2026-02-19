# CRM 諮詢模組 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform R_Request consultation module into full CRM system with activity timeline, quick actions, and operational dashboard.

**Architecture:**
- Phase 1: Activity timeline stored as JSON in R_Request.Description + quick action sticky bar
- Phase 2: Dashboard component fetching 30-90 day data, calculating statistics in browser
- Phase 3: Mobile optimizations and error handling

**Tech Stack:** Vue 3, TypeScript, Vite 7, PrimeVue 4 (Unstyled), Pinia 3, iDempiere REST API

---

## Phase 1: Core Timeline & Quick Actions

### Task 1: Create RequestTimeline component (view-only)

**Files:**
- Create: `src/components/RequestTimeline.vue`
- Test: `src/components/__tests__/RequestTimeline.spec.ts`

**Step 1: Write the failing test**

```typescript
// src/components/__tests__/RequestTimeline.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestTimeline from '../RequestTimeline.vue'

describe('RequestTimeline', () => {
  it('parses JSON activities and renders timeline', () => {
    const activities = JSON.stringify([
      {
        timestamp: '2026-02-19T10:30:00Z',
        type: '前台行動',
        actionType: '打電話',
        content: '客戶確認',
        createdBy: 1000123,
      },
      {
        timestamp: '2026-02-19T14:00:00Z',
        type: '狀態改變',
        actionType: '已指派',
        content: '已指派給銷售',
        createdBy: 1000124,
      },
    ])

    const wrapper = mount(RequestTimeline, {
      props: { activities },
    })

    const items = wrapper.findAll('.timeline-item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('打電話')
    expect(items[1].text()).toContain('已指派')
  })

  it('handles empty activities gracefully', () => {
    const wrapper = mount(RequestTimeline, {
      props: { activities: '[]' },
    })
    expect(wrapper.text()).toContain('無活動記錄')
  })

  it('handles invalid JSON', () => {
    const wrapper = mount(RequestTimeline, {
      props: { activities: 'invalid' },
    })
    expect(wrapper.text()).toContain('無活動記錄')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd /home/tom/idempiere-module-ui/webapp
npm run test -- src/components/__tests__/RequestTimeline.spec.ts
```

Expected: FAIL - "RequestTimeline does not exist"

**Step 3: Write minimal implementation**

```vue
<!-- src/components/RequestTimeline.vue -->
<template>
  <div class="timeline">
    <div v-if="parsedActivities.length === 0" class="empty-state">
      無活動記錄
    </div>

    <div v-else class="timeline-items">
      <div
        v-for="(activity, idx) in parsedActivities"
        :key="idx"
        class="timeline-item"
      >
        <div class="timeline-time">{{ formatTime(activity.timestamp) }}</div>
        <div class="timeline-badge">{{ activity.type }}</div>
        <div class="timeline-content">
          <div class="timeline-action">{{ activity.actionType }}</div>
          <div class="timeline-text">{{ activity.content }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Activity {
  timestamp: string
  type: string
  actionType: string
  content: string
  createdBy: number
}

const props = defineProps<{
  activities: string
}>()

const parsedActivities = computed(() => {
  if (!props.activities) return []
  try {
    const parsed = JSON.parse(props.activities)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
})

function formatTime(timestamp: string): string {
  const d = new Date(timestamp)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}
</script>

<style scoped>
.timeline {
  padding: 0;
}

.empty-state {
  text-align: center;
  color: #94a3b8;
  padding: 1rem;
}

.timeline-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-left: 3px solid var(--color-primary);
  border-radius: 4px;
}

.timeline-time {
  min-width: 50px;
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
}

.timeline-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  color: var(--color-primary);
  border-radius: 3px;
  white-space: nowrap;
}

.timeline-content {
  flex: 1;
}

.timeline-action {
  font-weight: 500;
  font-size: 0.9375rem;
}

.timeline-text {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.25rem;
}
</style>
```

**Step 4: Run test to verify it passes**

```bash
npm run test -- src/components/__tests__/RequestTimeline.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/RequestTimeline.vue src/components/__tests__/RequestTimeline.spec.ts
git commit -m "feat: add RequestTimeline component for activity visualization"
```

---

### Task 2: Create QuickActionBar component

**Files:**
- Create: `src/components/QuickActionBar.vue`
- Test: `src/components/__tests__/QuickActionBar.spec.ts`

**Step 1: Write the failing test**

```typescript
// src/components/__tests__/QuickActionBar.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import QuickActionBar from '../QuickActionBar.vue'

describe('QuickActionBar', () => {
  it('renders all action buttons', () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    expect(wrapper.text()).toContain('記錄打電話')
    expect(wrapper.text()).toContain('發訊息')
    expect(wrapper.text()).toContain('更新狀態')
    expect(wrapper.text()).toContain('預約追蹤')
  })

  it('emits addActivity event when action clicked', async () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const phoneBtn = wrapper.find('button:contains("打電話")')
    await phoneBtn.trigger('click')

    expect(wrapper.emitted('add-activity')).toBeTruthy()
    const emitted = wrapper.emitted('add-activity')[0]
    expect(emitted[0].type).toBe('前台行動')
    expect(emitted[0].actionType).toBe('打電話')
  })

  it('disables buttons when disabled prop is true', () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
        disabled: true,
      },
    })

    const buttons = wrapper.findAll('button')
    buttons.forEach(btn => {
      expect(btn.attributes('disabled')).toBeDefined()
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test -- src/components/__tests__/QuickActionBar.spec.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```vue
<!-- src/components/QuickActionBar.vue -->
<template>
  <div class="quick-action-bar">
    <button
      class="action-btn"
      @click="handlePhoneClick"
      :disabled="disabled"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
      </svg>
      記錄打電話
    </button>

    <button
      class="action-btn"
      @click="handleMessageClick"
      :disabled="disabled"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      發訊息
    </button>

    <button
      class="action-btn"
      @click="handleStatusClick"
      :disabled="disabled"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
      更新狀態
    </button>

    <button
      class="action-btn"
      @click="handleTrackingClick"
      :disabled="disabled"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      預約追蹤
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  requestId: number
  currentStatus: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'add-activity': [activity: any]
  'update-status': []
  'set-tracking': []
}>()

function handlePhoneClick() {
  emit('add-activity', {
    type: '前台行動',
    actionType: '打電話',
    content: '',
  })
}

function handleMessageClick() {
  emit('add-activity', {
    type: '前台行動',
    actionType: '發訊息',
    content: '',
  })
}

function handleStatusClick() {
  emit('update-status')
}

function handleTrackingClick() {
  emit('set-tracking')
}
</script>

<style scoped>
.quick-action-bar {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  padding: 0.75rem;
  background: white;
  border-top: 1px solid var(--color-border);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 600px;
  margin: 0 auto;
  z-index: 100;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  min-height: var(--min-touch);
  transition: opacity 0.1s;
}

.action-btn:hover {
  opacity: 0.9;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (min-width: 640px) {
  .quick-action-bar {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
```

**Step 4: Run test to verify it passes**

```bash
npm run test -- src/components/__tests__/QuickActionBar.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/QuickActionBar.vue src/components/__tests__/QuickActionBar.spec.ts
git commit -m "feat: add QuickActionBar for request interactions"
```

---

### Task 3: Update RequestFormView to integrate timeline + quick actions

**Files:**
- Modify: `src/views/consultation/RequestFormView.vue:1-100`
- Test: `src/views/consultation/__tests__/RequestFormView.spec.ts`

**Step 1: Write the failing test**

```typescript
// src/views/consultation/__tests__/RequestFormView.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestFormView from '../RequestFormView.vue'

describe('RequestFormView - Timeline Integration', () => {
  it('renders RequestTimeline when editing', () => {
    const wrapper = mount(RequestFormView, {
      props: {
        id: 123,
      },
      global: {
        stubs: {
          RequestTimeline: true,
          QuickActionBar: true,
        },
      },
    })

    // This will fail initially as timeline not yet integrated
    expect(wrapper.findComponent({ name: 'RequestTimeline' }).exists()).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test -- src/views/consultation/__tests__/RequestFormView.spec.ts
```

Expected: FAIL

**Step 3: Update RequestFormView**

In `RequestFormView.vue`, add after the dynamic form:

```vue
<template>
  <!-- ... existing form code ... -->

  <!-- Activity Timeline Section -->
  <div v-if="isEdit" class="timeline-section">
    <h3>活動記錄</h3>
    <RequestTimeline :activities="formData.Description || '[]'" />
  </div>

  <!-- Quick Action Bar (sticky bottom) -->
  <div v-if="isEdit" class="quick-actions-wrapper">
    <QuickActionBar
      :request-id="id"
      :current-status="formData.R_Status_ID?.id || '待處理'"
      @add-activity="handleAddActivity"
      @update-status="handleUpdateStatus"
      @set-tracking="handleSetTracking"
    />
  </div>
</template>

<script setup lang="ts">
// Add imports at top
import RequestTimeline from '@/components/RequestTimeline.vue'
import QuickActionBar from '@/components/QuickActionBar.vue'

// Add these functions in script setup
function handleAddActivity(activity: any) {
  try {
    const activities = JSON.parse(formData.Description || '[]')
    activities.push({
      ...activity,
      timestamp: new Date().toISOString(),
      createdBy: auth.user?.id || 0,
    })
    formData.Description = JSON.stringify(activities)
    // Mark form as modified for save
    formModified.value = true
  } catch (e) {
    errorMsg.value = '活動記錄新增失敗'
  }
}

function handleUpdateStatus() {
  // Show status selector modal/dropdown
  // Will be implemented in next task
}

function handleSetTracking() {
  // Show date picker modal
  // Will be implemented in next task
}
</script>

<style scoped>
.timeline-section {
  margin-top: 2rem;
  margin-bottom: 6rem; /* Space for sticky bar */
  padding: 1rem 0;
  border-top: 1px solid var(--color-border);
}

.timeline-section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.quick-actions-wrapper {
  /* The QuickActionBar handles its own positioning */
}
</style>
```

**Step 4: Run test to verify it passes**

```bash
npm run test -- src/views/consultation/__tests__/RequestFormView.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/views/consultation/RequestFormView.vue src/views/consultation/__tests__/RequestFormView.spec.ts
git commit -m "feat: integrate timeline and quick action bar in request form"
```

---

### Task 4: Create helper functions for activity management

**Files:**
- Create: `src/utils/requestActivity.ts`
- Test: `src/utils/__tests__/requestActivity.spec.ts`

**Step 1: Write the failing test**

```typescript
// src/utils/__tests__/requestActivity.spec.ts
import { describe, it, expect } from 'vitest'
import { parseActivities, addActivity, isActivityJSON } from '../requestActivity'

describe('requestActivity utilities', () => {
  it('parses valid activity JSON', () => {
    const json = JSON.stringify([
      { timestamp: '2026-02-19T10:30:00Z', type: '前台行動', actionType: '打電話', content: 'test', createdBy: 1 },
    ])
    const result = parseActivities(json)
    expect(result).toHaveLength(1)
    expect(result[0].actionType).toBe('打電話')
  })

  it('returns empty array for invalid JSON', () => {
    expect(parseActivities('invalid')).toEqual([])
    expect(parseActivities('')).toEqual([])
    expect(parseActivities('null')).toEqual([])
  })

  it('adds activity to existing list', () => {
    const existing = JSON.stringify([
      { timestamp: '2026-02-19T10:30:00Z', type: '前台行動', actionType: '打電話', content: 'first', createdBy: 1 },
    ])
    const result = addActivity(existing, {
      type: '前台行動',
      actionType: '發訊息',
      content: 'second',
      createdBy: 2,
    })
    const parsed = parseActivities(result)
    expect(parsed).toHaveLength(2)
    expect(parsed[1].actionType).toBe('發訊息')
  })

  it('checks if string is valid activity JSON', () => {
    expect(isActivityJSON('[]')).toBe(true)
    expect(isActivityJSON(JSON.stringify([{ timestamp: '2026-02-19T10:30:00Z' }]))).toBe(true)
    expect(isActivityJSON('invalid')).toBe(false)
    expect(isActivityJSON('null')).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test -- src/utils/__tests__/requestActivity.spec.ts
```

Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/utils/requestActivity.ts

export interface RequestActivity {
  timestamp: string
  type: 'frontend_action' | 'customer_message' | 'status_change'
  actionType: string
  content: string
  createdBy: number
}

export function parseActivities(json: string): RequestActivity[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addActivity(
  existingJson: string,
  activity: Omit<RequestActivity, 'timestamp'>
): string {
  const activities = parseActivities(existingJson)
  activities.push({
    ...activity,
    timestamp: new Date().toISOString(),
  })
  return JSON.stringify(activities)
}

export function isActivityJSON(json: string): boolean {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed)
  } catch {
    return false
  }
}

export function formatActivityType(type: string): string {
  const typeMap: Record<string, string> = {
    frontend_action: '前台行動',
    customer_message: '客戶訊息',
    status_change: '狀態改變',
  }
  return typeMap[type] || type
}

export function formatActionType(actionType: string): string {
  const actionMap: Record<string, string> = {
    phone_call: '打電話',
    message: '發訊息',
    appointment: '預約',
    note: '備註',
    status_changed: '狀態改變',
  }
  return actionMap[actionType] || actionType
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test -- src/utils/__tests__/requestActivity.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/requestActivity.ts src/utils/__tests__/requestActivity.spec.ts
git commit -m "feat: add request activity utility functions"
```

---

## Phase 2: Dashboard Component

### Task 5: Create ConsultationDashboard component

**Files:**
- Create: `src/components/ConsultationDashboard.vue`
- Create: `src/utils/dashboardStats.ts`
- Test: `src/components/__tests__/ConsultationDashboard.spec.ts`

**Step 1: Write the failing test**

```typescript
// src/components/__tests__/ConsultationDashboard.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConsultationDashboard from '../ConsultationDashboard.vue'

describe('ConsultationDashboard', () => {
  it('renders metric cards', () => {
    const wrapper = mount(ConsultationDashboard, {
      props: {
        requests: [],
      },
    })

    expect(wrapper.text()).toContain('本月諮詢數')
    expect(wrapper.text()).toContain('轉化率')
    expect(wrapper.text()).toContain('平均回應時間')
  })

  it('calculates metrics from request data', () => {
    const mockRequests = [
      { id: 1, Created: '2026-02-01', R_Status_ID: { id: '待處理' } },
      { id: 2, Created: '2026-02-15', R_Status_ID: { id: '討論中' } },
      { id: 3, Created: '2026-02-19', R_Status_ID: { id: '已完成' } },
    ]

    const wrapper = mount(ConsultationDashboard, {
      props: {
        requests: mockRequests,
      },
    })

    // Should show 3 for current month
    expect(wrapper.text()).toContain('3')
  })

  it('displays warning section for silent/lost requests', () => {
    const wrapper = mount(ConsultationDashboard, {
      props: {
        requests: [],
      },
    })

    expect(wrapper.text()).toContain('預警清單')
    expect(wrapper.text()).toContain('沉默諮詢')
    expect(wrapper.text()).toContain('流失客戶')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test -- src/components/__tests__/ConsultationDashboard.spec.ts
```

Expected: FAIL

**Step 3: Write dashboard utilities**

```typescript
// src/utils/dashboardStats.ts

export interface RequestStats {
  totalThisMonth: number
  conversionRate: string
  avgResponseTime: string
  pendingCount: number
  silentCount: number
  lostCustomerCount: number
  statusDistribution: Record<string, number>
  topCustomers: Array<{ customerId: number; name: string; count: number }>
}

export function calculateStats(requests: any[], daysBefore: number = 90): RequestStats {
  const now = Date.now()
  const dayAgo = now - daysBefore * 24 * 60 * 60 * 1000
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()

  const filtered = requests.filter(r => new Date(r.Created).getTime() >= dayAgo)
  const thisMonth = requests.filter(r => new Date(r.Created).getTime() >= monthStart)

  // Count statuses
  const statusDist: Record<string, number> = {}
  filtered.forEach(r => {
    const status = r.R_Status_ID?.id || '待處理'
    statusDist[status] = (statusDist[status] || 0) + 1
  })

  // Count silent (等待回應 > 7 days)
  const silentCount = filtered.filter(r => {
    if (r.R_Status_ID?.id !== '等待回應') return false
    const lastActivityTime = extractLastActivityTime(r.Description)
    const daysSilent = (now - new Date(lastActivityTime).getTime()) / (1000 * 24 * 3600)
    return daysSilent > 7
  }).length

  // Count lost customers (90 days no activity)
  const customerMap = new Map()
  filtered.forEach(r => {
    const customerId = r.C_BPartner_ID?.id || r.C_BPartner_ID
    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, { created: new Date(r.Created).getTime(), name: r.C_BPartner_ID?.Name || '' })
    }
  })

  let lostCount = 0
  customerMap.forEach(({ created }) => {
    if (now - created > 90 * 24 * 60 * 60 * 1000) lostCount++
  })

  return {
    totalThisMonth: thisMonth.length,
    conversionRate: calculateConversionRate(thisMonth),
    avgResponseTime: calculateAvgResponseTime(filtered),
    pendingCount: filtered.filter(r => r.R_Status_ID?.id !== '已完成').length,
    silentCount,
    lostCustomerCount: lostCount,
    statusDistribution: statusDist,
    topCustomers: getTopCustomers(filtered, 10),
  }
}

function extractLastActivityTime(description: string): string {
  try {
    const activities = JSON.parse(description || '[]')
    if (activities.length > 0) {
      return activities[activities.length - 1].timestamp
    }
  } catch {}
  return new Date().toISOString()
}

function calculateConversionRate(requests: any[]): string {
  if (requests.length === 0) return '0%'
  // Simplified: count completed as converted
  const completed = requests.filter(r => r.R_Status_ID?.id === '已完成').length
  const rate = Math.round((completed / requests.length) * 100)
  return `${rate}%`
}

function calculateAvgResponseTime(requests: any[]): string {
  if (requests.length === 0) return '0h'
  let totalMs = 0
  let count = 0
  requests.forEach(r => {
    const lastActivityTime = extractLastActivityTime(r.Description)
    const responseMs = new Date(lastActivityTime).getTime() - new Date(r.Created).getTime()
    if (responseMs > 0) {
      totalMs += responseMs
      count++
    }
  })
  if (count === 0) return '0h'
  const hours = Math.round(totalMs / count / (1000 * 3600))
  return `${hours}h`
}

function getTopCustomers(requests: any[], limit: number): Array<{ customerId: number; name: string; count: number }> {
  const customerMap = new Map()
  requests.forEach(r => {
    const customerId = r.C_BPartner_ID?.id || r.C_BPartner_ID
    const name = r.C_BPartner_ID?.Name || `#${customerId}`
    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, { customerId, name, count: 0 })
    }
    customerMap.get(customerId).count++
  })
  return Array.from(customerMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
```

**Step 4: Write ConsultationDashboard component**

```vue
<!-- src/components/ConsultationDashboard.vue -->
<template>
  <div class="dashboard">
    <!-- Metric Cards -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">本月諮詢數</div>
        <div class="metric-value">{{ stats.totalThisMonth }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">轉化率</div>
        <div class="metric-value">{{ stats.conversionRate }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">平均回應時間</div>
        <div class="metric-value">{{ stats.avgResponseTime }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">未完成數</div>
        <div class="metric-value">{{ stats.pendingCount }}</div>
      </div>
      <div class="metric-card warning">
        <div class="metric-label">沉默諮詢</div>
        <div class="metric-value">{{ stats.silentCount }}</div>
      </div>
      <div class="metric-card warning">
        <div class="metric-label">流失客戶</div>
        <div class="metric-value">{{ stats.lostCustomerCount }}</div>
      </div>
    </div>

    <!-- Status Distribution -->
    <div class="section">
      <h3>狀態分布</h3>
      <div class="status-list">
        <div
          v-for="(count, status) in stats.statusDistribution"
          :key="status"
          class="status-item"
        >
          <span class="status-label">{{ status }}</span>
          <span class="status-count">{{ count }}</span>
        </div>
      </div>
    </div>

    <!-- Top Customers -->
    <div class="section">
      <h3>活躍客戶排行</h3>
      <div class="customer-list">
        <div
          v-for="(customer, idx) in stats.topCustomers"
          :key="customer.customerId"
          class="customer-item"
        >
          <span class="rank">{{ idx + 1 }}</span>
          <span class="name">{{ customer.name }}</span>
          <span class="count">{{ customer.count }}次</span>
        </div>
      </div>
    </div>

    <!-- Warning Section -->
    <div class="section warning-section">
      <h3>預警清單</h3>
      <div v-if="stats.silentCount > 0" class="warning-item">
        <span class="warning-badge">沉默</span>
        <span>{{ stats.silentCount }}個諮詢 > 7天無回應</span>
      </div>
      <div v-if="stats.lostCustomerCount > 0" class="warning-item">
        <span class="warning-badge">流失</span>
        <span>{{ stats.lostCustomerCount }}個客戶 > 90天無新諮詢</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { calculateStats } from '@/utils/dashboardStats'

const props = defineProps<{
  requests: any[]
}>()

const stats = computed(() => calculateStats(props.requests))
</script>

<style scoped>
.dashboard {
  padding: 1rem;
  max-width: 1024px;
  margin: 0 auto;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 768px) {
  .metrics-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.metric-card {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.metric-card.warning {
  background: #fef2f2;
  border-color: #fed7d7;
}

.metric-label {
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.metric-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-primary);
}

.metric-card.warning .metric-value {
  color: var(--color-error);
}

.section {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.status-list,
.customer-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-item,
.customer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f8fafc;
  border-radius: 4px;
  font-size: 0.875rem;
}

.status-label {
  font-weight: 500;
}

.status-count,
.count {
  background: var(--color-primary);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.rank {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
}

.warning-section {
  background: #fef2f2;
  border-color: #fed7d7;
}

.warning-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: white;
  border-left: 3px solid var(--color-error);
  border-radius: 4px;
  font-size: 0.875rem;
}

.warning-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: var(--color-error);
  color: white;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 500;
  min-width: 40px;
  text-align: center;
}
</style>
```

**Step 5: Run tests**

```bash
npm run test -- src/components/__tests__/ConsultationDashboard.spec.ts src/utils/__tests__/dashboardStats.spec.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/components/ConsultationDashboard.vue src/utils/dashboardStats.ts
git commit -m "feat: add consultation dashboard with metrics and statistics"
```

---

## Phase 3: Integration & Polish

### Task 6: Add Dashboard to HomeView

**Files:**
- Modify: `src/views/HomeView.vue`

**Step 1: Update HomeView to add dashboard card**

In `HomeView.vue` sections, add new card to 業務流程 section:

```typescript
// In the sections array, add to 業務流程 card:
{
  icon: '📊',
  label: '諮詢儀表板',
  desc: '追蹤諮詢狀態與客戶旅程',
  route: '/consultation-dashboard',
  pageKey: null,
}
```

**Step 2: Create dashboard route**

Add to `src/router/index.ts`:

```typescript
{
  path: '/consultation-dashboard',
  name: 'consultation-dashboard',
  component: () => import('@/views/consultation/ConsultationDashboardView.vue'),
  meta: { requiresAuth: true }
}
```

**Step 3: Create ConsultationDashboardView**

```vue
<!-- src/views/consultation/ConsultationDashboardView.vue -->
<template>
  <div class="dashboard-page">
    <header class="page-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>諮詢儀表板</h2>
      <button class="refresh-btn" @click="loadData" :disabled="loading">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36M20.49 15a9 9 0 01-14.85 3.36"/>
        </svg>
        刷新
      </button>
    </header>

    <div v-if="loading" class="loading-state">載入中...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <ConsultationDashboard v-else :requests="requests" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listRequests } from '@/api/request'
import ConsultationDashboard from '@/components/ConsultationDashboard.vue'

const router = useRouter()
const requests = ref<any[]>([])
const loading = ref(false)
const error = ref('')

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    // Fetch all requests (dashboard will filter by date)
    requests.value = await listRequests()
  } catch (e) {
    error.value = '無法載入資料'
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/')
}

onMounted(() => {
  loadData()
  // Auto-refresh every 5 minutes
  setInterval(loadData, 5 * 60 * 1000)
})
</script>

<style scoped>
.dashboard-page {
  padding: 1rem;
  max-width: 1024px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.back-btn,
.refresh-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  min-height: var(--min-touch);
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.error-state {
  color: var(--color-error);
}
</style>
```

**Step 4: Commit**

```bash
git add src/views/HomeView.vue src/views/consultation/ConsultationDashboardView.vue src/router/index.ts
git commit -m "feat: add consultation dashboard to home navigation"
```

---

### Task 7: Implement modal dialogs for status update & tracking

**Files:**
- Create: `src/components/StatusUpdateModal.vue`
- Create: `src/components/TrackingDateModal.vue`

(Implementation details similar to above pattern - write test, verify fail, implement, verify pass, commit)

**Brief outline:**
- StatusUpdateModal: dropdown to select from available R_Status values
- TrackingDateModal: date picker to set follow-up date (stored as note in JSON)

---

### Task 8: Add error handling & validation

**Files:**
- Modify: `src/views/consultation/RequestFormView.vue`
- Add validation for activity content (max length 500 chars)
- Add error boundaries

---

### Task 9: Mobile optimization

**Files:**
- Update: CSS media queries for RequestTimeline, QuickActionBar
- Verify sticky bar works on all devices
- Test responsive grid layouts

---

### Task 10: Documentation & final polish

**Files:**
- Update: `README.md` with CRM features documentation
- Add: Inline code comments
- Run full test suite

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-02-19-crm-consultation-implementation.md`.**

Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach would you prefer?

