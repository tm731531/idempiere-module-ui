<template>
  <header v-if="showHeader" class="app-header">
    <button class="header-btn" @click="goBack">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <span class="header-title">{{ pageTitle }}</span>
    <button class="header-btn" @click="goHome">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9"/><path d="M9 21V9h6v12"/></svg>
    </button>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const titleMap: Record<string, string> = {
  'customer-list': '客戶管理',
  'customer-new': '新增客戶',
  'customer-detail': '客戶資料',
  'consultation-list': '諮詢記錄',
  'consultation-new': '新增諮詢',
  'consultation-edit': '編輯諮詢',
  'appointment-calendar': '預約管理',
  'appointment-new': '新增預約',
  'order-list': '訂單管理',
  'order-new': '新增訂單',
  'order-detail': '訂單明細',
  'treatment-list': '療程記錄',
  'treatment-new': '新增療程',
  'treatment-detail': '療程明細',
  'payment-list': '收款管理',
  'payment-new': '新增收款',
  'payment-detail': '收款明細',
  'shipment-list': '出入庫',
  'shipment-new': '新增出入庫',
  'shipment-detail': '出入庫明細',
  'field-config': '欄位設定',
}

const showHeader = computed(() => {
  const name = route.name as string
  return name !== 'home' && name !== 'login' && name !== undefined
})

const pageTitle = computed(() => {
  return titleMap[route.name as string] || ''
})

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

function goHome() {
  router.push('/')
}
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: white;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text);
}

.header-btn:hover {
  background: #f1f5f9;
}

.header-title {
  font-size: 1rem;
  font-weight: 600;
}
</style>
