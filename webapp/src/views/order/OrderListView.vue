<template>
  <div class="order-list-page">
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

    <div v-else-if="orders.length === 0" class="empty-state">
      <p>目前沒有訂單</p>
    </div>

    <div v-else class="order-cards">
      <div
        v-for="o in orders"
        :key="o.id"
        class="order-card"
        @click="goToDetail(o.id)"
      >
        <div class="card-main">
          <div class="card-docno">{{ o.DocumentNo }}</div>
          <div class="card-customer">{{ getCustomerName(o) }}</div>
        </div>
        <div class="card-meta">
          <span :class="['sotrx-chip', o.IsSOTrx !== false ? 'so' : 'po']">
            {{ o.IsSOTrx !== false ? '銷售' : '採購' }}
          </span>
          <StatusBadge :status="getDocStatus(o)" />
          <span class="card-total">${{ formatAmount(o.GrandTotal) }}</span>
          <span class="card-date">{{ formatDate(o.DateOrdered) }}</span>
        </div>
      </div>
    </div>

    <button class="fab" @click="goToNew"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> 新增訂單</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listOrders } from '@/api/order'
import StatusBadge from '@/components/StatusBadge.vue'

type TabKey = 'all' | 'draft' | 'completed'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'completed', label: '已完成' },
]

const router = useRouter()

const activeTab = ref<TabKey>('all')
const orders = ref<any[]>([])
const loading = ref(false)

function getFilterForTab(tab: TabKey): string | undefined {
  if (tab === 'draft') return "DocStatus eq 'DR'"
  if (tab === 'completed') return "DocStatus eq 'CO'"
  return undefined
}

async function loadOrders() {
  loading.value = true
  try {
    const filter = getFilterForTab(activeTab.value)
    orders.value = await listOrders(filter)
  } catch {
    orders.value = []
  } finally {
    loading.value = false
  }
}

function switchTab(tab: TabKey) {
  activeTab.value = tab
  loadOrders()
}

function getCustomerName(o: any): string {
  const bp = o.C_BPartner_ID
  const fallback = o.IsSOTrx !== false ? '未指定客戶' : '未指定供應商'
  if (bp && typeof bp === 'object') {
    return bp.identifier || bp.Name || fallback
  }
  if (typeof bp === 'number' && bp > 0) {
    return `#${bp}`
  }
  return fallback
}

function getDocStatus(o: any): string {
  if (o.DocStatus && typeof o.DocStatus === 'object') {
    return o.DocStatus.id || 'DR'
  }
  return o.DocStatus || 'DR'
}

function formatAmount(val: any): string {
  if (val === null || val === undefined) return '0'
  return Number(val).toLocaleString()
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
  router.push({ name: 'order-detail', params: { id } })
}

function goToNew() {
  router.push({ name: 'order-new' })
}

onMounted(() => {
  loadOrders()
})
</script>

<style scoped>
.order-list-page {
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

.order-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.order-card {
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
}

.order-card:hover {
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

.card-customer {
  color: #64748b;
  font-size: 0.875rem;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.card-total {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-text);
  margin-left: auto;
}

.card-date {
  font-size: 0.8125rem;
  color: #94a3b8;
}

.sotrx-chip {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
}

.sotrx-chip.so {
  background: #eff6ff;
  color: #2563eb;
}

.sotrx-chip.po {
  background: #fefce8;
  color: #ca8a04;
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
