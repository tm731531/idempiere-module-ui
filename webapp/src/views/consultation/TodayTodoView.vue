<template>
  <div class="today-todo-page">
    <!-- Header row with title and "僅我的" toggle -->
    <div class="page-header">
      <h2 class="page-title">今日待辦</h2>
      <div class="my-toggle">
        <button
          :class="['toggle-btn', { active: !myOnly }]"
          @click="myOnly = false"
        >全部</button>
        <button
          :class="['toggle-btn', { active: myOnly }]"
          @click="myOnly = true"
        >僅我的</button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">載入中...</div>

    <template v-else>
      <!-- Stat row: 4 summary cards -->
      <div class="stat-row">
        <div class="stat-card stat-card--overdue">
          <div class="stat-count">{{ overdue.length }}</div>
          <div class="stat-label">逾期</div>
        </div>
        <div class="stat-card stat-card--today">
          <div class="stat-count">{{ todayItems.length }}</div>
          <div class="stat-label">今日跟進</div>
        </div>
        <div class="stat-card stat-card--tomorrow">
          <div class="stat-count">{{ tomorrowItems.length }}</div>
          <div class="stat-label">明日跟進</div>
        </div>
        <div class="stat-card stat-card--closed">
          <div class="stat-count">{{ closedToday.length }}</div>
          <div class="stat-label">今日完成</div>
        </div>
      </div>

      <!-- Overdue section -->
      <div class="section">
        <button class="section-header section-header--overdue" @click="collapsed.overdue = !collapsed.overdue">
          <span class="section-title">
            <span class="section-badge section-badge--overdue">逾期</span>
            {{ overdue.length }} 筆
          </span>
          <span class="collapse-icon">{{ collapsed.overdue ? '▶' : '▼' }}</span>
        </button>
        <div v-if="!collapsed.overdue" class="section-cards">
          <RequestCard
            v-for="r in overdue"
            :key="r.id"
            :request="r"
            badge-color="red"
            :badge-text="getOverdueBadgeText(r)"
            @click="goToEdit(r)"
          />
          <p v-if="overdue.length === 0" class="empty-bucket">無待辦項目</p>
        </div>
      </div>

      <!-- Today section -->
      <div class="section">
        <button class="section-header section-header--today" @click="collapsed.today = !collapsed.today">
          <span class="section-title">
            <span class="section-badge section-badge--today">今日跟進</span>
            {{ todayItems.length }} 筆
          </span>
          <span class="collapse-icon">{{ collapsed.today ? '▶' : '▼' }}</span>
        </button>
        <div v-if="!collapsed.today" class="section-cards">
          <RequestCard
            v-for="r in todayItems"
            :key="r.id"
            :request="r"
            badge-color="orange"
            badge-text="今日跟進"
            @click="goToEdit(r)"
          />
          <p v-if="todayItems.length === 0" class="empty-bucket">無待辦項目</p>
        </div>
      </div>

      <!-- Tomorrow section -->
      <div class="section">
        <button class="section-header section-header--tomorrow" @click="collapsed.tomorrow = !collapsed.tomorrow">
          <span class="section-title">
            <span class="section-badge section-badge--tomorrow">明日跟進</span>
            {{ tomorrowItems.length }} 筆
          </span>
          <span class="collapse-icon">{{ collapsed.tomorrow ? '▶' : '▼' }}</span>
        </button>
        <div v-if="!collapsed.tomorrow" class="section-cards">
          <RequestCard
            v-for="r in tomorrowItems"
            :key="r.id"
            :request="r"
            badge-color="yellow"
            badge-text="明日跟進"
            @click="goToEdit(r)"
          />
          <p v-if="tomorrowItems.length === 0" class="empty-bucket">無待辦項目</p>
        </div>
      </div>

      <!-- Closed today section -->
      <div class="section">
        <button class="section-header section-header--closed" @click="collapsed.closed = !collapsed.closed">
          <span class="section-title">
            <span class="section-badge section-badge--closed">今日完成</span>
            {{ closedToday.length }} 筆
          </span>
          <span class="collapse-icon">{{ collapsed.closed ? '▶' : '▼' }}</span>
        </button>
        <div v-if="!collapsed.closed" class="section-cards">
          <RequestCard
            v-for="r in closedToday"
            :key="r.id"
            :request="r"
            badge-color="green"
            badge-text="今日完成"
            @click="goToEdit(r)"
          />
          <p v-if="closedToday.length === 0" class="empty-bucket">無待辦項目</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { defineComponent, h } from 'vue'
import { useRouter } from 'vue-router'
import { listRequests } from '@/api/request'
import { lookupCurrentUserId } from '@/api/lookup'
import {
  loadRequestStatuses,
  isRequestCompleted,
} from '@/composables/useRequestStatuses'
import { useAuthStore } from '@/stores/auth'
import { getTrackingBadge } from '@/utils/trackingBadge'

