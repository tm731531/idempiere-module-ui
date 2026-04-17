<template>
  <div class="journey-page">
    <div class="journey-header">
      <div class="header-left">
        <button class="back-btn" @click="router.push({ name: 'consultation-list' })">返回</button>
        <h1 class="page-title">客戶旅程漏斗</h1>
      </div>
      <div class="date-filter">
        <button
          v-for="opt in DATE_OPTIONS"
          :key="opt.value"
          :class="['date-btn', { active: dateRange === opt.value }]"
          @click="dateRange = opt.value"
        >{{ opt.label }}</button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">載入中...</div>
    <div v-else-if="stages.length === 0" class="empty-state">
      <p>暫無狀態資料，請先設定諮詢狀態（R_Status）。</p>
    </div>
    <div v-else class="funnel-container">
      <!-- Funnel Bars -->
      <div class="funnel-bars">
        <div
          v-for="(stage, idx) in stages"
          :key="stage.stageIndex"
          class="funnel-bar-row"
        >
          <div
            :class="['funnel-bar', `funnel-bar--stage${stage.stageIndex + 1}`, { expanded: expandedStage === stage.stageIndex }]"
            :style="{ width: barWidth(idx, stage.count) }"
            @click="toggleExpand(stage.stageIndex)"
          >
            <div class="bar-inner">
              <div class="bar-stage-name">{{ stage.name }}</div>
              <div class="bar-stats">
                <span class="bar-count">{{ stage.count }} 件</span>
                <span v-if="idx > 0" class="bar-rate">
                  轉化率 {{ conversionRate(idx) }}%
                </span>
                <span v-if="idx > 0" class="bar-dropoff">
                  -{{ dropOff(idx) }} 流失
                </span>
              </div>
            </div>
            <svg
              class="expand-chevron"
              :class="{ rotated: expandedStage === stage.stageIndex }"
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          <!-- Drill-down panel -->
          <transition name="slide-down">
            <div v-if="expandedStage === stage.stageIndex" class="drill-down">
              <div v-if="stage.requests.length === 0" class="drill-empty">此階段無諮詢記錄</div>
              <div
                v-for="r in stage.requests"
                :key="r.id"
                class="drill-card"
                @click="router.push({ name: 'consultation-edit', params: { id: r.id } })"
              >
                <div class="drill-card-title">{{ r.Summary || '(無標題)' }}</div>
                <div class="drill-card-meta">
                  <span class="drill-customer">{{ getCustomerName(r) }}</span>
                  <span class="drill-status">{{ getStatusLabel(r) }}</span>
                  <span class="drill-date">{{ formatDate(r.Created) }}</span>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- Legend: statuses per stage -->
      <div class="stage-legend">
        <div
          v-for="stage in stages"
          :key="stage.stageIndex"
          :class="['legend-item', `legend-item--stage${stage.stageIndex + 1}`]"
        >
          <div class="legend-header">{{ stage.name }}</div>
          <div class="legend-statuses">
            <span
              v-for="s in stage.statuses"
              :key="s.R_Status_ID"
              class="legend-status-tag"
            >{{ s.Name }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { listRequests } from '@/api/request'
import {
  loadRequestStatuses,
  getAllStatuses,
  extractStatusId,
  getStatusName,
  isRequestCompleted,
} from '@/composables/useRequestStatuses'
import type { RequestStatus } from '@/api/request'

const router = useRouter()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FunnelStage {
  stageIndex: number    // 0-3
  name: string
  statuses: RequestStatus[]
  requests: any[]
  count: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STAGE_NAMES = ['潛在客戶', '有意向', '商機', '成交客戶']
const DATE_OPTIONS = [
  { value: '7', label: '7 天' },
  { value: '30', label: '30 天' },
  { value: '90', label: '90 天' },
  { value: 'all', label: '全部' },
]
// Bar widths for inverted pyramid (Stage 1 = 100%, Stage 4 = 40%)
const BAR_MAX_WIDTHS = ['100%', '80%', '60%', '40%']

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const loading = ref(false)
const dateRange = ref('all')
const allRequests = ref<any[]>([])
const expandedStage = ref<number | null>(null)

// ---------------------------------------------------------------------------
// Date range filtering
// ---------------------------------------------------------------------------
const filteredRequests = computed(() => {
  if (dateRange.value === 'all') return allRequests.value
  const days = parseInt(dateRange.value, 10)
  const cutoff = Date.now() - days * 86400_000
  return allRequests.value.filter(r => {
    if (!r.Created) return false
    const ts = new Date(String(r.Created).replace(/Z$/i, '')).getTime()
    return ts >= cutoff
  })
})

// ---------------------------------------------------------------------------
// Stage computation (quartile-based, no hardcoded IDs)
// ---------------------------------------------------------------------------

/**
 * Divide statuses into N evenly-sized groups (quartiles when n=4).
 * Returns an array of arrays, each containing the statuses in that group.
 */
function buildStageGroups(allStatuses: RequestStatus[]): RequestStatus[][] {
  const n = allStatuses.length
  if (n === 0) return []

  // Determine how many stages to use: clamp to min(4, n)
  const numStages = Math.min(4, n)
  const groups: RequestStatus[][] = Array.from({ length: numStages }, () => [])

  allStatuses.forEach((s, i) => {
    // Which group? floor(i / n * numStages) — even distribution
    const groupIdx = Math.min(Math.floor((i * numStages) / n), numStages - 1)
    const group = groups[groupIdx]
    if (group) group.push(s)
  })

  return groups
}

/**
 * Build a lookup: R_Status_ID → stage index (0-based)
 */
function buildStatusStageMap(groups: RequestStatus[][]): Map<number, number> {
  const map = new Map<number, number>()
  groups.forEach((group, idx) => {
    group.forEach(s => map.set(s.R_Status_ID, idx))
  })
  return map
}

const stages = computed((): FunnelStage[] => {
  const allStatuses = getAllStatuses()
  const groups = buildStageGroups(allStatuses)
  if (groups.length === 0) return []

  const stageMap = buildStatusStageMap(groups)

  // Bucket each request into a stage
  const buckets: any[][] = Array.from({ length: groups.length }, () => [])

  filteredRequests.value.forEach(r => {
    const statusId = extractStatusId(r)
    let stageIdx: number | null = null

    if (statusId !== null) {
      stageIdx = stageMap.get(statusId) ?? null
    }

    // Fallback: if no R_Status_ID, try by name (legacy records)
    if (stageIdx === null) {
      const legacyName = r.LastResult
      if (legacyName) {
        const found = allStatuses.find(s => s.Name === legacyName)
        if (found) stageIdx = stageMap.get(found.R_Status_ID) ?? null
      }
    }

    // Default to stage 0 if we still can't determine
    if (stageIdx === null) stageIdx = 0
    const bucket = buckets[stageIdx]
    if (bucket) bucket.push(r)
  })

  return groups.map((group, idx) => ({
    stageIndex: idx,
    name: STAGE_NAMES[idx] ?? `Stage ${idx + 1}`,
    statuses: group,
    requests: buckets[idx] ?? [],
    count: buckets[idx]?.length ?? 0,
  }))
})

// ---------------------------------------------------------------------------
// Funnel metrics
// ---------------------------------------------------------------------------

/** Stage 0 is the baseline; higher stages show conversion from previous stage */
function conversionRate(stageIdx: number): string {
  if (stageIdx <= 0 || stages.value.length <= stageIdx) return '0'
  const prevStage = stages.value[stageIdx - 1]
  const currStage = stages.value[stageIdx]
  if (!prevStage || !currStage) return '0'
  const prev = prevStage.count
  const curr = currStage.count
  if (prev === 0) return '0'
  return ((curr / prev) * 100).toFixed(1)
}

function dropOff(stageIdx: number): number {
  if (stageIdx <= 0 || stages.value.length <= stageIdx) return 0
  const prevStage = stages.value[stageIdx - 1]
  const currStage = stages.value[stageIdx]
  if (!prevStage || !currStage) return 0
  return Math.max(0, prevStage.count - currStage.count)
}

function barWidth(idx: number, count: number): string {
  // If we have fewer than 4 stages, scale bar widths accordingly
  const numStages = stages.value.length
  const maxWidths = ['100%', '80%', '60%', '40%']
  // For fewer stages, interpolate between 100% and 40%
  if (numStages <= 1) return '100%'
  const step = (100 - 40) / (numStages - 1)
  const pct = 100 - idx * step
  // Use predefined values for 4-stage case; dynamic for others
  if (numStages === 4) return maxWidths[idx] ?? `${pct}%`
  return `${pct.toFixed(0)}%`
}

// ---------------------------------------------------------------------------
// Drill-down toggle
// ---------------------------------------------------------------------------
function toggleExpand(stageIdx: number) {
  expandedStage.value = expandedStage.value === stageIdx ? null : stageIdx
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
function getCustomerName(r: any): string {
  const bp = r.C_BPartner_ID
  if (bp && typeof bp === 'object') return bp.Name || bp.identifier || ''
  if (typeof bp === 'number' && bp > 0) return `客戶 #${bp}`
  return ''
}

function getStatusLabel(r: any): string {
  const id = extractStatusId(r)
  if (id !== null) {
    const name = getStatusName(id)
    if (name) return name
  }
  return r.LastResult || ''
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(String(dateStr).replace(/Z$/i, ''))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------
async function loadData() {
  loading.value = true
  try {
    const [requests] = await Promise.all([
      listRequests(undefined, 500),
      loadRequestStatuses(),
    ])
    allRequests.value = requests
  } catch {
    allRequests.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.journey-page {
  padding: 1rem;
  max-width: 700px;
  margin: 0 auto;
  padding-bottom: 5rem;
}

.journey-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: #1e293b;
}

.back-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s;
}

.back-btn:hover {
  background: #f1f5f9;
}

/* Date filter pills */
.date-filter {
  display: flex;
  gap: 0.25rem;
}

.date-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 999px;
  background: white;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s;
  color: #64748b;
}

.date-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
}

/* Funnel layout */
.funnel-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.funnel-bars {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.funnel-bar-row {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Each funnel bar */
.funnel-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: filter 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  min-height: 48px;
}

.funnel-bar:hover {
  filter: brightness(1.04);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

/* Stage color gradient: Stage 1 (light blue) → Stage 4 (deep blue) */
.funnel-bar--stage1 { background: #dbeafe; color: #1e40af; }
.funnel-bar--stage2 { background: #93c5fd; color: #1e3a8a; }
.funnel-bar--stage3 { background: #3b82f6; color: white; }
.funnel-bar--stage4 { background: #1d4ed8; color: white; }

.bar-inner {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  flex-wrap: wrap;
}

.bar-stage-name {
  font-weight: 700;
  font-size: 0.9375rem;
  white-space: nowrap;
}

.bar-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
  flex-wrap: wrap;
}

.bar-count {
  font-weight: 600;
}

.bar-rate {
  opacity: 0.9;
}

.bar-dropoff {
  opacity: 0.75;
}

.expand-chevron {
  flex-shrink: 0;
  transition: transform 0.2s;
  margin-left: 0.5rem;
}

.expand-chevron.rotated {
  transform: rotate(180deg);
}

/* Drill-down panel */
.drill-down {
  width: 92%;
  margin: 0.25rem auto 0;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.drill-empty {
  text-align: center;
  padding: 1rem;
  color: #94a3b8;
  font-size: 0.875rem;
}

.drill-card {
  padding: 0.625rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.12s;
}

.drill-card:last-child {
  border-bottom: none;
}

.drill-card:hover {
  background: #f1f5f9;
}

.drill-card-title {
  font-weight: 500;
  font-size: 0.9375rem;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drill-card-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: #64748b;
  flex-wrap: wrap;
}

.drill-customer {
  font-weight: 500;
  color: #334155;
}

.drill-status {
  background: rgba(59, 130, 246, 0.1);
  color: #1d4ed8;
  padding: 0.0625rem 0.375rem;
  border-radius: 4px;
}

/* Slide-down transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: max-height 0.25s ease, opacity 0.2s ease;
  max-height: 9999px;
  opacity: 1;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

/* Stage legend */
.stage-legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
}

.legend-item {
  border-radius: 8px;
  padding: 0.625rem 0.75rem;
  border: 1px solid transparent;
}

.legend-item--stage1 { background: #eff6ff; border-color: #bfdbfe; }
.legend-item--stage2 { background: #dbeafe; border-color: #93c5fd; }
.legend-item--stage3 { background: #bfdbfe; border-color: #60a5fa; }
.legend-item--stage4 { background: #93c5fd; border-color: #3b82f6; }

.legend-header {
  font-weight: 700;
  font-size: 0.8125rem;
  color: #1e40af;
  margin-bottom: 0.375rem;
}

.legend-statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.legend-status-tag {
  font-size: 0.75rem;
  background: white;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  padding: 0.0625rem 0.375rem;
  color: #1e40af;
}
</style>
