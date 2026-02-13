<script setup lang="ts">
defineProps<{
  status: string
}>()

const statusMap: Record<string, string> = {
  DR: '草稿',
  IP: '處理中',
  CO: '已完成',
  CL: '已關閉',
  VO: '已作廢',
  RE: '已沖銷',
}

function label(code: string): string {
  return statusMap[code] || code
}

function cssClass(code: string): string {
  const key = code.toLowerCase()
  return statusMap[code] ? `status-${key}` : ''
}
</script>

<template>
  <span class="status-badge" :class="cssClass(status)">{{ label(status) }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.status-dr {
  background: rgba(148, 163, 184, 0.15);
  color: #64748b;
}

.status-ip {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-co {
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
}

.status-cl {
  background: rgba(148, 163, 184, 0.15);
  color: #64748b;
}

.status-vo {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.status-re {
  background: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}
</style>
