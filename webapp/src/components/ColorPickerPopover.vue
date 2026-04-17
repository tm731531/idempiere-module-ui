<template>
  <!-- Accessible popover: closes on Escape or outside click -->
  <Teleport to="body">
    <div
      v-if="visible"
      class="color-popover-overlay"
      @click.self="close"
      @keydown.esc="close"
    >
      <div
        ref="popoverEl"
        class="color-popover"
        :style="positionStyle"
        role="dialog"
        aria-label="選擇顏色"
      >
        <!-- Preset palette -->
        <div class="color-grid">
          <button
            v-for="c in PALETTE"
            :key="c.hex"
            class="color-swatch"
            :class="{ active: modelValue === c.hex }"
            :style="{ backgroundColor: c.hex }"
            :title="c.label"
            @click="select(c.hex)"
          />
        </div>
        <!-- Revert to default -->
        <button class="btn-default" @click="selectDefault">
          使用預設
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'

// ========== Clinic-friendly palette (10 colors) ==========
const PALETTE = [
  { hex: '#6366f1', label: '靛藍' },
  { hex: '#3b82f6', label: '藍色' },
  { hex: '#06b6d4', label: '青色' },
  { hex: '#10b981', label: '翠綠' },
  { hex: '#84cc16', label: '草綠' },
  { hex: '#f59e0b', label: '琥珀' },
  { hex: '#f97316', label: '橙色' },
  { hex: '#ec4899', label: '粉紅' },
  { hex: '#8b5cf6', label: '紫色' },
  { hex: '#94a3b8', label: '灰色' },
] as const

const props = defineProps<{
  /** Currently selected hex color (or undefined for "default") */
  modelValue?: string | null
  /** Whether the popover is visible */
  visible: boolean
  /** Anchor element for positioning (optional) */
  anchorEl?: HTMLElement | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'update:visible': [value: boolean]
  /** Emitted when user picks a color or chooses default */
  change: [value: string | null]
}>()

const popoverEl = ref<HTMLElement | null>(null)
const positionStyle = ref<Record<string, string>>({})

// Position near anchor when shown
watch(() => props.visible, async (shown) => {
  if (!shown || !props.anchorEl) return
  await nextTick()
  const rect = props.anchorEl.getBoundingClientRect()
  const pop = popoverEl.value
  const popH = pop ? pop.offsetHeight : 160
  const spaceBelow = window.innerHeight - rect.bottom
  const top = spaceBelow >= popH + 8
    ? rect.bottom + 4
    : rect.top - popH - 4
  const left = Math.min(rect.left, window.innerWidth - 200)
  positionStyle.value = {
    top: `${top}px`,
    left: `${Math.max(8, left)}px`,
  }
})

const computedStyle = computed(() => positionStyle.value)

function select(hex: string) {
  emit('update:modelValue', hex)
  emit('change', hex)
  close()
}

function selectDefault() {
  emit('update:modelValue', null)
  emit('change', null)
  close()
}

function close() {
  emit('update:visible', false)
}
</script>

<style scoped>
.color-popover-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
}

.color-popover {
  position: fixed;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 0.625rem;
  z-index: 501;
  min-width: 164px;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-bottom: 0.5rem;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;
}

.color-swatch:hover {
  transform: scale(1.15);
  border-color: #64748b;
}

.color-swatch.active {
  border-color: #1e293b;
  transform: scale(1.1);
}

.btn-default {
  width: 100%;
  padding: 0.375rem 0;
  font-size: 0.8125rem;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}

.btn-default:hover {
  background: #f1f5f9;
  color: #334155;
}
</style>
