<template>
  <Teleport to="body">
    <Transition name="sheet-fade" @enter="onEnter" @leave="onLeave">
      <div
        v-if="modelValue"
        class="sheet-overlay"
        :style="{ backgroundColor: `rgba(0, 0, 0, ${modelValue ? 0.3 : 0})` }"
        @click="close"
      >
        <div
          class="sheet-container"
          :style="{ maxHeight: maxHeight }"
          @click.stop
        >
          <div class="sheet-handle"></div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

interface Props {
  modelValue: boolean
  maxHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  maxHeight: '70vh',
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

function close() {
  emit('update:modelValue', false)
}

function onEnter(el: Element) {
  const container = el.querySelector('.sheet-container') as HTMLElement
  if (container) {
    container.style.transform = 'translateY(0)'
  }
}

function onLeave(el: Element) {
  const container = el.querySelector('.sheet-container') as HTMLElement
  if (container) {
    container.style.transform = 'translateY(100%)'
  }
}
</script>

<style scoped>
.sheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 100;
  transition: background-color 0.3s ease-out;
}

.sheet-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-radius: 12px 12px 0 0;
  max-height: 70vh;
  overflow-y: auto;
  transform: translateY(100%);
  transition: transform 0.3s ease-out;
  z-index: 101;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
}

/* Handle bar at top of sheet */
.sheet-handle {
  width: 40px;
  height: 4px;
  margin: 8px auto;
  background: #d1d5db;
  border-radius: 2px;
}

/* Hide scrollbar on iOS */
.sheet-container::-webkit-scrollbar {
  display: none;
}
.sheet-container {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Smooth transitions */
.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity 0.3s ease-out;
}

.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}
</style>
