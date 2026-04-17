<template>
  <div class="pending-page">
    <div class="page-header">
      <h2 class="page-title">待分配客戶</h2>
    </div>

    <!-- Tab navigation -->
    <div class="tab-nav">
      <button
        :class="['tab-btn', { active: activeTab === 'unassigned' }]"
        @click="activeTab = 'unassigned'"
      >
        未分配諮詢單
        <span v-if="!loadingUnassigned" class="tab-badge">{{ unassigned.length }}</span>
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'prospects' }]"
        @click="activeTab = 'prospects'"
      >
        未開單客戶
        <span v-if="!loadingProspects" class="tab-badge">{{ prospectsWithoutRequests.length }}</span>
      </button>
    </div>

    <!-- Tab 1: Unassigned Requests -->
    <div v-if="activeTab === 'unassigned'" class="tab-content">
      <div v-if="loadingUnassigned" class="loading-state">載入中...</div>
      <div v-else-if="unassigned.length === 0" class="empty-state">
        <p>目前沒有未分配的諮詢單</p>
      </div>
      <div v-else class="card-list">
        <div v-for="r in unassigned" :key="r.id" class="request-card">
          <div class="card-body">
            <div class="card-title">{{ r.Summary || '（無標題）' }}</div>
            <div class="card-meta-row">
              <span v-if="getCustomerName(r)" class="meta-customer">{{ getCustomerName(r) }}</span>
              <span class="meta-date">{{ formatDate(r.Created) }}</span>
            </div>
            <div v-if="r.DocumentNo" class="card-docno">#{{ r.DocumentNo }}</div>
          </div>
          <div class="card-actions">
            <button
              class="claim-btn"
              :disabled="claimingId === r.id"
              @click.stop="onClaim(r)"
            >
              {{ claimingId === r.id ? '認領中...' : '認領' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 2: Prospects Without Requests -->
    <div v-if="activeTab === 'prospects'" class="tab-content">
      <div v-if="loadingProspects" class="loading-state">載入中...</div>
      <div v-else-if="prospectsWithoutRequests.length === 0" class="empty-state">
        <p>目前沒有未開單的潛在客戶</p>
      </div>
      <div v-else class="card-list">
        <div v-for="bp in prospectsWithoutRequests" :key="bp.id" class="prospect-card">
          <div class="card-body">
            <div class="card-title">{{ bp.Name }}</div>
            <div class="card-meta-row">
              <span v-if="bp.Phone" class="meta-phone">{{ bp.Phone }}</span>
              <span v-if="bp.EMail" class="meta-email">{{ bp.EMail }}</span>
            </div>
            <span class="prospect-badge">潛在客戶</span>
          </div>
          <div class="card-actions">
            <button
              class="create-btn"
              @click.stop="onCreateRequest(bp)"
            >
              建立諮詢
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast notification -->
    <div v-if="toast.visible" :class="['toast', `toast--${toast.type}`]">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { listRequests, updateRequest } from '@/api/request'
import { listProspects } from '@/api/bpartner'
import { lookupCurrentUserId } from '@/api/lookup'

type TabKey = 'unassigned' | 'prospects'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<TabKey>('unassigned')
const unassigned = ref<any[]>([])
const allProspects = ref<any[]>([])
const requestCustomerIds = ref<Set<number>>(new Set())
const loadingUnassigned = ref(false)
const loadingProspects = ref(false)
const claimingId = ref<number | null>(null)

const toast = ref({ visible: false, message: '', type: 'success' as 'success' | 'error' })

// Prospects that have no consultation request yet
const prospectsWithoutRequests = computed(() =>
  allProspects.value.filter(bp => !requestCustomerIds.value.has(bp.id))
)

async function loadUnassigned() {
  loadingUnassigned.value = true
  try {
    // Fetch all requests and filter client-side — iDempiere OData null filter can be unreliable
    const all = await listRequests(undefined, 500)
    unassigned.value = all.filter(r => {
      if (r.SalesRep_ID === null || r.SalesRep_ID === undefined) return true
      if (typeof r.SalesRep_ID === 'object' && r.SalesRep_ID !== null) {
        // If expanded as object, check id field
        return !r.SalesRep_ID.id
      }
      return false
    })
  } catch {
    unassigned.value = []
  } finally {
    loadingUnassigned.value = false
  }
}

async function loadProspects() {
  loadingProspects.value = true
  try {
    // Parallel: fetch prospects + all request customer IDs
    const [prospects, allRequests] = await Promise.all([
      listProspects(200),
      listRequests(undefined, 500),
    ])

    allProspects.value = prospects

    // Build set of bpartner IDs that already have a request
    const ids = new Set<number>()
    for (const r of allRequests) {
      const bp = r.C_BPartner_ID
      if (bp && typeof bp === 'object' && bp.id) {
        ids.add(bp.id)
      } else if (typeof bp === 'number' && bp > 0) {
        ids.add(bp)
      }
    }
    requestCustomerIds.value = ids
  } catch {
    allProspects.value = []
    requestCustomerIds.value = new Set()
  } finally {
    loadingProspects.value = false
  }
}

async function onClaim(request: any) {
  if (!confirm(`確定認領 #${request.DocumentNo || request.id}?`)) return

  claimingId.value = request.id
  try {
    // Get current user's AD_User_ID
    const userName = authStore.user?.name || ''
    const userId = await lookupCurrentUserId(userName)

    if (!userId) {
      showToast('無法取得目前使用者 ID，請重新登入', 'error')
      return
    }

    await updateRequest(request.id, { SalesRep_ID: userId })
    showToast('已認領', 'success')
    // Remove from local list immediately
    unassigned.value = unassigned.value.filter(r => r.id !== request.id)
  } catch (err) {
    showToast(`認領失敗：${String(err)}`, 'error')
  } finally {
    claimingId.value = null
  }
}

function onCreateRequest(bp: any) {
  router.push({
    name: 'consultation-new',
    query: { customerId: String(bp.id) },
  })
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

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(message: string, type: 'success' | 'error') {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { visible: true, message, type }
  toastTimer = setTimeout(() => {
    toast.value.visible = false
  }, type === 'error' ? 5000 : 2000)
}

onMounted(async () => {
  await Promise.all([loadUnassigned(), loadProspects()])
})
</script>

<style scoped>
.pending-page {
  padding: 1rem;
  padding-bottom: 5rem;
  max-width: 600px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1rem;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

/* Tab navigation */
.tab-nav {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid #f1f5f9;
  padding-bottom: 0;
}

.tab-btn {
  flex: 1;
  padding: 0.625rem 0.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #94a3b8;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #64748b;
}

.tab-btn.active {
  color: #3f3f46;
  border-bottom-color: #3f3f46;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.3rem;
  background: #e2e8f0;
  color: #475569;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.tab-btn.active .tab-badge {
  background: #3f3f46;
  color: white;
}

/* Card list */
.card-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.request-card,
.prospect-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-weight: 500;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1e293b;
  margin-bottom: 0.25rem;
}

.card-meta-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.meta-customer,
.meta-date,
.meta-phone,
.meta-email {
  font-size: 0.8125rem;
  color: #64748b;
}

.card-docno {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.25rem;
}

.prospect-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: #eff6ff;
  color: #3b82f6;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.25rem;
}

.card-actions {
  flex-shrink: 0;
}

/* Claim button */
.claim-btn {
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  min-height: var(--min-touch);
  transition: background 0.15s;
}

.claim-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.claim-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Create request button */
.create-btn {
  padding: 0.5rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  min-height: var(--min-touch);
  transition: background 0.15s;
}

.create-btn:hover {
  background: #059669;
}

/* Loading / empty states */
.loading-state,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.2s ease-out;
}

.toast--success {
  background: #10b981;
  color: white;
}

.toast--error {
  background: #ef4444;
  color: white;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
