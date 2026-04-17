/**
 * Compute tracking badge metadata for DateNextAction display.
 *
 * iDempiere REST returns "Z" suffix on DateTime but the value is actually local
 * time — strip Z before parsing (see parseIdempiereDateTime).
 */
export interface TrackingBadge {
  text: string
  color: 'red' | 'orange' | 'yellow' | 'gray'
}

export function getTrackingBadge(dateStr: string | null | undefined): TrackingBadge | null {
  if (!dateStr) return null

  // Strip the fake-Z suffix so the browser parses as local time
  const d = new Date(String(dateStr).replace(/Z$/i, ''))
  if (isNaN(d.getTime())) return null

  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)

  // Compare calendar days only (not time-of-day)
  const trackingDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffMs = trackingDay.getTime() - todayMidnight.getTime()
  const diffDays = Math.round(diffMs / 86400000)

  if (diffDays < 0) {
    return { text: `逾期 ${Math.abs(diffDays)} 天`, color: 'red' }
  } else if (diffDays === 0) {
    return { text: '今日跟進', color: 'orange' }
  } else if (diffDays === 1) {
    return { text: '明日跟進', color: 'yellow' }
  } else {
    return { text: `${diffDays} 天後`, color: 'gray' }
  }
}
