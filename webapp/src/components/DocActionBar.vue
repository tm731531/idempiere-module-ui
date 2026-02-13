<script setup lang="ts">
import { ref } from 'vue'
import { canComplete, completeDocument } from '@/composables/useDocAction'

const props = defineProps<{
  docStatus: string
  tableName: string
  recordId: number
}>()

const emit = defineEmits<{
  completed: []
  error: [message: string]
}>()

const confirming = ref(false)
const loading = ref(false)

function startConfirm() {
  confirming.value = true
}

function cancelConfirm() {
  confirming.value = false
}

async function doComplete() {
  loading.value = true
  try {
    const result = await completeDocument(props.tableName, props.recordId)
    if (result.success) {
      confirming.value = false
      emit('completed')
    } else {
      confirming.value = false
      emit('error', result.error || '處理失敗')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="doc-action-bar">
    <span v-if="docStatus === 'CO'" class="status-badge status-co">已完成</span>
    <span v-else-if="docStatus === 'VO'" class="status-badge status-vo">已作廢</span>
    <template v-else-if="canComplete(docStatus)">
      <template v-if="!confirming">
        <button class="btn-complete" :disabled="loading" @click="startConfirm">
          完成
        </button>
      </template>
      <template v-else>
        <span class="confirm-prompt">確定要完成？</span>
        <button class="btn-confirm" :disabled="loading" @click="doComplete">
          {{ loading ? '處理中...' : '確定' }}
        </button>
        <button class="btn-cancel" :disabled="loading" @click="cancelConfirm">
          取消
        </button>
      </template>
    </template>
  </div>
</template>

<style scoped>
.doc-action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.btn-complete {
  min-height: var(--min-touch);
  padding: 8px 24px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-complete:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-complete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.confirm-prompt {
  font-weight: 600;
  color: var(--color-text);
}

.btn-confirm {
  min-height: var(--min-touch);
  padding: 8px 20px;
  background: var(--color-success);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm:hover:not(:disabled) {
  filter: brightness(0.9);
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-cancel {
  min-height: var(--min-touch);
  padding: 8px 20px;
  background: var(--color-border);
  color: var(--color-text);
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel:hover:not(:disabled) {
  filter: brightness(0.95);
}

.btn-cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.status-co {
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
}

.status-vo {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}
</style>
