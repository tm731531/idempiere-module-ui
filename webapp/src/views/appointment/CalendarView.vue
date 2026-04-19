<template>
  <div class="calendar-layout">
    <!-- Left Sidebar -->
    <aside class="calendar-sidebar">
      <!-- Search box -->
      <div class="sidebar-section">
        <input
          v-model="searchQuery"
          class="search-input"
          placeholder="搜尋預約..."
          type="search"
        />
      </div>

      <!-- Resource filter -->
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
        <div v-else class="resource-chips">
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
          </label>
        </div>
      </div>

      <!-- Status legend -->
      <div class="sidebar-section">
        <div class="selector-title" style="margin-bottom: 0.5rem;">狀態圖例</div>
        <div v-if="statusesLoading" class="selector-loading">載入中...</div>
        <div v-else class="status-legend">
          <div
            v-for="s in statuses"
            :key="s.Value"
            class="legend-item"
          >
            <span class="legend-dot" :style="{ backgroundColor: s.color }"></span>
            <span class="legend-name">{{ s.Name }}</span>
          </div>
        </div>
      </div>

      <!-- Show cancelled toggle -->
      <div class="sidebar-section">
        <label class="toggle-label">
          <input type="checkbox" v-model="showCancelled" class="toggle-checkbox" />
          顯示已取消
        </label>
      </div>
    </aside>

    <!-- Main calendar area -->
    <div class="calendar-main">
      <FullCalendar :options="calendarOptions" ref="calendarRef" />
    </div>

    <!-- Appointment form dialog -->
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

    <!-- Copy Assignment Dialog -->
    <CopyAssignmentDialog
      v-if="showCopyDialog && selectedAppt"
      :source-appt="selectedAppt"
      :resources="resources"
      @success="onCopySuccess"
      @cancel="showCopyDialog = false"
    />

    <!-- Resource chip color picker -->
    <ColorPickerPopover
      v-model:visible="chipColorPicker.visible"
      :model-value="chipColorPicker.resourceId !== null ? (resourceColors[chipColorPicker.resourceId] ?? null) : null"
      :anchor-el="chipColorPicker.anchorEl"
      @change="onChipColorChange"
      @update:visible="chipColorPicker.visible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { CalendarOptions, EventDropArg, EventResizeDoneArg, DateSelectArg, EventClickArg, DatesSetArg } from '@fullcalendar/core'
import zhTwLocale from '@fullcalendar/core/locales/zh-tw'

import { listResources } from '@/api/resource'
import { listAssignments, updateAssignment } from '@/api/assignment'
import { toIdempiereDateTime } from '@/api/utils'
import { parseDesc } from '@/composables/useAppointmentDesc'
import { useAppointmentStatuses, isTerminalStatus } from '@/composables/useAppointmentStatuses'
import { useToast } from '@/composables/useToast'
import { useAssignmentColors, flushPendingSave } from '@/composables/useAssignmentColors'
import { CALENDAR_CONFIG } from '@/constants/calendar'

import AppointmentForm from './AppointmentForm.vue'
import CopyAssignmentDialog from '@/components/CopyAssignmentDialog.vue'
import ColorPickerPopover from '@/components/ColorPickerPopover.vue'

// ─── Toast & colors ──────────────────────────────────────────────────────────
const toast = useToast()
const { load: loadColors, resolveAssignmentColor, setResourceColor, clearResourceColor, resourceColors } = useAssignmentColors()

// ─── Appointment statuses ─────────────────────────────────────────────────────
const { statuses, load: loadStatuses, getStatusColor } = useAppointmentStatuses()
const statusesLoading = ref(true)

// ─── Resources ────────────────────────────────────────────────────────────────
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
  refreshCalendar()
}

function toggleAll() {
  if (allSelected.value) {
    selectedResourceIds.clear()
  } else {
    resources.value.forEach(r => selectedResourceIds.add(r.id))
  }
  refreshCalendar()
}

function getResourceColor(resourceId: number): string {
  const userColor = resourceColors.value[resourceId]
  if (userColor) return userColor
  const idx = resources.value.findIndex(r => r.id === resourceId)
  if (idx !== -1) {
    return CALENDAR_CONFIG.COLORS[idx % CALENDAR_CONFIG.COLORS.length]!
  }
  return CALENDAR_CONFIG.COLORS[Math.abs(resourceId) % CALENDAR_CONFIG.COLORS.length]!
}

// ─── Resource chip color picker ───────────────────────────────────────────────
const chipColorPicker = reactive({
  visible: false,
  resourceId: null as number | null,
  anchorEl: null as HTMLElement | null,
})

function openChipColorPicker(event: MouseEvent, resourceId: number) {
  event.preventDefault()
  chipColorPicker.resourceId = resourceId
  chipColorPicker.anchorEl = (event.currentTarget as HTMLElement) ?? null
  chipColorPicker.visible = true
}

function onChipColorChange(hex: string | null) {
  if (chipColorPicker.resourceId === null) return
  if (hex === null) {
    clearResourceColor(chipColorPicker.resourceId)
  } else {
    setResourceColor(chipColorPicker.resourceId, hex)
  }
  refreshCalendar()
}

