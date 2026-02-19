/**
 * Request Activity Utilities
 * Handles parsing and management of activity timeline data
 */

export interface Activity {
  timestamp: string
  type: string
  actionType: string
  content: string
  createdBy: string
}

/**
 * Parse activities from JSON string
 * Returns empty array if parsing fails
 */
export function parseActivities(jsonString: string): Activity[] {
  try {
    const parsed = JSON.parse(jsonString)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.warn('Failed to parse activities:', error)
    return []
  }
}

/**
 * Stringify activities to JSON
 */
export function stringifyActivities(activities: Activity[]): string {
  try {
    return JSON.stringify(activities)
  } catch (error) {
    console.warn('Failed to stringify activities:', error)
    return '[]'
  }
}
