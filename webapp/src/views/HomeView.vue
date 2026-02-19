<template>
  <div class="home-page">
    <!-- Header -->
    <header class="home-header">
      <div class="header-top">
        <span class="user-name">{{ auth.user?.name || '' }}</span>
        <div class="header-actions">
          <button class="btn-secondary" @click="handleSwitchContext"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M4 4l17 17"/></svg> 切換</button>
          <button class="btn-secondary btn-logout" @click="handleLogout"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg> 登出</button>
        </div>
      </div>
      <div class="header-context">
        <span class="context-item">{{ auth.context?.clientName || '' }}</span>
        <span class="context-sep">/</span>
        <span class="context-item">{{ auth.context?.organizationName || '' }}</span>
        <span class="context-sep">/</span>
        <span class="context-item">{{ auth.context?.roleName || '' }}</span>
        <span v-if="auth.context?.warehouseName" class="context-sep">/</span>
        <span v-if="auth.context?.warehouseName" class="context-item">{{ auth.context.warehouseName }}</span>
      </div>
    </header>

    <!-- Sections -->
    <div v-for="section in visibleSections" :key="section.title" class="section">
      <h3 class="section-title">{{ section.title }}</h3>
      <div class="module-grid">
        <div
          v-for="card in section.cards"
          :key="card.route"
          class="module-card"
        >
          <div class="card-body" @click="navigate(card.route)">
            <div class="card-icon">{{ card.icon }}</div>
            <div class="card-label">{{ card.label }}</div>
            <div class="card-desc">{{ card.desc }}</div>
          </div>
          <div v-if="card.shortcuts && card.shortcuts.length" class="card-shortcuts">
            <button
              v-for="s in card.shortcuts"
              :key="s.label"
              class="shortcut-btn"
              @click.stop="navigate(card.route, s.query)"
            >
              {{ s.label }}
            </button>
          </div>
        </div>
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
  icon: string
  label: string
  desc: string
  route: string
  pageKey: string | null
  systemOnly?: boolean
  businessOnly?: boolean
  shortcuts?: { label: string; query: Record<string, string> }[]
}

interface CardSection {
  title: string
  cards: ModuleCard[]
  businessOnly?: boolean
  systemOnly?: boolean
}

const isSystemClient = computed(() => auth.context?.clientId === 0)

const sections: CardSection[] = [
  {
    title: '客戶服務',
    businessOnly: true,
    cards: [
      { icon: '👤', label: '客戶管理', desc: '管理客戶資料', route: '/customer', pageKey: 'customer' },
      { icon: '📋', label: '諮詢記錄', desc: '諮詢與評估記錄', route: '/consultation', pageKey: 'consultation' },
      { icon: '📅', label: '預約管理', desc: '預約行事曆', route: '/appointment', pageKey: 'appointment' },
    ],
  },
  {
    title: '業務流程',
    businessOnly: true,
    cards: [
      {
        icon: '🛒', label: '開單紀錄', desc: '銷售與採購訂單', route: '/order', pageKey: 'order',
        shortcuts: [
          { label: '銷售訂單', query: { type: 'so' } },
          { label: '採購單', query: { type: 'po' } },
        ],
      },
      { icon: '💉', label: '療程記錄', desc: '療程執行與耗材', route: '/treatment', pageKey: 'treatment' },
      {
        icon: '💰', label: '收付款', desc: '收款與付款記錄', route: '/payment', pageKey: 'payment',
        shortcuts: [
          { label: '收款', query: { type: 'ar' } },
          { label: '付款', query: { type: 'ap' } },
        ],
      },
      {
        icon: '📦', label: '出入庫', desc: '出貨與收貨記錄', route: '/shipment', pageKey: 'shipment',
        shortcuts: [
          { label: '出貨', query: { type: 'so' } },
          { label: '收貨', query: { type: 'po' } },
        ],
      },
      { icon: '📊', label: '諮詢儀表板', desc: '追蹤諮詢狀態與客戶旅程', route: '/consultation-dashboard', pageKey: null },
    ],
  },
  {
    title: '管理',
    businessOnly: true,
    cards: [
      { icon: '🏷️', label: '商品管理', desc: '商品與療程項目', route: '/product', pageKey: 'product' },
      { icon: '⚙️', label: '系統設定', desc: '稅率、服務人員、儲位', route: '/admin/reference-data', pageKey: null },
      { icon: '📊', label: '行銷設定', desc: '績效分類設定', route: '/admin/dimensions', pageKey: null },
    ],
  },
  {
    title: '系統管理',
    systemOnly: true,
    cards: [
      { icon: '🗄️', label: 'Table/Column', desc: 'AD 資料字典管理', route: '/admin/tables', pageKey: null },
    ],
  },
]

const visibleSections = computed(() => {
  return sections
    .filter(s => {
      if (s.systemOnly && !isSystemClient.value) return false
      if (s.businessOnly && isSystemClient.value) return false
      return true
    })
    .map(s => ({
      ...s,
      cards: s.cards.filter(card => {
        if (card.systemOnly && !isSystemClient.value) return false
        if (card.businessOnly && isSystemClient.value) return false
        if (card.pageKey) return canAccess(card.pageKey)
        return true
      }),
    }))
    .filter(s => s.cards.length > 0)
})

function navigate(route: string, query?: Record<string, string>) {
  router.push({ path: route, query })
}

function handleLogout() {
  auth.logout()
  router.push('/login')
}

async function handleSwitchContext() {
  await auth.switchContext()
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
  padding: 0.75rem 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-name {
  font-weight: 600;
  font-size: 1rem;
}

.header-context {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: #64748b;
}

.context-sep {
  margin: 0 0.25rem;
  color: #cbd5e1;
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

/* Sections */
.section {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
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
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.module-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.12);
}

.card-body {
  padding: 1.25rem;
  cursor: pointer;
}

.card-icon {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
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

/* Shortcuts */
.card-shortcuts {
  display: flex;
  border-top: 1px solid var(--color-border);
}

.shortcut-btn {
  flex: 1;
  padding: 0.5rem;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-primary);
  cursor: pointer;
  min-height: 36px;
  transition: background 0.1s;
}

.shortcut-btn:hover {
  background: rgba(99, 102, 241, 0.06);
}

.shortcut-btn + .shortcut-btn {
  border-left: 1px solid var(--color-border);
}
</style>
