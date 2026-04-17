<template>
  <div class="dashboard-page">
    <header class="page-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h1>諮詢儀表板</h1>
      <div class="header-controls">
        <div class="date-filter">
          <label>時間範圍:</label>
          <select v-model="dateRange" class="date-select">
            <option value="7">最近 7 天</option>
            <option value="30">最近 30 天</option>
            <option value="90">最近 90 天</option>
            <option value="all">全部</option>
          </select>
        </div>
        <button class="refresh-btn" @click="loadData" :disabled="loading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36M20.49 15a9 9 0 01-14.85 3.36" />
          </svg>
          刷新
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading-state">載入中...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <ConversionMetrics v-else :requests="filteredRequests" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { listRequests } from '@/api/request'
import ConversionMetrics from '@/components/ConversionMetrics.vue'
import { useToast } from '@/composables/useToast'
import { parseIdempiereDateTime } from '@/api/utils'

const router = useRouter()
const toast = useToast()
const requests = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const dateRange = ref('30') // 預設 30 天

let interval: ReturnType<typeof setInterval> | null = null

// 計算日期範圍
const dateRangeParams = computed(() => {
  if (dateRange.value === 'all') return {}

  const days = parseInt(dateRange.value)
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
})

// 過濾諮詢
const filteredRequests = computed(() => {
  if (dateRange.value === 'all') return requests.value

  const { from, to } = dateRangeParams.value
  return requests.value.filter(req => {
    const created = parseIdempiereDateTime(req.Created)
    return created >= new Date(from!) && created <= new Date(to!)
  })
})

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    // 加載所有諮詢記錄（SalesRep_ID is $expand'd, names resolved in ConversionMetrics）
    requests.value = await listRequests()
  } catch (e) {
    error.value = '無法加載儀表板資料'
    toast.add({
      severity: 'error',
      summary: '載入失敗',
      detail: '無法加載儀表板資料，請稍後重試',
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/')
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // Resume auto-refresh when tab becomes visible
    if (!interval) {
      interval = setInterval(loadData, 5 * 60 * 1000)
    }
  } else {
    // Pause auto-refresh when tab is hidden
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }
}

onMounted(() => {
  loadData()
  // 每 5 分鐘自動刷新一次（僅在頁面可見時）
  if (document.visibilityState === 'visible') {
    interval = setInterval(loadData, 5 * 60 * 1000)
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (interval) clearInterval(interval)
  document.removeEventListener('visibilitychange', onVisibilityChange)
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
  gap: 1rem;
  flex-wrap: wrap;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.date-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.date-filter label {
  font-weight: 500;
  color: #475569;
}

.date-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
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
