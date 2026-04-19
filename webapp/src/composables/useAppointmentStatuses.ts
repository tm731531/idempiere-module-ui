/**
 * useAppointmentStatuses
 *
 * Loads appointment status definitions from iDempiere AD_Reference (name = 'AppointmentStatus').
 * Falls back to built-in defaults when the AD_Reference does not exist in the target environment.
 *
 * Status Value codes:
 *   SCH = 預約中   CFM = 已確認   CHK = 已到場   INP = 進行中
 *   DON = 已完成   ABS = 未到     CXL = 取消
 *
 * Terminal statuses (CXL, ABS): appointment is over / cancelled.
 * Conflict detection should exclude records with terminal status.
 */

import { ref } from 'vue'
import { apiClient } from '@/api/client'

export interface AppointmentStatus {
  Value: string   // e.g. SCH, CFM, CHK, INP, DON, ABS, CXL
  Name: string    // display name in zh-TW
  color: string   // hex color from Description field
}

// Terminal status codes — conflicts should exclude these
const TERMINAL_CODES = new Set<string>(['CXL', 'ABS'])

// Default fallback when AD_Reference is not configured in iDempiere
const DEFAULT_STATUSES: AppointmentStatus[] = [
  { Value: 'SCH', Name: '預約中', color: '#FBBF24' },
  { Value: 'CFM', Name: '已確認', color: '#3B82F6' },
  { Value: 'CHK', Name: '已到場', color: '#10B981' },
  { Value: 'INP', Name: '進行中', color: '#F97316' },
  { Value: 'DON', Name: '已完成', color: '#9CA3AF' },
  { Value: 'ABS', Name: '未到',   color: '#EF4444' },
  { Value: 'CXL', Name: '取消',   color: '#D1D5DB' },
]

// Module-level cache — shared across all components in a session
let cached: AppointmentStatus[] | null = null
let loadingPromise: Promise<AppointmentStatus[]> | null = null

/**
 * Load appointment statuses from AD_Reference 'AppointmentStatus'.
 * Two-step query:
 *   1. GET AD_Reference by Name → extract AD_Reference_ID
 *   2. GET AD_Ref_List filtered by that ID → map to AppointmentStatus[]
 * Falls back to DEFAULT_STATUSES on any error or empty result.
 */
export async function loadAppointmentStatuses(): Promise<AppointmentStatus[]> {
  if (cached !== null) return cached
  if (loadingPromise !== null) return loadingPromise

  loadingPromise = (async () => {
    try {
      // Step 1: resolve AD_Reference_ID by Name
      const refResp = await apiClient.get('/api/v1/models/AD_Reference', {
        params: {
          '$filter': "Name eq 'AppointmentStatus'",
          '$select': 'AD_Reference_ID',
          '$top': '1',
        },
      })
      const refRecords: any[] = refResp.data?.records ?? []
      if (refRecords.length === 0) {
        // AD_Reference not configured — use defaults silently
        cached = applyOverrides(DEFAULT_STATUSES)
        return cached
      }

      const refId: number = refRecords[0]!.id ?? refRecords[0]!.AD_Reference_ID
      if (!refId) {
        cached = applyOverrides(DEFAULT_STATUSES)
        return cached
      }

      // Step 2: load AD_Ref_List entries
      const listResp = await apiClient.get('/api/v1/models/AD_Ref_List', {
        params: {
          '$filter': `AD_Reference_ID eq ${refId}`,
          '$select': 'Value,Name,Description',
          '$orderby': 'Value',
          '$top': '50',
        },
      })
      const listRecords: any[] = listResp.data?.records ?? []
      if (listRecords.length === 0) {
        cached = applyOverrides(DEFAULT_STATUSES)
        return cached
      }

      cached = applyOverrides(listRecords.map((r) => ({
        Value: String(r.Value ?? ''),
        Name: String(r.Name ?? r.Value ?? ''),
        // Description field stores the hex color (e.g. "#FBBF24")
        color: isHexColor(r.Description) ? r.Description : (getFallbackColor(r.Value) ?? '#94A3B8'),
      })))

      return cached
    } catch {
      // Network error or permission issue — fall back to defaults
      cached = applyOverrides(DEFAULT_STATUSES)
      return cached
    } finally {
      loadingPromise = null
    }
  })()

  return loadingPromise
}

function isHexColor(val: unknown): val is string {
  return typeof val === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(val.trim())
}

function getFallbackColor(value: unknown): string | undefined {
  const s = DEFAULT_STATUSES.find((d) => d.Value === value)
  return s?.color
}

/** Return the color for a status value. Falls back to #94A3B8 (slate-400). */
export function getStatusColor(value: string): string {
  if (!cached) return '#94A3B8'
  return cached.find((s) => s.Value === value)?.color ?? '#94A3B8'
}

/** Return the display name for a status value. Falls back to the raw value. */
export function getStatusName(value: string): string {
  if (!cached) return value
  return cached.find((s) => s.Value === value)?.Name ?? value
}

/**
 * Returns true if the status is terminal (CXL or ABS).
 * Terminal appointments should be excluded from conflict detection.
 */
export function isTerminalStatus(value: string): boolean {
  return TERMINAL_CODES.has(value)
}

/** Reset the cache (e.g. on logout). Note: does NOT clear localStorage overrides (user preference). */
export function clearAppointmentStatusCache(): void {
  cached = null
  loadingPromise = null
}

// ─── localStorage override support ────────────────────────────────────────────

const OVERRIDE_KEY = 'appointmentStatusOverrides'
interface StatusOverride { name?: string; color?: string }
type OverrideMap = Record<string, StatusOverride>

function readOverrides(): OverrideMap {
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? '{}') }
  catch { return {} }
}

function writeOverrides(map: OverrideMap): void {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map))
}

export function applyOverrides(statuses: AppointmentStatus[]): AppointmentStatus[] {
  const overrides = readOverrides()
  return statuses.map(s => {
    const ov = overrides[s.Value]
    if (!ov) return s
    return { ...s, Name: ov.name ?? s.Name, color: ov.color ?? s.color }
  })
}

/** Save a color override for a status (null = remove override). */
export function saveStatusColorOverride(value: string, color: string | null): void {
  const map = readOverrides()
  if (!map[value]) map[value] = {}
  if (color === null) delete map[value]!.color
  else map[value]!.color = color
  writeOverrides(map)
  if (cached) cached = applyOverrides(cached)
}

/** Save a name override for a status (null = remove override). */
export function saveStatusNameOverride(value: string, name: string | null): void {
  const map = readOverrides()
  if (!map[value]) map[value] = {}
  if (name === null) delete map[value]!.name
  else map[value]!.name = name
  writeOverrides(map)
  if (cached) cached = applyOverrides(cached)
}

/** Remove all localStorage overrides. */
export function clearStatusOverrides(): void {
  localStorage.removeItem(OVERRIDE_KEY)
  if (cached) {
    // Re-apply with empty overrides (i.e. remove all overrides from cached)
    clearAppointmentStatusCache()
  }
}

/**
 * Vue composable — returns reactive status list and helpers.
 * Call loadAppointmentStatuses() before rendering to pre-warm the cache.
 */
export function useAppointmentStatuses() {
  const statuses = ref<AppointmentStatus[]>(cached ?? DEFAULT_STATUSES)

  async function load() {
    const result = await loadAppointmentStatuses()
    statuses.value = result
  }

  return {
    statuses,
    load,
    getStatusColor,
    getStatusName,
    isTerminalStatus,
    clearCache: clearAppointmentStatusCache,
  }
}