// ─── Assignments ──────────────────────────────────────────────────────────────
const assignments = ref<any[]>([])
const loading = ref(false)
const searchQuery = ref('')
const showCancelled = ref(false)

// Date range currently shown in the calendar (set by datesSet callback)
const visibleStart = ref<Date>(new Date())
const visibleEnd = ref<Date>(new Date())

async function loadAssignments() {
  loading.value = true
  try {
    assignments.value = await listAssignments(visibleStart.value, visibleEnd.value)
  } catch {
    assignments.value = []
  } finally {
    loading.value = false
  }
  refreshCalendar()
}

// ─── Calendar events (derived from assignments) ───────────────────────────────
const calendarEvents = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return assignments.value
    .filter((a) => {
      // Resource filter
      const resId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
      if (!selectedResourceIds.has(resId)) return false
      // Terminal status filter
      const desc = parseDesc(a.Description)
      if (!showCancelled.value && isTerminalStatus(desc.status ?? '')) return false
      // Search filter
      if (q) {
        const name = (a.Name ?? '').toLowerCase()
        const bp = (desc.bpartner_name ?? '').toLowerCase()
        const svc = (desc.service ?? '').toLowerCase()
        if (!name.includes(q) && !bp.includes(q) && !svc.includes(q)) return false
      }
      return true
    })
    .map((a) => {
      const desc = parseDesc(a.Description)
      const resId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
      const assignId = a.id ?? a.S_ResourceAssignment_ID

      // Status color takes priority; fall back to resource color from useAssignmentColors
      let bgColor: string
      if (desc.status) {
        bgColor = getStatusColor(desc.status)
      } else {
        bgColor = resolveAssignmentColor(assignId, resId)
      }

      // Dim cancelled/absent appointments
      const terminal = isTerminalStatus(desc.status ?? '')
      const opacity = terminal ? 0.45 : 1

      return {
        id: String(assignId),
        title: a.Name ?? '',
        start: a.AssignDateFrom,
        end: a.AssignDateTo,
        backgroundColor: bgColor,
        borderColor: bgColor,
        textColor: '#fff',
        opacity,
        extendedProps: { assignment: a, desc },
      }
    })
})

// ─── FullCalendar ref & helpers ───────────────────────────────────────────────
const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)

function refreshCalendar() {
  // Re-render events by replacing the array in calendarOptions
  // FullCalendar reacts to the `events` option reference change
}

// ─── Dialog / form state ──────────────────────────────────────────────────────
const showForm = ref(false)
const showCopyDialog = ref(false)
const selectedAppt = ref<any>(null)
const selectedResourceId = ref(0)
const formDate = ref('')
const formTime = ref('')
const editingAppt = ref<any>(null)

// ─── FullCalendar event handlers ──────────────────────────────────────────────

function handleSelect(info: DateSelectArg) {
  editingAppt.value = null
  selectedResourceId.value = 0
  // Extract date and time for the form pre-fill
  const d = info.start
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  formDate.value = `${y}-${mo}-${day}`
  formTime.value = `${h}:${mi}`
  showForm.value = true
  // Deselect the highlighted range
  calendarRef.value?.getApi().unselect()
}

function handleEventClick(info: EventClickArg) {
  const assignment = info.event.extendedProps.assignment
  selectedAppt.value = assignment
  editingAppt.value = assignment
  selectedResourceId.value = 0
  formDate.value = ''
  formTime.value = ''
  showForm.value = true
}

async function handleEventDrop(info: EventDropArg) {
  const a = info.event.extendedProps.assignment
  const newStart = info.event.start
  const newEnd = info.event.end ?? new Date(newStart!.getTime() + 30 * 60 * 1000)
  try {
    await updateAssignment(a.id, {
      AssignDateFrom: toIdempiereDateTime(newStart!),
      AssignDateTo: toIdempiereDateTime(newEnd),
    })
    await loadAssignments()
  } catch {
    info.revert()
    toast.add({
      severity: 'error',
      summary: '拖拉更新失敗',
      detail: '無法更新預約時間，已恢復原位置',
      life: 4000,
    })
  }
}

async function handleEventResize(info: EventResizeDoneArg) {
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
      detail: '無法更新預約結束時間',
      life: 4000,
    })
  }
}

function handleDatesSet(info: DatesSetArg) {
  const changed =
    info.start.getTime() !== visibleStart.value.getTime() ||
    info.end.getTime() !== visibleEnd.value.getTime()
  visibleStart.value = info.start
  visibleEnd.value = info.end
  if (changed) {
    loadAssignments()
  }
}

