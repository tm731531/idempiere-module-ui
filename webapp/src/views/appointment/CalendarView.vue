<template>
  <div class="calendar-page">
    <div class="calendar-header">
      <div class="nav-row">
        <button class="nav-btn" @click="prevWeek">&lt;</button>
        <button class="nav-btn today-btn" @click="goToday">本週</button>
        <button class="nav-btn" @click="nextWeek">&gt;</button>
      </div>
      <div class="week-range">{{ weekRangeLabel }}</div>
    </div>

    <div v-if="loading" class="loading-state">載入中...</div>

    <div v-else class="calendar-grid-wrapper">
      <div class="calendar-grid">
        <!-- Header row: time column + resource columns -->
        <div class="grid-header">
          <div class="time-col-header">時間</div>
          <div
            v-for="res in resources"
            :key="res.S_Resource_ID"
            class="resource-col-header"
          >
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
            v-for="res in resources"
            :key="res.S_Resource_ID"
            class="slot-cell"
            @click="onSlotClick(res, slot)"
          >
            <div
              v-for="appt in getAppointmentsAt(res.S_Resource_ID, slot)"
              :key="appt.id"
              class="appointment-block"
              :style="{ height: getBlockHeight(appt) + 'px' }"
              :title="appt.Name"
            >
              <span class="appt-name">{{ appt.Name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Appointment form modal -->
    <AppointmentForm
      v-if="showForm"
      :resources="resources"
      :initial-resource-id="selectedResourceId"
      :initial-date="selectedDate"
      :initial-time="selectedTime"
      @saved="onAppointmentSaved"
      @cancel="showForm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { listResources } from '@/api/resource'
import { listAssignments } from '@/api/assignment'
import AppointmentForm from './AppointmentForm.vue'

const resources = ref<any[]>([])
const assignments = ref<any[]>([])
const loading = ref(false)
const showForm = ref(false)
const selectedResourceId = ref(0)
const selectedDate = ref('')
const selectedTime = ref('')

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
  return `${formatDateShort(start)} - ${formatDateShort(end)}`
})

function formatDateShort(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

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

// Build a selected date string for today in the current week
const selectedWeekDay = computed(() => {
  return formatDateShort(currentWeekStart.value)
})

// Load data
async function loadResources() {
  try {
    resources.value = await listResources()
  } catch {
    resources.value = []
  }
}

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

// Get appointments for a given resource and time slot
function getAppointmentsAt(resourceId: number, slot: string): any[] {
  const slotHour = parseInt(slot.split(':')[0]!)
  const slotMin = parseInt(slot.split(':')[1]!)

  return assignments.value.filter((a) => {
    const aResId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
    if (aResId !== resourceId) return false

    const from = new Date(a.AssignDateFrom)
    const fromH = from.getHours()
    const fromM = from.getMinutes()

    // Show appointment block only at its start slot
    return fromH === slotHour && fromM === slotMin
  })
}

// Calculate block height based on duration (30min = 40px)
function getBlockHeight(appt: any): number {
  const from = new Date(appt.AssignDateFrom)
  const to = new Date(appt.AssignDateTo)
  const durationMin = (to.getTime() - from.getTime()) / (1000 * 60)
  const slots = Math.max(1, Math.round(durationMin / 30))
  return slots * 40 - 4  // 4px for gap/padding
}

// Slot click handler
function onSlotClick(resource: any, slot: string) {
  selectedResourceId.value = resource.S_Resource_ID
  selectedDate.value = selectedWeekDay.value
  selectedTime.value = slot
  showForm.value = true
}

function onAppointmentSaved() {
  showForm.value = false
  loadAssignments()
}

onMounted(async () => {
  loading.value = true
  await loadResources()
  await loadAssignments()
})
</script>

<style scoped>
.calendar-page {
  padding: 0.5rem;
  max-width: 100%;
  overflow-x: hidden;
}

.calendar-header {
  text-align: center;
  margin-bottom: 0.75rem;
}

.nav-row {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.nav-btn {
  padding: 0.5rem 1rem;
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
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text);
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.calendar-grid-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.calendar-grid {
  min-width: 400px;
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
  width: 60px;
  min-width: 60px;
  padding: 0.5rem 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  color: #64748b;
}

.resource-col-header {
  flex: 1;
  min-width: 120px;
  padding: 0.5rem 0.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: center;
  border-left: 1px solid var(--color-border);
  color: var(--color-text);
}

.grid-row {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  min-height: 40px;
}

.time-label {
  width: 60px;
  min-width: 60px;
  padding: 0.25rem;
  font-size: 0.75rem;
  color: #64748b;
  text-align: center;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0.5rem;
}

.slot-cell {
  flex: 1;
  min-width: 120px;
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
  background: var(--color-primary);
  color: white;
  border-radius: 4px;
  padding: 0.125rem 0.375rem;
  font-size: 0.75rem;
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

/* Scrollbar styling for mobile */
.calendar-grid-wrapper::-webkit-scrollbar {
  height: 4px;
}

.calendar-grid-wrapper::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}
</style>
