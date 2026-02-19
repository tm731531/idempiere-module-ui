/**
 * Validation utilities for consultation module
 * Provides validation functions for activities, forms, and dates
 */

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
}

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: any) => boolean | string
  message?: string
}

// Activity Content Validation
export function validateActivityContent(content: string): ValidationResult {
  const errors: Record<string, string> = {}

  // Check if empty
  if (!content || !content.trim()) {
    errors.content = '請輸入活動內容'
  }

  // Check length
  if (content && content.length > 500) {
    errors.content = '活動內容不能超過500字'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

// Tracking Date Validation
export function validateTrackingDate(dateStr: string): ValidationResult {
  const errors: Record<string, string> = {}

  if (!dateStr) {
    errors.date = '請選擇日期'
    return { isValid: false, errors }
  }

  const selected = new Date(dateStr)
  const today = new Date()

  // Normalize to midnight for date comparison
  selected.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  // Date must not be in the past
  if (selected < today) {
    errors.date = '日期不能是過去的日期'
  }

  // Date must not be more than 90 days in the future
  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + 90)
  if (selected > maxDate) {
    errors.date = '日期不能超過90天後'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

// Tracking Time Validation
export function validateTrackingTime(timeStr: string): ValidationResult {
  const errors: Record<string, string> = {}

  if (!timeStr) {
    errors.time = '請選擇時間'
    return { isValid: false, errors }
  }

  const [hoursStr, minutesStr] = timeStr.split(':')
  const hours = parseInt(hoursStr, 10)
  const minutes = parseInt(minutesStr, 10)

  // Validate format
  if (isNaN(hours) || isNaN(minutes)) {
    errors.time = '時間格式無效'
    return { isValid: false, errors }
  }

  // Business hours: 08:00-19:59 (before 20:00)
  if (hours < 8 || hours >= 20) {
    errors.time = '時間必須在08:00-20:00之間'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

// Tracking Description Validation
export function validateTrackingDescription(description: string): ValidationResult {
  const errors: Record<string, string> = {}

  if (!description || !description.trim()) {
    errors.description = '請輸入追蹤說明'
  }

  if (description && description.length > 200) {
    errors.description = '追蹤說明不能超過200字'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

// Combined Tracking Validation
export interface TrackingFormData {
  date: string
  time: string
  description: string
}

export function validateTrackingForm(data: TrackingFormData): ValidationResult {
  const errors: Record<string, string> = {}

  // Validate date
  const dateErrors = validateTrackingDate(data.date)
  if (!dateErrors.isValid) {
    Object.assign(errors, dateErrors.errors)
  }

  // Validate time
  const timeErrors = validateTrackingTime(data.time)
  if (!timeErrors.isValid) {
    Object.assign(errors, timeErrors.errors)
  }

  // Validate description
  const descErrors = validateTrackingDescription(data.description)
  if (!descErrors.isValid) {
    Object.assign(errors, descErrors.errors)
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

// Request Form Validation
export interface RequestFormData {
  Summary?: string
  R_RequestType_ID?: number | string
  R_Status_ID?: number | string
  C_BPartner_ID?: number | string
}

export function validateRequestForm(data: RequestFormData): ValidationResult {
  const errors: Record<string, string> = {}

  // Validate Summary
  if (!data.Summary || !data.Summary.trim()) {
    errors.Summary = '請輸入諮詢摘要'
  } else if (data.Summary.length > 200) {
    errors.Summary = '諮詢摘要不能超過200字'
  }

  // Validate RequestType
  if (!data.R_RequestType_ID) {
    errors.R_RequestType_ID = '請選擇諮詢類型'
  }

  // Validate Status
  if (!data.R_Status_ID) {
    errors.R_Status_ID = '請選擇狀態'
  }

  // C_BPartner_ID is optional - no validation required

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

// Email Validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Phone Validation (basic)
export function validatePhone(phone: string): boolean {
  // Allow common formats: +123456789, 123-456-7890, (123) 456-7890, etc.
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

// Input Sanitization (prevent injection)
export function sanitizeUserInput(input: string): string {
  if (!input) return ''

  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
}

// Status Selection Validation
export interface StatusOption {
  R_Status_ID: number
  Name: string
}

export function validateStatusSelection(
  selectedStatusId: number | null,
  availableStatuses: StatusOption[]
): ValidationResult {
  const errors: Record<string, string> = {}

  if (selectedStatusId === null || selectedStatusId === undefined) {
    errors.status = '請選擇狀態'
  } else {
    // Check if selected status exists in available statuses
    const statusExists = availableStatuses.some(s => s.R_Status_ID === selectedStatusId)
    if (!statusExists) {
      errors.status = '所選狀態無效'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
