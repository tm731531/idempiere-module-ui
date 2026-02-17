<template>
  <div class="order-list-page">
    <!-- Primary: SO/PO toggle -->
    <div class="type-toggle">
      <button :class="['toggle-btn', { active: isSOTrx }]" @click="setType(true)">銷售訂單</button>
      <button :class="['toggle-btn', { active: !isSOTrx }]" @click="setType(false)">採購單</button>
    </div>

    <!-- Secondary: Status tabs -->
    <div class="filter-tabs">
      <button
        v-for="tab in statusTabs"
        :key="tab.key"
        :class="['tab-btn', { active: statusTab === tab.key }]"
        @click="switchStatus(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="loading-state">載入中...</div>

    <div v-else-if="orders.length === 0" class="empty-state">
      <p>目前沒有{{ isSOTrx ? '銷售訂單' : '採購單' }}</p>
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
          <StatusBadge :status="getDocStatus(o)" />
          <span class="card-total">${{ formatAmount(o.GrandTotal) }}</span>
          <span class="card-date">{{ formatDate(o.DateOrdered) }}</span>
        </div>
      </div>
    </div>

    <button class="fab" @click="goToNew">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
      新增{{ isSOTrx ? '銷售訂單' : '採購單' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { listOrders } from '@/api/order'
import StatusBadge from '@/components/StatusBadge.vue'

type StatusKey = 'all' | 'draft' | 'completed'

const statusTabs: { key: StatusKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'completed', label: '已完成' },
]

const router = useRouter()
const route = useRoute()

const isSOTrx = ref(true)
const statusTab = ref<StatusKey>('all')
const orders = ref<any[]>([])
const loading = ref(false)

function buildFilter(): string {
  const parts: string[] = [isSOTrx.value ? 'IsSOTrx eq true' : 'IsSOTrx eq false']
  if (statusTab.value === 'draft') parts.push("DocStatus eq 'DR'")
  else if (statusTab.value === 'completed') parts.push("DocStatus eq 'CO'")
  return parts.join(' and ')
}

async function loadOrders() {
  loading.value = true
  try {
    orders.value = await listOrders(buildFilter())
  } catch {
    orders.value = []
  } finally {
    loading.value = false
  }
}

function setType(so: boolean) {
  if (isSOTrx.value === so) return
  isSOTrx.value = so
  loadOrders()
}

function switchStatus(key: StatusKey) {
  statusTab.value = key
  loadOrders()
}

function getCustomerName(o: any): string {
  const bp = o.C_BPartner_ID
  const fallback = isSOTrx.value ? '未指定客戶' : '未指定供應商'
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
  router.push({ name: 'order-new', query: { type: isSOTrx.value ? 'so' : 'po' } })
}

onMounted(() => {
  const type = route.query.type as string
  if (type === 'po') isSOTrx.value = false
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

.type-toggle {
  display: flex;
  gap: 0;
  margin-bottom: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.toggle-btn {
  flex: 1;
  padding: 0.625rem;
  font-size: 0.9375rem;
  border: none;
  background: transparent;
  cursor: pointer;
  min-height: var(--min-touch);
  color: var(--color-text);
  transition: background 0.15s, color 0.15s;
}

.toggle-btn.active {
  background: var(--color-primary);
  color: white;
  font-weight: 600;
}

.toggle-btn:not(.active):hover {
  background: rgba(99, 102, 241, 0.06);
}

.filter-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tab-btn {
  flex: 1;
  padding: 0.375rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  font-size: 0.8125rem;
  min-height: 36px;
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
