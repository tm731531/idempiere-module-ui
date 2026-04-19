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
        <div v-else class="resource-groups">
          <div v-for="group in groupedResources" :key="group.typeId ?? 'ungrouped'" class="resource-group">
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

      <!-- Status legend -->
      <div class="sidebar-section">
        <div class="selector-header">
          <span class="selector-title">狀態圖例</span>
          <button class="btn-toggle-all" @click="showStatusManager = !showStatusManager">
            {{ showStatusManager ? '完成' : '編輯' }}
          </button>
        </div>
        <div v-if="statusesLoading" class="selector-loading">載入中...</div>
        <div v-else-if="!showStatusManager" class="status-legend">
          <div v-for="s in statuses" :key="s.Value" class="legend-item">
            <span class="legend-dot" :style="{ backgroundColor: s.color }"></span>
            <span class="legend-name">{{ s.Name }}</span>
          </div>
        </div>
        <div v-else class="status-manager">
          <div v-for="s in statuses" :key="s.Value" class="status-manager-row">
            <input
              type="color"
              :value="s.color"
              class="status-color-input"
              :title="`${s.Value} 顏色`"
              @change="onStatusColorChange(s.Value, ($event.target as HTMLInputElement).value)"
            />
            <input
              type="text"
              :value="s.Name"
              class="status-name-input"
              :placeholder="s.Value"
              @blur="onStatusNameChange(s.Value, ($event.target as HTMLInputElement).value)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
          </div>
          <button class="btn-reset-overrides" @click="resetAllStatusOverrides">
            重設為預設
          </button>
        </div>
      </div>

      <!-- Service preset filter (only shown when presets are configured) -->
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

      <!-- Show cancelled toggle -->
      <div class="sidebar-section">
        <label class="toggle-label">
          <input type="checkbox" v-model="showCancelled" class="toggle-checkbox" />
          顯示已取消
        </label>
      </div>

      <!-- Admin shortcuts -->
      <div class="sidebar-section sidebar-admin">
        <button class="admin-shortcut-btn" @click="router.push({ name: 'reference-data' })">
          管理資源設定
        </button>
        <button class="admin-shortcut-btn" @click="router.push({ name: 'reference-data' })">
          管理狀態設定
        </button>
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
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { CalendarOptions, EventDropArg, DateSelectArg, EventClickArg, DatesSetArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import zhTwLocale from '@fullcalendar/core/locales/zh-tw'

import { listResources, listResourceTypes, deactivateResource, listResourceUnavailability } from '@/api/resource'
import type { ResourceType, ResourceUnavailability } from '@/api/resource'
import { listAssignments, updateAssignment } from '@/api/assignment'
import { toIdempiereDateTime } from '@/api/utils'
import { parseDesc } from '@/composables/useAppointmentDesc'
import {
  useAppointmentStatuses, isTerminalStatus,
  saveStatusColorOverride, saveStatusNameOverride, clearStatusOverrides,
  clearAppointmentStatusCache,
} from '@/composables/useAppointmentStatuses'
import { useAppointmentServices } from '@/composables/useAppointmentServices'
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
const showStatusManager = ref(false)

function onStatusColorChange(value: string, color: string) {
  saveStatusColorOverride(value, color)
  clearAppointmentStatusCache()
  void loadStatuses()
}

function onStatusNameChange(value: string, name: string) {
  saveStatusNameOverride(value, name.trim() || null)
  clearAppointmentStatusCache()
  void loadStatuses()
}

function resetAllStatusOverrides() {
  clearStatusOverrides()
  clearAppointmentStatusCache()
  void loadStatuses()
}

// ─── Appointment services (service preset filter) ─────────────────────────────
const { services: appointmentServices, load: loadServices } = useAppointmentServices()
const selectedServices = reactive(new Set<string>())
const allServicesSelected = computed(
  () => appointmentServices.value.length === 0 ||
    appointmentServices.value.every(s => selectedServices.has(s.Name))
)

watch(appointmentServices, (newServices) => {
  newServices.forEach(s => selectedServices.add(s.Name))
})

function toggleService(name: string) {
  if (selectedServices.has(name)) selectedServices.delete(name)
  else selectedServices.add(name)
}

function toggleAllServices() {
  if (allServicesSelected.value) selectedServices.clear()
  else appointmentServices.value.forEach(s => selectedServices.add(s.Name))
}

// ─── Resources ────────────────────────────────────────────────────────────────
const resources = ref<any[]>([])
const resourceTypes = ref<ResourceType[]>([])
const resourcesLoading = ref(false)
const selectedResourceIds = reactive(new Set<number>())

const allSelected = computed(() =>
  resources.value.length > 0 && resources.value.every(r => selectedResourceIds.has(r.id))
)

const groupedResources = computed(() => {
  if (resourceTypes.value.length === 0) {
    return [{ typeId: null as number | null, typeName: null as string | null, resources: resources.value }]
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
  const groups: { typeId: number | null; typeName: string | null; resources: typeof resources.value }[] = [...typeMap.values()]
  if (ungrouped.length > 0) groups.push({ typeId: null, typeName: groups.length > 0 ? '其他' : null, resources: ungrouped })
  return groups
})

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

// Resource unavailability blocks (grey background events)
const unavailabilityBlocks = ref<ResourceUnavailability[]>([])

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
  const regularEvents = assignments.value
    .filter((a) => {
      // Resource filter
      const resId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
      if (!selectedResourceIds.has(resId)) return false
      // Terminal status filter
      const desc = parseDesc(a.Description)
      if (!showCancelled.value && isTerminalStatus(desc.status ?? '')) return false
      // Service filter (only active when presets exist and some deselected)
      if (appointmentServices.value.length > 0 && !allServicesSelected.value) {
        const svc = desc.service ?? ''
        if (svc && !selectedServices.has(svc)) return false
      }
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

  // Append resource unavailability background events (grey blocks)
  const bgEvents = unavailabilityBlocks.value
    .filter(u => selectedResourceIds.has(u.resourceId))
    .map(u => {
      const resName = resources.value.find(r => r.id === u.resourceId)?.Name ?? ''
      const exclusiveEnd = new Date(
        new Date(u.dateTo ?? u.dateFrom).getTime() + 86400000,
      ).toISOString().slice(0, 10)
      return {
        id: `unavail-${u.id}`,
        title: resName ? `${resName}: ${u.name}` : u.name,
        start: u.dateFrom,
        end: exclusiveEnd,
        display: 'background' as const,
        color: '#e2e8f0',
        classNames: ['unavail-block'],
        extendedProps: {},
      }
    })

  return [...regularEvents, ...bgEvents]
})

// ─── Router ───────────────────────────────────────────────────────────────────
const router = useRouter()

// ─── Search results for date-jump ────────────────────────────────────────────
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

function formatEventDate(start: string | Date | undefined): string {
  if (!start) return ''
  const d = new Date(start)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

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
    // Refresh unavailability blocks for the new date range
    if (resources.value.length > 0) {
      const allIds = resources.value.map(r => r.id)
      listResourceUnavailability(allIds, info.start, info.end)
        .then(blocks => { unavailabilityBlocks.value = blocks })
    }
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
    const [newList, newTypes] = await Promise.all([listResources(), listResourceTypes()])
    for (const r of newList) {
      if (!resources.value.find((x: any) => x.id === r.id)) {
        selectedResourceIds.add(r.id)
      }
    }
    resources.value = newList
    resourceTypes.value = newTypes
    // Refresh unavailability for updated resource list
    if (newList.length > 0) {
      const allIds = newList.map(r => r.id)
      unavailabilityBlocks.value = await listResourceUnavailability(
        allIds, visibleStart.value, visibleEnd.value,
      )
    }
  } catch { /* silent */ }
}

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

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  // Load colors, statuses, and services in parallel with resources
  void loadColors()
  void loadServices()
  loadStatuses().finally(() => { statusesLoading.value = false })

  resourcesLoading.value = true
  try {
    const [resList, typeList] = await Promise.all([listResources(), listResourceTypes()])
    resources.value = resList
    resourceTypes.value = typeList
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

.status-manager {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.status-manager-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.status-color-input {
  width: 28px;
  height: 22px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 1px;
  cursor: pointer;
  flex-shrink: 0;
}

.status-name-input {
  flex: 1;
  font-size: 0.75rem;
  padding: 2px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  min-width: 0;
}

.status-name-input:focus {
  outline: none;
  border-color: #94a3b8;
}

.btn-reset-overrides {
  margin-top: 0.25rem;
  font-size: 0.7rem;
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
  text-decoration: underline;
}

.btn-reset-overrides:hover {
  color: #64748b;
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

.sidebar-admin {
  margin-top: auto;
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

.resource-groups {
  display: flex;
  flex-direction: column;
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
