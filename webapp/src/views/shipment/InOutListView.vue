<template>
  <div class="inout-list-page">
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

    <div v-else-if="inouts.length === 0" class="empty-state">
      <p>目前沒有出貨/收貨紀錄</p>
    </div>

    <div v-else class="inout-cards">
      <div
        v-for="io in inouts"
        :key="io.id"
        class="inout-card"
        @click="goToDetail(io.id)"
      >
        <div class="card-main">
          <div class="card-docno">{{ io.DocumentNo }}</div>
          <div class="card-customer">{{ getCustomerName(io) }}</div>
        </div>
        <div class="card-meta">
          <StatusBadge :status="getDocStatus(io)" />
          <span class="card-type">{{ getTypeLabel(io) }}</span>
          <span class="card-date">{{ formatDate(io.MovementDate) }}</span>
        </div>
      </div>
    </div>

    <button class="fab" @click="goToNew"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> 新增出入庫</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listInOuts } from '@/api/inout'
import StatusBadge from '@/components/StatusBadge.vue'

type TabKey = 'all' | 'shipment' | 'receipt'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'shipment', label: '出貨' },
  { key: 'receipt', label: '收貨' },
]

const router = useRouter()

const activeTab = ref<TabKey>('all')
const inouts = ref<any[]>([])
const loading = ref(false)

function getFilterForTab(tab: TabKey): string | undefined {
  if (tab === 'shipment') return 'IsSOTrx eq true'
  if (tab === 'receipt') return 'IsSOTrx eq false'
  return undefined
}

async function loadInOuts() {
  loading.value = true
  try {
    const filter = getFilterForTab(activeTab.value)
    inouts.value = await listInOuts(filter)
  } catch {
    inouts.value = []
  } finally {
    loading.value = false
  }
}

function switchTab(tab: TabKey) {
  activeTab.value = tab
  loadInOuts()
}

function getCustomerName(io: any): string {
  const bp = io.C_BPartner_ID
  if (bp && typeof bp === 'object') {
    return bp.identifier || bp.name || '未指定客戶'
  }
  if (typeof bp === 'number' && bp > 0) {
    return `客戶 #${bp}`
  }
  return '未指定客戶'
}

function getDocStatus(io: any): string {
  if (io.DocStatus && typeof io.DocStatus === 'object') {
    return io.DocStatus.id || 'DR'
  }
  return io.DocStatus || 'DR'
}

function getTypeLabel(io: any): string {
  let isSOTrx = io.IsSOTrx
  if (isSOTrx && typeof isSOTrx === 'object') {
    isSOTrx = isSOTrx.id
  }
  return isSOTrx ? '出貨' : '收貨'
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
  router.push({ name: 'shipment-detail', params: { id } })
}

function goToNew() {
  router.push({ name: 'shipment-new' })
}

onMounted(() => {
  loadInOuts()
})
</script>

<style scoped>
.inout-list-page {
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

.inout-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.inout-card {
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
}

.inout-card:hover {
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

.card-type {
  font-size: 0.8125rem;
  color: #64748b;
}

.card-date {
  font-size: 0.8125rem;
  color: #94a3b8;
  margin-left: auto;
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
