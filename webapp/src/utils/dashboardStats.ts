/**
 * Dashboard Statistics Utilities
 * Calculates consultation metrics and analytics
 */

import { isRequestCompleted, extractStatusName, isCancelledStatus, extractStatusId } from '@/composables/useRequestStatuses'
import { parseIdempiereDateTime } from '@/api/utils'

// Look-back thresholds (in days)
const SILENT_DAYS_THRESHOLD = 7
const LOST_CUSTOMER_DAYS_THRESHOLD = 90
const DEFAULT_PENDING_STATUS_LABEL = '待處理'

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
 * Parse a date value that may be an iDempiere datetime string. Falls back to
 * the native Date parser for non-iDempiere-shaped inputs (e.g. test fixtures).
 */
function parseMaybeDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string' && value) return parseIdempiereDateTime(value)
  return new Date(NaN)
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
  const filtered = requests.filter((r) => parseMaybeDate(r.Created).getTime() >= dayAgo)

  // Filter requests from current month only
  const thisMonth = requests.filter((r) => parseMaybeDate(r.Created).getTime() >= monthStart)

  // Status distribution — source is R_Status_ID (expanded) Name/identifier.
  // Legacy rows that only have LastResult surface that text instead.
  const statusDist: Record<string, number> = {}
  filtered.forEach((r) => {
    const status = extractStatusName(r) || DEFAULT_PENDING_STATUS_LABEL
    statusDist[status] = (statusDist[status] || 0) + 1
  })

  // Silent consultations: not closed AND not cancelled AND older than SILENT_DAYS_THRESHOLD days.
  // The previous implementation inspected R_Request.Description for activity
  // JSON, but Description is no longer fetched in $select — the parse always
  // returned an empty array, so the heuristic collapsed to "created > N days".
  // We now express that rule directly.
  const silentCount = filtered.filter((r) => {
    if (isRequestCompleted(r)) return false
    if (isCancelledStatus(extractStatusId(r) ?? extractStatusName(r) ?? undefined)) return false
    const createdMs = parseMaybeDate(r.Created).getTime()
    if (Number.isNaN(createdMs)) return false
    const daysSinceCreated = (now - createdMs) / (1000 * 24 * 3600)
    return daysSinceCreated > SILENT_DAYS_THRESHOLD
  }).length

  // Calculate lost customers: identify customers with no consultation for 90+ days
  // IMPORTANT: Use ALL historical records to find LAST consultation per customer,
  // not just filtered (90-day) records. A customer with one very old consultation
  // but recent activity should NOT be marked lost.
  const customerLastActivity = new Map()
  requests.forEach((r) => {
    const customerId = r.C_BPartner_ID?.id ?? r.C_BPartner_ID
    if (customerId == null) return  // skip records with no customer FK
    const name = r.C_BPartner_ID?.Name || `#${customerId}`
    const createdTime = parseMaybeDate(r.Created).getTime()

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

  // Count customers with last consultation exceeding threshold days ago
  let lostCount = 0
  customerLastActivity.forEach(({ lastTime }) => {
    if (now - lastTime > LOST_CUSTOMER_DAYS_THRESHOLD * 24 * 60 * 60 * 1000) {
      lostCount++
    }
  })

  return {
    totalThisMonth: thisMonth.length,
    // Conversion rate uses the full look-back window (not just this month) to
    // stay meaningful when consultations span multiple months.
    conversionRate: calculateConversionRate(requests),
    avgResponseTime: calculateAvgResponseTime(filtered),
    pendingCount: filtered.filter((r) => !isRequestCompleted(r) && !isCancelledStatus(extractStatusId(r) ?? extractStatusName(r) ?? undefined)).length,
    silentCount,
    lostCustomerCount: lostCount,
    statusDistribution: statusDist,
    topCustomers: getTopCustomers(filtered, 10),
  }
}

/**
 * Calculate conversion rate (completed / total).
 * Completed is determined by R_Status_ID → R_Status.IsClosed when available,
 * otherwise by legacy status-name match (e.g. '已完成').
 */
function calculateConversionRate(requests: any[]): string {
  if (requests.length === 0) return '0%'
  const completed = requests.filter((r) => isRequestCompleted(r)).length
  const rate = Math.round((completed / requests.length) * 100)
  return `${rate}%`
}

/**
 * Calculate average response time (Updated − Created) across completed
 * consultations only. Description-based activity parsing was removed because
 * Description is no longer included in $select.
 */
function calculateAvgResponseTime(requests: any[]): string {
  if (requests.length === 0) return '0h'
  let totalMs = 0
  let count = 0
  requests.forEach((r) => {
    if (!isRequestCompleted(r)) return
    const createdMs = parseMaybeDate(r.Created).getTime()
    const updatedMs = parseMaybeDate(r.Updated).getTime()
    if (Number.isNaN(createdMs) || Number.isNaN(updatedMs)) return
    const delta = updatedMs - createdMs
    if (delta > 0) {
      totalMs += delta
      count++
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
