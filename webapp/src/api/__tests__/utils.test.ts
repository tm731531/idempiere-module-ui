import { describe, it, expect } from 'vitest'
import { escapeODataString, toIdempiereDateTime, toDateString } from '@/api/utils'

describe('escapeODataString', () => {
  it('should escape single quotes', () => {
    expect(escapeODataString("O'Brien")).toBe("O''Brien")
  })
  it('should remove dangerous characters', () => {
    expect(escapeODataString('test<script>')).toBe('testscript')
  })
  it('should return empty for empty input', () => {
    expect(escapeODataString('')).toBe('')
  })
})

describe('toIdempiereDateTime', () => {
  it('should format local time with Z suffix', () => {
    const d = new Date(2026, 1, 13, 14, 30, 0)
    expect(toIdempiereDateTime(d)).toBe('2026-02-13T14:30:00Z')
  })
})

describe('toDateString', () => {
  it('should format as YYYY-MM-DD', () => {
    const d = new Date(2026, 0, 5)
    expect(toDateString(d)).toBe('2026-01-05')
  })
})
