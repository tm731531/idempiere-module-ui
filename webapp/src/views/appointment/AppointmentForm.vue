<template>
  <div class="form-overlay" @click.self="$emit('cancel')">
    <div class="form-modal">
      <h3 class="form-title">{{ editingId ? '編輯預約' : '新增預約' }}</h3>

      <div class="form-group">
        <label class="form-label">服務人員</label>
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
        <button class="btn btn-secondary" @click="$emit('cancel')">取消</button>
        <button class="btn btn-primary" :disabled="saving" @click="handleSave">
          {{ saving ? '儲存中...' : '儲存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { createAssignment, checkConflict } from '@/api/assignment'

const props = defineProps<{
  resources: any[]
  initialResourceId?: number
  initialDate?: string
  initialTime?: string
  editingId?: number
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
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
const errorMsg = ref('')

onMounted(() => {
  if (props.initialResourceId !== undefined && props.initialResourceId !== 0) {
    form.resourceId = props.initialResourceId
  }
  if (props.initialDate && props.initialTime) {
    // Build datetime-local value: "YYYY-MM-DDTHH:MM"
    form.dateFrom = `${props.initialDate}T${props.initialTime}`
    // Default end time: +30 minutes
    const fromDate = new Date(`${props.initialDate}T${props.initialTime}:00`)
    const toDate = new Date(fromDate.getTime() + 30 * 60 * 1000)
    const toH = String(toDate.getHours()).padStart(2, '0')
    const toM = String(toDate.getMinutes()).padStart(2, '0')
    form.dateTo = `${props.initialDate}T${toH}:${toM}`
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

async function handleSave() {
  if (!validate()) return

  saving.value = true
  errorMsg.value = ''

  try {
    // Check for conflicts first
    const hasConflict = await checkConflict(
      form.resourceId,
      new Date(form.dateFrom),
      new Date(form.dateTo),
      props.editingId,
    )

    if (hasConflict) {
      errorMsg.value = '此服務人員在該時段已有預約，請選擇其他時段'
      saving.value = false
      return
    }

    await doSave()
  } catch {
    errorMsg.value = '儲存失敗，請稍後再試'
    saving.value = false
  }
}

async function doSave() {
  const orgId = authStore.context?.organizationId ?? 0
  if (!orgId) {
    errorMsg.value = '請先切換到具體組織（不可使用 * 組織）'
    saving.value = false
    return
  }

  await createAssignment({
    S_Resource_ID: form.resourceId,
    AssignDateFrom: form.dateFrom,
    AssignDateTo: form.dateTo,
    Name: form.name.trim(),
    Description: form.description.trim() || undefined,
    AD_Org_ID: orgId,
  })

  saving.value = false
  emit('saved')
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
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1rem;
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
</style>