// ---- Inline RequestCard component ----
const RequestCard = defineComponent({
  name: 'RequestCard',
  props: {
    request: { type: Object, required: true },
    badgeColor: { type: String, default: 'gray' },
    badgeText: { type: String, default: '' },
  },
  emits: ['click'],
  setup(props, { emit }) {
    function getCustomerName(r: any): string {
      const bp = r.C_BPartner_ID
      if (bp && typeof bp === 'object') return bp.Name || bp.identifier || ''
      if (typeof bp === 'number' && bp > 0) return `客戶 #${bp}`
      return ''
    }

    function getOperatorName(r: any): string {
      const sr = r.SalesRep_ID
      if (sr && typeof sr === 'object') {
        return sr.Name || sr.identifier || `諮詢師 #${sr.id}`
      }
      if (typeof sr === 'number' && sr > 0) return `諮詢師 #${sr}`
      return '未分配'
    }

    function getPriorityLabel(priority: any): string {
      const p = typeof priority === 'number' ? priority : Number(priority)
      if (isNaN(p)) return ''
      if (p <= 3) return '高'
      if (p <= 6) return '中'
      return '低'
    }

    function getPriorityClass(priority: any): string {
      const p = typeof priority === 'number' ? priority : Number(priority)
      if (isNaN(p)) return ''
      if (p <= 3) return 'priority--high'
      if (p <= 6) return 'priority--medium'
      return 'priority--low'
    }

    return () => h('div', {
      class: 'request-card',
      onClick: () => emit('click'),
    }, [
      h('div', { class: 'card-main' }, [
        h('div', { class: 'card-title-row' }, [
          h('span', { class: 'card-summary' }, props.request.Summary || '(無標題)'),
          props.request.Priority != null
            ? h('span', { class: `priority-tag ${getPriorityClass(props.request.Priority)}` }, getPriorityLabel(props.request.Priority))
            : null,
        ]),
        getCustomerName(props.request)
          ? h('div', { class: 'card-customer' }, getCustomerName(props.request))
          : null,
      ]),
      h('div', { class: 'card-meta' }, [
        h('span', { class: `tracking-badge tracking-badge--${props.badgeColor}` }, props.badgeText),
        h('span', { class: 'card-operator' }, `👤 ${getOperatorName(props.request)}`),
      ]),
    ])
  },
})

// ---- Main view logic ----

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const allRequests = ref<any[]>([])
const myOnly = ref(false)
const currentUserId = ref<number | null>(null)

const collapsed = ref({
  overdue: false,
  today: false,
  tomorrow: false,
  closed: false,
})

/** Today midnight (local) */
function todayMidnight(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Parse iDempiere datetime (strip fake Z) */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const d = new Date(String(dateStr).replace(/Z$/i, ''))
  return isNaN(d.getTime()) ? null : d
}

/** Day difference (calendar days) from today midnight. Negative = past. */
function diffDaysFromToday(dateStr: string | null | undefined): number | null {
  const d = parseDate(dateStr)
  if (!d) return null
  const trackingDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffMs = trackingDay.getTime() - todayMidnight().getTime()
  return Math.round(diffMs / 86400000)
}

/** Filter requests optionally by current user's SalesRep_ID */
const filteredRequests = computed(() => {
  if (!myOnly.value || currentUserId.value === null) return allRequests.value
  const uid = currentUserId.value
  return allRequests.value.filter(r => {
    const sr = r.SalesRep_ID
    if (sr && typeof sr === 'object') return sr.id === uid
    if (typeof sr === 'number') return sr === uid
    return false
  })
})

/** Sort by Priority ascending (1 = highest; null/undefined go to end) */
function sortByPriority(reqs: any[]): any[] {
  return [...reqs].sort((a, b) => {
    const pa = a.Priority != null ? Number(a.Priority) : 999
    const pb = b.Priority != null ? Number(b.Priority) : 999
    return pa - pb
  })
}

const overdue = computed(() =>
  sortByPriority(
    filteredRequests.value.filter(r => {
      if (isRequestCompleted(r)) return false
      const diff = diffDaysFromToday(r.DateNextAction)
      return diff !== null && diff < 0
    })
  )
)

const todayItems = computed(() =>
  sortByPriority(
    filteredRequests.value.filter(r => {
      if (isRequestCompleted(r)) return false
      return diffDaysFromToday(r.DateNextAction) === 0
    })
  )
)

const tomorrowItems = computed(() =>
  sortByPriority(
    filteredRequests.value.filter(r => {
      if (isRequestCompleted(r)) return false
      return diffDaysFromToday(r.DateNextAction) === 1
    })
  )
)

const closedToday = computed(() =>
  sortByPriority(
    filteredRequests.value.filter(r => {
      if (!isRequestCompleted(r)) return false
      const updated = parseDate(r.Updated)
      if (!updated) return false
      const updatedDay = new Date(updated.getFullYear(), updated.getMonth(), updated.getDate())
      return updatedDay.getTime() === todayMidnight().getTime()
    })
  )
)

