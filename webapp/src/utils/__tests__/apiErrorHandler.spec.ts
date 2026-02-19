import { describe, it, expect } from 'vitest'
import {
  translateApiError,
  isNetworkError,
  isValidationError,
  isAuthenticationError,
  isPermissionError,
  isNotFoundError,
  isServerError,
  extractValidationErrors,
  isRetryable,
  getRetryDelay,
} from '../apiErrorHandler'

describe('API Error Handler', () => {
  describe('translateApiError', () => {
    it('translates network error', () => {
      const error = { message: 'Network Error' }
      expect(translateApiError(error)).toBe('網路連線失敗，請稍後重試')
    })

    it('translates timeout error', () => {
      const error = { code: 'ECONNABORTED' }
      expect(translateApiError(error)).toBe('請求超時，請稍後重試')
    })

    it('translates 400 validation error', () => {
      const error = { response: { status: 400, data: { message: 'Invalid input' } } }
      expect(translateApiError(error)).toContain('資料驗證失敗')
      expect(translateApiError(error)).toContain('Invalid input')
    })

    it('translates 400 without message', () => {
      const error = { response: { status: 400 } }
      expect(translateApiError(error)).toBe('資料驗證失敗')
    })

    it('translates 401 authentication error', () => {
      const error = { response: { status: 401 } }
      expect(translateApiError(error)).toBe('您的登入已過期，請重新登入')
    })

    it('translates 403 permission error', () => {
      const error = { response: { status: 403 } }
      expect(translateApiError(error)).toBe('您沒有權限執行此操作')
    })

    it('translates 404 not found error', () => {
      const error = { response: { status: 404 } }
      expect(translateApiError(error)).toBe('資料不存在')
    })

    it('translates 409 conflict error', () => {
      const error = { response: { status: 409, data: { message: 'Conflict' } } }
      expect(translateApiError(error)).toContain('資料衝突')
    })

    it('translates 422 validation error', () => {
      const error = { response: { status: 422, data: { message: 'Invalid data' } } }
      expect(translateApiError(error)).toContain('資料驗證失敗')
    })

    it('translates 500 server error', () => {
      const error = { response: { status: 500 } }
      expect(translateApiError(error)).toBe('伺服器錯誤，請聯繫管理員')
    })

    it('translates 502 bad gateway error', () => {
      const error = { response: { status: 502 } }
      expect(translateApiError(error)).toBe('伺服器暫時無法回應，請稍後重試')
    })

    it('translates 503 service unavailable error', () => {
      const error = { response: { status: 503 } }
      expect(translateApiError(error)).toBe('伺服器維護中，請稍後重試')
    })

    it('uses error field as fallback', () => {
      const error = { response: { status: 400, data: { error: 'Bad request' } } }
      expect(translateApiError(error)).toContain('Bad request')
    })

    it('handles unknown status codes', () => {
      const error = { response: { status: 418 } }
      expect(translateApiError(error)).toContain('操作失敗')
    })
  })

  describe('Error type checking', () => {
    it('detects network errors', () => {
      expect(isNetworkError({})).toBe(true)
      expect(isNetworkError({ response: { status: 200 } })).toBe(false)
    })

    it('detects validation errors', () => {
      expect(isValidationError({ response: { status: 400 } })).toBe(true)
      expect(isValidationError({ response: { status: 422 } })).toBe(true)
      expect(isValidationError({ response: { status: 500 } })).toBe(false)
    })

    it('detects authentication errors', () => {
      expect(isAuthenticationError({ response: { status: 401 } })).toBe(true)
      expect(isAuthenticationError({ response: { status: 200 } })).toBe(false)
    })

    it('detects permission errors', () => {
      expect(isPermissionError({ response: { status: 403 } })).toBe(true)
      expect(isPermissionError({ response: { status: 200 } })).toBe(false)
    })

    it('detects not found errors', () => {
      expect(isNotFoundError({ response: { status: 404 } })).toBe(true)
      expect(isNotFoundError({ response: { status: 200 } })).toBe(false)
    })

    it('detects server errors', () => {
      expect(isServerError({ response: { status: 500 } })).toBe(true)
      expect(isServerError({ response: { status: 502 } })).toBe(true)
      expect(isServerError({ response: { status: 503 } })).toBe(true)
      expect(isServerError({ response: { status: 400 } })).toBe(false)
    })
  })

  describe('extractValidationErrors', () => {
    it('extracts errors from errors object', () => {
      const error = {
        response: {
          data: {
            errors: {
              Summary: 'Required field',
              R_Status_ID: 'Invalid status',
            },
          },
        },
      }

      const errors = extractValidationErrors(error)
      expect(errors.Summary).toBe('Required field')
      expect(errors.R_Status_ID).toBe('Invalid status')
    })

    it('handles array error messages', () => {
      const error = {
        response: {
          data: {
            errors: {
              email: ['Invalid email', 'Must be unique'],
            },
          },
        },
      }

      const errors = extractValidationErrors(error)
      expect(errors.email).toBe('Invalid email')
    })

    it('falls back to message field', () => {
      const error = {
        response: {
          data: {
            message: 'General error',
          },
        },
      }

      const errors = extractValidationErrors(error)
      expect(errors.general).toBe('General error')
    })

    it('returns empty object for no errors', () => {
      const error = { response: { data: {} } }
      const errors = extractValidationErrors(error)
      expect(Object.keys(errors).length).toBe(0)
    })

    it('handles missing response data', () => {
      const error = { response: {} }
      const errors = extractValidationErrors(error)
      expect(Object.keys(errors).length).toBe(0)
    })
  })

  describe('isRetryable', () => {
    it('retries network errors up to 3 times', () => {
      const error = {}
      expect(isRetryable(error, 1)).toBe(true)
      expect(isRetryable(error, 2)).toBe(true)
      expect(isRetryable(error, 3)).toBe(true)
      expect(isRetryable(error, 4)).toBe(false)
    })

    it('retries timeout errors up to 3 times', () => {
      const error = { code: 'ECONNABORTED' }
      expect(isRetryable(error, 1)).toBe(true)
      expect(isRetryable(error, 3)).toBe(true)
      expect(isRetryable(error, 4)).toBe(false)
    })

    it('retries 429 rate limit errors up to 5 times', () => {
      const error = { response: { status: 429 } }
      expect(isRetryable(error, 1)).toBe(true)
      expect(isRetryable(error, 5)).toBe(true)
      expect(isRetryable(error, 6)).toBe(false)
    })

    it('retries 502/503 errors up to 3 times', () => {
      const error502 = { response: { status: 502 } }
      const error503 = { response: { status: 503 } }

      expect(isRetryable(error502, 1)).toBe(true)
      expect(isRetryable(error502, 3)).toBe(true)
      expect(isRetryable(error502, 4)).toBe(false)

      expect(isRetryable(error503, 1)).toBe(true)
      expect(isRetryable(error503, 3)).toBe(true)
      expect(isRetryable(error503, 4)).toBe(false)
    })

    it('does not retry non-retryable errors', () => {
      const error400 = { response: { status: 400 } }
      const error401 = { response: { status: 401 } }

      expect(isRetryable(error400)).toBe(false)
      expect(isRetryable(error401)).toBe(false)
    })
  })

  describe('getRetryDelay', () => {
    it('returns increasing delay for each attempt', () => {
      const delay1 = getRetryDelay(1)
      const delay2 = getRetryDelay(2)
      const delay3 = getRetryDelay(3)

      // Delays should be increasing (ignoring jitter variance)
      expect(delay2).toBeGreaterThan(delay1 - 1000)
      expect(delay3).toBeGreaterThan(delay2 - 1000)
    })

    it('caps maximum delay at 10 seconds', () => {
      const delay = getRetryDelay(10)
      expect(delay).toBeLessThanOrEqual(11000) // 10 seconds + jitter
    })

    it('returns reasonable values for first attempts', () => {
      const delay1 = getRetryDelay(1)
      expect(delay1).toBeGreaterThanOrEqual(0)
      expect(delay1).toBeLessThan(2000)
    })
  })
})
