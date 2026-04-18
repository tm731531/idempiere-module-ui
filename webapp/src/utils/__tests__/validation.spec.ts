import { describe, it, expect } from 'vitest'
import {
  validateActivityContent,
  validateRequestForm,
  validateEmail,
  validatePhone,
  sanitizeUserInput,
  validateStatusSelection,
  validateTrackingDate,
  validateTrackingTime,
} from '../validation'

describe('Activity Content Validation', () => {
  it('validates empty content', () => {
    const result = validateActivityContent('')
    expect(result.isValid).toBe(false)
    expect(result.errors.content).toBe('請輸入活動內容')
  })

  it('validates whitespace-only content', () => {
    const result = validateActivityContent('   ')
    expect(result.isValid).toBe(false)
    expect(result.errors.content).toBe('請輸入活動內容')
  })

  it('validates max length (500 chars)', () => {
    const longContent = 'a'.repeat(501)
    const result = validateActivityContent(longContent)
    expect(result.isValid).toBe(false)
    expect(result.errors.content).toBe('活動內容不能超過500字')
  })

  it('accepts valid content', () => {
    const result = validateActivityContent('Valid activity content')
    expect(result.isValid).toBe(true)
    expect(Object.keys(result.errors).length).toBe(0)
  })

  it('accepts 500 char content', () => {
    const content = 'a'.repeat(500)
    const result = validateActivityContent(content)
    expect(result.isValid).toBe(true)
  })
})

