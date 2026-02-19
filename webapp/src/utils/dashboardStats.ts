/**
 * Dashboard Statistics Utilities
 * Calculates consultation metrics and analytics
 */

export interface RequestStats {
  totalThisMonth: number
  conversionRate: string
  avgResponseTime: string
  pendingCount: number
  silentCount: number
  lostCustomerCount: number
  statusDistribution: Record<string, number>
  topCustomers: Array<{ customerId: number; name: string; count: number }>
}

/**
 * Calculate comprehensive dashboard statistics from consultation requests
 * @param requests - Array of consultation request records
 * @param daysBefore - Look-back window in days (default: 90)
 * @returns RequestStats object with all calculated metrics
 */
export function calculateStats(requests: any[], daysBefore: number = 90): RequestStats {
  const now = Date.now()
  const dayAgo = now - daysBefore * 24 * 60 * 60 * 1000

  // Calculate month start (first day of current month)
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime()

  // Filter requests from the look-back period
  const filtered = requests.filter((r) => new Date(r.Created).getTime() >= dayAgo)

  // Filter requests from current month only
  const thisMonth = requests.filter((r) => new Date(r.Created).getTime() >= monthStart)

  // 計算狀態分布
  const statusDist: Record<string, number> = {}
  filtered.forEach((r) => {
    const status = r.R_Status_ID?.id || '待處理'
    statusDist[status] = (statusDist[status] || 0) + 1
  })

  // 計算沉默諮詢（等待回應 > 7 天）
  const silentCount = filtered.filter((r) => {
    const status = r.R_Status_ID?.id
    if (status !== '等待回應') return false
    try {
      const activities = JSON.parse(r.Description || '[]')
      if (activities.length === 0) {
        const daysSince = (now - new Date(r.Created).getTime()) / (1000 * 24 * 3600)
        return daysSince > 7
      }
      const lastActivity = activities[activities.length - 1]?.timestamp
      if (!lastActivity) return false
      const daysSilent = (now - new Date(lastActivity).getTime()) / (1000 * 24 * 3600)
      return daysSilent > 7
    } catch {
      return false
    }
  }).length

  // Calculate lost customers: identify customers with no consultation for 90+ days
  // IMPORTANT: Use ALL historical records to find LAST consultation per customer,
  // not just filtered (90-day) records. A customer with one very old consultation
  // but recent activity should NOT be marked lost.
  const customerLastActivity = new Map()
  requests.forEach((r) => {
    const customerId = r.C_BPartner_ID?.id ?? r.C_BPartner_ID
    const name = r.C_BPartner_ID?.Name || `#${customerId}`
    const createdTime = new Date(r.Created).getTime()

    if (!customerLastActivity.has(customerId)) {
      customerLastActivity.set(customerId, { customerId, name, lastTime: createdTime })
    } else {
      // Update to the most recent consultation time for this customer
      const existing = customerLastActivity.get(customerId)
      if (createdTime > existing.lastTime) {
        existing.lastTime = createdTime
      }
    }
  })

  // Count customers with last consultation 90+ days ago
  let lostCount = 0
  customerLastActivity.forEach(({ lastTime }) => {
    // Check if the time elapsed since last activity exceeds 90 days
    if (now - lastTime > 90 * 24 * 60 * 60 * 1000) {
      lostCount++
    }
  })

  return {
    totalThisMonth: thisMonth.length,
    conversionRate: calculateConversionRate(thisMonth),
    avgResponseTime: calculateAvgResponseTime(filtered),
    pendingCount: filtered.filter((r) => r.R_Status_ID?.id !== '已完成').length,
    silentCount,
    lostCustomerCount: lostCount,
    statusDistribution: statusDist,
    topCustomers: getTopCustomers(filtered, 10),
  }
}

/**
 * Calculate conversion rate (completed / total)
 */
function calculateConversionRate(requests: any[]): string {
  if (requests.length === 0) return '0%'
  const completed = requests.filter((r) => r.R_Status_ID?.id === '已完成').length
  const rate = Math.round((completed / requests.length) * 100)
  return `${rate}%`
}

/**
 * Calculate average response time based on first activity timestamp
 */
function calculateAvgResponseTime(requests: any[]): string {
  if (requests.length === 0) return '0h'
  let totalMs = 0
  let count = 0
  requests.forEach((r) => {
    try {
      const activities = JSON.parse(r.Description || '[]')
      if (activities.length > 0) {
        const responseMs = new Date(activities[0].timestamp).getTime() - new Date(r.Created).getTime()
        if (responseMs > 0) {
          totalMs += responseMs
          count++
        }
      }
    } catch {
      // skip parsing errors
    }
  })
  if (count === 0) return '0h'
  const hours = Math.round(totalMs / count / (1000 * 3600))
  return `${hours}h`
}

/**
 * Get top N customers by consultation count
 */
function getTopCustomers(
  requests: any[],
  limit: number
): Array<{ customerId: number; name: string; count: number }> {
  const customerMap = new Map()
  requests.forEach((r) => {
    const customerId = r.C_BPartner_ID?.id ?? r.C_BPartner_ID
    const name = r.C_BPartner_ID?.Name || `#${customerId}`
    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, { customerId, name, count: 0 })
    }
    customerMap.get(customerId).count++
  })
  return Array.from(customerMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
