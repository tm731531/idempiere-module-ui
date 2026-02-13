<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { FieldDefinition } from '@/api/metadata'
import DynamicField from './DynamicField.vue'

const props = defineProps<{
  fieldDefs: FieldDefinition[]
  modelValue: Record<string, any>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>]
}>()

const grouped = computed(() => {
  const groups = new Map<string, FieldDefinition[]>()
  for (const def of props.fieldDefs) {
    const g = def.field.fieldGroup || '其他'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(def)
  }
  return groups
})

const groupNames = computed(() => Array.from(grouped.value.keys()))

const expandedGroups = reactive(new Set<string>())

const autoExpandedGroups = computed(() => {
  const result = new Set<string>()
  const names = groupNames.value
  if (names.length > 0) {
    result.add(names[0]!)
  }
  for (const [groupName, defs] of grouped.value) {
    if (defs.some(d => d.column.isMandatory)) {
      result.add(groupName)
    }
  }
  return result
})

function isExpanded(groupName: string): boolean {
  if (expandedGroups.has(groupName)) return true
  if (expandedGroups.has(`collapsed:${groupName}`)) return false
  return autoExpandedGroups.value.has(groupName)
}

function toggleGroup(groupName: string) {
  if (isExpanded(groupName)) {
    expandedGroups.delete(groupName)
    expandedGroups.add(`collapsed:${groupName}`)
  } else {
    expandedGroups.delete(`collapsed:${groupName}`)
    expandedGroups.add(groupName)
  }
}

function onFieldUpdate(columnName: string, value: any) {
  const merged = { ...props.modelValue, [columnName]: value }
  emit('update:modelValue', merged)
}
</script>

<template>
  <div class="dynamic-form">
    <div
      v-for="groupName in groupNames"
      :key="groupName"
      class="form-section"
    >
      <button
        type="button"
        class="section-header"
        @click="toggleGroup(groupName)"
      >
        <span class="collapse-indicator">{{ isExpanded(groupName) ? '\u25BC' : '\u25B6' }}</span>
        {{ groupName }}
      </button>

      <div v-if="isExpanded(groupName)" class="section-content">
        <div class="form-grid">
          <DynamicField
            v-for="def in grouped.get(groupName)"
            :key="def.column.columnName"
            :field="def.field"
            :column="def.column"
            :model-value="modelValue[def.column.columnName]"
            :disabled="def.field.isReadOnly"
            @update:model-value="onFieldUpdate(def.column.columnName, $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dynamic-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: none;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  min-height: var(--min-touch);
}

.section-header:hover {
  background: rgba(0, 0, 0, 0.03);
}

.collapse-indicator {
  font-size: 0.75rem;
  width: 1em;
  flex-shrink: 0;
}

.section-content {
  padding: 16px;
  border-top: 1px solid var(--color-border);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
