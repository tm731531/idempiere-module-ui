import { describe, it, expect, vi, afterEach } from 'vitest'
import { getTrackingBadge } from '../trackingBadge'

describe('getTrackingBadge', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null for null input', () => {
    expect(getTrackingBadge(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(getTrackingBadge(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getTrackingBadge('')).toBeNull()
  })

  it('returns null for invalid date string', () => {
    expect(getTrackingBadge('not-a-date')).toBeNull()
  })

  it('returns red badge for overdue date (yesterday)', () => {
    vi.useFakeTimers()
    // Fix "now" to 2026-05-10T12:00:00 local
    vi.setSystemTime(new Date(2026, 4, 10, 12, 0, 0))

    // Yesterday = 2026-05-09
    const result = getTrackingBadge('2026-05-09T09:00:00Z')
    expect(result).not.toBeNull()
    expect(result!.color).toBe('red')
    expect(result!.text).toContain('逾期')
    expect(result!.text).toContain('1 天')
  })

  it('returns red badge for overdue date (5 days ago)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 10, 12, 0, 0))

    const result = getTrackingBadge('2026-05-05T09:00:00Z')
    expect(result).not.toBeNull()
    expect(result!.color).toBe('red')
    expect(result!.text).toBe('逾期 5 天')
  })

  it('returns orange badge for today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 10, 12, 0, 0))

    const result = getTrackingBadge('2026-05-10T09:00:00Z')
    expect(result).not.toBeNull()
    expect(result!.color).toBe('orange')
    expect(result!.text).toBe('今日跟進')
  })

  it('returns yellow badge for tomorrow', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 10, 12, 0, 0))

    const result = getTrackingBadge('2026-05-11T09:00:00Z')
    expect(result).not.toBeNull()
    expect(result!.color).toBe('yellow')
    expect(result!.text).toBe('明日跟進')
  })

  it('returns gray badge for 3 days from now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 10, 12, 0, 0))

    const result = getTrackingBadge('2026-05-13T09:00:00Z')
    expect(result).not.toBeNull()
    expect(result!.color).toBe('gray')
    expect(result!.text).toBe('3 天後')
  })

  it('handles iDempiere Z-suffix as local time (strips Z before parse)', () => {
    vi.useFakeTimers()
    // Fix "now" to a specific local time
    vi.setSystemTime(new Date(2026, 4, 10, 12, 0, 0))

    // The date 2026-05-10T00:00:00Z should be treated as local midnight = today
    const result = getTrackingBadge('2026-05-10T00:00:00Z')
    expect(result).not.toBeNull()
    expect(result!.color).toBe('orange')   // today
  })
})
