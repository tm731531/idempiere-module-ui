<template>
  <div class="customer-detail-page">
    <div class="detail-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>客戶資料</h2>
      <button class="edit-btn" @click="handleEdit">編輯</button>
    </div>

    <div v-if="loading" class="loading-state">載入中...</div>

    <div v-else-if="errorMsg" class="error-state">{{ errorMsg }}</div>

    <template v-else-if="customer">
      <div class="detail-card">
        <h3 class="section-title">基本資訊</h3>
        <div class="detail-row">
          <span class="detail-label">姓名</span>
          <span class="detail-value">{{ customer.Name }}</span>
        </div>
        <div v-if="customer.TaxID" class="detail-row">
          <span class="detail-label">身分證/統編</span>
          <span class="detail-value">{{ customer.TaxID }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">狀態</span>
          <span class="detail-value">{{ customer.IsActive ? '啟用' : '停用' }}</span>
        </div>
      </div>

      <div v-if="contact" class="detail-card">
        <h3 class="section-title">聯絡資訊</h3>
        <div v-if="contact.Phone" class="detail-row">
          <span class="detail-label">電話</span>
          <span class="detail-value">{{ contact.Phone }}</span>
        </div>
        <div v-if="contact.EMail" class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">{{ contact.EMail }}</span>
        </div>
        <div v-if="!contact.Phone && !contact.EMail" class="detail-row">
          <span class="detail-label">聯絡資訊</span>
          <span class="detail-value empty">尚未填寫</span>
        </div>
      </div>

      <div v-if="customer.Description" class="detail-card">
        <h3 class="section-title">備註</h3>
        <div class="detail-row">
          <span class="detail-value">{{ customer.Description }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getCustomerDetail, getCustomerContact } from '@/api/bpartner'

const router = useRouter()
const route = useRoute()

const customer = ref<any>(null)
const contact = ref<any>(null)
const loading = ref(false)
const errorMsg = ref('')

async function loadCustomer() {
  const id = Number(route.params.id)
  if (!id) {
    errorMsg.value = '無效的客戶 ID'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const [bp, ct] = await Promise.all([
      getCustomerDetail(id),
      getCustomerContact(id),
    ])
    customer.value = bp
    contact.value = ct
  } catch {
    errorMsg.value = '載入客戶資料失敗'
  } finally {
    loading.value = false
  }
}

// Watch route to reload when navigating back from edit
watch(() => route.fullPath, () => {
  if (route.name === 'customer-detail') loadCustomer()
}, { immediate: true })

function handleEdit() {
  router.push({ name: 'customer-edit', params: { id: route.params.id } })
}

function goBack() {
  router.push({ name: 'customer-list' })
}
</script>

<style scoped>
.customer-detail-page { padding: 1rem; max-width: 600px; margin: 0 auto; }
.detail-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.detail-header h2 { font-size: 1.25rem; margin: 0; flex: 1; }
.loading-state, .error-state { text-align: center; padding: 2rem; color: #64748b; }
.error-state { color: var(--color-error); }
.detail-card { background: white; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; margin-bottom: 1rem; }
.section-title { font-size: 1rem; font-weight: 600; padding: 0.75rem 1rem 0.5rem; margin: 0; border-bottom: 1px solid var(--color-border); }
.detail-row { display: flex; padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); min-height: var(--min-touch); align-items: center; }
.detail-row:last-child { border-bottom: none; }
.detail-label { width: 120px; flex-shrink: 0; font-size: 0.875rem; color: #64748b; }
.detail-value { flex: 1; font-size: 1rem; }
.detail-value.empty { color: #94a3b8; font-style: italic; }
.back-btn, .edit-btn { padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--color-border); border-radius: 8px; cursor: pointer; min-height: var(--min-touch); }
.edit-btn { border-color: var(--color-primary); color: var(--color-primary); }
</style>
