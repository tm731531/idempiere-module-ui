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
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { isRequestCompleted } from '@/composables/useRequestStatuses'
import { parseIdempiereDateTime } from '@/api/utils'

const router = useRouter()

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

/**
 * Parse a date value that may be an iDempiere datetime string. Falls back to
 * the native Date parser for non-iDempiere-shaped inputs.
 */
function parseMaybeDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string' && value) return parseIdempiereDateTime(value)
  return new Date(NaN)
}

/**
 * Resolve the primary operator (consultant) id for a request from SalesRep_ID.
 * Returns null when no consultant is assigned — we no longer fall back to
 * activity JSON (Description is not fetched and was always empty in practice).
 */
function getPrimaryOperatorId(req: any): number | null {
  if (req?.SalesRep_ID && typeof req.SalesRep_ID === 'object') {
    const id = req.SalesRep_ID.id
    if (typeof id === 'number') return id
  } else if (typeof req?.SalesRep_ID === 'number') {
    return req.SalesRep_ID
  }
  return null
}

/**
 * Compute the complete metrics object in a single pass over props.requests.
 */
const metrics = computed<ConversionMetricsData>(() => {
  const reqs = props.requests
  const totalCount = reqs.length

  if (totalCount === 0) {
    return {
      conversionRate: '0%',
      convertedCount: 0,
      totalCount: 0,
      avgConversionTime: '-',
      pendingConversionCount: 0,
      operatorPerformance: [],
    }
  }

  // --- Conversion rate & average conversion time ---
  const converted = reqs.filter(isRequestCompleted)
  const convertedCount = converted.length
  const conversionRate = `${((convertedCount / totalCount) * 100).toFixed(1)}%`

  const conversionDays: number[] = []
  converted.forEach((req) => {
    const createdMs = parseMaybeDate(req.Created).getTime()
    const updatedMs = parseMaybeDate(req.Updated).getTime()
    if (Number.isNaN(createdMs) || Number.isNaN(updatedMs)) return
    const delta = updatedMs - createdMs
    if (delta > 0) conversionDays.push(delta / (1000 * 60 * 60 * 24))
  })
  const avgConversionTime = conversionDays.length > 0
    ? `${(conversionDays.reduce((a, b) => a + b, 0) / conversionDays.length).toFixed(1)} 天`
    : '-'

  // --- Pending conversions: older than 7 days AND not completed ---
  const now = Date.now()
  const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000
  const pendingConversionCount = reqs.filter((req) => {
    const createdMs = parseMaybeDate(req.Created).getTime()
    if (Number.isNaN(createdMs) || createdMs > sevenDaysAgoMs) return false
    return !isRequestCompleted(req)
  }).length

  // --- Operator performance (aggregated by SalesRep_ID) ---
  interface OperatorAgg {
    consultationsAssigned: Set<number>
    conversionsCreated: Set<number>
    responseTime: number[]
  }
  const operatorMap = new Map<number, OperatorAgg>()
  const ensure = (id: number): OperatorAgg => {
    let hit = operatorMap.get(id)
    if (!hit) {
      hit = {
        consultationsAssigned: new Set(),
        conversionsCreated: new Set(),
        responseTime: [],
      }
      operatorMap.set(id, hit)
    }
    return hit
  }

  reqs.forEach((req) => {
    const opId = getPrimaryOperatorId(req)
    if (opId == null) return
    const agg = ensure(opId)
    agg.consultationsAssigned.add(req.R_Request_ID)
    if (isRequestCompleted(req)) {
      agg.conversionsCreated.add(req.R_Request_ID)
    }
    const createdMs = parseMaybeDate(req.Created).getTime()
    const updatedMs = parseMaybeDate(req.Updated).getTime()
    if (!Number.isNaN(createdMs) && !Number.isNaN(updatedMs)) {
      const ms = updatedMs - createdMs
      if (ms > 0) agg.responseTime.push(ms / (1000 * 60 * 60))
    }
  })

  // Build a lookup of SalesRep_ID → display name from expanded FK objects.
  const salesRepNames = new Map<number, string>()
  reqs.forEach((req) => {
    if (req.SalesRep_ID && typeof req.SalesRep_ID === 'object') {
      const id = req.SalesRep_ID.id
      if (typeof id === 'number' && !salesRepNames.has(id)) {
        salesRepNames.set(id, req.SalesRep_ID.Name || req.SalesRep_ID.identifier || '')
      }
    }
  })

  const operatorPerformance: OperatorPerformance[] = Array.from(operatorMap.entries()).map(
    ([operatorId, data]) => ({
      operatorId,
      operatorName:
        salesRepNames.get(operatorId) ||
        (props.operatorNames && props.operatorNames[operatorId]) ||
        `用戶 #${operatorId}`,
      consultationsUpdated: data.consultationsAssigned.size,
      conversionsCreated: data.conversionsCreated.size,
      conversionRate:
        data.consultationsAssigned.size > 0
          ? `${((data.conversionsCreated.size / data.consultationsAssigned.size) * 100).toFixed(1)}%`
          : '0%',
      avgResponseTime:
        data.responseTime.length > 0
          ? `${(data.responseTime.reduce((a, b) => a + b, 0) / data.responseTime.length).toFixed(1)}h`
          : '-',
    }),
  )

  return {
    conversionRate,
    convertedCount,
    totalCount,
    avgConversionTime,
    pendingConversionCount,
    operatorPerformance,
  }
})

// 排序績效表（按轉化訂單數降序）
const sortedPerformance = computed(() => {
  return [...metrics.value.operatorPerformance].sort(
    (a, b) => b.conversionsCreated - a.conversionsCreated,
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
  const perf = metrics.value.operatorPerformance.find((p) => p.operatorId === operatorId)
  const displayName =
    perf?.operatorName ||
    (props.operatorNames && props.operatorNames[operatorId]) ||
    `用戶 #${operatorId}`
  router.push({
    name: 'consultation-list',
    query: {
      filterOperatorId: operatorId,
      filterOperatorName: displayName,
    },
  })
}
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
