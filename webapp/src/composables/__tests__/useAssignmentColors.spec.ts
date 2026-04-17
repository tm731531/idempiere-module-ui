import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'

// ========== Mock the sysconfig API ==========
vi.mock('@/api/sysconfig', () => ({
  getResourceColors: vi.fn(),
  setResourceColors: vi.fn(),
  getAssignmentColors: vi.fn(),
  setAssignmentColor: vi.fn(),
}))

import {
  getResourceColors,
  setResourceColors,
  getAssignmentColors,
  setAssignmentColor as _setAssignmentColorApi,
} from '@/api/sysconfig'

// Re-import module under test AFTER mocks are set up
// We need to reset module state between tests, so use dynamic imports

describe('useAssignmentColors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  async function freshImport() {
    // Force a fresh module instance for each test
    const mod = await import('@/composables/useAssignmentColors')
    return mod
  }

  describe('resolveAssignmentColor — priority', () => {
    it('returns assignment override when present', async () => {
      vi.mocked(getResourceColors).mockResolvedValue({ 10: '#aabbcc' })
      vi.mocked(getAssignmentColors).mockResolvedValue({ 99: '#ff0000' })

      const { useAssignmentColors } = await freshImport()
      const { load, resolveAssignmentColor } = useAssignmentColors()
      await load()
      await flushPromises()

      expect(resolveAssignmentColor(99, 10)).toBe('#ff0000')
    })

    it('falls back to resource color when no assignment override', async () => {
      vi.mocked(getResourceColors).mockResolvedValue({ 10: '#aabbcc' })
      vi.mocked(getAssignmentColors).mockResolvedValue({})

      const { useAssignmentColors } = await freshImport()
      const { load, resolveAssignmentColor } = useAssignmentColors()
      await load()
      await flushPromises()

      expect(resolveAssignmentColor(99, 10)).toBe('#aabbcc')
    })

    it('falls back to DEFAULT_APPT_COLOR when neither override nor resource color', async () => {
      vi.mocked(getResourceColors).mockResolvedValue({})
      vi.mocked(getAssignmentColors).mockResolvedValue({})

      const { useAssignmentColors, DEFAULT_APPT_COLOR } = await freshImport()
      const { load, resolveAssignmentColor } = useAssignmentColors()
      await load()
      await flushPromises()

      expect(resolveAssignmentColor(99, 10)).toBe(DEFAULT_APPT_COLOR)
    })

    it('treats null/undefined assignmentId as no-override (falls back to resource)', async () => {
      vi.mocked(getResourceColors).mockResolvedValue({ 10: '#00ff00' })
      vi.mocked(getAssignmentColors).mockResolvedValue({ 99: '#ff0000' })

      const { useAssignmentColors } = await freshImport()
      const { load, resolveAssignmentColor } = useAssignmentColors()
      await load()
      await flushPromises()

      // Passing null for assignmentId should skip override lookup
      expect(resolveAssignmentColor(null, 10)).toBe('#00ff00')
      expect(resolveAssignmentColor(undefined, 10)).toBe('#00ff00')
    })
  })

  describe('load', () => {
    it('loads both color maps from AD_SysConfig', async () => {
      const resColors = { 1: '#111111', 2: '#222222' }
      const asgColors = { 100: '#333333' }
      vi.mocked(getResourceColors).mockResolvedValue(resColors)
      vi.mocked(getAssignmentColors).mockResolvedValue(asgColors)

      const { useAssignmentColors } = await freshImport()
      const { load, resourceColors, assignmentColors } = useAssignmentColors()
      await load()
      await flushPromises()

      expect(resourceColors.value).toEqual(resColors)
      expect(assignmentColors.value).toEqual(asgColors)
    })

    it('is idempotent — only calls API once even when called multiple times', async () => {
      vi.mocked(getResourceColors).mockResolvedValue({})
      vi.mocked(getAssignmentColors).mockResolvedValue({})

      const { useAssignmentColors } = await freshImport()
      const { load } = useAssignmentColors()
      await load()
      await load()
      await load()
      await flushPromises()

      expect(getResourceColors).toHaveBeenCalledTimes(1)
    })

    it('handles API errors gracefully (does not throw)', async () => {
      vi.mocked(getResourceColors).mockRejectedValue(new Error('network error'))
      vi.mocked(getAssignmentColors).mockRejectedValue(new Error('network error'))

      const { useAssignmentColors } = await freshImport()
      const { load, resourceColors } = useAssignmentColors()

      await expect(load()).resolves.toBeUndefined()
      await flushPromises()

      // Should remain empty, not throw
      expect(resourceColors.value).toEqual({})
    })
  })

  describe('setResourceColor — debounced save', () => {
    it('saves after 500ms debounce', async () => {
      vi.mocked(getResourceColors).mockResolvedValue({})
      vi.mocked(getAssignmentColors).mockResolvedValue({})
      vi.mocked(setResourceColors).mockResolvedValue(undefined)

      const { useAssignmentColors } = await freshImport()
      const { load, setResourceColor } = useAssignmentColors()
      await load()
      await flushPromises()

      setResourceColor(5, '#123456')
      // Not yet saved (debounce pending)
      expect(setResourceColors).not.toHaveBeenCalled()

      vi.advanceTimersByTime(500)
      await flushPromises()

      expect(setResourceColors).toHaveBeenCalledTimes(1)
      expect(setResourceColors).toHaveBeenCalledWith(expect.objectContaining({ 5: '#123456' }))
    })

    it('debounces multiple rapid calls into one save', async () => {
      vi.mocked(getResourceColors).mockResolvedValue({})
      vi.mocked(getAssignmentColors).mockResolvedValue({})
      vi.mocked(setResourceColors).mockResolvedValue(undefined)

      const { useAssignmentColors } = await freshImport()
      const { load, setResourceColor } = useAssignmentColors()
      await load()
      await flushPromises()

      setResourceColor(1, '#aaa')
      setResourceColor(1, '#bbb')
      setResourceColor(1, '#ccc')

      vi.advanceTimersByTime(500)
      await flushPromises()

      // Only one save call with the final value
      expect(setResourceColors).toHaveBeenCalledTimes(1)
      expect(setResourceColors).toHaveBeenCalledWith(expect.objectContaining({ 1: '#ccc' }))
    })
  })

  describe('setAssignmentColorOverride', () => {
    it('updates local assignmentColors optimistically', async () => {
      vi.mocked(getResourceColors).mockResolvedValue({})
      vi.mocked(getAssignmentColors).mockResolvedValue({})
      vi.mocked(_setAssignmentColorApi).mockResolvedValue(undefined)

      const { useAssignmentColors } = await freshImport()
      const { load, setAssignmentColorOverride, assignmentColors } = useAssignmentColors()
      await load()
      await flushPromises()

      await setAssignmentColorOverride(42, '#abcdef')
      await flushPromises()

      expect(assignmentColors.value[42]).toBe('#abcdef')
    })

    it('removes local entry when color is null', async () => {
      vi.mocked(getResourceColors).mockResolvedValue({})
      vi.mocked(getAssignmentColors).mockResolvedValue({ 42: '#abcdef' })
      vi.mocked(_setAssignmentColorApi).mockResolvedValue(undefined)

      const { useAssignmentColors } = await freshImport()
      const { load, setAssignmentColorOverride, assignmentColors } = useAssignmentColors()
      await load()
      await flushPromises()

      await setAssignmentColorOverride(42, null)
      await flushPromises()

      expect(assignmentColors.value[42]).toBeUndefined()
    })

    it('does not throw when API call fails (non-blocking)', async () => {
      vi.mocked(getResourceColors).mockResolvedValue({})
      vi.mocked(getAssignmentColors).mockResolvedValue({})
      vi.mocked(_setAssignmentColorApi).mockRejectedValue(new Error('save failed'))

      const { useAssignmentColors } = await freshImport()
      const { load, setAssignmentColorOverride } = useAssignmentColors()
      await load()
      await flushPromises()

      // Should not throw
      await expect(setAssignmentColorOverride(42, '#ff0000')).resolves.toBeUndefined()
      await flushPromises()
    })
  })
})
