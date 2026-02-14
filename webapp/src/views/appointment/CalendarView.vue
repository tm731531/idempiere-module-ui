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
            <div class="slot-content">
              <div
                v-for="appt in getAppointmentsAt(slot)"
                :key="appt.id"
                class="appt-chip"
                :style="{ backgroundColor: getAppointmentColor(appt) }"
                :title="`${getResourceName(appt)} — ${appt.Name}`"
              >
                <span class="appt-resource">{{ getResourceName(appt) }}</span>
                <span class="appt-name">{{ appt.Name }}</span>
                <span class="appt-time">{{ formatApptTime(appt) }}</span>
              </div>
              <div v-if="getAppointmentsAt(slot).length === 0" class="slot-empty">+</div>
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
            <span v-if="cell.count > 0" class="cell-count">{{ cell.count }}</span>
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
          <span v-if="m.count > 0" class="month-count">{{ m.count }}</span>
        </div>
      </div>
    </div>

    <!-- Appointment form modal -->
    <AppointmentForm
      v-if="showForm"
      :resources="resources"
      :initial-resource-id="selectedResourceId"
      :initial-date="formDate"
      :initial-time="formTime"
      @saved="onAppointmentSaved"
      @cancel="showForm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { listResources } from '@/api/resource'
import { listAssignments } from '@/api/assignment'
import { parseIdempiereDateTime } from '@/api/utils'
import AppointmentForm from './AppointmentForm.vue'

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

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']
function getResourceColor(resourceId: number): string {
  const idx = resources.value.findIndex(r => r.id === resourceId)
  return COLORS[idx >= 0 ? idx % COLORS.length : 0]!
}

function getAppointmentColor(appt: any): string {
  const resId = typeof appt.S_Resource_ID === 'object' ? appt.S_Resource_ID.id : appt.S_Resource_ID
  return getResourceColor(resId)
}

function getResourceName(appt: any): string {
  if (typeof appt.S_Resource_ID === 'object' && appt.S_Resource_ID.identifier) {
    return appt.S_Resource_ID.identifier
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
  for (let h = 7; h < 21; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  slots.push('21:00')
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

// ========== Day/Week: filter for time grid ==========
function getAppointmentsAt(slot: string): any[] {
  const slotHour = parseInt(slot.split(':')[0]!)
  const slotMin = parseInt(slot.split(':')[1]!)

  return assignments.value.filter((a) => {
    const aResId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
    if (!selectedResourceIds.has(aResId)) return false

    const from = parseIdempiereDateTime(a.AssignDateFrom)
    if (formatDateFull(from) !== selectedDay.value) return false

    return from.getHours() === slotHour && from.getMinutes() === slotMin
  })
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

  const cells: { day: number; date: string; currentMonth: boolean; isToday: boolean; count: number }[] = []

  // Previous month padding
  const prevLastDay = new Date(year, month, 0).getDate()
  for (let i = startOffset - 1; i >= 0; i--) {
    const pd = prevLastDay - i
    const pDate = new Date(year, month - 1, pd)
    cells.push({ day: pd, date: formatDateFull(pDate), currentMonth: false, isToday: false, count: 0 })
  }

  // Current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = formatDateFull(new Date(year, month, day))
    cells.push({ day, date: dateStr, currentMonth: true, isToday: dateStr === today, count: 0 })
  }

  // Next month padding (fill to 42 cells = 6 rows)
  let nextDay = 1
  while (cells.length < 42) {
    const nDate = new Date(year, month + 1, nextDay)
    cells.push({ day: nextDay, date: formatDateFull(nDate), currentMonth: false, isToday: false, count: 0 })
    nextDay++
  }

  // Count appointments per day
  for (const a of assignments.value) {
    const aResId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
    if (!selectedResourceIds.has(aResId)) continue
    const dateStr = formatDateFull(parseIdempiereDateTime(a.AssignDateFrom))
    const cell = cells.find(c => c.date === dateStr)
    if (cell) cell.count++
  }

  return cells
})

// ========== Year: 12 month cards ==========
const yearMonths = computed(() => {
  const year = currentDate.value.getFullYear()
  const now = new Date()
  const currentMonth = now.getFullYear() === year ? now.getMonth() : -1

  return Array.from({ length: 12 }, (_, m) => {
    // Count assignments in this month
    const monthStart = formatDateFull(new Date(year, m, 1))
    const monthEnd = formatDateFull(new Date(year, m + 1, 0))
    let count = 0
    for (const a of assignments.value) {
      const aResId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
      if (!selectedResourceIds.has(aResId)) continue
      const dateStr = formatDateFull(parseIdempiereDateTime(a.AssignDateFrom))
      if (dateStr >= monthStart && dateStr <= monthEnd) count++
    }
    return {
      month: m,
      label: MONTH_LABELS[m],
      count,
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

// ========== Form ==========
const showForm = ref(false)
const selectedResourceId = ref(0)
const formDate = ref('')
const formTime = ref('')

function onSlotClick(slot: string) {
  selectedResourceId.value = 0
  formDate.value = selectedDay.value
  formTime.value = slot
  showForm.value = true
}

function onAppointmentSaved() {
  showForm.value = false
  loadAssignments()
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
  min-width: 0;
}

.time-row {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  min-height: 44px;
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

.slot-content {
  flex: 1;
  padding: 0.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: flex-start;
  align-content: flex-start;
}

.slot-empty {
  width: 100%;
  text-align: center;
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 36px;
}

.appt-chip {
  display: inline-flex;
  flex-direction: column;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  color: white;
  font-size: 0.75rem;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  cursor: pointer;
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

.cell-count {
  font-size: 0.6875rem;
  color: white;
  background: var(--color-primary);
  border-radius: 10px;
  padding: 0 0.375rem;
  line-height: 1.4;
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

.month-count {
  font-size: 0.75rem;
  color: white;
  background: var(--color-primary);
  border-radius: 10px;
  padding: 0.125rem 0.5rem;
}
</style>
