<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { FieldMeta, ColumnMeta } from '@/api/metadata'
import { fetchRefListItems, fetchIdentifierColumn, checkQuickCreateEligibility } from '@/api/metadata'
import { getFieldLabel } from '@/i18n/fieldLabels'
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
  // Fallback: if no referenceTableName, derive from column name (same as Ref 19)
  if (props.referenceTableName) return props.referenceTableName
  if (props.column.referenceId === 30 || props.column.referenceId === 18) {
    const cn = props.column.columnName
    return cn.endsWith('_ID') ? cn.slice(0, -3) : ''
  }
  return ''
})

// Display field for SearchSelector — resolved from AD_Column.IsIdentifier
// Starts empty; SearchSelector waits for this to be resolved before initializing
const displayFieldName = ref('')

const isFkField = computed(() =>
  [18, 19, 30].includes(props.column.referenceId) && resolvedTableName.value
)

// QuickCreate: determined dynamically from AD metadata
const enableQuickCreate = ref(false)
const quickCreateDefaults = ref<Record<string, any>>({})

const label = computed(() => getFieldLabel(props.column.columnName, props.field.name))

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  const refId = props.column.referenceId

  if (refId === 11 || refId === 29) {
    emit('update:modelValue', target.value === '' ? null : parseInt(target.value, 10))
  } else if (refId === 12) {
    emit('update:modelValue', target.value === '' ? null : parseFloat(target.value))
  } else if (refId === 20) {
    emit('update:modelValue', target.checked)
  } else if (refId === 16) {
    // DateTime: normalize "2026-02-14T18:50" → "2026-02-14T18:50:00Z"
    const v = target.value
    if (!v) { emit('update:modelValue', null); return }
    const normalized = v.length === 16 ? `${v}:00Z` : v.endsWith('Z') ? v : `${v}Z`
    emit('update:modelValue', normalized)
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
  if (isFkField.value) {
    const table = resolvedTableName.value
    displayFieldName.value = await fetchIdentifierColumn(table)

    // Check QuickCreate eligibility from AD metadata
    const qc = await checkQuickCreateEligibility(table)
    enableQuickCreate.value = qc.eligible
    quickCreateDefaults.value = qc.mandatoryDefaults
  }
})
</script>

<template>
  <div v-if="!isHidden" class="field-wrapper">
    <label class="field-label">
      {{ label }}
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
      :quickCreate="enableQuickCreate"
      :quickCreateDefaults="quickCreateDefaults"
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
