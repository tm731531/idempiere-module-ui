<template>
  <div
    class="form-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="appointment-form-title"
    @click.self="handleCancel"
    @keydown.esc="handleCancel"
  >
    <div class="form-modal">
      <h3 id="appointment-form-title" class="form-title">{{ editingAppt ? '編輯預約' : '新增預約' }}</h3>

      <!-- Consultation link banner (shown when navigated from consultation edit page) -->
      <div v-if="linkedConsultationId" class="consultation-banner">
        關聯諮詢 #{{ linkedConsultationId }}
      </div>

      <!-- Mode toggle (create mode only) -->
      <div v-if="!editingAppt" class="form-group">
        <div class="mode-toggle">
          <button
            type="button"
            class="mode-btn"
            :class="{ active: !multiMode }"
            @click="multiMode = false"
          >單一資源</button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: multiMode }"
            @click="multiMode = true"
          >多資源同時</button>
        </div>
      </div>

      <!-- Single resource selector -->
      <div v-if="!multiMode" class="form-group">
        <label class="form-label">服務人員</label>
        <div class="selector-row">
          <select v-model="form.resourceId" class="form-input">
            <option :value="0" disabled>請選擇</option>
            <option
              v-for="r in resources"
              :key="r.id"
              :value="r.id"
            >
              {{ r.Name }}
            </option>
          </select>
          <button type="button" class="inline-add-btn" @click="showCreateResource = true" title="新增服務人員">+</button>
        </div>
        <div v-if="showCreateResource" class="inline-create-form">
          <input v-model="newResourceName" class="form-input" placeholder="服務人員名稱" @keyup.enter="handleCreateResource" />
          <div class="inline-create-actions">
            <button class="btn btn-secondary" @click="showCreateResource = false; newResourceName = ''">取消</button>
            <button class="btn btn-primary" :disabled="creatingResource || !newResourceName.trim()" @click="handleCreateResource">
              {{ creatingResource ? '...' : '建立' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Multi-resource checkbox list -->
      <div v-if="multiMode" class="form-group">
        <label class="form-label">選擇服務人員（可多選）</label>
        <div class="resource-checklist">
          <label
            v-for="r in resources"
            :key="r.id"
            class="resource-check-row"
          >
            <input
              type="checkbox"
              :value="r.id"
              v-model="selectedResourceIds"
              class="resource-checkbox"
            />
            <span class="resource-name">{{ r.Name }}</span>
            <span
              v-if="resourceConflicts[r.id]"
              class="conflict-dot"
              title="此時段已有預約"
            >●</span>
          </label>
          <div v-if="resources.length === 0" class="no-resources">尚無服務人員</div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">開始時間</label>
        <input
          v-model="form.dateFrom"
          type="datetime-local"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label class="form-label">結束時間</label>
        <input
          v-model="form.dateTo"
          type="datetime-local"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label class="form-label">名稱</label>
        <input
          v-model="form.name"
          type="text"
          class="form-input"
          placeholder="預約名稱"
        />
      </div>

      <div class="form-group">
        <label class="form-label">客戶</label>
        <SearchSelector
          v-model="form.bpartnerId"
          table-name="C_BPartner"
          display-field="Name"
          search-field="Name"
          filter="IsCustomer eq true"
          :initial-label="form.bpartnerLabel"
        />
      </div>

      <!-- Color override (optional per-assignment color) -->
      <div class="form-group">
        <label class="form-label">顏色</label>
        <div class="color-field">
          <button
            ref="colorAnchorEl"
            type="button"
            class="color-preview-btn"
            :style="{ backgroundColor: form.colorOverride || '#94a3b8' }"
            :title="form.colorOverride ? '點擊更改顏色' : '點擊設定顏色（可選）'"
            @click="colorPickerVisible = true"
          />
          <span class="color-hint">
            {{ form.colorOverride ? form.colorOverride : '使用資源預設顏色' }}
          </span>
          <button
            v-if="form.colorOverride"
            type="button"
            class="btn-clear-color"
            title="清除顏色覆蓋"
            @click="form.colorOverride = null"
          >✕</button>
        </div>
        <ColorPickerPopover
          v-model:visible="colorPickerVisible"
          :model-value="form.colorOverride"
          :anchor-el="colorAnchorEl"
          @change="(c: string | null) => { form.colorOverride = c }"
        />
      </div>

      <div class="form-group">
        <label class="form-label">備註</label>
        <textarea
          v-model="form.description"
          class="form-input form-textarea"
          placeholder="選填"
          rows="3"
        />
      </div>

      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

      <!-- Multi-submit result summary -->
      <div v-if="multiResultSummary" class="multi-result-summary" :class="multiResultSummary.hasError ? 'summary-partial' : 'summary-ok'">
        {{ multiResultSummary.text }}
      </div>

      <div class="form-actions">
        <button
          v-if="editingAppt"
          class="btn btn-danger"
          :disabled="saving"
          @click="handleDelete"
        >
          {{ deleting ? '刪除中...' : '刪除' }}
        </button>
        <div class="actions-right">
          <button class="btn btn-secondary" @click="handleCancel">取消</button>
          <button class="btn btn-primary" :disabled="saving || (multiMode && selectedResourceIds.length === 0)" @click="handleSave">
            {{ saving ? '儲存中...' : '儲存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { createAssignment, createMultipleAssignments, updateAssignment, deleteAssignment, checkConflict } from '@/api/assignment'
import { createResource } from '@/api/resource'
import { lookupOrgWarehouse } from '@/api/lookup'
import { parseIdempiereDateTime, toIdempiereDateTime } from '@/api/utils'
import SearchSelector from '@/components/SearchSelector.vue'
import ColorPickerPopover from '@/components/ColorPickerPopover.vue'
import { useAssignmentColors, flushPendingSave } from '@/composables/useAssignmentColors'

const { setAssignmentColorOverride } = useAssignmentColors()

const router = useRouter()
const route = useRoute()

const props = defineProps<{
  resources: any[]
  existingAssignments: any[]
  initialResourceId?: number
  initialDate?: string
  initialTime?: string
  editingAppt?: any  // full assignment object for editing
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
  'resources-changed': []
}>()

const authStore = useAuthStore()

const form = reactive({
  resourceId: 0,
  dateFrom: '',
  dateTo: '',
  name: '',
  description: '',
  bpartnerId: null as number | null,
  bpartnerLabel: '',
  colorOverride: null as string | null,
})

const saving = ref(false)
const deleting = ref(false)
const errorMsg = ref('')

// Debounce + stale-response guard for conflict checks
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let fetchSeq = 0

// Color picker
const colorPickerVisible = ref(false)
const colorAnchorEl = ref<HTMLElement | null>(null)

// Multi-resource mode state
const multiMode = ref(false)
const selectedResourceIds = ref<number[]>([])
// Per-resource conflict flags: resourceId → hasConflict
const resourceConflicts = ref<Record<number, boolean>>({})
// Summary shown after a multi-submit
const multiResultSummary = ref<{ text: string; hasError: boolean } | null>(null)

// Query param: ID of the consultation this appointment is being created for (UX hint only)
const linkedConsultationId = computed(() => {
  const val = route?.query?.consultationId
  return val ? String(val) : null
})

// Resource creation
const showCreateResource = ref(false)
const newResourceName = ref('')
const creatingResource = ref(false)

async function handleCreateResource() {
  if (!newResourceName.value.trim()) return
  creatingResource.value = true
  try {
    const orgId = authStore.context?.organizationId ?? 0
    const whId = await lookupOrgWarehouse(orgId)
    if (!whId) throw new Error('找不到倉庫')
    const created = await createResource({
      name: newResourceName.value.trim(),
      warehouseId: whId,
    })
    form.resourceId = created.id
    showCreateResource.value = false
    newResourceName.value = ''
    emit('resources-changed')
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '新增服務人員失敗'
  } finally {
    creatingResource.value = false
  }
}

// Recheck per-resource conflicts whenever selected resources or time window change.
// Debounced (300 ms) to prevent parallel API calls when the user clicks multiple
// resources rapidly. A sequence counter discards stale responses.
watch(
  [selectedResourceIds, () => form.dateFrom, () => form.dateTo],
  ([resIds, from, to]) => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(async () => {
      debounceTimer = null
      if (!multiMode.value || !from || !to) return
      const fromDate = new Date(from)
      const toDate = new Date(to)
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate >= toDate) return

      const seq = ++fetchSeq

      const entries = await Promise.all(
        resIds.map(async (id) => {
          try {
            const hasConflict = await checkConflict(id, fromDate, toDate)
            return [id, hasConflict, null] as [number, boolean, null]
          } catch {
            return [id, false, id] as [number, boolean, number]
          }
        }),
      )

      // Discard stale response if a newer fetch was started
      if (seq !== fetchSeq) return

      const conflicts: Record<number, boolean> = {}
      const failedIds: number[] = []
      for (const [id, has, failId] of entries) {
        conflicts[id] = has
        if (failId !== null) failedIds.push(failId)
      }
      resourceConflicts.value = conflicts

      if (failedIds.length > 0) {
        const failedNames = failedIds
          .map(id => props.resources.find(r => r.id === id)?.Name ?? `#${id}`)
          .join('、')
        errorMsg.value = `無法檢查衝突的服務人員：${failedNames}`
      }
    }, 300)
  },
  { deep: true },
)

function toDatetimeLocal(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day}T${h}:${mi}`
}

onMounted(() => {
  if (props.editingAppt) {
    // Edit mode: pre-fill from existing appointment
    const a = props.editingAppt
    const resId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
    form.resourceId = resId
    form.dateFrom = toDatetimeLocal(parseIdempiereDateTime(a.AssignDateFrom))
    form.dateTo = toDatetimeLocal(parseIdempiereDateTime(a.AssignDateTo))
    form.name = a.Name || ''
    form.description = a.Description || ''
    // Pre-fill color override from composable cache
    const assignId = a.id ?? a.S_ResourceAssignment_ID
    if (assignId) {
      const { assignmentColors } = useAssignmentColors()
      form.colorOverride = assignmentColors.value[assignId] ?? null
    }
    // Pre-fill customer if present
    if (a.C_BPartner_ID) {
      if (typeof a.C_BPartner_ID === 'object') {
        form.bpartnerId = a.C_BPartner_ID.id ?? null
        form.bpartnerLabel = a.C_BPartner_ID.identifier || a.C_BPartner_ID.Name || ''
      } else {
        form.bpartnerId = a.C_BPartner_ID
      }
    }
  } else {
    // Create mode
    if (props.initialResourceId !== undefined && props.initialResourceId !== 0) {
      form.resourceId = props.initialResourceId
    }
    if (props.initialDate && props.initialTime) {
      form.dateFrom = `${props.initialDate}T${props.initialTime}`
      const fromDate = new Date(`${props.initialDate}T${props.initialTime}:00`)
      const toDate = new Date(fromDate.getTime() + 30 * 60 * 1000)
      const toH = String(toDate.getHours()).padStart(2, '0')
      const toM = String(toDate.getMinutes()).padStart(2, '0')
      form.dateTo = `${props.initialDate}T${toH}:${toM}`
    }

    // Pre-fill customer from query param (when navigated from consultation form)
    const customerIdParam = route?.query?.customerId
    if (customerIdParam && !form.bpartnerId) {
      const parsed = Number(customerIdParam)
      if (!Number.isNaN(parsed) && parsed > 0) {
        form.bpartnerId = parsed
        // bpartnerLabel will be resolved by SearchSelector via initialLabel/resolveCurrentLabel
      }
    }
  }
})

onBeforeUnmount(() => flushPendingSave())

// Cancel: emit to parent (modal mode) or navigate back (standalone mode)
function handleCancel() {
  if (linkedConsultationId.value) {
    // Navigated from a consultation — go back to it
    router.push({ name: 'consultation-edit', params: { id: linkedConsultationId.value } })
  } else {
    emit('cancel')
  }
}

function validate(): boolean {
  if (!multiMode.value && !form.resourceId) {
    errorMsg.value = '請選擇服務人員'
    return false
  }
  if (multiMode.value && selectedResourceIds.value.length === 0) {
    errorMsg.value = '請至少選擇一位服務人員'
    return false
  }
  if (!form.dateFrom || !form.dateTo) {
    errorMsg.value = '請填寫開始與結束時間'
    return false
  }
  if (new Date(form.dateFrom) >= new Date(form.dateTo)) {
    errorMsg.value = '結束時間必須晚於開始時間'
    return false
  }
  if (!form.name.trim()) {
    errorMsg.value = '請填寫預約名稱'
    return false
  }
  errorMsg.value = ''
  return true
}

function checkConflictLocal(): boolean {
  const newFrom = new Date(form.dateFrom).getTime()
  const newTo = new Date(form.dateTo).getTime()
  const editId = props.editingAppt?.id

  return props.existingAssignments.some((a) => {
    if (editId && a.id === editId) return false

    const aResId = typeof a.S_Resource_ID === 'object' ? a.S_Resource_ID.id : a.S_Resource_ID
    if (aResId !== form.resourceId) return false

    const aFrom = parseIdempiereDateTime(a.AssignDateFrom).getTime()
    const aTo = parseIdempiereDateTime(a.AssignDateTo).getTime()

    return newFrom < aTo && newTo > aFrom
  })
}

async function handleSave() {
  if (!validate()) return

  saving.value = true
  errorMsg.value = ''
  multiResultSummary.value = null

  const orgId = authStore.context?.organizationId ?? 0
  if (!orgId) {
    errorMsg.value = '請先切換到具體組織（不可使用 * 組織）'
    saving.value = false
    return
  }

  try {
    if (props.editingAppt) {
      // Edit mode: always single-resource
      await updateAssignment(props.editingAppt.id, {
        S_Resource_ID: form.resourceId,
        AssignDateFrom: toIdempiereDateTime(new Date(form.dateFrom)),
        AssignDateTo: toIdempiereDateTime(new Date(form.dateTo)),
        Name: form.name.trim(),
        Description: form.description.trim() || undefined,
        C_BPartner_ID: form.bpartnerId ?? undefined,
      })
      // Persist color override (non-blocking — failure does not block save)
      void setAssignmentColorOverride(props.editingAppt.id, form.colorOverride)
    } else if (multiMode.value) {
      // Multi-resource create: one POST per resource in parallel
      const sharedPayload = {
        AssignDateFrom: toIdempiereDateTime(new Date(form.dateFrom)),
        AssignDateTo: toIdempiereDateTime(new Date(form.dateTo)),
        Name: form.name.trim(),
        Description: form.description.trim() || undefined,
        AD_Org_ID: orgId,
        C_BPartner_ID: form.bpartnerId ?? undefined,
      }
      const results = await createMultipleAssignments(sharedPayload, selectedResourceIds.value)
      const successCount = results.filter((r) => r.result !== undefined).length
      const failCount = results.filter((r) => r.error !== undefined).length

      if (failCount === 0) {
        multiResultSummary.value = { text: `${successCount} 筆預約已建立`, hasError: false }
      } else {
        multiResultSummary.value = {
          text: `${successCount} 成功、${failCount} 失敗`,
          hasError: true,
        }
      }

      saving.value = false
      if (failCount === 0) {
        // All succeeded — close as normal
        if (linkedConsultationId.value) {
          router.push({ name: 'consultation-edit', params: { id: linkedConsultationId.value } })
        } else {
          emit('saved')
        }
      }
      // On partial failure: stay open so the user can see the summary
      return
    } else {
      // Single-resource create
      if (checkConflictLocal()) {
        errorMsg.value = '此服務人員在該時段已有預約，請選擇其他時段'
        saving.value = false
        return
      }
      const newAssignment = await createAssignment({
        S_Resource_ID: form.resourceId,
        AssignDateFrom: toIdempiereDateTime(new Date(form.dateFrom)),
        AssignDateTo: toIdempiereDateTime(new Date(form.dateTo)),
        Name: form.name.trim(),
        Description: form.description.trim() || undefined,
        AD_Org_ID: orgId,
        C_BPartner_ID: form.bpartnerId ?? undefined,
      })
      // Persist color override for newly-created assignment (non-blocking)
      const newId = newAssignment?.id ?? newAssignment?.S_ResourceAssignment_ID
      if (newId && form.colorOverride) {
        void setAssignmentColorOverride(newId, form.colorOverride)
      }
    }

    saving.value = false
    if (linkedConsultationId.value) {
      // Standalone mode: navigate back to the originating consultation
      router.push({ name: 'consultation-edit', params: { id: linkedConsultationId.value } })
    } else {
      emit('saved')
    }
  } catch {
    errorMsg.value = '儲存失敗，請稍後再試'
    saving.value = false
  }
}

async function handleDelete() {
  if (!props.editingAppt) return
  deleting.value = true
  try {
    await deleteAssignment(props.editingAppt.id)
    emit('saved')
  } catch {
    errorMsg.value = '刪除失敗，請稍後再試'
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.form-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.form-modal {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
}

.form-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.consultation-banner {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
  color: var(--color-text);
}

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.9375rem;
  min-height: var(--min-touch);
  background: white;
  color: var(--color-text);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.error-msg {
  color: var(--color-error);
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
}

.actions-right {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9375rem;
  min-height: var(--min-touch);
  cursor: pointer;
  border: 1px solid var(--color-border);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: var(--color-text);
}

.btn-secondary:hover {
  background: #f8fafc;
}

.btn-danger {
  background: var(--color-error, #ef4444);
  color: white;
  border-color: var(--color-error, #ef4444);
}

.btn-danger:hover {
  opacity: 0.9;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.selector-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.selector-row select {
  flex: 1;
}

.inline-add-btn {
  width: 44px;
  height: 44px;
  min-height: var(--min-touch);
  border: 1px solid var(--color-primary);
  background: transparent;
  color: var(--color-primary);
  border-radius: 8px;
  font-size: 1.25rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.inline-add-btn:hover {
  background: var(--color-primary);
  color: white;
}

.inline-create-form {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #f8fafc;
  border: 1px dashed var(--color-primary);
  border-radius: 8px;
}

.inline-create-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

/* Mode toggle */
.mode-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.mode-btn {
  flex: 1;
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
  background: white;
  color: var(--color-text);
  border: none;
}

.mode-btn.active {
  background: var(--color-primary);
  color: white;
}

/* Multi-resource checklist */
.resource-checklist {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.resource-check-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
}

.resource-check-row:last-child {
  border-bottom: none;
}

.resource-check-row:hover {
  background: #f8fafc;
}

.resource-checkbox {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
}

.resource-name {
  flex: 1;
  font-size: 0.9375rem;
}

.conflict-dot {
  color: var(--color-error, #ef4444);
  font-size: 0.75rem;
  flex-shrink: 0;
  cursor: help;
}

.no-resources {
  padding: 0.75rem;
  color: #94a3b8;
  font-size: 0.875rem;
}

/* Multi-submit result summary */
.multi-result-summary {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.summary-ok {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.summary-partial {
  background: #fef9c3;
  border: 1px solid #fde047;
  color: #713f12;
}

/* Color field */
.color-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-preview-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s, transform 0.1s;
}

.color-preview-btn:hover {
  border-color: #94a3b8;
  transform: scale(1.1);
}

.color-hint {
  font-size: 0.8125rem;
  color: #64748b;
  flex: 1;
}

.btn-clear-color {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.25rem;
  border-radius: 4px;
  line-height: 1;
}

.btn-clear-color:hover {
  color: #ef4444;
  background: #fee2e2;
}
</style>
