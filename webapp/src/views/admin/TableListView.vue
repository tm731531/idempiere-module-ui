<template>
  <div class="table-list-page">
    <!-- Search -->
    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="搜尋 Table（名稱或代碼）..."
        @input="handleSearch"
      />
      <button v-if="searchQuery" class="clear-btn" @click="clearSearch">清除</button>
    </div>

    <!-- Mode indicator -->
    <div class="mode-indicator">
      <span v-if="!searchQuery">App 常用 Table ({{ tables.length }})</span>
      <span v-else>搜尋結果 ({{ tables.length }})</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">載入中...</div>

    <!-- Table list -->
    <div v-else-if="tables.length > 0" class="table-grid">
      <div
        v-for="t in tables"
        :key="t.id"
        class="table-card"
        :class="{ 'app-table': t.isAppTable }"
        @click="goToColumns(t)"
      >
        <div class="table-name">{{ t.tableName }}</div>
        <div class="table-desc">{{ t.name }}</div>
        <div v-if="t.isAppTable" class="app-badge">APP</div>
      </div>
    </div>

    <div v-else class="empty-state">
      {{ searchQuery ? '找不到符合的 Table' : '沒有資料' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listAppTables, searchTables, type TableInfo } from '@/api/dictionary'

const router = useRouter()
const tables = ref<TableInfo[]>([])
const loading = ref(false)
const searchQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  loading.value = true
  try {
    tables.value = await listAppTables()
  } catch {
    tables.value = []
  } finally {
    loading.value = false
  }
})

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    if (!searchQuery.value.trim()) {
      loading.value = true
      try {
        tables.value = await listAppTables()
      } finally {
        loading.value = false
      }
      return
    }
    loading.value = true
    try {
      tables.value = await searchTables(searchQuery.value.trim())
    } catch {
      tables.value = []
    } finally {
      loading.value = false
    }
  }, 300)
}

function clearSearch() {
  searchQuery.value = ''
  handleSearch()
}

function goToColumns(t: TableInfo) {
  router.push({ name: 'table-columns', params: { tableId: t.id }, query: { name: t.tableName } })
}
</script>

<style scoped>
.table-list-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
}

.search-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.search-input {
  flex: 1;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.9375rem;
  min-height: var(--min-touch);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.clear-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  min-height: var(--min-touch);
}

.mode-indicator {
  font-size: 0.8125rem;
  color: #64748b;
  margin-bottom: 0.75rem;
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.table-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.table-card {
  position: relative;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.table-card:hover {
  border-color: var(--color-primary);
}

.table-card.app-table {
  border-left: 3px solid var(--color-primary);
}

.table-name {
  font-size: 0.9375rem;
  font-weight: 600;
  font-family: monospace;
}

.table-desc {
  font-size: 0.8125rem;
  color: #64748b;
  margin-top: 0.125rem;
}

.app-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.75rem;
  font-size: 0.625rem;
  font-weight: 700;
  background: var(--color-primary);
  color: white;
  padding: 0.0625rem 0.375rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
}
</style>
