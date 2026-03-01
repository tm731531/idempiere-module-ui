<template>
  <div class="request-list-page">
    <!-- View mode tabs: List vs Dashboard -->
    <div class="view-tabs">
      <button
        :class="['view-tab', { active: viewMode === 'list' }]"
        @click="viewMode = 'list'"
      >
        📋 列表
      </button>
      <button
        :class="['view-tab', { active: viewMode === 'dashboard' }]"
        @click="viewMode = 'dashboard'"
      >
        📊 儀表板
      </button>
    </div>

    <!-- List View -->
    <div v-if="viewMode === 'list'" class="list-view">
      <!-- Operator Filter Banner -->
      <div v-if="filterOperatorId" class="operator-filter-banner">
        <span>篩選: {{ filterOperatorName }}</span>
        <button class="clear-filter-btn" @click="clearOperatorFilter">清除篩選</button>
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

      <div v-else-if="requests.length === 0" class="empty-state">
        <p>目前沒有諮詢紀錄</p>
      </div>

      <div v-else class="request-cards">
        <div
          v-for="r in requests"
          :key="r.id"
          class="request-card"
          @click="goToEdit(r)"
        >
          <div class="card-main">
            <div class="card-summary-title">{{ r.Summary }}</div>
            <div v-if="getCustomerName(r)" class="card-customer">{{ getCustomerName(r) }}</div>
          </div>
          <div class="card-meta">
            <span class="card-status">{{ getStatusName(r) }}</span>
            <span
              v-if="isConverted(r)"
              class="conversion-badge"
              :title="`訂單: ${getOrderNo(r)}`"
            >
              ✓ 已轉化
            </span>
            <span class="card-date">{{ formatDate(r.Created) }}</span>
          </div>
        </div>
      </div>

      <button class="fab" @click="goToNew"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> 新增諮詢</button>
    </div>

    <!-- Dashboard View -->
    <div v-else class="dashboard-view">
      <div v-if="dashboardLoading" class="loading-state">載入儀表板中...</div>
      <ConversionMetrics v-else :requests="allRequests" :operatorNames="operatorNames" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { listRequests } from '@/api/request'
import { getSysConfig } from '@/api/sysconfig'
import ConversionMetrics from '@/components/ConversionMetrics.vue'

type TabKey = string // Now dynamic based on SysConfig
type ViewMode = 'list' | 'dashboard'

const tabs = ref<{ key: TabKey; label: string }[]>([
  { key: 'all', label: '全部' },
])

const router = useRouter()
const route = useRoute()

const viewMode = ref<ViewMode>('list')
const activeTab = ref<TabKey>('all')
const requests = ref<any[]>([])
const allRequests = ref<any[]>([])
const customStatuses = ref<string[]>([]) // 自定義狀態列表
const operatorNames = ref<Record<number, string>>({})
const loading = ref(false)
const dashboardLoading = ref(false)

// 從 query 參數獲取操作人過濾
const filterOperatorId = computed(() => {
  const id = route.query.filterOperatorId
  return id ? Number(id) : null
})
const filterOperatorName = computed(() => route.query.filterOperatorName as string || null)

function filterRequestsByStatus(allReqs: any[], statusName: string): any[] {
  let filtered = allReqs

  // Filter by status
  if (statusName !== 'all') {
    filtered = filtered.filter(r => r.LastResult === statusName)
  }

  // Filter by operator (if specified)
  if (filterOperatorId.value) {
    filtered = filtered.filter(r => {
      // Check if UpdatedBy matches the operator ID
      let updatedById: number | null = null
      if (r.UpdatedBy && typeof r.UpdatedBy === 'object') {
        updatedById = r.UpdatedBy.id
      } else if (typeof r.UpdatedBy === 'number') {
        updatedById = r.UpdatedBy
      }
      return updatedById === filterOperatorId.value
    })
  }

  return filtered
}

async function loadRequests() {
  loading.value = true
  try {
    const allReqs = await listRequests()
    console.log('📊 Loaded requests:', allReqs.length, 'Filter operator ID:', filterOperatorId.value)
    if (allReqs.length > 0) {
      console.log('📋 Sample request UpdatedBy:', allReqs[0].UpdatedBy)
    }
    requests.value = filterRequestsByStatus(allReqs, activeTab.value)
    console.log('✅ Filtered requests:', requests.value.length)
  } catch {
    requests.value = []
  } finally {
    loading.value = false
  }
}

async function loadAllRequests() {
  dashboardLoading.value = true
  try {
    // Load all requests without filter for dashboard
    allRequests.value = await listRequests()
  } catch {
    allRequests.value = []
  } finally {
    dashboardLoading.value = false
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
  // Display LastResult field (status name)
  return r.LastResult || ''
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 檢查咨詢是否已轉化（基於 LastResult 欄位）
function isConverted(r: any): boolean {
  const completedStatuses = ['已完成', 'Closed', '已轉化', 'Completed']
  return r.LastResult && completedStatuses.includes(r.LastResult)
}

// 取得關聯的訂單號
function getOrderNo(r: any): string {
  // TODO: Implement once we have proper activity storage
  return ''
}

function goToEdit(r: any) {
  router.push({
    name: 'consultation-edit',
    params: { id: r.id },
    state: { preloadedData: r }
  })
}

function goToNew() {
  router.push({ name: 'consultation-new' })
}

function clearOperatorFilter() {
  router.push({ name: 'consultation-list' })
}

// 監聽操作人過濾變化，重新加載列表
watch(
  () => filterOperatorId.value,
  () => {
    loadRequests()
  }
)

onMounted(async () => {
  // Load available statuses from SysConfig
  const configValue = await getSysConfig('MobileSettingConfig')
  if (configValue) {
    try {
      const statuses = JSON.parse(configValue)
      // Extract status names for dashboard
      customStatuses.value = statuses.map((s: any) => s.Name || s)
      // Add status tabs (keep 'all' as first tab)
      tabs.value = [
        { key: 'all', label: '全部' },
        ...statuses.map((s: any) => ({
          key: s.Name || s,
          label: s.Name || s,
        })),
      ]
    } catch (e) {
      // Ignore parse errors
    }
  }

  loadRequests()
  loadAllRequests()  // Pre-load all requests for dashboard
})
</script>

<style scoped>
.request-list-page {
  padding: 1rem;
  padding-bottom: 5rem;
  max-width: 600px;
  margin: 0 auto;
}

/* View mode tabs (List vs Dashboard) */
.view-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid #f1f5f9;
}

.view-tab {
  flex: 1;
  padding: 0.75rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #94a3b8;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
  margin-bottom: -2px;
}

.view-tab:hover {
  color: #64748b;
}

.view-tab.active {
  color: #3f3f46;
  border-bottom-color: #3f3f46;
}

.list-view,
.dashboard-view {
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

.conversion-badge {
  display: inline-block;
  background: #10b981;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 0.5rem;
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

.operator-filter-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  background: #e3f2fd;
  border-left: 4px solid var(--color-primary);
  border-radius: 4px;
  font-size: 0.9375rem;
  color: #1565c0;
}

.clear-filter-btn {
  padding: 0.375rem 0.75rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-filter-btn:hover {
  background: var(--color-primary-hover);
}
</style>
