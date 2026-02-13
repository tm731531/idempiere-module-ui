<template>
  <div class="customer-detail-page">
    <div class="detail-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>客戶資料</h2>
      <button class="edit-btn" @click="handleEdit">編輯</button>
    </div>

    <div v-if="loading" class="loading-state">載入中...</div>

    <div v-else-if="errorMsg" class="error-state">{{ errorMsg }}</div>

    <div v-else-if="customer" class="detail-card">
      <div class="detail-row">
        <span class="detail-label">姓名</span>
        <span class="detail-value">{{ customer.Name }}</span>
      </div>
      <div v-if="customer.TaxID" class="detail-row">
        <span class="detail-label">身分證/統編</span>
        <span class="detail-value">{{ customer.TaxID }}</span>
      </div>
      <div v-if="customer.Description" class="detail-row">
        <span class="detail-label">描述</span>
        <span class="detail-value">{{ customer.Description }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">狀態</span>
        <span class="detail-value">{{ customer.IsActive ? '啟用' : '停用' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getCustomerDetail } from '@/api/bpartner'

const router = useRouter()
const route = useRoute()

const customer = ref<any>(null)
const loading = ref(false)
const errorMsg = ref('')

onMounted(async () => {
  const id = Number(route.params.id)
  if (!id) {
    errorMsg.value = '無效的客戶 ID'
    return
  }
  loading.value = true
  try {
    customer.value = await getCustomerDetail(id)
  } catch {
    errorMsg.value = '載入客戶資料失敗'
  } finally {
    loading.value = false
  }
})

function handleEdit() {
  // Placeholder for future edit mode
}

function goBack() {
  router.push({ name: 'customer-list' })
}
</script>

<style scoped>
.customer-detail-page {
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.detail-header h2 {
  font-size: 1.25rem;
  margin: 0;
  flex: 1;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.error-state {
  color: var(--color-error);
}

.detail-card {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.detail-row {
  display: flex;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  min-height: var(--min-touch);
  align-items: center;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  width: 120px;
  flex-shrink: 0;
  font-size: 0.875rem;
  color: #64748b;
}

.detail-value {
  flex: 1;
  font-size: 1rem;
}

.back-btn,
.edit-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
}

.edit-btn {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
</style>
