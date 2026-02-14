<template>
  <div class="calendar-page">
    <!-- Zone 1: Resource selector -->
    <div class="resource-selector">
      <div class="selector-header">
        <span class="selector-title">資源</span>
        <button class="btn-toggle-all" @click="toggleAll">
          {{ allSelected ? '取消全選' : '全選' }}
        </button>
      </div>
      <div v-if="resourcesLoading" class="selector-loading">載入中...</div>
      <div v-else class="resource-chips">
        <label
          v-for="res in resources"
          :key="res.S_Resource_ID"
          class="resource-chip"
          :class="{ selected: selectedResourceIds.has(res.S_Resource_ID) }"
        >
          <input
            type="checkbox"
            :checked="selectedResourceIds.has(res.S_Resource_ID)"
            @change="toggleResource(res.S_Resource_ID)"
          />
          <span class="chip-name">{{ res.Name }}</span>
        </label>
      </div>
    </div>

    <!-- Zone 2: Calendar -->
    <div class="calendar-section">
      <!-- Week navigation -->
      <div class="calendar-header">
        <div class="nav-row">
          <button class="nav-btn" @click="prevWeek">&lt;</button>
          <button class="nav-btn today-btn" @click="goToday">本週</button>
          <button class="nav-btn" @click="nextWeek">&gt;</button>
        </div>
        <div class="week-range">{{ weekRangeLabel }}</div>
      </div>

      <!-- Day tabs -->
      <div class="day-tabs">
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

      <div v-else-if="selectedResources.length === 0" class="empty-state">
        請選擇至少一個資源
      </div>

      <div v-else class="calendar-grid-wrapper">
        <div class="calendar-grid">
          <!-- Header row: time column + selected resource columns -->
          <div class="grid-header">
            <div class="time-col-header">時間</div>
            <div
              v-for="res in selectedResources"
              :key="res.S_Resource_ID"
              class="resource-col-header"
              :style="{ backgroundColor: getResourceColor(res.S_Resource_ID) + '15' }"
            >
              <span class="res-dot" :style="{ backgroundColor: getResourceColor(res.S_Resource_ID) }"></span>
              {{ res.Name }}
            </div>
          </div>

          <!-- Time slot rows -->
          <div
            v-for="slot in timeSlots"
            :key="slot"
            class="grid-row"
          >
            <div class="time-label">{{ slot }}</div>
            <div
              v-for="res in selectedResources"
              :key="res.S_Resource_ID"
              class="slot-cell"
              @click="onSlotClick(res, slot)"
            >
              <div
                v-for="appt in getAppointmentsAt(res.S_Resource_ID, slot)"
                :key="appt.id"
                class="appointment-block"
                :style="{ height: getBlockHeight(appt) + 'px', backgroundColor: getResourceColor(res.S_Resource_ID) }"
                :title="appt.Name"
              >
                <span class="appt-name">{{ appt.Name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Appointment form modal -->
    <AppointmentForm
      v-if="showForm"
      :resources="selectedResources"
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
import AppointmentForm from './AppointmentForm.vue'

// Resources
const resources = ref<any[]>([])
const resourcesLoading = ref(false)
const selectedResourceIds = reactive(new Set<number>())

const selectedResources = computed(() =>
  resources.value.filter(r => selectedResourceIds.has(r.S_Resource_ID))
)

const allSelected = computed(() =>
  resources.value.length > 0 && resources.value.every(r => selectedResourceIds.has(r.S_Resource_ID))
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
    resources.value.forEach(r => selectedResourceIds.add(r.S_Resource_ID))
  }
}

// Color palette for resources
const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']
function getResourceColor(resourceId: number): string {
  const idx = resources.value.findIndex(r => r.S_Resource_ID === resourceId)
  return COLORS[idx % COLORS.length]!
}

// Week navigation
const currentWeekStart = ref(getMonday(new Date()))

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

const weekRangeLabel = computed(() => {
  const start = currentWeekStart.value
  const end = getWeekEnd(start)
  return `${formatDateShort(start)} ~ ${formatDateShort(end)}`
})

function formatDateShort(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}/${day}`
}

function formatDateFull(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const weekDays = computed(() => {
  const start = currentWeekStart.value
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

// Selected day (defaults to today if in current week, else Monday)
const selectedDay = ref(formatDateFull(new Date()))

watch(currentWeekStart, () => {
  const today = formatDateFull(new Date())
  const days = weekDays.value.map(d => d.date)
  if (days.includes(today)) {
    selectedDay.value = today
  } else {
    selectedDay.value = days[0]!
  }
})

function prevWeek() {
  const d = new Date(currentWeekStart.value)
  d.setDate(d.getDate() - 7)
  currentWeekStart.value = d
  loadAssignments()
}

function nextWeek() {
  const d = new Date(currentWeekStart.value)
  d.setDate(d.getDate() + 7)
  currentWeekStart.value = d
  loadAssignments()
}

function goToday() {
  currentWeekStart.value = getMonday(new Date())
  selectedDay.value = formatDateFull(new Date())
  loadAssignments()
}

// Time slots: 9:00 to 18:00, 30-minute intervals
const timeSlots = computed(() => {
  const slots: string[] = []
  for (let h = 9; h < 18; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  slots.push('18:00')
  return slots
})

// Assignments
const assignments = ref<any[]>([])
const loading = ref(false)

async function loadAssignments() {
  loading.value = true
  try {
    const start = currentWeekStart.value
    const end = getWeekEnd(start)
    assignments.value = await listAssignments(start, end)
  } catch {
    assignments.value = []
  } finally {
    loading.value = false
  }
}

// Filter assignments for selected day + resource + slot
function getAppointmentsAt(resourceId: number, slot: string): any[] {
  const slotHour = parseInt(slot.split(':')[0]!)
  const slotMin = parseInt(slot.split(':')[1]!)

  return assignments.value.filter((a) => {
    const aResId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
    if (aResId !== resourceId) return false

    const from = new Date(a.AssignDateFrom)
    const dateStr = formatDateFull(from)
    if (dateStr !== selectedDay.value) return false

    const fromH = from.getHours()
    const fromM = from.getMinutes()
    return fromH === slotHour && fromM === slotMin
  })
}

function getBlockHeight(appt: any): number {
  const from = new Date(appt.AssignDateFrom)
  const to = new Date(appt.AssignDateTo)
  const durationMin = (to.getTime() - from.getTime()) / (1000 * 60)
  const slots = Math.max(1, Math.round(durationMin / 30))
  return slots * 40 - 4
}

// Form
const showForm = ref(false)
const selectedResourceId = ref(0)
const formDate = ref('')
const formTime = ref('')

function onSlotClick(resource: any, slot: string) {
  selectedResourceId.value = resource.S_Resource_ID || resource.id
  formDate.value = selectedDay.value
  formTime.value = slot
  showForm.value = true
}

function onAppointmentSaved() {
  showForm.value = false
  loadAssignments()
}

// Init
onMounted(async () => {
  resourcesLoading.value = true
  try {
    resources.value = await listResources()
    // Select all by default
    resources.value.forEach(r => selectedResourceIds.add(r.S_Resource_ID))
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
  max-width: 100%;
}

/* Zone 1: Resource selector */
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
  color: var(--color-text);
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
  gap: 0.25rem;
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

.resource-chip input[type="checkbox"] {
  display: none;
}

.chip-name {
  white-space: nowrap;
}

/* Zone 2: Calendar */
.calendar-section {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

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

.week-range {
  font-size: 0.8125rem;
  color: #64748b;
}

/* Day tabs */
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

.loading-state,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
  font-size: 0.875rem;
}

/* Calendar grid */
.calendar-grid-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.calendar-grid {
  min-width: 300px;
}

.grid-header {
  display: flex;
  position: sticky;
  top: 0;
  background: white;
  z-index: 2;
  border-bottom: 2px solid var(--color-border);
}

.time-col-header {
  width: 50px;
  min-width: 50px;
  padding: 0.5rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-align: center;
  color: #64748b;
}

.resource-col-header {
  flex: 1;
  min-width: 100px;
  padding: 0.5rem 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  border-left: 1px solid var(--color-border);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.res-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.grid-row {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  min-height: 40px;
}

.time-label {
  width: 50px;
  min-width: 50px;
  padding: 0.25rem;
  font-size: 0.6875rem;
  color: #94a3b8;
  text-align: center;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0.375rem;
}

.slot-cell {
  flex: 1;
  min-width: 100px;
  border-left: 1px solid var(--color-border);
  position: relative;
  cursor: pointer;
  min-height: 40px;
}

.slot-cell:hover {
  background: rgba(99, 102, 241, 0.04);
}

.appointment-block {
  position: absolute;
  top: 1px;
  left: 2px;
  right: 2px;
  color: white;
  border-radius: 4px;
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  overflow: hidden;
  z-index: 1;
  cursor: pointer;
}

.appt-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.calendar-grid-wrapper::-webkit-scrollbar {
  height: 4px;
}

.calendar-grid-wrapper::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}
</style>
