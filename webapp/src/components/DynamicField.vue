<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { FieldMeta, ColumnMeta } from '@/api/metadata'
import { fetchRefListItems } from '@/api/metadata'
import SearchSelector from './SearchSelector.vue'

const props = defineProps<{
  field: FieldMeta
  column: ColumnMeta
  modelValue: any
  disabled: boolean
  referenceTableName?: string
  filter?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const refListOptions = ref<{ value: string; name: string }[]>([])

const isHidden = computed(() =>
  props.column.referenceId === 13 || props.column.referenceId === 28
)

// For FK reference fields (18/19/30), resolve the table name
const resolvedTableName = computed(() => {
  if (props.column.referenceId === 19) {
    // TableDirect: derive from column name
    const cn = props.column.columnName
    return cn.endsWith('_ID') ? cn.slice(0, -3) : cn
  }
  // For Ref 18/30, use prop from parent (resolved in metadata.ts)
  return props.referenceTableName || ''
})

// Display field for SearchSelector — most tables use "Name"
const displayFieldName = computed(() => {
  const docNoTables = new Set([
    'C_Order', 'C_Payment', 'M_InOut', 'M_Production', 'M_Movement',
    'C_Invoice', 'M_Requisition',
  ])
  const valueTables = new Set(['M_Locator'])

  if (docNoTables.has(resolvedTableName.value)) return 'DocumentNo'
  if (valueTables.has(resolvedTableName.value)) return 'Value'
  return 'Name'
})

const isFkField = computed(() =>
  [18, 19, 30].includes(props.column.referenceId) && resolvedTableName.value
)

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  const refId = props.column.referenceId

  if (refId === 11 || refId === 29) {
    emit('update:modelValue', target.value === '' ? null : parseInt(target.value, 10))
  } else if (refId === 12) {
    emit('update:modelValue', target.value === '' ? null : parseFloat(target.value))
  } else if (refId === 20) {
    emit('update:modelValue', target.checked)
  } else {
    emit('update:modelValue', target.value)
  }
}

function onSelectChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}

onMounted(async () => {
  if (props.column.referenceId === 17 && props.column.referenceValueId) {
    refListOptions.value = await fetchRefListItems(props.column.referenceValueId)
  }
})
</script>

<template>
  <div v-if="!isHidden" class="field-wrapper">
    <label class="field-label">
      {{ field.name }}
      <span v-if="column.isMandatory" class="required">*</span>
    </label>

    <!-- FK fields: TableDirect (19) / Table (18) / Search (30) -->
    <SearchSelector
      v-if="isFkField"
      :modelValue="modelValue"
      :tableName="resolvedTableName"
      :displayField="displayFieldName"
      :searchField="displayFieldName"
      :filter="filter"
      :disabled="disabled"
      @update:modelValue="emit('update:modelValue', $event)"
    />

    <!-- List (17) -->
    <select
      v-else-if="column.referenceId === 17"
      :value="modelValue"
      :disabled="disabled"
      @change="onSelectChange"
    >
      <option value="">-- 請選擇 --</option>
      <option v-for="opt in refListOptions" :key="opt.value" :value="opt.value">
        {{ opt.name }}
      </option>
    </select>

    <!-- Integer (11) / Qty (29) -->
    <input
      v-else-if="column.referenceId === 11 || column.referenceId === 29"
      type="number"
      :value="modelValue"
      :disabled="disabled"
      @input="onInput"
    />

    <!-- Amount (12) -->
    <input
      v-else-if="column.referenceId === 12"
      type="number"
      step="0.01"
      :value="modelValue"
      :disabled="disabled"
      @input="onInput"
    />

    <!-- Text (14) / Memo (38) -->
    <textarea
      v-else-if="column.referenceId === 14 || column.referenceId === 38"
      :value="modelValue"
      :disabled="disabled"
      @input="onInput"
    />

    <!-- Date (15) -->
    <input
      v-else-if="column.referenceId === 15"
      type="date"
      :value="modelValue"
      :disabled="disabled"
      @input="onInput"
    />

    <!-- DateTime (16) -->
    <input
      v-else-if="column.referenceId === 16"
      type="datetime-local"
      :value="modelValue"
      :disabled="disabled"
      @input="onInput"
    />

    <!-- YesNo (20) -->
    <input
      v-else-if="column.referenceId === 20"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="onInput"
    />

    <!-- String (10) / fallback for unknown types -->
    <input
      v-else
      type="text"
      :value="modelValue"
      :disabled="disabled"
      :maxlength="column.fieldLength || undefined"
      @input="onInput"
    />
  </div>

  <!-- Hidden ID field (13) / Button (28) - no visible rendering -->
  <input
    v-else
    type="hidden"
    :value="modelValue"
  />
</template>

<style scoped>
.field-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.required {
  color: var(--color-error);
  margin-left: 2px;
}

.field-wrapper input[type="text"],
.field-wrapper input[type="number"],
.field-wrapper input[type="date"],
.field-wrapper input[type="datetime-local"],
.field-wrapper textarea,
.field-wrapper select {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.875rem;
  min-height: var(--min-touch);
  width: 100%;
}

.field-wrapper input[type="checkbox"] {
  width: 20px;
  height: 20px;
  min-height: var(--min-touch);
  align-self: flex-start;
}

.field-wrapper textarea {
  min-height: 80px;
  resize: vertical;
}

.field-wrapper input:disabled,
.field-wrapper textarea:disabled,
.field-wrapper select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
