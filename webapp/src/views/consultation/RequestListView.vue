<template>
  <div class="request-list-page">
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

    <div v-else-if="requests.length === 0" class="empty-state">
      <p>目前沒有諮詢紀錄</p>
    </div>

    <div v-else class="request-cards">
      <div
        v-for="r in requests"
        :key="r.id"
        class="request-card"
        @click="goToEdit(r.id)"
      >
        <div class="card-main">
          <div class="card-summary-title">{{ r.Summary }}</div>
          <div v-if="getCustomerName(r)" class="card-customer">{{ getCustomerName(r) }}</div>
        </div>
        <div class="card-meta">
          <span class="card-status">{{ getStatusName(r) }}</span>
          <span class="card-date">{{ formatDate(r.Created) }}</span>
        </div>
      </div>
    </div>

    <button class="fab" @click="goToNew"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> 新增諮詢</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listRequests } from '@/api/request'

type TabKey = 'all' | 'active' | 'done'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '進行中' },
  { key: 'done', label: '已完成' },
]

const router = useRouter()

const activeTab = ref<TabKey>('all')
const requests = ref<any[]>([])
const loading = ref(false)

function getFilterForTab(tab: TabKey): string | undefined {
  if (tab === 'active') return 'Processed eq false'
  if (tab === 'done') return 'Processed eq true'
  return undefined
}

async function loadRequests() {
  loading.value = true
  try {
    const filter = getFilterForTab(activeTab.value)
    requests.value = await listRequests(filter)
  } catch {
    requests.value = []
  } finally {
    loading.value = false
  }
}

function switchTab(tab: TabKey) {
  activeTab.value = tab
  loadRequests()
}

function getCustomerName(r: any): string {
  const bp = r.C_BPartner_ID
  if (bp && typeof bp === 'object') {
    return bp.Name || bp.identifier || ''
  }
  if (typeof bp === 'number' && bp > 0) {
    return `客戶 #${bp}`
  }
  return ''
}

function getStatusName(r: any): string {
  if (r.R_Status_ID && typeof r.R_Status_ID === 'object') {
    return r.R_Status_ID.identifier || ''
  }
  return ''
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function goToEdit(id: number) {
  router.push({ name: 'consultation-edit', params: { id } })
}

function goToNew() {
  router.push({ name: 'consultation-new' })
}

onMounted(() => {
  loadRequests()
})
</script>

<style scoped>
.request-list-page {
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

.request-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.request-card {
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
}

.request-card:hover {
  border-color: var(--color-primary);
  background: #f8fafc;
}

.card-main {
  margin-bottom: 0.5rem;
}

.card-summary-title {
  font-weight: 500;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-customer {
  color: #64748b;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-status {
  font-size: 0.8125rem;
  color: var(--color-primary);
  background: rgba(99, 102, 241, 0.08);
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
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
