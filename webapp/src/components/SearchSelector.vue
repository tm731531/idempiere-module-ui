<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { apiClient } from '@/api/client'
import { escapeODataString } from '@/api/utils'

const props = withDefaults(defineProps<{
  modelValue: number | null
  tableName: string
  displayField: string
  searchField: string
  filter?: string
  quickCreate?: boolean
  disabled?: boolean
}>(), {
  quickCreate: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  'quick-create': []
}>()

const mode = ref<'loading' | 'dropdown' | 'search'>('loading')
const dropdownOptions = ref<{ id: number; label: string }[]>([])
const searchText = ref('')
const searchResults = ref<{ id: number; label: string }[]>([])
const showDropdown = ref(false)
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const idColumn = ref('')

function getIdColumn(tableName: string): string {
  return `${tableName}_ID`
}

async function countRecords(): Promise<number> {
  const params: Record<string, string> = {
    '$top': '0',
    '$count': 'true',
  }
  if (props.filter) {
    params['$filter'] = props.filter
  }
  const resp = await apiClient.get(`/api/v1/models/${props.tableName}`, { params })
  return resp.data['row-count'] || 0
}

async function loadAllOptions(): Promise<void> {
  const params: Record<string, string> = {
    '$select': `${idColumn.value},${props.displayField}`,
    '$orderby': props.displayField,
  }
  if (props.filter) {
    params['$filter'] = props.filter
  }
  const resp = await apiClient.get(`/api/v1/models/${props.tableName}`, { params })
  const records = resp.data.records || []
  dropdownOptions.value = records.map((r: any) => ({
    id: r.id,
    label: r[props.displayField] || '',
  }))
}

async function doSearch(query: string): Promise<void> {
  if (!query.trim()) {
    searchResults.value = []
    showDropdown.value = false
    return
  }

  const safe = escapeODataString(query)
  let filterStr = `contains(${props.searchField},'${safe}')`
  if (props.filter) {
    filterStr = `${props.filter} and ${filterStr}`
  }

  const resp = await apiClient.get(`/api/v1/models/${props.tableName}`, {
    params: {
      '$filter': filterStr,
      '$select': `${idColumn.value},${props.displayField}`,
      '$orderby': props.displayField,
      '$top': '20',
    },
  })

  const records = resp.data.records || []
  searchResults.value = records.map((r: any) => ({
    id: r.id,
    label: r[props.displayField] || '',
  }))
  showDropdown.value = true
}

function onSearchInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  searchText.value = value

  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
  debounceTimer.value = setTimeout(() => {
    doSearch(value)
  }, 300)
}

function selectItem(item: { id: number; label: string }): void {
  emit('update:modelValue', item.id)
  searchText.value = item.label
  showDropdown.value = false
}

function onDropdownChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value === '') {
    emit('update:modelValue', null)
  } else {
    emit('update:modelValue', parseInt(value, 10))
  }
}

function onQuickCreate(): void {
  emit('quick-create')
}

onMounted(async () => {
  idColumn.value = getIdColumn(props.tableName)
  try {
    const count = await countRecords()
    if (count <= 20) {
      mode.value = 'dropdown'
      await loadAllOptions()
    } else {
      mode.value = 'search'
    }
  } catch {
    // Fallback to search mode on error
    mode.value = 'search'
  }
})

// Sync display text when modelValue changes externally in dropdown mode
watch(() => props.modelValue, (newVal) => {
  if (mode.value === 'dropdown') return
  if (newVal === null) {
    searchText.value = ''
  }
})
</script>

<template>
  <div class="search-selector">
    <!-- Loading state -->
    <select v-if="mode === 'loading'" disabled class="selector-input">
      <option>載入中...</option>
    </select>

    <!-- Dropdown mode (≤ 20 records) -->
    <select
      v-else-if="mode === 'dropdown'"
      class="selector-input"
      :value="modelValue ?? ''"
      :disabled="disabled"
      @change="onDropdownChange"
    >
      <option value="">-- 請選擇 --</option>
      <option v-for="opt in dropdownOptions" :key="opt.id" :value="opt.id">
        {{ opt.label }}
      </option>
    </select>

    <!-- Search mode (> 20 records) -->
    <template v-else>
      <input
        type="text"
        class="selector-input"
        :value="searchText"
        :disabled="disabled"
        placeholder="搜尋..."
        @input="onSearchInput"
        @focus="showDropdown = searchResults.length > 0"
        @blur="setTimeout(() => showDropdown = false, 200)"
      />

      <ul v-if="showDropdown && searchResults.length > 0" class="selector-dropdown">
        <li
          v-for="item in searchResults"
          :key="item.id"
          class="selector-item"
          @mousedown.prevent="selectItem(item)"
        >
          {{ item.label }}
        </li>
      </ul>

      <button
        v-if="quickCreate"
        type="button"
        class="quick-create-btn"
        @click="onQuickCreate"
      >
        新增
      </button>
    </template>
  </div>
</template>

<style scoped>
.search-selector {
  position: relative;
  width: 100%;
}

.selector-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.875rem;
  min-height: var(--min-touch);
}

.selector-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.selector-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 0 0 6px 6px;
  list-style: none;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.selector-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 0.875rem;
}

.selector-item:hover {
  background: rgba(99, 102, 241, 0.08);
  color: var(--color-primary);
}

.quick-create-btn {
  margin-top: 4px;
  padding: 6px 16px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  min-height: var(--min-touch);
  cursor: pointer;
}

.quick-create-btn:hover {
  background: var(--color-primary-hover);
}
</style>
