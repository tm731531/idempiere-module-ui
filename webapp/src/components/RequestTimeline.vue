<template>
  <div class="timeline-container">
    <div v-if="parsedActivities.length === 0" class="empty-state">
      無活動記錄
    </div>

    <div v-else class="timeline">
      <div v-for="(activity, index) in parsedActivities" :key="getActivityKey(activity, index)" class="timeline-item">
        <!-- 時間軸線 -->
        <div class="timeline-line">
          <div class="timeline-dot"></div>
          <div v-if="index < parsedActivities.length - 1" class="timeline-connector"></div>
        </div>

        <!-- 活動卡片 -->
        <div class="timeline-card">
          <div class="card-header">
            <span class="timestamp">{{ formatTime(activity.timestamp) }}</span>
            <span class="type-badge" :class="getTypeBadgeClass(activity.type)">
              {{ activity.type }}
            </span>
          </div>

          <div class="card-body">
            <div class="action-type">{{ activity.actionType }}</div>
            <div class="content">{{ activity.content }}</div>
            <div class="metadata">
              <span class="created-by">操作人：{{ activity.createdBy }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { parseIdempiereDateTime } from '@/api/utils'

interface Activity {
  timestamp: string
  type: string
  actionType: string
  content: string
  createdBy: string
}

interface Props {
  activities: string
}

const props = defineProps<Props>()

const parsedActivities = computed(() => {
  try {
    const parsed = JSON.parse(props.activities)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
})

/**
 * 格式化時間戳，失敗時返回原始值
 * 確保 parseIdempiereDateTime() 異常不會影響整個組件
 */
function formatTime(timestamp: string): string {
  try {
    const date = parseIdempiereDateTime(timestamp)
    return date.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    console.warn(`Failed to format timestamp: ${timestamp}`, error)
    return timestamp
  }
}

/**
 * 生成穩定的 activity key (替代 index)
 * 防止列表重新排序時造成狀態混亂
 */
function getActivityKey(activity: Activity, index: number): string {
  return `${activity.timestamp}-${activity.type}-${activity.actionType}-${index}`
}

function getTypeBadgeClass(type: string): string {
  const typeMap: Record<string, string> = {
    '前台行動': 'type-action',
    '狀態改變': 'type-status',
    '備註': 'type-note',
    '指派': 'type-assignment',
  }
  return typeMap[type] || 'type-default'
}
</script>

<style scoped>
.timeline-container {
  width: 100%;
  padding: 16px;
}

/* 空狀態 */
.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: #9ca3af;
  font-size: 14px;
}

/* 時間軸容器 */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* 時間軸項目 */
.timeline-item {
  display: flex;
  gap: 16px;
  position: relative;
}

/* 時間軸線 */
.timeline-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #3b82f6;
  border: 3px solid white;
  box-shadow: 0 0 0 1px #3b82f6;
  position: relative;
  z-index: 2;
  margin-top: 8px;
}

.timeline-connector {
  width: 2px;
  flex: 1;
  min-height: 40px;
  background: linear-gradient(to bottom, #3b82f6, #e5e7eb);
}

/* 活動卡片 */
.timeline-card {
  flex: 1;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  margin-top: 4px;
  margin-bottom: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.timestamp {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

/* 類型 Badge */
.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.type-action {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.type-status {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.type-note {
  background: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}

.type-assignment {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.type-default {
  background: rgba(148, 163, 184, 0.1);
  color: #64748b;
}

/* 卡片主體 */
.card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.action-type {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.content {
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
}

.metadata {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
}

.created-by {
  display: inline-block;
}

/* 行動設備適配 */
@media (max-width: 640px) {
  .timeline-container {
    padding: 12px;
  }

  .timeline-item {
    gap: 12px;
  }

  .timeline-dot {
    width: 10px;
    height: 10px;
    border-width: 2px;
  }

  .timeline-card {
    padding: 10px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .timestamp {
    font-size: 11px;
  }

  .type-badge {
    font-size: 11px;
    padding: 3px 8px;
  }

  .action-type {
    font-size: 13px;
  }

  .content {
    font-size: 12px;
  }
}
</style>
