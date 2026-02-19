<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog-modal">
      <div class="dialog-header">
        <h3 class="dialog-title">預約追蹤</h3>
        <button type="button" class="dialog-close" @click="$emit('close')">✕</button>
      </div>

      <div class="dialog-content">
        <!-- Error display -->
        <FormErrorAlert
          :errors="validationErrors"
          dismissible
          title="預約追蹤驗證失敗"
          @dismiss="validationErrors = {}"
        />

        <!-- Date input -->
        <div class="form-group">
          <label class="form-label">日期 *</label>
          <input
            v-model="selectedDate"
            type="date"
            class="form-input"
            :min="todayStr"
            @blur="validateForm"
          />
        </div>

        <!-- Time input -->
        <div class="form-group">
          <label class="form-label">時間 *</label>
          <input
            v-model="selectedTime"
            type="time"
            class="form-input"
            @blur="validateForm"
          />
        </div>

        <!-- Description input -->
        <div class="form-group">
          <label class="form-label">說明 *</label>
          <textarea
            v-model="description"
            class="form-textarea"
            placeholder="預約追蹤說明"
            maxlength="200"
            @blur="validateForm"
          />
          <div class="char-counter">{{ description.length }}/200</div>
        </div>
      </div>

      <div class="dialog-actions">
        <button
          type="button"
          class="btn btn-secondary"
          @click="$emit('close')"
        >
          取消
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!isValidForm"
          @click="handleConfirm"
        >
          確認
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  validateTrackingForm,
  validateTrackingDate,
  validateTrackingTime,
  validateTrackingDescription,
  type TrackingFormData,
} from '@/utils/validation'
import FormErrorAlert from './FormErrorAlert.vue'

interface Props {
  requestId: number
  initialDate?: string
}

interface TrackingData {
  date: string
  time: string
  description: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'tracking-set': [data: TrackingData]
  'close': []
}>()

// Get today's date as ISO string (YYYY-MM-DD)
const getTodayStr = (): string => {
  const today = new Date()
  return today.toISOString().split('T')[0] ?? ''
}

// Get current time as HH:MM
const getCurrentTimeStr = (): string => {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

const todayStr = computed(() => getTodayStr())
const selectedDate = ref<string>(props.initialDate ?? getTodayStr())
const selectedTime = ref(getCurrentTimeStr())
const _description = ref('')
const validationErrors = ref<Record<string, string>>({})

// Enforce 200 character limit
const description = computed({
  get: () => _description.value,
  set: (value: string) => {
    _description.value = value.slice(0, 200)
  }
})

// Validate form data
function validateForm() {
  const formData: TrackingFormData = {
    date: selectedDate.value,
    time: selectedTime.value,
    description: description.value,
  }

  const validation = validateTrackingForm(formData)
  validationErrors.value = validation.errors

  return validation.isValid
}

// Check if form is valid (computed for button disabled state)
const isValidForm = computed(() => {
  const formData: TrackingFormData = {
    date: selectedDate.value,
    time: selectedTime.value,
    description: description.value,
  }

  const validation = validateTrackingForm(formData)
  return validation.isValid
})

function handleConfirm() {
  if (!validateForm()) {
    return
  }

  emit('tracking-set', {
    date: selectedDate.value,
    time: selectedTime.value,
    description: description.value,
  })
}
</script>

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
  max-width: 400px;
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

.form-input,
.form-textarea {
  padding: 12px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 16px;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-height: 44px;
  line-height: 1.5;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.form-textarea {
  min-height: 120px;
  resize: vertical;
  padding: 12px 14px;
}

.char-counter {
  font-size: 13px;
  color: #6b7280;
  text-align: right;
  font-weight: 500;
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
    padding: 0;
    align-items: flex-end;
    animation: slideUpIn 0.3s ease-out;
  }

  .dialog-modal {
    width: 100%;
    max-height: calc(100vh - 60px);
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  }

  .dialog-header {
    padding: 24px 20px;
  }

  .dialog-title {
    font-size: 20px;
  }

  .dialog-close {
    width: 44px;
    height: 44px;
    font-size: 28px;
  }

  .dialog-content {
    padding: 20px;
    gap: 16px;
  }

  .form-group {
    gap: 8px;
  }

  .form-label {
    font-size: 15px;
    font-weight: 600;
  }

  .form-input {
    font-size: 16px;
    min-height: 48px;
  }

  .form-textarea {
    font-size: 16px;
    min-height: 140px;
    padding: 12px 14px;
  }

  .dialog-actions {
    padding: 16px 20px;
    padding-bottom: max(16px, env(safe-area-inset-bottom));
    gap: 10px;
  }

  .btn {
    flex: 1;
    min-height: 48px;
    font-size: 16px;
  }

  @keyframes slideUpIn {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
}

@media (min-width: 641px) and (max-width: 1024px) {
  .dialog-modal {
    max-width: 90vw;
    max-width: 500px;
  }

  .dialog-content {
    padding: 20px;
  }

  .btn {
    flex: 1;
    min-height: 44px;
  }

  .form-input,
  .form-textarea {
    min-height: 44px;
  }

  .form-textarea {
    min-height: 130px;
  }
}

@media (min-width: 1025px) {
  .dialog-modal {
    max-width: 450px;
  }

  .btn {
    min-height: 40px;
  }
}
</style>
