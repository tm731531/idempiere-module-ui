<template>
  <div class="production-list-page">
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

    <div v-else-if="productions.length === 0" class="empty-state">
      <p>目前沒有療程紀錄</p>
    </div>

    <div v-else class="production-cards">
      <div
        v-for="p in productions"
        :key="p.id"
        class="production-card"
        @click="goToDetail(p.id)"
      >
        <div class="card-main">
          <div class="card-docno">{{ p.DocumentNo }}</div>
          <div class="card-product">{{ getProductName(p) }}</div>
        </div>
        <div class="card-meta">
          <StatusBadge :status="getDocStatus(p)" />
          <span class="card-qty">數量: {{ p.ProductionQty }}</span>
          <span class="card-date">{{ formatDate(p.MovementDate) }}</span>
        </div>
        <div v-if="p.Description" class="card-desc">{{ p.Description }}</div>
      </div>
    </div>

    <button class="fab" @click="goToNew">新增療程</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listProductions } from '@/api/production'
import StatusBadge from '@/components/StatusBadge.vue'

type TabKey = 'all' | 'draft' | 'completed'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'completed', label: '已完成' },
]

const router = useRouter()

const activeTab = ref<TabKey>('all')
const productions = ref<any[]>([])
const loading = ref(false)

function getFilterForTab(tab: TabKey): string | undefined {
  if (tab === 'draft') return "DocStatus eq 'DR'"
  if (tab === 'completed') return "DocStatus eq 'CO'"
  return undefined
}

async function loadProductions() {
  loading.value = true
  try {
    const filter = getFilterForTab(activeTab.value)
    productions.value = await listProductions(filter)
  } catch {
    productions.value = []
  } finally {
    loading.value = false
  }
}

function switchTab(tab: TabKey) {
  activeTab.value = tab
  loadProductions()
}

function getProductName(p: any): string {
  if (p.M_Product_ID && typeof p.M_Product_ID === 'object') {
    return p.M_Product_ID.identifier || '未指定療程'
  }
  return '未指定療程'
}

function getDocStatus(p: any): string {
  if (p.DocStatus && typeof p.DocStatus === 'object') {
    return p.DocStatus.id || 'DR'
  }
  return p.DocStatus || 'DR'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function goToDetail(id: number) {
  router.push({ name: 'treatment-detail', params: { id } })
}

function goToNew() {
  router.push({ name: 'treatment-new' })
}

onMounted(() => {
  loadProductions()
})
</script>

<style scoped>
.production-list-page {
  padding: 1rem;
  padding-bottom: 5rem;
  max-width: 600px;
  margin: 0 auto;
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

.production-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.production-card {
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
}

.production-card:hover {
  border-color: var(--color-primary);
  background: #f8fafc;
}

.card-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.card-docno {
  font-weight: 600;
  font-size: 1rem;
}

.card-product {
  color: #64748b;
  font-size: 0.875rem;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.card-qty {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-text);
  margin-left: auto;
}

.card-date {
  font-size: 0.8125rem;
  color: #94a3b8;
}

.card-desc {
  margin-top: 0.375rem;
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
}

.fab:hover {
  background: var(--color-primary-hover);
}
</style>
