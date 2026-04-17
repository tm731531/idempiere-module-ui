<template>
  <div class="gantt-page">
    <!-- Toolbar -->
    <div class="gantt-toolbar">
      <div class="toolbar-left">
        <button class="back-btn" @click="router.push({ name: 'consultation-list' })">← 返回列表</button>
        <span class="gantt-title">諮詢甘特圖</span>
      </div>
      <div class="toolbar-right">
        <span class="zoom-label">縮放：</span>
        <button
          v-for="z in ZOOM_LEVELS"
          :key="z.key"
          :class="['zoom-btn', { active: zoomKey === z.key }]"
          @click="zoomKey = z.key"
        >{{ z.label }}</button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">載入中...</div>
    <div v-else-if="items.length === 0" class="empty-state">目前沒有諮詢紀錄</div>

    <div v-else class="gantt-container" ref="containerRef">
      <!-- Header row: date columns -->
      <div class="gantt-header">
        <div class="gantt-label-col gantt-header-cell">諮詢</div>
        <div class="gantt-timeline-col">
          <div class="date-cells">
            <div
              v-for="col in dateColumns"
              :key="col.dateStr"
              :class="['date-cell', { weekend: col.isWeekend, today: col.isToday }]"
              :style="{ width: colWidth + 'px' }"
            >
              {{ col.label }}
            </div>
          </div>
        </div>
      </div>

      <!-- Today line (positioned over the grid) -->
      <div class="gantt-body">
        <div class="gantt-today-line" :style="{ left: todayLineLeft + 'px' }" />

        <!-- Rows -->
        <div
          v-for="item in items"
          :key="item.id"
          class="gantt-row"
        >
          <!-- Left label -->
          <div class="gantt-label-col gantt-row-label" :title="item.summary">
            <span class="row-doc-no">{{ item.docNo }}</span>
            <span class="row-summary">{{ item.summary }}</span>
          </div>

          <!-- Timeline area -->
          <div class="gantt-timeline-col gantt-row-timeline" :style="{ width: timelineWidth + 'px' }">
            <!-- Weekend shading -->
            <div
              v-for="col in dateColumns"
              :key="'bg-' + col.dateStr"
              :class="['col-bg', { weekend: col.isWeekend, today: col.isToday }]"
              :style="{ left: col.offsetPx + 'px', width: colWidth + 'px' }"
            />

            <!-- Bar -->
            <div
              v-if="item.barVisible"
              :class="['gantt-bar', `gantt-bar--${item.color}`]"
              :style="{
                left: item.barLeft + 'px',
                width: Math.max(item.barWidth, MIN_BAR_WIDTH) + 'px',
              }"
              :title="item.tooltip"
              draggable="true"
              @dragstart="onBarDragStart($event, item)"
              @dragend="onBarDragEnd"
            >
              <span class="bar-label">{{ item.docNo }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Drag ghost (invisible helper) -->
    <div ref="ghostRef" class="drag-ghost" />

    <!-- Save error toast -->
    <div v-if="saveError" class="save-error-toast">{{ saveError }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { listRequests, updateRequest } from '@/api/request'
import { parseIdempiereDateTime, toIdempiereDateTime } from '@/api/utils'
import { isRequestCompleted, loadRequestStatuses } from '@/composables/useRequestStatuses'

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

interface ZoomLevel {
  key: 'biweek' | 'month' | 'quarter'
  label: string
  /** How many days the viewport shows */
  days: number
  /** Width of each column in pixels (one column = colDays days) */
  colDays: number
  colWidth: number
}

const ZOOM_LEVELS: ZoomLevel[] = [
  { key: 'biweek', label: '2週',   days: 14,  colDays: 1, colWidth: 46 },
  { key: 'month',  label: '1月',   days: 31,  colDays: 2, colWidth: 52 },
  { key: 'quarter',label: '季度',  days: 90,  colDays: 7, colWidth: 56 },
]

const MIN_BAR_WIDTH = 6
const LABEL_COL_WIDTH = 160 // px, must match CSS

type BarColor = 'red' | 'orange' | 'yellow' | 'green' | 'gray'

interface GanttItem {
  id: number
  docNo: string
  summary: string
  startDate: Date
  endDate: Date
  color: BarColor
  tooltip: string
  barLeft: number
  barWidth: number
  barVisible: boolean
}

interface DateColumn {
  date: Date
  dateStr: string
  label: string
  isWeekend: boolean
  isToday: boolean
  offsetPx: number
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const router = useRouter()
const loading = ref(false)
const saveError = ref<string | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const ghostRef = ref<HTMLElement | null>(null)

const zoomKey = ref<ZoomLevel['key']>('biweek')

/** Start day of the viewport (local midnight) */
const viewStart = ref<Date>((() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  // Start 3 days before today so past items are visible
  d.setDate(d.getDate() - 3)
  return d
})())

const rawRequests = ref<any[]>([])

// ---------------------------------------------------------------------------
// Drag state
// ---------------------------------------------------------------------------

interface DragState {
  item: GanttItem
  startMouseX: number
  originalEndDate: Date
}

let dragState: DragState | null = null

// ---------------------------------------------------------------------------
// Computed: zoom
// ---------------------------------------------------------------------------

const currentZoom = computed<ZoomLevel>(
  () => ZOOM_LEVELS.find(z => z.key === zoomKey.value) ?? ZOOM_LEVELS[0]!
)

const colWidth = computed(() => currentZoom.value.colWidth)
const colDays = computed(() => currentZoom.value.colDays)

const viewDays = computed(() => currentZoom.value.days)

const timelineWidth = computed(() => dateColumns.value.length * colWidth.value)

// ---------------------------------------------------------------------------
// Computed: date columns
// ---------------------------------------------------------------------------

const dateColumns = computed<DateColumn[]>(() => {
  const cols: DateColumn[] = []
  const totalCols = Math.ceil(viewDays.value / colDays.value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < totalCols; i++) {
    const d = new Date(viewStart.value)
    d.setDate(d.getDate() + i * colDays.value)

    const dow = d.getDay() // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6

    const todayMid = new Date(today)
    const isToday = d.getFullYear() === todayMid.getFullYear()
      && d.getMonth() === todayMid.getMonth()
      && d.getDate() === todayMid.getDate()

    const m = d.getMonth() + 1
    const day = d.getDate()
    const label = colDays.value === 1
      ? `${m}/${day}`
      : `${m}/${day}`

    cols.push({
      date: new Date(d),
      dateStr: d.toISOString().slice(0, 10),
      label,
      isWeekend,
      isToday,
      offsetPx: i * colWidth.value,
    })
  }
  return cols
})

// ---------------------------------------------------------------------------
// Computed: today line position
// ---------------------------------------------------------------------------

const todayLineLeft = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = today.getTime() - viewStart.value.getTime()
  const diffDays = diffMs / 86400000
  return LABEL_COL_WIDTH + (diffDays / colDays.value) * colWidth.value
})

