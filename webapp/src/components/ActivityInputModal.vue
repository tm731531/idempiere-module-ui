<script setup lang="ts">
import { ref, computed } from 'vue'
import { validateActivityContent } from '@/utils/validation'
import FormErrorAlert from './FormErrorAlert.vue'

interface Props {
  requestId: number
  actionType: '電話' | '訊息'
}

interface ActivityPayload {
  type: string
  actionType: string
  content: string
  timestamp?: string
  createdBy?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'activity-added': [payload: ActivityPayload]
  'close': []
}>()

const content = ref('')
const errors = ref<Record<string, string>>({})
const submitting = ref(false)

const charCount = computed(() => content.value.length)

const isValid = computed(() => {
  const validation = validateActivityContent(content.value)
  return validation.isValid
})

const modalTitle = computed(() => {
  return `記錄${props.actionType}`
})

const placeholder = computed(() => {
  if (props.actionType === '電話') {
    return '記錄電話內容（最多500字）'
  }
  return '記錄訊息內容（最多500字）'
})

function validateForm(): boolean {
  const validation = validateActivityContent(content.value)
  errors.value = validation.errors
  return validation.isValid
}

async function handleConfirm() {
  if (!validateForm()) {
    return
  }

  submitting.value = true

  try {
    const timestamp = new Date().toISOString()
    const createdBy = localStorage.getItem('user_name') || '未知用戶'

    const payload: ActivityPayload = {
      type: '前台行動',
      actionType: props.actionType,
      content: content.value,
      timestamp,
      createdBy,
    }

    emit('activity-added', payload)
    emit('close')
  } finally {
    submitting.value = false
  }
}

function handleCancel() {
  emit('close')
}

function dismissErrors() {
  errors.value = {}
}
</script>

<template>
  <div class="dialog-overlay" @click.self="handleCancel">
    <div class="dialog-modal">
      <div class="dialog-header">
        <h3 class="dialog-title">{{ modalTitle }}</h3>
        <button type="button" class="dialog-close" @click="handleCancel">✕</button>
      </div>

      <div class="dialog-content">
        <FormErrorAlert
          :errors="errors"
          dismissible
          :title="`${modalTitle}失敗`"
          @dismiss="dismissErrors"
        />

        <div class="form-group">
          <label class="form-label">內容 *</label>
          <textarea
            v-model="content"
            :placeholder="placeholder"
            class="form-textarea"
            maxlength="500"
            rows="6"
          />
          <div class="char-counter">
            {{ charCount }}/500
          </div>
        </div>
      </div>

      <div class="dialog-actions">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="submitting"
          @click="handleCancel"
        >
          取消
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!isValid || submitting"
          @click="handleConfirm"
        >
          {{ submitting ? '提交中...' : '確認' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 16px;
}

.dialog-modal {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.dialog-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.dialog-close:hover {
  background-color: #f3f4f6;
}

.dialog-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.form-textarea {
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-textarea:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.char-counter {
  font-size: 12px;
  color: #6b7280;
  text-align: right;
}

.dialog-actions {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
  justify-content: flex-end;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.btn-primary {
  background: #4f46e5;
  color: white;
}

.btn.btn-primary:hover:not(:disabled) {
  background: #4338ca;
}

.btn.btn-secondary {
  background: #e5e7eb;
  color: #111827;
}

.btn.btn-secondary:hover:not(:disabled) {
  background: #d1d5db;
}

@media (max-width: 640px) {
  .dialog-overlay {
    padding: 8px;
  }

  .dialog-modal {
    max-height: calc(100vh - 16px);
  }

  .dialog-header {
    padding: 16px;
  }

  .dialog-content {
    padding: 16px;
  }

  .dialog-actions {
    padding: 12px 16px;
    gap: 8px;
  }

  .btn {
    flex: 1;
    min-height: 44px;
  }

  .form-textarea {
    font-size: 16px;
  }
}
</style>
