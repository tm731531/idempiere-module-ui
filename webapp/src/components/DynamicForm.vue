<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FieldDefinition } from '@/api/metadata'
import DynamicField from './DynamicField.vue'

const props = defineProps<{
  fieldDefs: FieldDefinition[]
  modelValue: Record<string, any>
  disabled?: boolean
  columnFilters?: Record<string, string>
  promoteMandatory?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>]
}>()

const promoteSet = computed(() => new Set(props.promoteMandatory || []))

const mandatoryFields = computed(() =>
  props.fieldDefs.filter(d => d.column.isMandatory || promoteSet.value.has(d.column.columnName))
)

const optionalFields = computed(() =>
  props.fieldDefs.filter(d => !d.column.isMandatory && !promoteSet.value.has(d.column.columnName))
)

const showOptional = ref(false)

function onFieldUpdate(columnName: string, value: any) {
  const merged = { ...props.modelValue, [columnName]: value }
  emit('update:modelValue', merged)
}
</script>

<template>
  <div class="dynamic-form">
    <!-- Mandatory fields: always visible -->
    <div v-if="mandatoryFields.length > 0" class="form-section">
      <div class="section-header-static">
        必填欄位
      </div>
      <div class="section-content">
        <div class="form-grid">
          <DynamicField
            v-for="def in mandatoryFields"
            :key="def.column.columnName"
            :field="def.field"
            :column="def.column"
            :model-value="modelValue[def.column.columnName]"
            :disabled="disabled || def.field.isReadOnly || !def.column.isUpdateable"
            :referenceTableName="def.referenceTableName"
            :filter="columnFilters?.[def.column.columnName]"
            @update:model-value="onFieldUpdate(def.column.columnName, $event)"
          />
        </div>
      </div>
    </div>

    <!-- Optional fields: collapsed by default -->
    <div v-if="optionalFields.length > 0" class="form-section optional-section">
      <button
        type="button"
        class="section-header"
        @click="showOptional = !showOptional"
      >
        <span class="collapse-indicator">{{ showOptional ? '\u25BC' : '\u25B6' }}</span>
        更多欄位
        <span class="field-count">({{ optionalFields.length }})</span>
      </button>

      <div v-if="showOptional" class="section-content">
        <div class="form-grid">
          <DynamicField
            v-for="def in optionalFields"
            :key="def.column.columnName"
            :field="def.field"
            :column="def.column"
            :model-value="modelValue[def.column.columnName]"
            :disabled="disabled || def.field.isReadOnly || !def.column.isUpdateable"
            :referenceTableName="def.referenceTableName"
            :filter="columnFilters?.[def.column.columnName]"
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

.section-header-static {
  padding: 12px 16px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
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

.field-count {
  font-weight: 400;
  color: #94a3b8;
  font-size: 0.875rem;
}

.optional-section {
  border-style: dashed;
}

.section-content {
  padding: 16px;
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
