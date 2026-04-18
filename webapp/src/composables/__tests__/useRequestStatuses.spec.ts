import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/request', () => ({
  listRequestStatuses: vi.fn(async () => [
    { R_Status_ID: 1, Name: '待處理', SeqNo: 10, IsActive: true, IsClosed: false },
    { R_Status_ID: 2, Name: '已完成', SeqNo: 20, IsActive: true, IsClosed: true },
    { R_Status_ID: 3, Name: '已取消', SeqNo: 30, IsActive: true, IsClosed: true },
  ]),
}))

import { listRequestStatuses } from '@/api/request'
import {
  loadRequestStatuses,
  clearRequestStatusesCache,
  findStatus,
  isCancelledStatus,
  isCompletedStatus,
  isRequestCompleted,
  extractStatusId,
  extractStatusName,
} from '@/composables/useRequestStatuses'

describe('useRequestStatuses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearRequestStatusesCache()
  })

  // ── loadRequestStatuses ────────────────────────────────────────────

  describe('loadRequestStatuses', () => {
    it('calls API and returns statuses ordered by SeqNo', async () => {
      const result = await loadRequestStatuses()

      expect(listRequestStatuses).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(3)
      expect(result[0]!.R_Status_ID).toBe(1)
      expect(result[1]!.R_Status_ID).toBe(2)
      expect(result[2]!.R_Status_ID).toBe(3)
    })

    it('returns cached result on second call without force', async () => {
      await loadRequestStatuses()
      await loadRequestStatuses()

      expect(listRequestStatuses).toHaveBeenCalledTimes(1)
    })

    it('reloads from API when force=true', async () => {
      await loadRequestStatuses()
      await loadRequestStatuses(true)

      expect(listRequestStatuses).toHaveBeenCalledTimes(2)
    })
  })

  // ── findStatus ─────────────────────────────────────────────────────

  describe('findStatus', () => {
    beforeEach(async () => {
      await loadRequestStatuses()
    })

    it('returns the matching status row for a known ID', () => {
      const status = findStatus(1)
      expect(status).not.toBeNull()
      expect(status!.Name).toBe('待處理')
    })

    it('returns null for an unknown ID', () => {
      expect(findStatus(999)).toBeNull()
    })

    it('returns null when called with null', () => {
      expect(findStatus(null)).toBeNull()
    })
  })

  // ── isCompletedStatus ──────────────────────────────────────────────

  describe('isCompletedStatus', () => {
    beforeEach(async () => {
      await loadRequestStatuses()
    })

    it('returns true for a status with IsClosed=true (numeric ID)', () => {
      expect(isCompletedStatus(2)).toBe(true)
    })

    it('returns false for a status with IsClosed=false (numeric ID)', () => {
      expect(isCompletedStatus(1)).toBe(false)
    })

    it('returns false for unknown numeric ID', () => {
      expect(isCompletedStatus(999)).toBe(false)
    })

    it('returns false for null/empty', () => {
      expect(isCompletedStatus(null)).toBe(false)
      expect(isCompletedStatus('')).toBe(false)
    })

    it('matches cached status by name string', () => {
      // '已完成' is in the mock data with IsClosed=true
      expect(isCompletedStatus('已完成')).toBe(true)
      // '待處理' is in the mock data with IsClosed=false
      expect(isCompletedStatus('待處理')).toBe(false)
    })

    it('uses FALLBACK_COMPLETED_NAMES for legacy strings not in cache', async () => {
      // Clear cache so only fallback list is used
      clearRequestStatusesCache()
      // cache is empty — falls back to hardcoded list
      expect(isCompletedStatus('Closed')).toBe(true)
      expect(isCompletedStatus('已轉化')).toBe(true)
      expect(isCompletedStatus('新單')).toBe(false)
    })

    it('returns false for a cancelled status even when IsClosed=true (numeric ID)', () => {
      expect(isCompletedStatus(3)).toBe(false)
    })

    it('returns false for cancelled status name string', () => {
      expect(isCompletedStatus('已取消')).toBe(false)
      expect(isCompletedStatus('cancelled')).toBe(false)
    })
  })

  // ── isCancelledStatus ──────────────────────────────────────────────

  describe('isCancelledStatus', () => {
    beforeEach(async () => {
      await loadRequestStatuses()
    })

    it('returns true for a status whose Name contains "取消"', () => {
      expect(isCancelledStatus(3)).toBe(true)
    })

    it('returns false for a non-cancel status', () => {
      expect(isCancelledStatus(2)).toBe(false)
      expect(isCancelledStatus(1)).toBe(false)
    })

    it('detects cancel by string name', () => {
      expect(isCancelledStatus('已取消')).toBe(true)
      expect(isCancelledStatus('cancel')).toBe(true)
      expect(isCancelledStatus('Cancelled')).toBe(true)
    })

    it('returns false for null/empty', () => {
      expect(isCancelledStatus(null)).toBe(false)
      expect(isCancelledStatus('')).toBe(false)
    })
  })

  // ── isRequestCompleted ─────────────────────────────────────────────

  describe('isRequestCompleted', () => {
    beforeEach(async () => {
      await loadRequestStatuses()
    })

    it('returns true when R_Status_ID is expanded object with IsClosed=true', () => {
      const req = { R_Status_ID: { id: 2, IsClosed: true } }
      expect(isRequestCompleted(req)).toBe(true)
    })

    it('returns false when R_Status_ID is expanded object with IsClosed=false', () => {
      const req = { R_Status_ID: { id: 1, IsClosed: false } }
      expect(isRequestCompleted(req)).toBe(false)
    })

    it('returns false for null/undefined request', () => {
      expect(isRequestCompleted(null)).toBe(false)
      expect(isRequestCompleted(undefined)).toBe(false)
    })

    it('falls back to LastResult for legacy records without R_Status_ID', () => {
      // With cache empty, falls back to FALLBACK_COMPLETED_NAMES
      clearRequestStatusesCache()
      expect(isRequestCompleted({ LastResult: 'Closed' })).toBe(true)
      expect(isRequestCompleted({ LastResult: '新單' })).toBe(false)
    })

    it('returns false for a cancelled status even though IsClosed=true', () => {
      const req = { R_Status_ID: { id: 3 } }
      expect(isRequestCompleted(req)).toBe(false)
    })

    it('returns false when LastResult is a cancel name', () => {
      clearRequestStatusesCache()
      expect(isRequestCompleted({ LastResult: '已取消' })).toBe(false)
    })
  })

  // ── extractStatusId ────────────────────────────────────────────────

  describe('extractStatusId', () => {
    it('extracts bare numeric ID', () => {
      expect(extractStatusId({ R_Status_ID: 42 })).toBe(42)
    })

    it('extracts id from expanded object', () => {
      expect(extractStatusId({ R_Status_ID: { id: 7, identifier: '待處理' } })).toBe(7)
    })

    it('returns null when R_Status_ID is null', () => {
      expect(extractStatusId({ R_Status_ID: null })).toBeNull()
    })

    it('returns null when R_Status_ID is undefined', () => {
      expect(extractStatusId({})).toBeNull()
    })

    it('returns null when R_Status_ID object has a non-numeric id', () => {
      expect(extractStatusId({ R_Status_ID: { id: 'string-id' } })).toBeNull()
    })
  })

  // ── extractStatusName ──────────────────────────────────────────────

  describe('extractStatusName', () => {
    it('returns Name from expanded R_Status_ID object', () => {
      const req = { R_Status_ID: { id: 2, Name: '已完成', identifier: 'Completed' } }
      expect(extractStatusName(req)).toBe('已完成')
    })

    it('falls back to identifier when Name is absent', () => {
      const req = { R_Status_ID: { id: 2, identifier: '已完成' } }
      expect(extractStatusName(req)).toBe('已完成')
    })

    it('falls back to LastResult when R_Status_ID is absent', () => {
      const req = { LastResult: '待處理' }
      expect(extractStatusName(req)).toBe('待處理')
    })

    it('returns null when no status info is available', () => {
      expect(extractStatusName({})).toBeNull()
    })
  })
})
