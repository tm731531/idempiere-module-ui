<template>
  <div class="action-sheet">
    <!-- 預約摘要卡片 -->
    <div class="appt-summary">
      <div class="summary-header">
        <h4 class="summary-title">{{ appt.Name || '未命名預約' }}</h4>
      </div>

      <div class="summary-rows">
        <div class="summary-row">
          <span class="label">服務人員</span>
          <span class="value">{{ getResourceName() }}</span>
        </div>
        <div class="summary-row">
          <span class="label">時間</span>
          <span class="value">{{ formatTime() }}</span>
        </div>
        <div v-if="appt.Comments" class="summary-row">
          <span class="label">備註</span>
          <span class="value">{{ appt.Comments }}</span>
        </div>
      </div>
    </div>

    <!-- 操作按鈕 -->
    <div class="actions">
      <button class="action-btn primary" @click="$emit('edit')">
        <span class="btn-icon">✎</span> 編輯
      </button>
      <button class="action-btn secondary" @click="$emit('copy')">
        <span class="btn-icon">⊕</span> 複製
      </button>
      <button class="action-btn danger" @click="$emit('delete')">
        <span class="btn-icon">🗑</span> 刪除
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { parseIdempiereDateTime } from '@/api/utils'

interface Props {
  appt: any
  resources?: any[]
}

withDefaults(defineProps<Props>(), {
  resources: () => [],
})

defineEmits<{
  edit: []
  copy: []
  delete: []
}>()

function getResourceName(): string {
  const resId = typeof appt.S_Resource_ID === 'object'
    ? appt.S_Resource_ID.id
    : appt.S_Resource_ID

  const res = props.resources?.find(r => r.id === resId)
  return res?.Name || `#${resId}`
}

function formatTime(): string {
  try {
    const from = parseIdempiereDateTime(appt.AssignDateFrom)
    const to = parseIdempiereDateTime(appt.AssignDateTo)

    const fromStr = from.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    const toStr = to.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })

    return `${fromStr} - ${toStr}`
  } catch {
    return '時間格式錯誤'
  }
}
</script>

<style scoped>
.action-sheet {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 摘要卡片 */
.appt-summary {
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.summary-header {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.summary-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.summary-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0;
}

.summary-row .label {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.summary-row .value {
  font-size: 14px;
  color: #111827;
  font-weight: 600;
}

/* 操作按鈕 */
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  touch-action: manipulation;
}

.action-btn:active {
  transform: scale(0.98);
}

.action-btn.primary {
  background: #4f46e5;
  color: white;
}

.action-btn.primary:hover {
  background: #4338ca;
}

.action-btn.secondary {
  background: #e5e7eb;
  color: #111827;
}

.action-btn.secondary:hover {
  background: #d1d5db;
}

.action-btn.danger {
  background: #fee2e2;
  color: #991b1b;
}

.action-btn.danger:hover {
  background: #fecaca;
}

.btn-icon {
  font-size: 18px;
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .action-sheet {
    padding: 12px;
  }

  .action-btn {
    padding: 14px 16px;
    font-size: 15px;
  }
}
</style>
