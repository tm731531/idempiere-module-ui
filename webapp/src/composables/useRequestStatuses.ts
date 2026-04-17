/**
 * useRequestStatuses
 *
 * Loads R_Status rows once and caches them in module scope.
 * R_Status.IsClosed is the source of truth for determining terminal
 * (completed / closed) consultation states, replacing the previous
 * hardcoded ['已完成', 'Closed', '已轉化', 'Completed'] string match
 * against the legacy R_Request.LastResult field.
 */

import { ref, computed } from 'vue'
import { listRequestStatuses, type RequestStatus } from '@/api/request'

// Module-level cache: shared across all components in a session.
const statuses = ref<RequestStatus[]>([])
const loaded = ref(false)
const loading = ref<Promise<RequestStatus[]> | null>(null)

/**
 * Fallback completed-status name list used ONLY when R_Status table is
 * empty or when records expose a legacy string status (no R_Status_ID FK).
 * This allows a smooth migration period where older records still work.
 */
const FALLBACK_COMPLETED_NAMES = ['已完成', 'Closed', '已轉化', 'Completed']

/**
 * Extracts the numeric R_Status_ID from an R_Request record.
 * Handles expanded object form `{id, identifier, ...}`, bare number, or null.
 */
export function extractStatusId(req: any): number | null {
  const raw = req?.R_Status_ID
  if (raw == null) return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'object' && 'id' in raw) {
    const id = (raw as any).id
    return typeof id === 'number' ? id : null
  }
  return null
}

/**
 * Extracts a legacy status "name" from an R_Request record.
 * Checks (in order): expanded R_Status_ID.identifier / .Name, LastResult.
 * Used for backward compatibility with records that predate the FK migration
 * OR with test fixtures that pass string ids.
 */
export function extractStatusName(req: any): string | null {
  const raw = req?.R_Status_ID
  if (raw && typeof raw === 'object') {
    const name = (raw as any).Name || (raw as any).identifier
    if (typeof name === 'string' && name) return name
    // test fixtures sometimes use { id: '已完成', identifier: '已完成' }
    const id = (raw as any).id
    if (typeof id === 'string' && id) return id
  }
  if (typeof raw === 'string' && raw) return raw
  if (typeof req?.LastResult === 'string' && req.LastResult) return req.LastResult
  return null
}

/**
 * Load R_Status rows (once) from iDempiere.
 * Subsequent calls return cached promise.
 */
export async function loadRequestStatuses(forceReload = false): Promise<RequestStatus[]> {
  if (!forceReload && loaded.value) return statuses.value
  if (!forceReload && loading.value) return loading.value

  loading.value = (async () => {
    try {
      const rows = await listRequestStatuses()
      statuses.value = rows.slice().sort((a, b) => (a.SeqNo ?? 0) - (b.SeqNo ?? 0))
      loaded.value = true
      return statuses.value
    } catch (e) {
      // On error, keep any previously-cached rows and mark not-loaded so next call retries
      loaded.value = false
      throw e
    } finally {
      loading.value = null
    }
  })()

  return loading.value
}

/** Reset cache (e.g. on logout). */
export function clearRequestStatusesCache(): void {
  statuses.value = []
  loaded.value = false
  loading.value = null
}

/** All cached statuses, ordered by SeqNo. */
export function getAllStatuses(): RequestStatus[] {
  return statuses.value
}

/** Find a status by R_Status_ID. */
export function findStatus(id: number | null | undefined): RequestStatus | null {
  if (id == null) return null
  return statuses.value.find(s => s.R_Status_ID === id) ?? null
}

/**
 * Check whether a given R_Status_ID represents a terminal/closed state.
 *
 * Resolution order:
 *   1. If id is a number and appears in cached R_Status → use its IsClosed.
 *   2. If id is a string (or name was extracted from a legacy record) →
 *      compare against FALLBACK_COMPLETED_NAMES.
 */
export function isCompletedStatus(
  idOrName: number | string | null | undefined,
): boolean {
  if (idOrName == null || idOrName === '') return false

  if (typeof idOrName === 'number') {
    const s = findStatus(idOrName)
    if (s) return s.IsClosed === true
    // Unknown numeric id — cannot determine
    return false
  }

  // String: backward-compat / legacy LastResult
  const name = String(idOrName)
  // Also check cached statuses by name (tests / legacy)
  const byName = statuses.value.find(s => s.Name === name)
  if (byName) return byName.IsClosed === true
  return FALLBACK_COMPLETED_NAMES.includes(name)
}

/**
 * Check whether an R_Request record (not a bare id) represents a completed
 * consultation. Inspects the expanded R_Status_ID FK first, then falls back
 * to LastResult for legacy rows that were never migrated.
 */
export function isRequestCompleted(req: any): boolean {
  if (!req) return false
  const id = extractStatusId(req)
  if (typeof id === 'number') {
    // Known R_Status_ID — authoritative
    const s = findStatus(id)
    if (s) return s.IsClosed === true
  }
  // Fall back to name from expanded FK or LastResult
  const name = extractStatusName(req)
  if (name) return isCompletedStatus(name)
  return false
}

/**
 * Return the display name for a status id/object. Prefers the cached
 * R_Status.Name, falls back to the expanded identifier or the raw string.
 */
export function getStatusName(idOrObj: number | string | { id?: any; Name?: string; identifier?: string } | null | undefined): string {
  if (idOrObj == null || idOrObj === '') return ''
  if (typeof idOrObj === 'number') {
    return findStatus(idOrObj)?.Name ?? ''
  }
  if (typeof idOrObj === 'string') return idOrObj
  if (typeof idOrObj === 'object') {
    const id = (idOrObj as any).id
    if (typeof id === 'number') {
      const hit = findStatus(id)
      if (hit) return hit.Name
    }
    return (idOrObj as any).Name || (idOrObj as any).identifier || ''
  }
  return ''
}

/**
 * Vue composable that returns reactive status data plus helpers.
 */
export function useRequestStatuses() {
  const all = computed(() => statuses.value)
  const isReady = computed(() => loaded.value)

  return {
    all,
    isReady,
    load: loadRequestStatuses,
    clear: clearRequestStatusesCache,
    findStatus,
    isCompletedStatus,
    isRequestCompleted,
    getStatusName,
    extractStatusId,
    extractStatusName,
  }
}