// ─── FullCalendar options ─────────────────────────────────────────────────────
const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  initialView: 'timeGridWeek',
  locale: zhTwLocale,
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGrid3Day,timeGridDay,listDay',
  },
  views: {
    timeGrid3Day: {
      type: 'timeGrid',
      duration: { days: 3 },
      buttonText: '3日',
    },
  },
  buttonText: {
    month: '月',
    week: '週',
    day: '日',
    today: '今天',
    list: '列表',
  },
  slotDuration: '00:15:00',
  slotMinTime: '09:00:00',
  slotMaxTime: '18:00:00',
  allDaySlot: false,
  nowIndicator: true,
  editable: true,
  selectable: true,
  height: '100%',
  events: calendarEvents.value,
  select: handleSelect,
  eventClick: handleEventClick,
  eventDrop: handleEventDrop,
  eventResize: handleEventResize,
  datesSet: handleDatesSet,
  // Render semi-transparent for terminal statuses
  eventDidMount(info) {
    const opacity = info.event.extendedProps.opacity as number | undefined
    if (opacity !== undefined && opacity < 1) {
      info.el.style.opacity = String(opacity)
    }
  },
}))

// ─── Form callbacks ───────────────────────────────────────────────────────────

function onAppointmentSaved() {
  showForm.value = false
  editingAppt.value = null
  selectedAppt.value = null
  loadAssignments()
}

async function onCopySuccess() {
  showCopyDialog.value = false
  selectedAppt.value = null
  await Promise.all([loadAssignments(), reloadResources()])
}

async function reloadResources() {
  try {
    const newList = await listResources()
    for (const r of newList) {
      if (!resources.value.find((x: any) => x.id === r.id)) {
        selectedResourceIds.add(r.id)
      }
    }
    resources.value = newList
  } catch { /* silent */ }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  // Load colors and statuses in parallel with resources
  void loadColors()
  loadStatuses().finally(() => { statusesLoading.value = false })

  resourcesLoading.value = true
  try {
    resources.value = await listResources()
    resources.value.forEach(r => selectedResourceIds.add(r.id))
  } catch {
    resources.value = []
  } finally {
    resourcesLoading.value = false
  }

  // FullCalendar's datesSet callback will trigger the initial loadAssignments.
  // Set a default range for the fallback in case datesSet fires before onMounted finishes.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  weekEnd.setHours(23, 59, 59, 0)
  visibleStart.value = today
  visibleEnd.value = weekEnd
})

onBeforeUnmount(() => flushPendingSave())
</script>

<style scoped>
.calendar-layout {
  display: flex;
  gap: 0.75rem;
  height: calc(100vh - 64px); /* subtract AppHeader height */
  padding: 0.75rem;
  overflow: hidden;
}

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
.calendar-sidebar {
  width: 220px;
  min-width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.5rem;
}

.sidebar-section {
  padding: 0.5rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.sidebar-section:last-child {
  border-bottom: none;
}

.search-input {
  width: 100%;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.8125rem;
  background: #f8fafc;
  color: var(--color-text);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: white;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.375rem;
}

.selector-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
}

.btn-toggle-all {
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: white;
  font-size: 0.6875rem;
  cursor: pointer;
  color: #64748b;
}

.btn-toggle-all:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.selector-loading {
  font-size: 0.75rem;
  color: #94a3b8;
  padding: 0.25rem 0;
}

.resource-chips {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.resource-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.8125rem;
  cursor: pointer;
  background: white;
  transition: all 0.15s;
  user-select: none;
}

.resource-chip.selected {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.07);
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
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

/* Status legend */
.status-legend {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #475569;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  white-space: nowrap;
}

/* Show cancelled toggle */
.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: #475569;
  cursor: pointer;
  user-select: none;
}

.toggle-checkbox {
  cursor: pointer;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 0.75rem 0.5rem;
  color: #94a3b8;
  font-size: 0.75rem;
  line-height: 1.6;
}

/* ─── Calendar main ───────────────────────────────────────────────────────── */
.calendar-main {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.5rem;
}

/* FullCalendar height fill */
:deep(.fc) {
  height: 100%;
  font-family: inherit;
}

:deep(.fc-toolbar-title) {
  font-size: 1rem;
  font-weight: 600;
}

:deep(.fc-button) {
  font-size: 0.8125rem !important;
  padding: 0.25rem 0.625rem !important;
}

:deep(.fc-button-primary) {
  background-color: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
}

:deep(.fc-button-primary:not(:disabled):hover) {
  background-color: var(--color-primary-hover) !important;
  border-color: var(--color-primary-hover) !important;
}

:deep(.fc-button-primary:not(:disabled).fc-button-active) {
  background-color: var(--color-primary-hover) !important;
  border-color: var(--color-primary-hover) !important;
}

:deep(.fc-event) {
  cursor: pointer;
  font-size: 0.75rem;
  border-radius: 4px;
}

:deep(.fc-daygrid-event) {
  border-radius: 4px;
}

:deep(.fc-timegrid-event) {
  border-radius: 4px;
}

/* Mobile: stack sidebar on top */
@media (max-width: 640px) {
  .calendar-layout {
    flex-direction: column;
    height: auto;
    overflow: auto;
  }

  .calendar-sidebar {
    width: 100%;
    min-width: 0;
    flex-direction: row;
    flex-wrap: wrap;
    overflow: visible;
  }

  .sidebar-section {
    flex: 1 1 auto;
    min-width: 140px;
  }

  .calendar-main {
    height: 600px;
  }
}
</style>
