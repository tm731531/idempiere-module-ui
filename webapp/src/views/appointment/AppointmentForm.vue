<template>
  <div class="form-overlay" @click.self="$emit('cancel')">
    <div class="form-modal">
      <h3 class="form-title">{{ editingAppt ? '編輯預約' : '新增預約' }}</h3>

      <div class="form-group">
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
        <label class="form-label">備註</label>
        <textarea
          v-model="form.description"
          class="form-input form-textarea"
          placeholder="選填"
          rows="3"
        />
      </div>

      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

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
          <button class="btn btn-secondary" @click="$emit('cancel')">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="handleSave">
            {{ saving ? '儲存中...' : '儲存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { createAssignment, updateAssignment, deleteAssignment } from '@/api/assignment'
import { createResource } from '@/api/resource'
import { lookupOrgWarehouse } from '@/api/lookup'
import { parseIdempiereDateTime, toIdempiereDateTime } from '@/api/utils'

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
})

const saving = ref(false)
const deleting = ref(false)
const errorMsg = ref('')

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
  }
})

function validate(): boolean {
  if (!form.resourceId) {
    errorMsg.value = '請選擇服務人員'
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

  try {
    if (checkConflictLocal()) {
      errorMsg.value = '此服務人員在該時段已有預約，請選擇其他時段'
      saving.value = false
      return
    }

    const orgId = authStore.context?.organizationId ?? 0
    if (!orgId) {
      errorMsg.value = '請先切換到具體組織（不可使用 * 組織）'
      saving.value = false
      return
    }

    if (props.editingAppt) {
      // Update existing
      await updateAssignment(props.editingAppt.id, {
        S_Resource_ID: form.resourceId,
        AssignDateFrom: toIdempiereDateTime(new Date(form.dateFrom)),
        AssignDateTo: toIdempiereDateTime(new Date(form.dateTo)),
        Name: form.name.trim(),
        Description: form.description.trim() || undefined,
      })
    } else {
      // Create new
      await createAssignment({
        S_Resource_ID: form.resourceId,
        AssignDateFrom: form.dateFrom,
        AssignDateTo: form.dateTo,
        Name: form.name.trim(),
        Description: form.description.trim() || undefined,
        AD_Org_ID: orgId,
      })
    }

    saving.value = false
    emit('saved')
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
</style>
