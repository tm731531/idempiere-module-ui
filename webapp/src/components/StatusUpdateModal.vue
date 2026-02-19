<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog-modal">
      <div class="dialog-header">
        <h3 class="dialog-title">更新狀態</h3>
        <button type="button" class="dialog-close" @click="$emit('close')">✕</button>
      </div>

      <div class="dialog-content">
        <!-- Error message when no selection -->
        <div v-if="showError" class="error-alert">
          <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>請選擇狀態</span>
        </div>

        <div v-if="props.statuses.length === 0" class="empty-state">
          無可用狀態
        </div>
        <div v-else class="status-list">
          <label
            v-for="status in props.statuses"
            :key="status.R_Status_ID"
            class="status-item"
          >
            <input
              type="radio"
              :value="status.R_Status_ID"
              :checked="selectedStatusId === status.R_Status_ID"
              @change="selectedStatusId = status.R_Status_ID"
            />
            <span class="status-label">{{ status.Name }}</span>
          </label>
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
          :disabled="props.statuses.length === 0 || selectedStatusId === null"
          @click="handleConfirm"
        >
          確認
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Status {
  R_Status_ID: number
  Name: string
}

interface Props {
  requestId: number
  currentStatusId: string | number
  statuses: Status[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'status-selected': [statusId: number]
  'close': []
}>()

const selectedStatusId = ref<number | null>(null)
const showError = ref(false)

// Computed to normalize currentStatusId to number
const normalizedCurrentStatusId = computed(() => {
  const currentId = typeof props.currentStatusId === 'string'
    ? Number(props.currentStatusId)
    : props.currentStatusId
  return currentId
})

function handleConfirm() {
  // Check if a status is selected
  if (selectedStatusId.value === null) {
    showError.value = true
    return
  }

  showError.value = false
  emit('status-selected', selectedStatusId.value)
}

// Initialize and watch for prop changes
watch(
  () => props.currentStatusId,
  () => {
    selectedStatusId.value = normalizedCurrentStatusId.value
  },
  { immediate: true }
)
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
  gap: 12px;
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
}

.status-item:hover {
  background-color: #f3f4f6;
}

.status-item input[type="radio"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #4f46e5;
  flex-shrink: 0;
}

.status-label {
  font-size: 14px;
  color: #111827;
  font-weight: 500;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
  background: #f9fafb;
  border-radius: 8px;
}

.error-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  color: #991b1b;
  font-size: 13px;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.error-icon {
  width: 18px;
  height: 18px;
  color: #dc2626;
  flex-shrink: 0;
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
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  }

  .dialog-header {
    padding: 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .dialog-content {
    padding: 20px;
    gap: 12px;
  }

  .dialog-actions {
    padding: 16px 20px;
    gap: 12px;
  }

  .btn {
    flex: 1;
    min-height: 48px;
    font-size: 16px;
  }

  .status-item {
    padding: 16px;
    min-height: 56px;
  }

  .status-label {
    font-size: 16px;
  }

  .dialog-close {
    width: 40px;
    height: 40px;
    font-size: 28px;
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

  .btn {
    min-height: 44px;
  }

  .status-item {
    padding: 14px;
    min-height: 48px;
  }
}

@media (min-width: 1025px) {
  .dialog-modal {
    max-width: 400px;
  }

  .btn {
    min-height: 40px;
  }
}
</style>
