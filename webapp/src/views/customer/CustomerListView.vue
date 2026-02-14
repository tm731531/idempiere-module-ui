<template>
  <div class="customer-list-page">
    <div class="search-bar">
      <input
        v-model="query"
        type="text"
        placeholder="搜尋姓名、身分證或電話..."
        class="search-input"
        @input="onSearchInput"
      />
    </div>

    <div v-if="loading" class="loading-state">搜尋中...</div>

    <div v-else-if="customers.length === 0" class="empty-state">
      <p>{{ query ? '找不到符合條件的客戶' : '請輸入關鍵字搜尋客戶' }}</p>
    </div>

    <div v-else class="customer-cards">
      <div
        v-for="c in customers"
        :key="c.id"
        class="customer-card"
        @click="goToDetail(c.id)"
      >
        <div class="card-name">{{ c.Name }}</div>
        <div v-if="c.TaxID" class="card-taxid">{{ c.TaxID }}</div>
      </div>
    </div>

    <button class="fab" @click="goToNew"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> 新增客戶</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { searchCustomers } from '@/api/bpartner'

const router = useRouter()

const query = ref('')
const customers = ref<any[]>([])
const loading = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    doSearch()
  }, 300)
}

async function doSearch() {
  const q = query.value.trim()
  if (!q) {
    customers.value = []
    return
  }
  loading.value = true
  try {
    customers.value = await searchCustomers(q)
  } catch {
    customers.value = []
  } finally {
    loading.value = false
  }
}

function goToDetail(id: number) {
  router.push({ name: 'customer-detail', params: { id } })
}

function goToNew() {
  router.push({ name: 'customer-new' })
}
</script>

<style scoped>
.customer-list-page {
  padding: 1rem;
  padding-bottom: 5rem;
  max-width: 600px;
  margin: 0 auto;
}

.search-bar {
  margin-bottom: 1rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1rem;
  min-height: var(--min-touch);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.customer-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.customer-card {
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.customer-card:hover {
  border-color: var(--color-primary);
  background: #f8fafc;
}

.card-name {
  font-weight: 500;
  flex: 1;
}

.card-taxid {
  color: #64748b;
  font-size: 0.875rem;
}

.fab {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 24px;
  font-size: 1rem;
  min-height: var(--min-touch);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.fab:hover {
  background: var(--color-primary-hover);
}
</style>
