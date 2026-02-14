export function escapeODataString(value: string): string {
  if (!value) return ''
  return value
    .replace(/'/g, "''")
    .replace(/[<>{}|\\^~\[\]`]/g, '')
    .trim()
}

export function toIdempiereDateTime(date: Date): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`
}

/**
 * Parse iDempiere datetime string as local time.
 * iDempiere REST API returns "2026-02-14T09:00:00Z" where the time is actually
 * local time with a fake Z suffix. Stripping Z forces the browser to parse as local.
 */
export function parseIdempiereDateTime(s: string): Date {
  return new Date(s.replace(/Z$/i, ''))
}

export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
