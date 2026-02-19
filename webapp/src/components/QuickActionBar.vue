<script setup lang="ts">
import { toIdempiereDateTime } from '@/api/utils'

interface Props {
  requestId: number
  currentStatus: string
  disabled?: boolean
}

defineProps<Props>()

interface ActivityPayload {
  type: string
  actionType: string
  content: string
}

const emit = defineEmits<{
  'add-activity': [payload: ActivityPayload]
  'update-status': []
  'set-tracking': []
}>()

function handlePhoneClick() {
  const timestamp = toIdempiereDateTime(new Date())
  const createdBy = localStorage.getItem('user_name') || '未知用戶'

  emit('add-activity', {
    type: '前台行動',
    actionType: '打電話',
    content: '',
  })
}

function handleMessageClick() {
  const timestamp = toIdempiereDateTime(new Date())
  const createdBy = localStorage.getItem('user_name') || '未知用戶'

  emit('add-activity', {
    type: '前台行動',
    actionType: '發訊息',
    content: '',
  })
}

function handleStatusClick() {
  emit('update-status')
}

function handleTrackingClick() {
  emit('set-tracking')
}
</script>

<template>
  <div class="quick-action-bar">
    <div class="action-grid">
      <!-- 記錄打電話 -->
      <button
        class="action-btn"
        :disabled="disabled"
        @click="handlePhoneClick"
        title="記錄打電話"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        <span>記錄打電話</span>
      </button>

      <!-- 發訊息 -->
      <button
        class="action-btn"
        :disabled="disabled"
        @click="handleMessageClick"
        title="發訊息"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>發訊息</span>
      </button>

      <!-- 更新狀態 -->
      <button
        class="action-btn"
        :disabled="disabled"
        @click="handleStatusClick"
        title="更新狀態"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 11l3 3L22 4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>更新狀態</span>
      </button>

      <!-- 預約追蹤 -->
      <button
        class="action-btn"
        :disabled="disabled"
        @click="handleTrackingClick"
        title="預約追蹤"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M19 21H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h2l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>
        </svg>
        <span>預約追蹤</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.quick-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-top: 1px solid var(--color-border, #e5e7eb);
  padding: 12px;
  z-index: 50;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .action-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--min-touch, 56px);
  padding: 8px 12px;
  background: linear-gradient(135deg, var(--color-primary, #3b82f6), var(--color-primary-light, #60a5fa));
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.action-btn svg {
  display: block;
  width: 20px;
  height: 20px;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}

.action-btn:hover:not(:disabled) {
  opacity: 0.85;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.action-btn:active:not(:disabled) {
  transform: translateY(0);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #9ca3af;
}

@media (max-width: 640px) {
  .quick-action-bar {
    padding: 8px;
  }

  .action-grid {
    gap: 6px;
  }

  .action-btn {
    min-height: 52px;
    padding: 6px 8px;
    font-size: 0.7rem;
  }

  .action-btn svg {
    width: 18px;
    height: 18px;
  }
}
</style>
