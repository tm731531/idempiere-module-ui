<template>
  <div class="calendar-page">
    <!-- Resource filter chips -->
    <div class="resource-selector">
      <div class="selector-header">
        <span class="selector-title">服務人員</span>
        <button class="btn-toggle-all" @click="toggleAll">
          {{ allSelected ? '取消全選' : '全選' }}
        </button>
      </div>
      <div v-if="resourcesLoading" class="selector-loading">載入中...</div>
      <div v-else class="resource-chips">
        <label
          v-for="res in resources"
          :key="res.id"
          class="resource-chip"
          :class="{ selected: selectedResourceIds.has(res.id) }"
          @click.prevent="toggleResource(res.id)"
        >
          <span class="chip-dot" :style="{ backgroundColor: getResourceColor(res.id) }"></span>
          <span class="chip-name">{{ res.Name }}</span>
        </label>
      </div>
    </div>

    <!-- Calendar -->
    <div class="calendar-section">
      <!-- View mode tabs -->
      <div class="view-tabs">
        <button
          v-for="m in viewModes"
          :key="m.key"
          class="view-tab"
          :class="{ active: viewMode === m.key }"
          @click="switchView(m.key)"
        >{{ m.label }}</button>
      </div>

      <!-- Navigation -->
      <div class="calendar-header">
        <div class="nav-row">
          <button class="nav-btn" @click="navPrev">&lt;</button>
          <button class="nav-btn today-btn" @click="navToday">今天</button>
          <button class="nav-btn" @click="navNext">&gt;</button>
        </div>
        <div class="header-label">{{ headerLabel }}</div>
      </div>

      <!-- Day tabs (week view only) -->
      <div v-if="viewMode === 'week'" class="day-tabs">
        <button
          v-for="day in weekDays"
          :key="day.date"
          class="day-tab"
          :class="{ active: selectedDay === day.date, today: day.isToday }"
          @click="selectedDay = day.date"
        >
          <span class="day-label">{{ day.label }}</span>
          <span class="day-date">{{ day.dateShort }}</span>
        </button>
      </div>

      <div v-if="loading" class="loading-state">載入中...</div>

      <!-- Day / Week: time grid -->
      <div v-else-if="viewMode === 'day' || viewMode === 'week'" class="calendar-grid-wrapper">
        <div class="time-grid">
          <div
            v-for="slot in timeSlots"
            :key="slot"
            class="time-row"
            @click="onSlotClick(slot)"
          >
            <div class="time-label">{{ slot }}</div>
            <div class="slot-bg"></div>
          </div>
          <!-- Appointment blocks (absolutely positioned, side-by-side) -->
          <div
            v-for="layout in dayApptLayout"
            :key="layout.appt.id"
            class="appt-block"
            :class="{
              'conflict': dragState.hasConflict && dragState.appointmentId === layout.appt.id,
              'dragging': dragState.dragging && dragState.appointmentId === layout.appt.id,
            }"
            :style="getApptBlockStyle(layout)"
            :title="`${getResourceName(layout.appt)} — ${layout.appt.Name}`"
            @click.stop="onApptClick(layout.appt)"
            @contextmenu.stop="onApptContextMenu($event, layout.appt)"
            @mousedown="startDragAppt($event, layout.appt)"
            @touchstart="startDragAppt($event, layout.appt)"
          >
            <span class="appt-resource">{{ getResourceName(layout.appt) }}</span>
            <span class="appt-name">{{ layout.appt.Name }}</span>
            <span class="appt-time">{{ formatApptTime(layout.appt) }}</span>

            <!-- Conflict tooltip -->
            <div
              v-if="dragState.hasConflict && dragState.appointmentId === layout.appt.id"
              class="conflict-tooltip"
            >
              與「{{ dragState.conflictingNames.join('」「') }}」衝突
            </div>
          </div>
        </div>
      </div>

      <!-- Month: calendar grid -->
      <div v-else-if="viewMode === 'month'" class="month-grid-wrapper">
        <div class="month-weekday-header">
          <span v-for="d in DAY_LABELS" :key="d" class="weekday-label">{{ d }}</span>
        </div>
        <div class="month-grid">
          <div
            v-for="(cell, i) in monthCells"
            :key="i"
            class="month-cell"
            :class="{
              'other-month': !cell.currentMonth,
              today: cell.isToday,
            }"
            @click="cell.date && drillToDay(cell.date)"
          >
            <span class="cell-day">{{ cell.day }}</span>
            <div v-if="cell.resourceCounts.length > 0" class="cell-counts">
              <span
                v-for="rc in cell.resourceCounts"
                :key="rc.id"
                class="cell-res-badge"
                :style="{ backgroundColor: getResourceColor(rc.id) }"
              >{{ rc.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Year: 12 month cards -->
      <div v-else-if="viewMode === 'year'" class="year-grid">
        <div
          v-for="m in yearMonths"
          :key="m.month"
          class="year-month-card"
          :class="{ 'current-month': m.isCurrent }"
          @click="drillToMonth(m.month)"
        >
          <span class="month-name">{{ m.label }}</span>
          <div v-if="m.resourceCounts.length > 0" class="cell-counts">
            <span
              v-for="rc in m.resourceCounts"
              :key="rc.id"
              class="cell-res-badge"
              :style="{ backgroundColor: getResourceColor(rc.id) }"
            >{{ rc.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Sheet: Appointment Action Menu (Mobile) -->
    <BottomSheet v-model="showActionSheet">
      <AppointmentActionSheet
        v-if="selectedAppt"
        :appt="selectedAppt"
        :resources="resources"
        @edit="handleEditAppt"
        @copy="handleCopyAppt"
        @delete="handleDeleteAppt"
      />
    </BottomSheet>

    <!-- Copy Assignment Dialog (Phase 2) -->
    <CopyAssignmentDialog
      v-if="showCopyDialog && selectedAppt"
      :source-appt="selectedAppt"
      :resources="resources"
      @success="onCopySuccess"
      @cancel="showCopyDialog = false"
    />

    <!-- Context Menu (Desktop right-click) -->
    <Teleport v-if="contextMenu.show" to="body">
      <div
        class="context-menu-overlay"
        @click="contextMenu.show = false"
        @contextmenu.prevent
      >
        <div
          class="context-menu"
          :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
        >
          <button
            class="context-item"
            @click="
              selectedAppt = contextMenu.appt
              showActionSheet = true
              contextMenu.show = false
              handleEditAppt()
            "
          >
            ✎ 編輯
          </button>
          <button
            class="context-item"
            @click="
              selectedAppt = contextMenu.appt
              showCopyDialog = true
              contextMenu.show = false
            "
          >
            ⊕ 複製
          </button>
          <div class="context-divider"></div>
          <button
            class="context-item danger"
            @click="
              selectedAppt = contextMenu.appt
              handleDeleteAppt()
              contextMenu.show = false
            "
          >
            🗑 刪除
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Appointment form modal (create or edit) -->
    <AppointmentForm
      v-if="showForm"
      :resources="resources"
      :existing-assignments="assignments"
      :initial-resource-id="selectedResourceId"
      :initial-date="formDate"
      :initial-time="formTime"
      :editing-appt="editingAppt"
      @saved="onAppointmentSaved"
      @cancel="showForm = false"
      @resources-changed="reloadResources"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { listResources } from '@/api/resource'
import { listAssignments, updateAssignment } from '@/api/assignment'
import { parseIdempiereDateTime } from '@/api/utils'
import AppointmentForm from './AppointmentForm.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import AppointmentActionSheet from '@/components/AppointmentActionSheet.vue'
import CopyAssignmentDialog from '@/components/CopyAssignmentDialog.vue'
import { checkConflict, formatDuration, getMinutesDiff } from '@/lib/time-overlap'
import { CALENDAR_CONFIG } from '@/constants/calendar'

// ========== View Mode ==========
type ViewMode = 'day' | 'week' | 'month' | 'year'
const viewModes = [
  { key: 'day' as ViewMode, label: '日' },
  { key: 'week' as ViewMode, label: '週' },
  { key: 'month' as ViewMode, label: '月' },
  { key: 'year' as ViewMode, label: '年' },
]
const viewMode = ref<ViewMode>('week')
const currentDate = ref(new Date())

function switchView(mode: ViewMode) {
  // When switching from week to day, preserve the selected day
  if (viewMode.value === 'week' && mode === 'day' && selectedDay.value) {
    const [y, m, d] = selectedDay.value.split('-').map(Number)
    currentDate.value = new Date(y!, m! - 1, d!)
  }
  viewMode.value = mode
  loadAssignments()
}

// ========== Resources ==========
const resources = ref<any[]>([])
const resourcesLoading = ref(false)
const selectedResourceIds = reactive(new Set<number>())

const allSelected = computed(() =>
  resources.value.length > 0 && resources.value.every(r => selectedResourceIds.has(r.id))
)

function toggleResource(id: number) {
  if (selectedResourceIds.has(id)) {
    selectedResourceIds.delete(id)
  } else {
    selectedResourceIds.add(id)
  }
}

function toggleAll() {
  if (allSelected.value) {
    selectedResourceIds.clear()
  } else {
    resources.value.forEach(r => selectedResourceIds.add(r.id))
  }
}

function getResourceColor(resourceId: number): string {
  const idx = resources.value.findIndex(r => r.id === resourceId)
  const colorIdx = Math.max(0, idx) % CALENDAR_CONFIG.COLORS.length
  return CALENDAR_CONFIG.COLORS[colorIdx]!
}

function getAppointmentColor(appt: any): string {
  const resId = typeof appt.S_Resource_ID === 'object' ? appt.S_Resource_ID.id : appt.S_Resource_ID
  return getResourceColor(resId)
}

function getResourceName(appt: any): string {
  if (typeof appt.S_Resource_ID === 'object' && (appt.S_Resource_ID.identifier || appt.S_Resource_ID.Name)) {
    return appt.S_Resource_ID.identifier || appt.S_Resource_ID.Name
  }
  const resId = typeof appt.S_Resource_ID === 'object' ? appt.S_Resource_ID.id : appt.S_Resource_ID
  const res = resources.value.find(r => r.id === resId)
  return res?.Name || ''
}

// ========== Date Helpers ==========
const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

function formatDateFull(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function formatDateShort(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function getWeekEnd(start: Date): Date {
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 0)
  return end
}

// ========== Navigation ==========
function navPrev() {
  const d = new Date(currentDate.value)
  if (viewMode.value === 'day') d.setDate(d.getDate() - 1)
  else if (viewMode.value === 'week') d.setDate(d.getDate() - 7)
  else if (viewMode.value === 'month') d.setMonth(d.getMonth() - 1)
  else d.setFullYear(d.getFullYear() - 1)
  currentDate.value = d
  loadAssignments()
}

function navNext() {
  const d = new Date(currentDate.value)
  if (viewMode.value === 'day') d.setDate(d.getDate() + 1)
  else if (viewMode.value === 'week') d.setDate(d.getDate() + 7)
  else if (viewMode.value === 'month') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  currentDate.value = d
  loadAssignments()
}

function navToday() {
  currentDate.value = new Date()
  loadAssignments()
}

// ========== Header Label ==========
const headerLabel = computed(() => {
  const d = currentDate.value
  if (viewMode.value === 'day') {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${DAY_NAMES[d.getDay()]}`
  }
  if (viewMode.value === 'week') {
    const mon = getMonday(d)
    const sun = getWeekEnd(mon)
    return `${formatDateShort(mon)} ~ ${formatDateShort(sun)}`
  }
  if (viewMode.value === 'month') {
    return `${d.getFullYear()}年${d.getMonth() + 1}月`
  }
  return `${d.getFullYear()}年`
})

// ========== Selected Day (for day/week time grid) ==========
const selectedDay = ref(formatDateFull(new Date()))

// Keep selectedDay in sync with currentDate for day view
watch([currentDate, viewMode], () => {
  if (viewMode.value === 'day') {
    selectedDay.value = formatDateFull(currentDate.value)
  } else if (viewMode.value === 'week') {
    const mon = getMonday(currentDate.value)
    const sun = getWeekEnd(mon)
    const today = formatDateFull(new Date())
    const monStr = formatDateFull(mon)
    const sunStr = formatDateFull(sun)
    if (today >= monStr && today <= sunStr) {
      selectedDay.value = today
    } else {
      selectedDay.value = monStr
    }
  }
})

// ========== Week Days (for week view) ==========
const weekDays = computed(() => {
  const start = getMonday(currentDate.value)
  const today = formatDateFull(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = formatDateFull(d)
    return {
      date: dateStr,
      label: DAY_LABELS[i],
      dateShort: `${d.getMonth() + 1}/${d.getDate()}`,
      isToday: dateStr === today,
    }
  })
})

// ========== Time Slots ==========
const timeSlots = computed(() => {
  const slots: string[] = []
  for (let h = 0; h < 24; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
})

// ========== Assignments ==========
const assignments = ref<any[]>([])
const loading = ref(false)

function getDateRange(): { start: Date; end: Date } {
  const d = currentDate.value
  if (viewMode.value === 'day') {
    const start = new Date(d)
    start.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setHours(23, 59, 59, 0)
    return { start, end }
  }
  if (viewMode.value === 'week') {
    return { start: getMonday(d), end: getWeekEnd(getMonday(d)) }
  }
  if (viewMode.value === 'month') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    return { start, end }
  }
  // year
  const start = new Date(d.getFullYear(), 0, 1)
  const end = new Date(d.getFullYear(), 11, 31, 23, 59, 59)
  return { start, end }
}

async function loadAssignments() {
  loading.value = true
  try {
    const { start, end } = getDateRange()
    assignments.value = await listAssignments(start, end)
  } catch {
    assignments.value = []
  } finally {
    loading.value = false
  }
}

// ========== Day/Week: filtered assignments for selected day ==========
const GRID_START_HOUR = CALENDAR_CONFIG.GRID_START_HOUR
const SLOT_HEIGHT = CALENDAR_CONFIG.SLOT_HEIGHT
const LABEL_WIDTH = CALENDAR_CONFIG.LABEL_WIDTH

const filteredDayAssignments = computed(() => {
  return assignments.value.filter((a) => {
    const aResId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
    if (!selectedResourceIds.has(aResId)) return false
    const from = parseIdempiereDateTime(a.AssignDateFrom)
    return formatDateFull(from) === selectedDay.value
  })
})

// Compute layout: which column each appointment goes in (Google Calendar style)
interface ApptLayout {
  appt: any
  col: number
  totalCols: number
}

const dayApptLayout = computed((): ApptLayout[] => {
  const appts = filteredDayAssignments.value.map((a) => {
    const from = parseIdempiereDateTime(a.AssignDateFrom)
    const to = parseIdempiereDateTime(a.AssignDateTo)
    return {
      appt: a,
      fromMins: from.getHours() * 60 + from.getMinutes(),
      toMins: to.getHours() * 60 + to.getMinutes(),
      resId: typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID,
      col: 0,
      totalCols: 1,
    }
  })

  // Sort by start time, then by resource ID for stable ordering
  appts.sort((a, b) => a.fromMins - b.fromMins || a.resId - b.resId)

  // Find overlapping groups and assign columns
  for (let i = 0; i < appts.length; i++) {
    const a = appts[i]!
    // Find all appointments that overlap with this one
    const overlapping = appts.filter(
      (b) => b.fromMins < a.toMins && b.toMins > a.fromMins
    )
    // Determine which columns are taken by earlier-assigned overlapping items
    const usedCols = new Set<number>()
    for (const o of overlapping) {
      if (o !== a && o.col !== undefined) usedCols.add(o.col)
    }
    // Assign first available column
    let col = 0
    while (usedCols.has(col)) col++
    a.col = col
  }

  // Second pass: compute totalCols for each overlapping group
  for (let i = 0; i < appts.length; i++) {
    const a = appts[i]!
    const overlapping = appts.filter(
      (b) => b.fromMins < a.toMins && b.toMins > a.fromMins
    )
    const maxCol = Math.max(...overlapping.map((o) => o.col))
    const totalCols = maxCol + 1
    for (const o of overlapping) {
      o.totalCols = Math.max(o.totalCols, totalCols)
    }
  }

  return appts.map((a) => ({
    appt: a.appt,
    col: a.col,
    totalCols: a.totalCols,
  }))
})

function getApptBlockStyle(layout: ApptLayout): Record<string, string> {
  const from = parseIdempiereDateTime(layout.appt.AssignDateFrom)
  const to = parseIdempiereDateTime(layout.appt.AssignDateTo)
  const fromMins = from.getHours() * 60 + from.getMinutes()
  const toMins = to.getHours() * 60 + to.getMinutes()
  const gridStartMins = GRID_START_HOUR * 60

  const topPx = ((fromMins - gridStartMins) / 30) * SLOT_HEIGHT
  const heightPx = Math.max(((toMins - fromMins) / 30) * SLOT_HEIGHT, SLOT_HEIGHT / 2)

  // Horizontal: divide available space among overlapping columns
  // Available space starts after the time label (LABEL_WIDTH + border + gap)
  const leftOffset = LABEL_WIDTH + 5  // label width + border + small gap
  const rightGap = 4
  const colGap = 2  // gap between columns

  return {
    top: `${topPx}px`,
    height: `${heightPx}px`,
    left: `calc(${leftOffset}px + (100% - ${leftOffset + rightGap}px) * ${layout.col / layout.totalCols})`,
    width: `calc((100% - ${leftOffset + rightGap}px) / ${layout.totalCols} - ${colGap}px)`,
    backgroundColor: getAppointmentColor(layout.appt),
  }
}

function formatApptTime(appt: any): string {
  const from = parseIdempiereDateTime(appt.AssignDateFrom)
  const to = parseIdempiereDateTime(appt.AssignDateTo)
  const fH = String(from.getHours()).padStart(2, '0')
  const fM = String(from.getMinutes()).padStart(2, '0')
  const tH = String(to.getHours()).padStart(2, '0')
  const tM = String(to.getMinutes()).padStart(2, '0')
  return `${fH}:${fM}-${tH}:${tM}`
}

// ========== Month: calendar grid ==========
const monthCells = computed(() => {
  const d = currentDate.value
  const year = d.getFullYear()
  const month = d.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const today = formatDateFull(new Date())

  // Monday-based: getDay() 0=Sun→6, 1=Mon→0, ...
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  interface ResourceCount { id: number; count: number }
  const cells: { day: number; date: string; currentMonth: boolean; isToday: boolean; resourceCounts: ResourceCount[] }[] = []

  // Previous month padding
  const prevLastDay = new Date(year, month, 0).getDate()
  for (let i = startOffset - 1; i >= 0; i--) {
    const pd = prevLastDay - i
    const pDate = new Date(year, month - 1, pd)
    cells.push({ day: pd, date: formatDateFull(pDate), currentMonth: false, isToday: false, resourceCounts: [] })
  }

  // Current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = formatDateFull(new Date(year, month, day))
    cells.push({ day, date: dateStr, currentMonth: true, isToday: dateStr === today, resourceCounts: [] })
  }

  // Next month padding (fill to 42 cells = 6 rows)
  let nextDay = 1
  while (cells.length < 42) {
    const nDate = new Date(year, month + 1, nextDay)
    cells.push({ day: nextDay, date: formatDateFull(nDate), currentMonth: false, isToday: false, resourceCounts: [] })
    nextDay++
  }

  // Count appointments per day per resource
  const dayCounts = new Map<string, Map<number, number>>()
  for (const a of assignments.value) {
    const aResId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
    if (!selectedResourceIds.has(aResId)) continue
    const dateStr = formatDateFull(parseIdempiereDateTime(a.AssignDateFrom))
    if (!dayCounts.has(dateStr)) dayCounts.set(dateStr, new Map())
    const resMap = dayCounts.get(dateStr)!
    resMap.set(aResId, (resMap.get(aResId) || 0) + 1)
  }
  for (const cell of cells) {
    const resMap = dayCounts.get(cell.date)
    if (resMap) {
      cell.resourceCounts = Array.from(resMap.entries())
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => {
          const ai = resources.value.findIndex(r => r.id === a.id)
          const bi = resources.value.findIndex(r => r.id === b.id)
          return ai - bi
        })
    }
  }

  return cells
})

// ========== Year: 12 month cards ==========
const yearMonths = computed(() => {
  const year = currentDate.value.getFullYear()
  const now = new Date()
  const currentMonth = now.getFullYear() === year ? now.getMonth() : -1

  // Pre-compute per-month per-resource counts
  const monthResCounts = Array.from({ length: 12 }, () => new Map<number, number>())
  for (const a of assignments.value) {
    const aResId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
    if (!selectedResourceIds.has(aResId)) continue
    const d = parseIdempiereDateTime(a.AssignDateFrom)
    if (d.getFullYear() !== year) continue
    const resMap = monthResCounts[d.getMonth()]!
    resMap.set(aResId, (resMap.get(aResId) || 0) + 1)
  }

  return Array.from({ length: 12 }, (_, m) => {
    const resMap = monthResCounts[m]!
    const resourceCounts = Array.from(resMap.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => {
        const ai = resources.value.findIndex(r => r.id === a.id)
        const bi = resources.value.findIndex(r => r.id === b.id)
        return ai - bi
      })
    return {
      month: m,
      label: MONTH_LABELS[m],
      resourceCounts,
      isCurrent: m === currentMonth,
    }
  })
})

// ========== Drill-down ==========
function drillToDay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  currentDate.value = new Date(y!, m! - 1, d!)
  viewMode.value = 'day'
  loadAssignments()
}

function drillToMonth(month: number) {
  const d = new Date(currentDate.value)
  d.setMonth(month)
  d.setDate(1)
  currentDate.value = d
  viewMode.value = 'month'
  loadAssignments()
}

// ========== Bottom Sheet & Form ==========
const showForm = ref(false)
const showActionSheet = ref(false)
const showCopyDialog = ref(false)
const selectedAppt = ref<any>(null)
const selectedResourceId = ref(0)
const formDate = ref('')
const formTime = ref('')
const editingAppt = ref<any>(null)

// ========== Drag State: Conflict Detection ==========
const dragState = reactive({
  dragging: false,
  appointmentId: null as number | null,
  hasConflict: false,
  conflictingNames: [] as string[],
  dragStartY: 0,
  dragCurrentY: 0,
})

// ========== Context Menu (Right-click, Desktop) ==========
const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  appt: null as any,
})

function onSlotClick(slot: string) {
  editingAppt.value = null
  selectedResourceId.value = 0
  formDate.value = selectedDay.value
  formTime.value = slot
  showForm.value = true
}

function onApptClick(appt: any) {
  // Mobile first: show action sheet instead of directly opening form
  selectedAppt.value = appt
  showActionSheet.value = true
}

function onApptContextMenu(event: MouseEvent, appt: any) {
  // Desktop: right-click context menu
  event.preventDefault()
  contextMenu.show = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.appt = appt
}

function handleEditAppt() {
  if (!selectedAppt.value) return
  editingAppt.value = selectedAppt.value
  selectedResourceId.value = 0
  formDate.value = ''
  formTime.value = ''
  showActionSheet.value = false
  showForm.value = true
}

function onAppointmentSaved() {
  showForm.value = false
  editingAppt.value = null
  selectedAppt.value = null
  loadAssignments()
}

// ========== Drag & Conflict Detection ==========
function startDragAppt(event: MouseEvent | TouchEvent, appt: any) {
  // Ignore if already dragging
  if (dragState.dragging) return

  // Get the Y coordinate
  const clientY = event instanceof TouchEvent
    ? event.touches[0]?.clientY || 0
    : event.clientY

  dragState.dragging = true
  dragState.appointmentId = appt.id
  dragState.dragStartY = clientY
  dragState.hasConflict = false
  dragState.conflictingNames = []

  // Add global listeners for mousemove/touchmove and mouseup/touchend
  const moveListener = (e: MouseEvent | TouchEvent) => onDragMove(e, appt)
  const upListener = (e: MouseEvent | TouchEvent) => onDragEnd(e, appt)

  document.addEventListener('mousemove', moveListener)
  document.addEventListener('touchmove', moveListener, { passive: false })
  document.addEventListener('mouseup', upListener)
  document.addEventListener('touchend', upListener)

  // Cleanup function
  function cleanup() {
    document.removeEventListener('mousemove', moveListener)
    document.removeEventListener('touchmove', moveListener)
    document.removeEventListener('mouseup', upListener)
    document.removeEventListener('touchend', upListener)
  }

  // Store cleanup for later
  ;(upListener as any).__cleanup = cleanup
}

function onDragMove(event: MouseEvent | TouchEvent, appt: any) {
  const clientY = event instanceof TouchEvent
    ? event.touches[0]?.clientY || 0
    : event.clientY

  dragState.dragCurrentY = clientY

  // Calculate time shift (1 slot = 30min = SLOT_HEIGHT px)
  const pixelDelta = clientY - dragState.dragStartY
  const slotsDelta = Math.round(pixelDelta / SLOT_HEIGHT)
  const minutesDelta = slotsDelta * 30

  // Calculate new time range
  const from = parseIdempiereDateTime(appt.AssignDateFrom)
  const to = parseIdempiereDateTime(appt.AssignDateTo)

  const newFrom = new Date(from.getTime() + minutesDelta * 60000)
  const newTo = new Date(to.getTime() + minutesDelta * 60000)

  // Get resource ID
  const resId = typeof appt.S_Resource_ID === 'object'
    ? appt.S_Resource_ID.id
    : appt.S_Resource_ID

  // Check for conflicts
  const conflict = checkConflict(
    { start: newFrom, end: newTo, resourceId: resId },
    assignments.value,
    appt.id // exclude self
  )

  dragState.hasConflict = conflict.hasConflict
  dragState.conflictingNames = conflict.conflictingNames
}

async function onDragEnd(event: MouseEvent | TouchEvent, appt: any) {
  // Remove listeners
  const listeners = Object.values(document._listeners || {})

  dragState.dragging = false

  if (dragState.hasConflict) {
    // Conflict: show toast and revert
    const msg = `與「${dragState.conflictingNames.join('」「')}」時間衝突，未儲存`
    // TODO: Replace with your toast solution (e.g., useToast())
    console.warn(msg)
    dragState.hasConflict = false
    dragState.conflictingNames = []
    dragState.appointmentId = null
    return
  }

  // No conflict: save new time
  const clientY = event instanceof TouchEvent
    ? event.changedTouches[0]?.clientY || 0
    : event.clientY

  const pixelDelta = clientY - dragState.dragStartY
  const slotsDelta = Math.round(pixelDelta / SLOT_HEIGHT)
  const minutesDelta = slotsDelta * 30

  if (minutesDelta === 0) {
    // No movement, just deselect
    dragState.appointmentId = null
    return
  }

  const from = parseIdempiereDateTime(appt.AssignDateFrom)
  const to = parseIdempiereDateTime(appt.AssignDateTo)

  const newFrom = new Date(from.getTime() + minutesDelta * 60000)
  const newTo = new Date(to.getTime() + minutesDelta * 60000)

  // Format to iDempiere datetime
  const toIdempiereDateTime = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    const s = String(d.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${day}T${h}:${min}:${s}Z`
  }

  try {
    await updateAssignment(appt.id, {
      AssignDateFrom: toIdempiereDateTime(newFrom),
      AssignDateTo: toIdempiereDateTime(newTo),
    })
    await loadAssignments()
  } catch (error) {
    console.error('Failed to update appointment:', error)
    // TODO: Show error toast
  } finally {
    dragState.appointmentId = null
  }
}

async function handleCopyAppt() {
  showActionSheet.value = false
  showCopyDialog.value = true
}

async function onCopySuccess() {
  showCopyDialog.value = false
  selectedAppt.value = null
  await loadAssignments()
}

async function handleDeleteAppt() {
  if (!selectedAppt.value) return

  const confirmed = confirm(`確認刪除「${selectedAppt.value.Name}」?`)
  if (!confirmed) return

  showActionSheet.value = false

  try {
    const { deleteAssignment } = await import('@/api/assignment')
    await deleteAssignment(selectedAppt.value.id)
    selectedAppt.value = null
    await loadAssignments()
  } catch (error) {
    console.error('Failed to delete appointment:', error)
    alert('刪除失敗，請重試')
  }
}

async function reloadResources() {
  try {
    const newList = await listResources()
    // Add any newly created resources to selection
    for (const r of newList) {
      if (!resources.value.find((x: any) => x.id === r.id)) {
        selectedResourceIds.add(r.id)
      }
    }
    resources.value = newList
  } catch { /* silent */ }
}

// ========== Init ==========
onMounted(async () => {
  resourcesLoading.value = true
  try {
    resources.value = await listResources()
    resources.value.forEach(r => selectedResourceIds.add(r.id))
  } catch {
    resources.value = []
  } finally {
    resourcesLoading.value = false
  }
  await loadAssignments()
})
</script>

<style scoped>
.calendar-page {
  padding: 0.5rem;
  max-width: 600px;
  margin: 0 auto;
}

/* Resource selector */
.resource-selector {
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.selector-title {
  font-size: 0.875rem;
  font-weight: 600;
}

.btn-toggle-all {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: white;
  font-size: 0.75rem;
  cursor: pointer;
  color: #64748b;
}

.btn-toggle-all:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.selector-loading {
  font-size: 0.8125rem;
  color: #64748b;
}

.resource-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.resource-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  font-size: 0.8125rem;
  cursor: pointer;
  background: white;
  transition: all 0.15s;
  user-select: none;
}

.resource-chip.selected {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.08);
  color: var(--color-primary);
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.chip-name {
  white-space: nowrap;
}

/* Calendar section */
.calendar-section {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

/* View mode tabs */
.view-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.view-tab {
  flex: 1;
  padding: 0.5rem;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  cursor: pointer;
  color: #64748b;
  border-bottom: 2px solid transparent;
  min-height: var(--min-touch);
}

.view-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

/* Calendar header */
.calendar-header {
  text-align: center;
  padding: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.nav-row {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.nav-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: white;
  font-size: 0.875rem;
  min-height: var(--min-touch);
  cursor: pointer;
}

.nav-btn:hover {
  border-color: var(--color-primary);
}

.today-btn {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.today-btn:hover {
  background: var(--color-primary-hover);
}

.header-label {
  font-size: 0.875rem;
  color: #64748b;
}

/* Day tabs (week view) */
.day-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
}

.day-tab {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: center;
  font-size: 0.75rem;
  color: #64748b;
  border-bottom: 2px solid transparent;
}

.day-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

.day-tab.today .day-date {
  color: var(--color-primary);
  font-weight: 600;
}

.day-label {
  display: block;
  font-size: 0.6875rem;
}

.day-date {
  display: block;
  font-size: 0.8125rem;
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
  font-size: 0.875rem;
}

/* Time grid (day/week) */
.calendar-grid-wrapper {
  overflow-y: auto;
  max-height: calc(100vh - 320px);
  -webkit-overflow-scrolling: touch;
}

.time-grid {
  position: relative;
  min-width: 0;
}

.time-row {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  height: 44px;
  cursor: pointer;
}

.time-row:hover {
  background: rgba(99, 102, 241, 0.03);
}

.time-label {
  width: 52px;
  min-width: 52px;
  padding: 0.375rem 0.25rem;
  font-size: 0.75rem;
  color: #94a3b8;
  text-align: center;
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
}

.slot-bg {
  flex: 1;
}

/* Appointment block (absolute positioned, spans multiple slots) */
.appt-block {
  position: absolute;
  border-radius: 6px;
  color: white;
  font-size: 0.75rem;
  line-height: 1.3;
  padding: 0.25rem 0.5rem;
  overflow: visible;
  cursor: pointer;
  z-index: 1;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  transition: opacity 0.2s, box-shadow 0.2s;
}

.appt-block:hover {
  opacity: 0.9;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

/* Dragging state */
.appt-block.dragging {
  opacity: 0.6;
  cursor: grabbing;
  z-index: 50;
}

/* Conflict state: red border + shadow warning */
.appt-block.conflict {
  border: 2px solid #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
}

/* Conflict tooltip */
.conflict-tooltip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: #ef4444;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 100;
  pointer-events: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.conflict-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: #ef4444;
}

/* Context Menu (Desktop right-click) */
.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
}

.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  z-index: 201;
  min-width: 160px;
  overflow: hidden;
}

.context-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  text-align: left;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s;
  color: #111827;
}

.context-item:hover {
  background-color: #f3f4f6;
}

.context-item.danger {
  color: #991b1b;
}

.context-item.danger:hover {
  background-color: #fee2e2;
}

.context-divider {
  height: 1px;
  background-color: #e5e7eb;
  margin: 4px 0;
}

.appt-resource {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.appt-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.9;
}

.appt-time {
  font-size: 0.6875rem;
  opacity: 0.8;
}

/* Month grid */
.month-grid-wrapper {
  padding: 0.5rem;
}

.month-weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid var(--color-border);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.month-cell {
  min-height: 48px;
  padding: 0.375rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  border-bottom: 1px solid #f1f5f9;
}

.month-cell:hover {
  background: rgba(99, 102, 241, 0.04);
}

.month-cell.other-month {
  opacity: 0.3;
}

.month-cell.today .cell-day {
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-day {
  font-size: 0.8125rem;
  font-weight: 500;
}

.cell-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
}

.cell-res-badge {
  font-size: 0.625rem;
  color: white;
  border-radius: 8px;
  padding: 0 0.3rem;
  line-height: 1.4;
  min-width: 16px;
  text-align: center;
}

/* Year grid */
.year-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.75rem;
}

.year-month-card {
  padding: 1rem 0.5rem;
  text-align: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
}

.year-month-card:hover {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.04);
}

.year-month-card.current-month {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.06);
}

.month-name {
  font-size: 0.9375rem;
  font-weight: 500;
}

</style>