// ---------------------------------------------------------------------------
// Helpers: date math
// ---------------------------------------------------------------------------

function dateToViewPx(date: Date): number {
  const diffMs = date.getTime() - viewStart.value.getTime()
  const diffDays = diffMs / 86400000
  return (diffDays / colDays.value) * colWidth.value
}

function pxDeltaToDays(deltaPx: number): number {
  return (deltaPx / colWidth.value) * colDays.value
}

// Wrapper so downstream code keeps working; delegates to the canonical parser.
function stripFakeZ(dateStr: string): Date {
  return parseIdempiereDateTime(String(dateStr))
}

// ---------------------------------------------------------------------------
// Computed: gantt items
// ---------------------------------------------------------------------------

const items = computed<GanttItem[]>(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const viewEnd = new Date(viewStart.value)
  viewEnd.setDate(viewEnd.getDate() + viewDays.value)

  return rawRequests.value.map((r): GanttItem => {
    // Start = Created (audit, read-only)
    const startDate = r.Created ? stripFakeZ(r.Created) : new Date()
    startDate.setHours(0, 0, 0, 0)

    // End = DateNextAction if set, else Created + 7 days
    let endDate: Date
    if (r.DateNextAction) {
      endDate = stripFakeZ(r.DateNextAction)
      endDate.setHours(0, 0, 0, 0)
      // Ensure at least 1 day
      if (endDate <= startDate) {
        endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 1)
      }
    } else {
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 7)
    }

    // Determine color — use the shared IsClosed-backed helper from
    // useRequestStatuses so closed-state logic stays in a single place.
    const isClosed = isRequestCompleted(r)
    let color: BarColor = 'green'
    if (isClosed) {
      color = 'gray'
    } else {
      const diffDays = Math.round((endDate.getTime() - today.getTime()) / 86400000)
      if (diffDays < 0) color = 'red'
      else if (diffDays === 0) color = 'orange'
      else if (diffDays === 1) color = 'yellow'
      else color = 'green'
    }

    // Bar position
    const barLeft = dateToViewPx(startDate)
    const barWidth = Math.max(
      dateToViewPx(endDate) - barLeft,
      MIN_BAR_WIDTH
    )

    // Is bar within visible range?
    const barVisible = endDate >= viewStart.value && startDate <= viewEnd

    // Tooltip
    const docNo = r.DocumentNo || `#${r.id}`
    const summary = r.Summary || ''
    const customerName = r.C_BPartner_ID?.Name || r.C_BPartner_ID?.identifier || ''
    const endStr = formatDateShort(endDate)
    const tooltip = [docNo, summary, customerName ? `客戶: ${customerName}` : '', `到期: ${endStr}`]
      .filter(Boolean)
      .join('\n')

    return {
      id: r.id ?? r.R_Request_ID,
      docNo,
      summary,
      startDate,
      endDate,
      color,
      tooltip,
      barLeft,
      barWidth,
      barVisible,
    }
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateShort(d: Date): string {
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}/${day}`
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadData() {
  loading.value = true
  try {
    // Load R_Status cache in parallel so `isRequestCompleted()` has data
    // when we compute bar colours. Errors are swallowed — the helper falls
    // back to a legacy name list if the cache is empty.
    const [requests] = await Promise.all([
      listRequests(undefined, 200),
      loadRequestStatuses().catch(() => []),
    ])
    rawRequests.value = requests
  } catch {
    rawRequests.value = []
  } finally {
    loading.value = false
  }
}

// ---------------------------------------------------------------------------
// Drag & drop (HTML5)
// ---------------------------------------------------------------------------

function onBarDragStart(event: DragEvent, item: GanttItem) {
  if (!event.dataTransfer) return

  // Use a tiny invisible element as drag image to avoid ghost
  if (ghostRef.value) {
    event.dataTransfer.setDragImage(ghostRef.value, 0, 0)
  }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(item.id))

  dragState = {
    item,
    startMouseX: event.clientX,
    originalEndDate: new Date(item.endDate),
  }

  // Listen on document for dragover to compute preview
  document.addEventListener('dragover', onDocumentDragOver)
}

function onDocumentDragOver(event: DragEvent) {
  event.preventDefault()
  if (!dragState || !event.dataTransfer) return
  event.dataTransfer.dropEffect = 'move'
}

function onBarDragEnd(event: DragEvent) {
  document.removeEventListener('dragover', onDocumentDragOver)
  if (!dragState) return

  const deltaPx = event.clientX - dragState.startMouseX
  const deltaDays = Math.round(pxDeltaToDays(deltaPx))

  if (deltaDays !== 0) {
    const newEnd = new Date(dragState.originalEndDate)
    newEnd.setDate(newEnd.getDate() + deltaDays)
    persistDateNextAction(dragState.item.id, newEnd)
  }

  dragState = null
}

async function persistDateNextAction(id: number, newDate: Date) {
  saveError.value = null
  try {
    // iDempiere writes DateNextAction at local midnight with the fake-Z
    // suffix — use the canonical `toIdempiereDateTime` from @/api/utils.
    const midnight = new Date(newDate)
    midnight.setHours(0, 0, 0, 0)
    const isoStr = toIdempiereDateTime(midnight)

    await updateRequest(id, { DateNextAction: isoStr })

    // Patch local data so the bar re-renders immediately
    const rec = rawRequests.value.find(r => (r.id ?? r.R_Request_ID) === id)
    if (rec) {
      rec.DateNextAction = isoStr
    }
  } catch (err: any) {
    saveError.value = `儲存失敗: ${err?.message || '請稍後再試'}`
    setTimeout(() => { saveError.value = null }, 4000)
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(loadData)

onBeforeUnmount(() => {
  document.removeEventListener('dragover', onDocumentDragOver)
})
</script>

<style scoped>
/* ─── Layout ─────────────────────────────────────────────────────────────── */

.gantt-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100vh;
  background: #f8fafc;
  font-size: 0.875rem;
}

/* ─── Toolbar ─────────────────────────────────────────────────────────────── */

.gantt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  gap: 0.5rem;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.back-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 0.8125rem;
  color: #64748b;
  transition: background 0.15s;
}

.back-btn:hover {
  background: #f1f5f9;
}

.gantt-title {
  font-weight: 600;
  font-size: 1rem;
  color: #1e293b;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.zoom-label {
  font-size: 0.8125rem;
  color: #64748b;
  margin-right: 0.25rem;
}

.zoom-btn {
  padding: 0.3125rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 0.8125rem;
  color: #64748b;
  transition: all 0.15s;
}

.zoom-btn:hover {
  background: #f1f5f9;
}

.zoom-btn.active {
  background: var(--color-primary, #6366f1);
  color: white;
  border-color: var(--color-primary, #6366f1);
}

/* ─── Loading / empty ──────────────────────────────────────────────────────── */

.loading-state,
.empty-state {
  padding: 3rem;
  text-align: center;
  color: #64748b;
}

/* ─── Gantt container ──────────────────────────────────────────────────────── */

.gantt-container {
  overflow-x: auto;
  flex: 1;
  position: relative;
}

/* ─── Header row ─────────────────────────────────────────────────────────── */

.gantt-header {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
  border-bottom: 2px solid #e2e8f0;
}

.gantt-header-cell {
  font-weight: 600;
  color: #475569;
  font-size: 0.8125rem;
  border-right: 1px solid #e2e8f0;
}

.gantt-label-col {
  width: 160px;
  min-width: 160px;
  flex-shrink: 0;
  padding: 0.5rem 0.75rem;
  box-sizing: border-box;
}

.gantt-timeline-col {
  flex: 1;
  position: relative;
  min-width: 0;
}

.date-cells {
  display: flex;
}

.date-cell {
  flex-shrink: 0;
  padding: 0.5rem 0.25rem;
  text-align: center;
  font-size: 0.75rem;
  color: #64748b;
  border-right: 1px solid #f1f5f9;
  box-sizing: border-box;
  overflow: hidden;
  white-space: nowrap;
}

.date-cell.weekend {
  background: #fafafa;
  color: #94a3b8;
}

.date-cell.today {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}

/* ─── Body ────────────────────────────────────────────────────────────────── */

.gantt-body {
  position: relative;
}

.gantt-today-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #3b82f6;
  opacity: 0.6;
  pointer-events: none;
  z-index: 5;
}

/* ─── Row ─────────────────────────────────────────────────────────────────── */

.gantt-row {
  display: flex;
  border-bottom: 1px solid #f1f5f9;
  min-height: 40px;
  align-items: center;
}

.gantt-row:hover {
  background: #f8fafc;
}

.gantt-row-label {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-right: 1px solid #e2e8f0;
  gap: 2px;
  overflow: hidden;
}

.row-doc-no {
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-summary {
  font-size: 0.75rem;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gantt-row-timeline {
  position: relative;
  height: 40px;
  overflow: hidden;
}

/* ─── Column background shading ──────────────────────────────────────────── */

.col-bg {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
}

.col-bg.weekend {
  background: rgba(0, 0, 0, 0.03);
}

.col-bg.today {
  background: rgba(59, 130, 246, 0.05);
}

/* ─── Bar ─────────────────────────────────────────────────────────────────── */

.gantt-bar {
  position: absolute;
  top: 8px;
  height: 24px;
  border-radius: 4px;
  cursor: grab;
  display: flex;
  align-items: center;
  padding: 0 6px;
  overflow: hidden;
  transition: filter 0.1s;
  z-index: 2;
  user-select: none;
  box-sizing: border-box;
}

.gantt-bar:active {
  cursor: grabbing;
}

.gantt-bar:hover {
  filter: brightness(1.08);
}

.bar-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}

/* Color variants */
.gantt-bar--red    { background: #ef4444; }
.gantt-bar--orange { background: #f97316; }
.gantt-bar--yellow { background: #eab308; }
.gantt-bar--green  { background: #22c55e; }
.gantt-bar--gray   { background: #94a3b8; }

/* ─── Drag ghost ──────────────────────────────────────────────────────────── */

.drag-ghost {
  position: fixed;
  top: -9999px;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

/* ─── Toast ───────────────────────────────────────────────────────────────── */

.save-error-toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: #ef4444;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.875rem;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
