<template>
  <div class="payment-list-page">
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

    <div v-else-if="payments.length === 0" class="empty-state">
      <p>目前沒有收款紀錄</p>
    </div>

    <div v-else class="payment-cards">
      <div
        v-for="p in payments"
        :key="p.id"
        class="payment-card"
        @click="goToDetail(p.id)"
      >
        <div class="card-main">
          <div class="card-docno">{{ p.DocumentNo }}</div>
          <div class="card-customer">{{ getCustomerName(p) }}</div>
        </div>
        <div class="card-meta">
          <StatusBadge :status="getDocStatus(p)" />
          <span class="card-tender">{{ getTenderLabel(p) }}</span>
          <span class="card-amount">${{ formatAmount(p.PayAmt) }}</span>
          <span class="card-date">{{ formatDate(p.DateTrx) }}</span>
        </div>
      </div>
    </div>

    <button class="fab" @click="goToNew">新增收款</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listPayments, TENDER_TYPES } from '@/api/payment'
import StatusBadge from '@/components/StatusBadge.vue'

type TabKey = 'all' | 'draft' | 'completed'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'completed', label: '已完成' },
]

const router = useRouter()

const activeTab = ref<TabKey>('all')
const payments = ref<any[]>([])
const loading = ref(false)

function getFilterForTab(tab: TabKey): string | undefined {
  if (tab === 'draft') return "DocStatus eq 'DR'"
  if (tab === 'completed') return "DocStatus eq 'CO'"
  return undefined
}

async function loadPayments() {
  loading.value = true
  try {
    const filter = getFilterForTab(activeTab.value)
    payments.value = await listPayments(filter)
  } catch {
    payments.value = []
  } finally {
    loading.value = false
  }
}

function switchTab(tab: TabKey) {
  activeTab.value = tab
  loadPayments()
}

function getCustomerName(p: any): string {
  if (p.C_BPartner_ID && typeof p.C_BPartner_ID === 'object') {
    return p.C_BPartner_ID.identifier || '未指定客戶'
  }
  return '未指定客戶'
}

function getDocStatus(p: any): string {
  if (p.DocStatus && typeof p.DocStatus === 'object') {
    return p.DocStatus.id || 'DR'
  }
  return p.DocStatus || 'DR'
}

function getTenderLabel(p: any): string {
  let code = p.TenderType
  if (code && typeof code === 'object') {
    code = code.id
  }
  const found = TENDER_TYPES.find(t => t.value === code)
  return found ? found.label : code || ''
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
  router.push({ name: 'payment-detail', params: { id } })
}

function goToNew() {
  router.push({ name: 'payment-new' })
}

onMounted(() => {
  loadPayments()
})
</script>

<style scoped>
.payment-list-page {
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

.payment-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.payment-card {
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
}

.payment-card:hover {
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

.card-tender {
  font-size: 0.8125rem;
  color: #64748b;
}

.card-amount {
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