describe('Request Form Validation', () => {
  it('validates empty summary', () => {
    const result = validateRequestForm({
      Summary: '',
      R_RequestType_ID: 1,
      R_Status_ID: 1,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.Summary).toBe('請輸入諮詢摘要')
  })

  it('validates summary max length', () => {
    const result = validateRequestForm({
      Summary: 'a'.repeat(201),
      R_RequestType_ID: 1,
      R_Status_ID: 1,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.Summary).toBe('諮詢摘要不能超過200字')
  })

  it('validates missing request type', () => {
    const result = validateRequestForm({
      Summary: 'Valid',
      R_RequestType_ID: undefined,
      R_Status_ID: 1,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.R_RequestType_ID).toBe('請選擇諮詢類型')
  })

  it('validates missing status', () => {
    const result = validateRequestForm({
      Summary: 'Valid',
      R_RequestType_ID: 1,
      R_Status_ID: undefined,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.R_Status_ID).toBe('請選擇狀態')
  })

  it('accepts valid form', () => {
    const result = validateRequestForm({
      Summary: 'Valid summary',
      R_RequestType_ID: 1,
      R_Status_ID: 1,
      C_BPartner_ID: 100,
    })

    expect(result.isValid).toBe(true)
  })

  it('accepts form without customer', () => {
    const result = validateRequestForm({
      Summary: 'Valid summary',
      R_RequestType_ID: 1,
      R_Status_ID: 1,
    })

    expect(result.isValid).toBe(true)
  })
})

describe('Email Validation', () => {
  it('rejects invalid email', () => {
    expect(validateEmail('not-an-email')).toBe(false)
  })

  it('accepts valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true)
  })

  it('accepts email with subdomain', () => {
    expect(validateEmail('user@mail.example.com')).toBe(true)
  })

  it('rejects email without domain', () => {
    expect(validateEmail('test@')).toBe(false)
  })

  it('rejects email without @', () => {
    expect(validateEmail('testexample.com')).toBe(false)
  })
})

describe('Phone Validation', () => {
  it('accepts basic phone number', () => {
    expect(validatePhone('1234567890')).toBe(true)
  })

  it('accepts phone with country code', () => {
    expect(validatePhone('+123456789')).toBe(true)
  })

  it('accepts formatted phone', () => {
    expect(validatePhone('123-456-7890')).toBe(true)
  })

  it('accepts phone with parentheses', () => {
    expect(validatePhone('(123) 456-7890')).toBe(true)
  })

  it('rejects invalid phone', () => {
    expect(validatePhone('abc')).toBe(false)
  })
})

describe('Input Sanitization', () => {
  it('removes angle brackets', () => {
    const result = sanitizeUserInput('<script>alert("xss")</script>')
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
  })

  it('trims whitespace', () => {
    const result = sanitizeUserInput('  hello  ')
    expect(result).toBe('hello')
  })

  it('handles empty input', () => {
    const result = sanitizeUserInput('')
    expect(result).toBe('')
  })

  it('preserves normal text', () => {
    const result = sanitizeUserInput('Hello World')
    expect(result).toBe('Hello World')
  })
})

describe('Tracking Date Validation', () => {
  it('accepts today\'s date in local time (not rejected due to UTC parse)', () => {
    // Bug: new Date('2026-05-10') parses as UTC midnight.
    // In UTC+8 that equals 2026-05-09 08:00 local — making today appear as "past".
    // Fix: parseDateStringLocal() uses new Date(y, m-1, d) which is local midnight.
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const result = validateTrackingDate(todayLocal)
    expect(result.isValid).toBe(true)
    expect(result.errors.date).toBeUndefined()
  })

  it('rejects empty date', () => {
    const result = validateTrackingDate('')
    expect(result.isValid).toBe(false)
    expect(result.errors.date).toBe('請選擇日期')
  })

  it('rejects a past date', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`
    const result = validateTrackingDate(dateStr)
    expect(result.isValid).toBe(false)
    expect(result.errors.date).toBe('日期不能是過去的日期')
  })

  it('rejects a date more than 90 days in the future', () => {
    const future = new Date()
    future.setDate(future.getDate() + 91)
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`
    const result = validateTrackingDate(dateStr)
    expect(result.isValid).toBe(false)
    expect(result.errors.date).toBe('日期不能超過90天後')
  })
})

describe('Tracking Time Validation — 20:00 boundary', () => {
  it('accepts exactly 20:00 (boundary should be inclusive)', () => {
    const result = validateTrackingTime('20:00')
    expect(result.isValid).toBe(true)
  })

  it('rejects 20:01 (past boundary)', () => {
    const result = validateTrackingTime('20:01')
    expect(result.isValid).toBe(false)
    expect(result.errors.time).toBe('時間必須在08:00-20:00之間')
  })

  it('rejects 21:00 (past boundary)', () => {
    const result = validateTrackingTime('21:00')
    expect(result.isValid).toBe(false)
  })

  it('rejects 07:59 (before business hours)', () => {
    const result = validateTrackingTime('07:59')
    expect(result.isValid).toBe(false)
  })

  it('accepts 08:00 (start of business hours)', () => {
    const result = validateTrackingTime('08:00')
    expect(result.isValid).toBe(true)
  })

  it('accepts 12:30 (mid-day)', () => {
    const result = validateTrackingTime('12:30')
    expect(result.isValid).toBe(true)
  })
})

describe('Status Selection Validation', () => {
  const statuses = [
    { R_Status_ID: 1, Name: 'New' },
    { R_Status_ID: 2, Name: 'In Progress' },
    { R_Status_ID: 3, Name: 'Completed' },
  ]

  it('rejects null selection', () => {
    const result = validateStatusSelection(null, statuses)
    expect(result.isValid).toBe(false)
    expect(result.errors.status).toBe('請選擇狀態')
  })

  it('rejects undefined selection', () => {
    const result = validateStatusSelection(undefined as any, statuses)
    expect(result.isValid).toBe(false)
    expect(result.errors.status).toBe('請選擇狀態')
  })

  it('rejects non-existent status', () => {
    const result = validateStatusSelection(999, statuses)
    expect(result.isValid).toBe(false)
    expect(result.errors.status).toBe('所選狀態無效')
  })

  it('accepts valid status', () => {
    const result = validateStatusSelection(1, statuses)
    expect(result.isValid).toBe(true)
  })

  it('accepts any valid status id', () => {
    const result = validateStatusSelection(3, statuses)
    expect(result.isValid).toBe(true)
  })
})
