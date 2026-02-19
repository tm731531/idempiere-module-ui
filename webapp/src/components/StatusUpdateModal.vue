<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog-modal">
      <div class="dialog-header">
        <h3 class="dialog-title">更新狀態</h3>
        <button type="button" class="dialog-close" @click="$emit('close')">✕</button>
      </div>

      <div class="dialog-content">
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
          :disabled="props.statuses.length === 0"
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

// Computed to normalize currentStatusId to number
const normalizedCurrentStatusId = computed(() => {
  const currentId = typeof props.currentStatusId === 'string'
    ? Number(props.currentStatusId)
    : props.currentStatusId
  return currentId
})

function handleConfirm() {
  if (selectedStatusId.value !== null) {
    emit('status-selected', selectedStatusId.value)
  }
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
}
</style>
