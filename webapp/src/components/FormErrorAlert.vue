<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  errors: Record<string, string>
  dismissible?: boolean
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  dismissible: true,
  title: '驗證錯誤',
})

const emit = defineEmits<{
  dismiss: []
}>()

const hasErrors = computed(() => {
  return Object.keys(props.errors).length > 0
})

const errorEntries = computed(() => {
  return Object.entries(props.errors)
})

function handleDismiss() {
  emit('dismiss')
}
</script>

<template>
  <div v-if="hasErrors" class="error-alert">
    <div class="error-header">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div class="error-title">{{ title }}</div>
      <button
        v-if="dismissible"
        class="error-close"
        @click="handleDismiss"
        aria-label="關閉錯誤訊息"
      >
        ✕
      </button>
    </div>

    <div class="error-list">
      <div
        v-for="[field, message] in errorEntries"
        :key="field"
        class="error-item"
      >
        <span class="error-field">{{ field }}:</span>
        <span class="error-message">{{ message }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-alert {
  background-color: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
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

.error-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.error-icon {
  width: 20px;
  height: 20px;
  color: #dc2626;
  flex-shrink: 0;
}

.error-title {
  font-weight: 700;
  color: #991b1b;
  font-size: 15px;
  flex: 1;
  line-height: 1.4;
}

.error-close {
  background: none;
  border: none;
  color: #dc2626;
  cursor: pointer;
  font-size: 18px;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background-color 0.2s;
  flex-shrink: 0;
  min-height: 32px;
  min-width: 32px;
}

.error-close:hover {
  background-color: rgba(220, 38, 38, 0.1);
}

.error-close:active {
  background-color: rgba(220, 38, 38, 0.2);
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.error-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  color: #7f1d1d;
  line-height: 1.6;
  padding: 4px 0;
}

.error-field {
  font-weight: 600;
  flex-shrink: 0;
  color: #991b1b;
}

.error-message {
  flex: 1;
}

@media (max-width: 640px) {
  .error-alert {
    padding: 16px;
    margin-bottom: 16px;
    border-radius: 8px;
  }

  .error-header {
    margin-bottom: 12px;
    gap: 10px;
  }

  .error-item {
    font-size: 14px;
    line-height: 1.6;
    padding: 4px 0;
  }

  .error-icon {
    width: 20px;
    height: 20px;
    margin-top: 2px;
  }

  .error-title {
    font-size: 15px;
    font-weight: 700;
  }

  .error-close {
    width: 36px;
    height: 36px;
    font-size: 20px;
  }

  .error-list {
    gap: 10px;
  }
}

@media (min-width: 641px) {
  .error-alert {
    padding: 16px;
  }

  .error-item {
    font-size: 13px;
  }
}
</style>
