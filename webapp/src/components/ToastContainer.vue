<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="toast-item"
          :class="`toast-${msg.severity}`"
          role="alert"
          @click="remove(msg.id)"
        >
          <span class="toast-icon">{{ icons[msg.severity] }}</span>
          <div class="toast-body">
            <div class="toast-summary">{{ msg.summary }}</div>
            <div v-if="msg.detail" class="toast-detail">{{ msg.detail }}</div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { messages, remove } = useToast()

const icons: Record<string, string> = {
  info: 'ℹ',
  success: '✓',
  warn: '⚠',
  error: '✕',
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
  max-width: 360px;
}

.toast-item {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  color: #fff;
  font-size: 0.875rem;
  cursor: pointer;
  pointer-events: all;
  line-height: 1.4;
}

.toast-info    { background: #3b82f6; }
.toast-success { background: var(--color-success, #22c55e); }
.toast-warn    { background: #f59e0b; color: #1e293b; }
.toast-error   { background: var(--color-error, #ef4444); }

.toast-icon {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 0.05rem;
}

.toast-summary {
  font-weight: 600;
}

.toast-detail {
  margin-top: 0.2rem;
  font-size: 0.8125rem;
  opacity: 0.9;
}

/* Transition */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(2rem);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(2rem);
}
</style>
