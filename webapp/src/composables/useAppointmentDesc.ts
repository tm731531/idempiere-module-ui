/**
 * useAppointmentDesc
 *
 * Parse / serialize the Description JSON stored in S_ResourceAssignment.Description.
 *
 * Format:
 * {
 *   "status": "CFM",          // SCH | CFM | CHK | INP | DON | ABS | CXL
 *   "group_id": "grp_...",    // optional — links assignments created together
 *   "bpartner_id": 1000023,   // C_BPartner_ID (numeric)
 *   "bpartner_name": "王小明", // display name (cache, avoids extra FK lookup)
 *   "service": "諮詢",         // service / treatment name
 *   "notes": "...",            // free text notes
 *   "order_id": null           // linked C_Order_ID (if any)
 * }
 *
 * Old records may have a plain-text Description (no JSON) — parseDesc handles
 * that gracefully by returning an empty object.
 */

export interface AppointmentDesc {
  status?: string               // SCH | CFM | CHK | INP | DON | ABS | CXL
  group_id?: string
  bpartner_id?: number | null
  bpartner_name?: string
  service?: string
  notes?: string
  order_id?: number | null
}

/**
 * Parse a raw Description string from S_ResourceAssignment.
 * Returns an empty object for null / non-JSON strings (legacy records).
 */
export function parseDesc(raw: string | undefined | null): AppointmentDesc {
  if (!raw) return {}
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{')) return {}
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as AppointmentDesc
  } catch {
    return {}
  }
}

/**
 * Serialize an AppointmentDesc to a JSON string.
 * Strips undefined / null optional keys to keep the payload compact.
 */
export function serializeDesc(desc: AppointmentDesc): string {
  // Keep only defined keys to avoid polluting the Description field
  const clean: Record<string, unknown> = {}
  if (desc.status !== undefined) clean.status = desc.status
  if (desc.group_id !== undefined) clean.group_id = desc.group_id
  if (desc.bpartner_id !== undefined) clean.bpartner_id = desc.bpartner_id
  if (desc.bpartner_name !== undefined) clean.bpartner_name = desc.bpartner_name
  if (desc.service !== undefined) clean.service = desc.service
  if (desc.notes !== undefined) clean.notes = desc.notes
  if (desc.order_id !== undefined) clean.order_id = desc.order_id
  return JSON.stringify(clean)
}

/**
 * Build a human-readable appointment name from BPartner name and service.
 * Format: "王小明 - 諮詢"
 * Falls back gracefully when either part is missing.
 */
export function buildName(bpartnerName: string, service: string): string {
  const bp = bpartnerName.trim()
  const svc = service.trim()
  if (bp && svc) return `${bp} - ${svc}`
  if (bp) return bp
  if (svc) return svc
  return ''
}