function getOverdueBadgeText(r: any): string {
  const badge = getTrackingBadge(r.DateNextAction)
  return badge ? badge.text : '逾期'
}

function goToEdit(r: any) {
  router.push({
    name: 'consultation-edit',
    params: { id: r.id },
    state: { preloadedData: r },
  })
}

// Expand sections that have content; collapse empty ones
function updateCollapsed() {
  collapsed.value.overdue = overdue.value.length === 0
  collapsed.value.today = todayItems.value.length === 0
  collapsed.value.tomorrow = tomorrowItems.value.length === 0
  collapsed.value.closed = closedToday.value.length === 0
}

async function loadData() {
  loading.value = true
  try {
    await loadRequestStatuses()
    allRequests.value = await listRequests(undefined, 200)
    updateCollapsed()
  } catch {
    allRequests.value = []
  } finally {
    loading.value = false
  }
}

// When myOnly toggle changes, re-evaluate collapsed state
watch(myOnly, () => {
  updateCollapsed()
})

onMounted(async () => {
  // Resolve current user's AD_User_ID for "僅我的" toggle
  const userName = authStore.user?.name
  if (userName) {
    try {
      currentUserId.value = await lookupCurrentUserId(userName)
    } catch {
      currentUserId.value = null
    }
  }

  await loadData()
})
</script>

<style scoped>
.today-todo-page {
  padding: 1rem;
  padding-bottom: 5rem;
  max-width: 600px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

/* 全部 / 僅我的 toggle */
.my-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.toggle-btn {
  padding: 0.375rem 0.875rem;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  cursor: pointer;
  color: #64748b;
  transition: all 0.15s;
}

.toggle-btn.active {
  background: var(--color-primary);
  color: white;
}

.toggle-btn:not(.active):hover {
  background: #f1f5f9;
}

/* Stat row */
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.stat-card {
  padding: 0.75rem 0.5rem;
  border-radius: 10px;
  text-align: center;
  border: 1px solid transparent;
}

.stat-count {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  margin-top: 0.25rem;
  font-weight: 500;
}

.stat-card--overdue {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

.stat-card--today {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #ea580c;
}

.stat-card--tomorrow {
  background: #fefce8;
  border-color: #fef08a;
  color: #ca8a04;
}

.stat-card--closed {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #16a34a;
}

/* Sections */
.section {
  margin-bottom: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 600;
  text-align: left;
  transition: background 0.15s;
}

.section-header--overdue { background: #fef2f2; color: #dc2626; }
.section-header--today   { background: #fff7ed; color: #ea580c; }
.section-header--tomorrow{ background: #fefce8; color: #ca8a04; }
.section-header--closed  { background: #f0fdf4; color: #16a34a; }

.section-header:hover {
  filter: brightness(0.97);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
}

.section-badge--overdue  { background: #dc2626; color: white; }
.section-badge--today    { background: #ea580c; color: white; }
.section-badge--tomorrow { background: #ca8a04; color: white; }
.section-badge--closed   { background: #16a34a; color: white; }

.collapse-icon {
  font-size: 0.75rem;
  opacity: 0.7;
}

.section-cards {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: white;
}

/* Request cards (rendered by inline component) */
:deep(.request-card) {
  padding: 0.75rem 1rem;
  background: #fafafa;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

:deep(.request-card:hover) {
  border-color: var(--color-primary);
  background: #f0f0ff;
}

:deep(.card-main) {
  margin-bottom: 0.5rem;
}

:deep(.card-title-row) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

:deep(.card-summary) {
  font-weight: 500;
  font-size: 0.9375rem;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.card-customer) {
  font-size: 0.8125rem;
  color: #64748b;
  margin-top: 0.25rem;
}

:deep(.card-meta) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

:deep(.tracking-badge) {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

:deep(.tracking-badge--red) {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

:deep(.tracking-badge--orange) {
  background: #fff7ed;
  color: #ea580c;
  border: 1px solid #fed7aa;
}

:deep(.tracking-badge--yellow) {
  background: #fefce8;
  color: #ca8a04;
  border: 1px solid #fef08a;
}

:deep(.tracking-badge--green) {
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

:deep(.card-operator) {
  font-size: 0.8125rem;
  color: white;
  background: #2196f3;
  padding: 0.25rem 0.625rem;
  border-radius: 4px;
  font-weight: 600;
}

:deep(.priority-tag) {
  display: inline-block;
  padding: 0.0625rem 0.375rem;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  white-space: nowrap;
}

:deep(.priority--high)   { background: #dc2626; color: white; }
:deep(.priority--medium) { background: #ea580c; color: white; }
:deep(.priority--low)    { background: #64748b; color: white; }

/* Loading / empty */
.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
}

.empty-bucket {
  text-align: center;
  padding: 0.75rem 1rem;
  color: #94a3b8;
  font-size: 0.875rem;
  margin: 0;
}
</style>
