<template>
  <div class="payment-list-page">
    <!-- Primary: AR/AP toggle -->
    <div class="type-toggle">
      <button :class="['toggle-btn', { active: isReceipt }]" @click="setType(true)">收款 (AR)</button>
      <button :class="['toggle-btn', { active: !isReceipt }]" @click="setType(false)">付款 (AP)</button>
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

    <div v-else-if="payments.length === 0" class="empty-state">
      <p>目前沒有{{ isReceipt ? '收款' : '付款' }}紀錄</p>
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

    <button class="fab" @click="goToNew">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
      新增{{ isReceipt ? '收款' : '付款' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { listPayments, TENDER_TYPES } from '@/api/payment'
import StatusBadge from '@/components/StatusBadge.vue'

type StatusKey = 'all' | 'draft' | 'completed'

const statusTabs: { key: StatusKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'completed', label: '已完成' },
]

const router = useRouter()
const route = useRoute()

const isReceipt = ref(true)
const statusTab = ref<StatusKey>('all')
const payments = ref<any[]>([])
const loading = ref(false)

function buildFilter(): string {
  const parts: string[] = [isReceipt.value ? 'IsReceipt eq true' : 'IsReceipt eq false']
  if (statusTab.value === 'draft') parts.push("DocStatus eq 'DR'")
  else if (statusTab.value === 'completed') parts.push("DocStatus eq 'CO'")
  return parts.join(' and ')
}

async function loadPayments() {
  loading.value = true
  try {
    payments.value = await listPayments(buildFilter())
  } catch {
    payments.value = []
  } finally {
    loading.value = false
  }
}

function setType(receipt: boolean) {
  if (isReceipt.value === receipt) return
  isReceipt.value = receipt
  loadPayments()
}

function switchStatus(key: StatusKey) {
  statusTab.value = key
  loadPayments()
}

function getCustomerName(p: any): string {
  const bp = p.C_BPartner_ID
  const fallback = isReceipt.value ? '未指定客戶' : '未指定供應商'
  if (bp && typeof bp === 'object') {
    return bp.identifier || bp.Name || bp.name || fallback
  }
  if (typeof bp === 'number' && bp > 0) {
    return `#${bp}`
  }
  return fallback
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
  router.push({ name: 'payment-new', query: { type: isReceipt.value ? 'ar' : 'ap' } })
}

onMounted(() => {
  const type = route.query.type as string
  if (type === 'ap') isReceipt.value = false
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
