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

/**
 * Add a new activity to the JSON string
 * Automatically assigns current timestamp
 */
export function addActivity(
  existingJson: string,
  activity: Omit<Activity, 'timestamp'>
): string {
  const activities = parseActivities(existingJson)
  activities.push({
    ...activity,
    timestamp: new Date().toISOString(),
  })
  return stringifyActivities(activities)
}

/**
 * Check if a string is valid activity JSON (array format)
 */
export function isActivityJSON(json: string): boolean {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed)
  } catch {
    return false
  }
}

/**
 * Get the timestamp of the last activity
 * Returns null if no activities found
 */
export function getLastActivityTime(json: string): string | null {
  const activities = parseActivities(json)
  if (activities.length === 0) return null
  return activities[activities.length - 1].timestamp
}

/**
 * Filter activities by type
 * Returns array of activities matching the specified type
 */
export function getActivitiesByType(json: string, type: string): Activity[] {
  const activities = parseActivities(json)
  return activities.filter((a) => a.type === type)
}

/**
 * Check for activity conflicts (overlapping timestamps)
 * Returns true if multiple activities have the same timestamp
 */
export function hasConflict(activities: Activity[]): boolean {
  // Extract all timestamps and check for duplicates
  const timestamps = activities.map((a) => a.timestamp)
  return timestamps.length !== new Set(timestamps).size
}
