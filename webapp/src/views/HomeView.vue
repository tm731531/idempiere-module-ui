<template>
  <div class="home-page">
    <!-- Header -->
    <header class="home-header">
      <div class="header-info">
        <span class="user-name">{{ auth.user?.name || '' }}</span>
        <span class="role-badge">{{ auth.context?.roleName || '' }}</span>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" @click="handleSwitchContext"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M4 4l17 17"/></svg> 切換</button>
        <button class="btn-secondary btn-logout" @click="handleLogout"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg> 登出</button>
      </div>
    </header>

    <!-- Module grid -->
    <div class="module-grid">
      <div
        v-for="card in visibleCards"
        :key="card.route"
        class="module-card"
        @click="navigate(card.route)"
      >
        <div class="card-label">{{ card.label }}</div>
        <div class="card-desc">{{ card.desc }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermission } from '@/composables/usePermission'

const auth = useAuthStore()
const router = useRouter()
const { canAccess, loadPermissions } = usePermission()

interface ModuleCard {
  label: string
  desc: string
  route: string
  pageKey: string | null
  adminOnly: boolean
}

const allCards: ModuleCard[] = [
  { label: '客戶管理', desc: '管理客戶資料', route: '/customer', pageKey: 'customer', adminOnly: false },
  { label: '諮詢記錄', desc: '諮詢與評估記錄', route: '/consultation', pageKey: 'consultation', adminOnly: false },
  { label: '預約管理', desc: '預約行事曆', route: '/appointment', pageKey: 'appointment', adminOnly: false },
  { label: '訂單管理', desc: '銷售訂單', route: '/order', pageKey: 'order', adminOnly: false },
  { label: '療程記錄', desc: '療程執行與耗材', route: '/treatment', pageKey: 'treatment', adminOnly: false },
  { label: '收款管理', desc: '收款記錄', route: '/payment', pageKey: 'payment', adminOnly: false },
  { label: '出入庫', desc: '出貨與收貨', route: '/shipment', pageKey: 'shipment', adminOnly: false },
  { label: '欄位設定', desc: '管理欄位顯示與順序', route: '/admin/field-config', pageKey: null, adminOnly: false },
]

const visibleCards = computed(() => {
  return allCards.filter(card => {
    if (card.pageKey) {
      return canAccess(card.pageKey)
    }
    return true
  })
})

function navigate(route: string) {
  router.push(route)
}

function handleLogout() {
  auth.logout()
  router.push('/login')
}

function handleSwitchContext() {
  auth.switchContext()
  router.push('/login')
}

onMounted(async () => {
  const roleId = auth.context?.roleId || 0
  if (roleId) {
    await loadPermissions(roleId)
  }
})
</script>

<style scoped>
.home-page {
  max-width: 1024px;
  margin: 0 auto;
  padding: 1rem;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.header-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-name {
  font-weight: 600;
  font-size: 1rem;
}

.role-badge {
  font-size: 0.75rem;
  background: var(--color-primary);
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  min-height: var(--min-touch);
}

.btn-secondary:hover {
  background: #f1f5f9;
}

.btn-logout {
  color: var(--color-error);
  border-color: var(--color-error);
}

.btn-logout:hover {
  background: #fef2f2;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .module-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .module-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.module-card {
  padding: 1.25rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.module-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.12);
}

.card-label {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.card-desc {
  font-size: 0.8125rem;
  color: #64748b;
}
</style>
