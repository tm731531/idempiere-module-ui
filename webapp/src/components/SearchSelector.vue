<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { escapeODataString } from '@/api/utils'

const props = withDefaults(defineProps<{
  modelValue: number | null
  tableName: string
  displayField: string
  searchField: string
  filter?: string
  quickCreate?: boolean
  quickCreateDefaults?: Record<string, any>
  disabled?: boolean
}>(), {
  quickCreate: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  'quick-create': []
}>()

const authStore = useAuthStore()

const mode = ref<'loading' | 'dropdown' | 'search'>('loading')
const dropdownOptions = ref<{ id: number; label: string }[]>([])
const searchText = ref('')
const searchResults = ref<{ id: number; label: string }[]>([])
const showDropdown = ref(false)
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const idColumn = ref('')

// Inline quick create state
const showQuickCreate = ref(false)
const quickCreateName = ref('')
const quickCreating = ref(false)
const quickCreateError = ref('')

function getIdColumn(tableName: string): string {
  return `${tableName}_ID`
}

function buildFilter(extra?: string): string {
  const parts: string[] = ['IsActive eq true']
  if (props.filter) parts.push(props.filter)
  if (extra) parts.push(extra)
  return parts.join(' and ')
}

async function countRecords(): Promise<number> {
  const params: Record<string, string> = {
    '$top': '0',
    '$count': 'true',
    '$filter': buildFilter(),
  }
  const resp = await apiClient.get(`/api/v1/models/${props.tableName}`, { params })
  return resp.data['row-count'] || 0
}

async function loadAllOptions(): Promise<void> {
  const params: Record<string, string> = {
    '$select': `${idColumn.value},${props.displayField}`,
    '$orderby': props.displayField,
    '$filter': buildFilter(),
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
  const filterStr = buildFilter(`contains(${props.searchField},'${safe}')`)

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

function onSearchBlur(): void {
  window.setTimeout(() => { showDropdown.value = false }, 200)
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

function toggleQuickCreate(): void {
  showQuickCreate.value = !showQuickCreate.value
  quickCreateError.value = ''
  if (showQuickCreate.value) {
    quickCreateName.value = ''
  }
}

async function handleQuickCreate(): Promise<void> {
  if (!quickCreateName.value.trim()) return
  quickCreating.value = true
  quickCreateError.value = ''
  try {
    const orgId = authStore.context?.organizationId ?? 0
    const payload: Record<string, any> = {
      AD_Org_ID: orgId,
      Name: quickCreateName.value.trim(),
      ...(props.quickCreateDefaults || {}),
    }
    const resp = await apiClient.post(`/api/v1/models/${props.tableName}`, payload)
    const newId = resp.data.id

    // Auto-select the new record
    emit('update:modelValue', newId)

    // Refresh options list
    if (mode.value === 'dropdown') {
      await loadAllOptions()
    } else {
      searchText.value = quickCreateName.value.trim()
    }

    // Close quick create
    showQuickCreate.value = false
    quickCreateName.value = ''
  } catch {
    quickCreateError.value = '新增失敗'
  } finally {
    quickCreating.value = false
  }
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
    <template v-else-if="mode === 'dropdown'">
      <div class="selector-row">
        <select
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
        <button
          v-if="quickCreate && !disabled"
          type="button"
          class="inline-create-toggle"
          :title="showQuickCreate ? '取消' : '新增選項'"
          @click="toggleQuickCreate"
        >
          {{ showQuickCreate ? '×' : '+' }}
        </button>
      </div>
    </template>

    <!-- Search mode (> 20 records) -->
    <template v-else>
      <div class="selector-row">
        <input
          type="text"
          class="selector-input"
          :value="searchText"
          :disabled="disabled"
          placeholder="搜尋..."
          @input="onSearchInput"
          @focus="showDropdown = searchResults.length > 0"
          @blur="onSearchBlur"
        />
        <button
          v-if="quickCreate && !disabled"
          type="button"
          class="inline-create-toggle"
          :title="showQuickCreate ? '取消' : '新增選項'"
          @click="toggleQuickCreate"
        >
          {{ showQuickCreate ? '×' : '+' }}
        </button>
      </div>

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
    </template>

    <!-- Inline quick create form -->
    <div v-if="showQuickCreate" class="quick-create-inline">
      <input
        v-model="quickCreateName"
        type="text"
        class="qc-input"
        placeholder="輸入名稱..."
        @keyup.enter="handleQuickCreate"
      />
      <button
        type="button"
        class="qc-btn"
        :disabled="!quickCreateName.trim() || quickCreating"
        @click="handleQuickCreate"
      >
        {{ quickCreating ? '...' : '新增' }}
      </button>
      <div v-if="quickCreateError" class="qc-error">{{ quickCreateError }}</div>
    </div>
  </div>
</template>

<style scoped>
.search-selector {
  position: relative;
  width: 100%;
}

.selector-row {
  display: flex;
  gap: 4px;
}

.selector-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.875rem;
  min-height: var(--min-touch);
  min-width: 0;
}

.selector-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.inline-create-toggle {
  width: var(--min-touch);
  min-height: var(--min-touch);
  border: 1px solid var(--color-primary);
  border-radius: 6px;
  background: transparent;
  color: var(--color-primary);
  font-size: 1.25rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.inline-create-toggle:hover {
  background: rgba(99, 102, 241, 0.08);
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

.quick-create-inline {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.qc-input {
  flex: 1;
  min-width: 100px;
  padding: 6px 10px;
  border: 1px solid var(--color-primary);
  border-radius: 6px;
  font-size: 0.8125rem;
  min-height: var(--min-touch);
}

.qc-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.qc-btn {
  padding: 6px 12px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  min-height: var(--min-touch);
  cursor: pointer;
  white-space: nowrap;
}

.qc-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.qc-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.qc-error {
  width: 100%;
  font-size: 0.75rem;
  color: var(--color-error);
  margin-top: 2px;
}
</style>
