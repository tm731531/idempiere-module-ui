<template>
  <div class="product-list-page">
    <div class="search-box">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="搜尋商品名稱..."
        @input="onSearchInput"
      />
    </div>

    <div class="filter-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="loading-state">載入中...</div>

    <div v-else-if="products.length === 0" class="empty-state">
      <p>目前沒有商品</p>
    </div>

    <div v-else class="product-cards">
      <div
        v-for="p in products"
        :key="p.id"
        class="product-card"
        @click="goToDetail(p.id)"
      >
        <div class="card-main">
          <div class="card-name">{{ p.Name }}</div>
          <div class="card-badges">
            <span v-if="p.IsBOM === true || p.IsBOM === 'Y'" class="badge bom">療程</span>
            <span v-if="p.IsActive === false || p.IsActive === 'N'" class="badge inactive">停用</span>
          </div>
        </div>
        <div class="card-meta">
          <span class="card-value">{{ p.Value }}</span>
          <span v-if="getCategoryName(p)" class="card-category">{{ getCategoryName(p) }}</span>
          <span v-if="getUomName(p)" class="card-uom">{{ getUomName(p) }}</span>
        </div>
        <div v-if="p.Description" class="card-desc">{{ p.Description }}</div>
      </div>
    </div>

    <button class="fab" @click="goToNew">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
      新增商品
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listProducts } from '@/api/product'
import { escapeODataString } from '@/api/utils'

type TabKey = 'all' | 'bom' | 'general'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'bom', label: '療程' },
  { key: 'general', label: '一般商品' },
]

const router = useRouter()

const activeTab = ref<TabKey>('all')
const products = ref<any[]>([])
const loading = ref(false)
const searchQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

function buildFilter(): string | undefined {
  const parts: string[] = []

  if (activeTab.value === 'bom') parts.push('IsBOM eq true')
  if (activeTab.value === 'general') parts.push('IsBOM eq false')

  if (searchQuery.value.trim()) {
    const escaped = escapeODataString(searchQuery.value.trim())
    parts.push(`contains(Name,'${escaped}')`)
  }

  return parts.length > 0 ? parts.join(' AND ') : undefined
}

async function loadProducts() {
  loading.value = true
  try {
    products.value = await listProducts(buildFilter())
  } catch {
    products.value = []
  } finally {
    loading.value = false
  }
}

function switchTab(tab: TabKey) {
  activeTab.value = tab
  loadProducts()
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadProducts(), 300)
}

function getCategoryName(p: any): string {
  if (p.M_Product_Category_ID && typeof p.M_Product_Category_ID === 'object') {
    return p.M_Product_Category_ID.identifier || p.M_Product_Category_ID.Name || ''
  }
  return ''
}

function getUomName(p: any): string {
  if (p.C_UOM_ID && typeof p.C_UOM_ID === 'object') {
    return p.C_UOM_ID.identifier || p.C_UOM_ID.Name || ''
  }
  return ''
}

function goToDetail(id: number) {
  router.push({ name: 'product-detail', params: { id } })
}

function goToNew() {
  router.push({ name: 'product-new' })
}

onMounted(() => {
  loadProducts()
})
</script>

<style scoped>
.product-list-page {
  padding: 1rem;
  padding-bottom: 5rem;
  max-width: 600px;
  margin: 0 auto;
}

.search-box {
  margin-bottom: 0.75rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1rem;
  min-height: var(--min-touch);
}

.filter-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tab-btn {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  font-size: 0.875rem;
  min-height: var(--min-touch);
  cursor: pointer;
}

.tab-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.product-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.product-card {
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
}

.product-card:hover {
  border-color: var(--color-primary);
  background: #f8fafc;
}

.card-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.card-name {
  font-weight: 600;
  font-size: 1rem;
}

.card-badges {
  display: flex;
  gap: 0.375rem;
}

.badge {
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge.bom {
  background: #dbeafe;
  color: #1d4ed8;
}

.badge.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: #64748b;
}

.card-value {
  font-family: monospace;
}

.card-desc {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.fab:hover {
  background: var(--color-primary-hover);
}
</style>
