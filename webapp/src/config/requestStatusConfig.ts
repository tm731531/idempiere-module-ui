/**
 * Request Status Configuration
 *
 * Unified configuration for request statuses used across:
 * - StatusUpdateModal (display available statuses)
 * - RequestFormView (load and update statuses)
 * - Dashboard/dashboardStats (statistics and categorization)
 *
 * Plugin Design: All status logic is defined in the UI layer,
 * not in the database. This allows flexible status management
 * without modifying iDempiere core data.
 */

/**
 * Status identifier strings used throughout the UI
 * These should match the R_Status names returned from the API
 */
export const REQUEST_STATUS_IDS = {
  PENDING: '待處理',           // Pending / Not yet handled
  WAITING: '等待回應',         // Waiting for response / Awaiting customer response
  COMPLETED: '已完成',         // Completed / Closed
} as const

/**
 * Status metadata with display names and categorization
 */
export interface StatusConfig {
  id: string
  label: string
  category: 'pending' | 'active' | 'completed'
  icon?: string
  color?: string
}

export const REQUEST_STATUSES: StatusConfig[] = [
  {
    id: REQUEST_STATUS_IDS.PENDING,
    label: '待處理',
    category: 'pending',
    icon: '⏳',
    color: '#ef4444', // red
  },
  {
    id: REQUEST_STATUS_IDS.WAITING,
    label: '等待回應',
    category: 'active',
    icon: '👥',
    color: '#f59e0b', // amber
  },
  {
    id: REQUEST_STATUS_IDS.COMPLETED,
    label: '已完成',
    category: 'completed',
    icon: '✓',
    color: '#10b981', // green
  },
]

/**
 * Helper function: Get status config by ID
 */
export function getStatusConfig(statusId: string): StatusConfig | undefined {
  return REQUEST_STATUSES.find(s => s.id === statusId)
}

/**
 * Helper function: Get all status IDs
 */
export function getAllStatusIds(): string[] {
  return REQUEST_STATUSES.map(s => s.id)
}

/**
 * Helper function: Check if status is pending (not yet handled)
 */
export function isPendingStatus(statusId: string | null | undefined): boolean {
  return statusId === REQUEST_STATUS_IDS.PENDING
}

/**
 * Helper function: Check if status is waiting for response
 */
export function isWaitingStatus(statusId: string | null | undefined): boolean {
  return statusId === REQUEST_STATUS_IDS.WAITING
}

/**
 * Helper function: Check if status is completed
 */
export function isCompletedStatus(statusId: string | null | undefined): boolean {
  return statusId === REQUEST_STATUS_IDS.COMPLETED
}

/**
 * Helper function: Check if status is still active (not completed)
 */
export function isActiveStatus(statusId: string | null | undefined): boolean {
  return statusId !== REQUEST_STATUS_IDS.COMPLETED && statusId !== null && statusId !== undefined
}

/**
 * Helper function: Get display label for status
 */
export function getStatusLabel(statusId: string | null | undefined): string {
  if (!statusId) return REQUEST_STATUS_IDS.PENDING
  const config = getStatusConfig(statusId)
  return config?.label || statusId
}

/**
 * Status transition rules
 * Define which statuses can transition to which
 * (For future use - currently all transitions are allowed)
 */
export interface StatusTransition {
  from: string
  to: string[]
}

export const STATUS_TRANSITIONS: StatusTransition[] = [
  {
    from: REQUEST_STATUS_IDS.PENDING,
    to: [REQUEST_STATUS_IDS.WAITING, REQUEST_STATUS_IDS.COMPLETED],
  },
  {
    from: REQUEST_STATUS_IDS.WAITING,
    to: [REQUEST_STATUS_IDS.PENDING, REQUEST_STATUS_IDS.COMPLETED],
  },
  {
    from: REQUEST_STATUS_IDS.COMPLETED,
    to: [], // Cannot transition from completed
  },
]

/**
 * Helper function: Check if transition is allowed
 */
export function canTransition(fromStatus: string, toStatus: string): boolean {
  const rule = STATUS_TRANSITIONS.find(r => r.from === fromStatus)
  return rule ? rule.to.includes(toStatus) : false
}

/**
 * Statistics thresholds and rules
 */
export const STATISTICS_CONFIG = {
  // Silent consultation: no activity for more than N days in WAITING status
  SILENT_DAYS_THRESHOLD: 7,

  // Lost customer: no consultations for more than N days
  LOST_CUSTOMER_DAYS_THRESHOLD: 90,

  // Status IDs for statistics
  ACTIVE_STATUS_ID: REQUEST_STATUS_IDS.WAITING,      // Use this for "silent" calculation
  COMPLETED_STATUS_ID: REQUEST_STATUS_IDS.COMPLETED, // Use this for conversion rate
} as const

/**
 * Helper function: Get statuses for a specific category
 */
export function getStatusesByCategory(category: 'pending' | 'active' | 'completed'): StatusConfig[] {
  return REQUEST_STATUSES.filter(s => s.category === category)
}
