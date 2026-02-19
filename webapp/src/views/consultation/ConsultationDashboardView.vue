<template>
  <div class="dashboard-page">
    <header class="page-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h1>諮詢儀表板</h1>
      <button class="refresh-btn" @click="loadData" :disabled="loading">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0114.85-3.36M20.49 15a9 9 0 01-14.85 3.36" />
        </svg>
        刷新
      </button>
    </header>

    <div v-if="loading" class="loading-state">載入中...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <ConsultationDashboard v-else :requests="requests" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listRequests } from '@/api/request'
import ConsultationDashboard from '@/components/ConsultationDashboard.vue'

const router = useRouter()
const requests = ref<any[]>([])
const loading = ref(false)
const error = ref('')

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    // 加載所有諮詢記錄（無過濾）
    requests.value = await listRequests()
  } catch (e) {
    error.value = '無法加載儀表板資料'
    console.error(e)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/')
}

onMounted(() => {
  loadData()
  // 可選：每 5 分鐘自動刷新一次
  const interval = setInterval(loadData, 5 * 60 * 1000)
  return () => clearInterval(interval)  // cleanup
})
</script>

<style scoped>
.dashboard-page {
  padding: 1rem;
  max-width: 1280px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.back-btn,
.refresh-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  min-height: var(--min-touch);
  transition: all 0.2s;
}

.back-btn:hover,
.refresh-btn:hover {
  background: #f1f5f9;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
</style>
