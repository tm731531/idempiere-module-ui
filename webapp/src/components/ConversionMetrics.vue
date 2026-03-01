<template>
  <div class="conversion-metrics">
    <!-- 轉化率卡片 -->
    <div class="metrics-grid">
      <div class="metric-card conversion-rate">
        <div class="metric-label">轉化率</div>
        <div class="metric-value">
          {{ metrics.conversionRate }}
        </div>
        <div class="metric-detail">{{ metrics.convertedCount }}/{{ metrics.totalCount }} 諮詢</div>
      </div>

      <div class="metric-card avg-conversion-time">
        <div class="metric-label">平均轉化時間</div>
        <div class="metric-value">
          {{ metrics.avgConversionTime }}
        </div>
        <div class="metric-detail">從諮詢建立到訂單</div>
      </div>

      <div class="metric-card pending-conversion">
        <div class="metric-label">待轉化諮詢</div>
        <div class="metric-value">
          {{ metrics.pendingConversionCount }}
        </div>
        <div class="metric-detail">超過 7 天未轉化</div>
      </div>
    </div>

    <!-- 操作人績效排名表 -->
    <div class="performance-section">
      <h3 class="section-title">諮詢師績效排名</h3>
      <div v-if="metrics.operatorPerformance.length === 0" class="empty-state">
        暫無績效數據
      </div>
      <table v-else class="performance-table">
        <thead>
          <tr>
            <th>#</th>
            <th>諮詢師</th>
            <th>操作諮詢數</th>
            <th>轉化訂單數</th>
            <th>轉化率</th>
            <th>平均響應時間</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(op, index) in sortedPerformance"
            :key="op.operatorId"
            class="performance-row"
            @click="viewOperatorDetails(op.operatorId)"
          >
            <td class="rank">{{ index + 1 }}</td>
            <td class="name">{{ op.operatorName }}</td>
            <td class="count">{{ op.consultationsUpdated }}</td>
            <td class="count highlight">{{ op.conversionsCreated }}</td>
            <td class="rate" :class="getConversionRateClass(op.conversionRate)">
              {{ op.conversionRate }}
            </td>
            <td class="response-time">{{ op.avgResponseTime }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface RequestActivity {
  timestamp: string
  type: string
  actionType: string
  content: string
  createdBy: number
  linkedOrderId?: number
  linkedOrderNo?: string
}

interface OperatorPerformance {
  operatorId: number
  operatorName: string
  consultationsUpdated: number
  conversionsCreated: number
  conversionRate: string
  avgResponseTime: string
}

interface ConversionMetricsData {
  conversionRate: string
  convertedCount: number
  totalCount: number
  avgConversionTime: string
  pendingConversionCount: number
  operatorPerformance: OperatorPerformance[]
}

interface Props {
  requests: any[]
  operatorNames?: Record<number, string>
  dateFrom?: string
  dateTo?: string
}

const props = withDefaults(defineProps<Props>(), {
  operatorNames: () => ({}),
})

const metrics = reactive<ConversionMetricsData>({
  conversionRate: '0%',
  convertedCount: 0,
  totalCount: 0,
  avgConversionTime: '-',
  pendingConversionCount: 0,
  operatorPerformance: [],
})

// 計算轉化率（基於 LastResult 欄位）
function calculateConversionRate() {
  if (props.requests.length === 0) return

  const completedStatuses = ['已完成', 'Closed', '已轉化', 'Completed']
  const converted = props.requests.filter(req =>
    req.LastResult && completedStatuses.includes(req.LastResult)
  )

  metrics.convertedCount = converted.length
  metrics.totalCount = props.requests.length
  const rate = (converted.length / props.requests.length) * 100
  metrics.conversionRate = `${rate.toFixed(1)}%`
}

// 計算平均轉化時間（基於 Created 和 Updated 欄位）
function calculateAvgConversionTime() {
  const completedStatuses = ['已完成', 'Closed', '已轉化', 'Completed']
  const times: number[] = []

  props.requests.forEach(req => {
    // 只計算已轉化的諮詢
    if (req.LastResult && completedStatuses.includes(req.LastResult)) {
      if (req.Created && req.Updated) {
        const timeToConversion = new Date(req.Updated).getTime() - new Date(req.Created).getTime()
        const days = timeToConversion / (1000 * 60 * 60 * 24)
        times.push(days)
      }
    }
  })

  if (times.length === 0) {
    metrics.avgConversionTime = '-'
    return
  }

  const avg = times.reduce((a: number, b: number) => a + b, 0) / times.length
  metrics.avgConversionTime = `${avg.toFixed(1)} 天`
}

// 計算待轉化諮詢（超過 7 天未轉化）
function calculatePendingConversions() {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const completedStatuses = ['已完成', 'Closed', '已轉化', 'Completed']

  const pending = props.requests.filter(req => {
    const created = new Date(req.Created)
    if (created > sevenDaysAgo) return false // 少於 7 天的不算

    // 未轉化的記錄（LastResult 不是完成狀態）
    return !req.LastResult || !completedStatuses.includes(req.LastResult)
  })

  metrics.pendingConversionCount = pending.length
}

// 計算操作人績效（基於 UpdatedBy 欄位）
function calculateOperatorPerformance() {
  const operatorMap = new Map<number, {
    consultationsUpdated: Set<number>
    conversionsCreated: Set<number>
    responseTime: number[]
  }>()

  props.requests.forEach(req => {
    // 獲取最後修改人的 ID
    let updatedById: number | null = null
    if (req.UpdatedBy && typeof req.UpdatedBy === 'object') {
      updatedById = req.UpdatedBy.id
    } else if (typeof req.UpdatedBy === 'number') {
      updatedById = req.UpdatedBy
    }

    // 如果沒有 UpdatedBy，使用 CreatedBy
    if (!updatedById) {
      if (req.CreatedBy && typeof req.CreatedBy === 'object') {
        updatedById = req.CreatedBy.id
      } else if (typeof req.CreatedBy === 'number') {
        updatedById = req.CreatedBy
      }
    }

    if (!updatedById) return

    if (!operatorMap.has(updatedById)) {
      operatorMap.set(updatedById, {
        consultationsUpdated: new Set(),
        conversionsCreated: new Set(),
        responseTime: [],
      })
    }

    const op = operatorMap.get(updatedById)!
    op.consultationsUpdated.add(req.R_Request_ID)

    // 判斷是否已轉化（LastResult 為完成狀態）
    // 假設完成狀態包含：'已完成', 'Closed', '已轉化' 等
    const completedStatuses = ['已完成', 'Closed', '已轉化', 'Completed']
    if (req.LastResult && completedStatuses.includes(req.LastResult)) {
      op.conversionsCreated.add(req.R_Request_ID)
    }

    // 計算響應時間（Updated - Created）
    if (req.Created && req.Updated) {
      const responseTime = new Date(req.Updated).getTime() - new Date(req.Created).getTime()
      op.responseTime.push(responseTime / (1000 * 60 * 60)) // 轉換為小時
    }
  })

  metrics.operatorPerformance = Array.from(operatorMap.entries()).map(([opId, data]) => ({
    operatorId: opId,
    operatorName: props.operatorNames[opId] || `用戶 #${opId}`,
    consultationsUpdated: data.consultationsUpdated.size,
    conversionsCreated: data.conversionsCreated.size,
    conversionRate: data.consultationsUpdated.size > 0
      ? `${((data.conversionsCreated.size / data.consultationsUpdated.size) * 100).toFixed(1)}%`
      : '0%',
    avgResponseTime: data.responseTime.length > 0
      ? `${(data.responseTime.reduce((a, b) => a + b, 0) / data.responseTime.length).toFixed(1)}h`
      : '-',
  }))
}

// 排序績效表（按轉化訂單數降序）
const sortedPerformance = computed(() => {
  return [...metrics.operatorPerformance].sort(
    (a, b) => b.conversionsCreated - a.conversionsCreated
  )
})

// 根據轉化率返回 CSS class
function getConversionRateClass(rate: string): string {
  const percentage = parseFloat(rate)
  if (percentage >= 50) return 'high'
  if (percentage >= 20) return 'medium'
  return 'low'
}

// 點擊操作人績效，導航到列表頁面並過濾該操作人的諮詢
function viewOperatorDetails(operatorId: number) {
  router.push({
    name: 'consultation-list',
    query: {
      filterOperatorId: operatorId,
      filterOperatorName: props.operatorNames[operatorId] || `用戶 #${operatorId}`,
    },
  })
}

// 監聽 requests 變化，重新計算
import { watch } from 'vue'
watch(
  () => props.requests,
  () => {
    calculateConversionRate()
    calculateAvgConversionTime()
    calculatePendingConversions()
    calculateOperatorPerformance()
  },
  { deep: true, immediate: true }
)
</script>

<style scoped>
.conversion-metrics {
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.metric-card {
  background: white;
  padding: 20px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.metric-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 32px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.metric-detail {
  font-size: 12px;
  color: #999;
}

.conversion-rate .metric-value {
  color: #4caf50;
}

.avg-conversion-time .metric-value {
  color: #2196f3;
}

.pending-conversion .metric-value {
  color: #ff9800;
}

/* 績效排名表 */
.performance-section {
  background: white;
  padding: 20px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.performance-table {
  width: 100%;
  border-collapse: collapse;
}

.performance-table thead {
  background: #f9f9f9;
}

.performance-table th {
  padding: 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  border-bottom: 2px solid #eee;
}

.performance-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
  font-size: 14px;
}

.performance-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.performance-row:hover {
  background: #e3f2fd;
}

.rank {
  font-weight: 600;
  color: #2196f3;
  width: 40px;
}

.name {
  font-weight: 500;
  color: #333;
}

.count {
  text-align: center;
}

.count.highlight {
  color: #4caf50;
  font-weight: 600;
}

.rate {
  text-align: center;
  font-weight: 600;
}

.rate.high {
  color: #4caf50;
}

.rate.medium {
  color: #ff9800;
}

.rate.low {
  color: #f44336;
}

.response-time {
  text-align: center;
  color: #999;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}
</style>
