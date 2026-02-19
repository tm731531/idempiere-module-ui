/**
 * API Error Handler and Translation Utilities
 * Provides user-friendly error messages in Chinese for API errors
 */

export interface ApiError {
  response?: {
    status: number
    data?: {
      message?: string
      error?: string
    }
  }
  message?: string
  code?: string
}

/**
 * Translate API error to user-friendly Chinese message
 * Handles network errors, validation errors, and server errors
 */
export function translateApiError(error: any): string {
  // Network error (no response)
  if (!error.response) {
    if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
      return '網路連線失敗，請稍後重試'
    }
    if (error.code === 'ECONNABORTED') {
      return '請求超時，請稍後重試'
    }
    return '網路連線失敗，請稍後重試'
  }

  const { status, data } = error.response

  // Parse error message from response
  const errorMessage = data?.message || data?.error || ''

  switch (status) {
    case 400:
      // Bad Request - validation error
      return errorMessage ? `資料驗證失敗: ${errorMessage}` : '資料驗證失敗'

    case 401:
      // Unauthorized - session expired
      return '您的登入已過期，請重新登入'

    case 403:
      // Forbidden - permission denied
      return '您沒有權限執行此操作'

    case 404:
      // Not Found
      return '資料不存在'

    case 409:
      // Conflict - data conflict
      return errorMessage ? `資料衝突: ${errorMessage}` : '資料已被修改，請重新整理後重試'

    case 422:
      // Unprocessable Entity - validation error
      return errorMessage ? `資料驗證失敗: ${errorMessage}` : '資料驗證失敗'

    case 500:
      // Internal Server Error
      return '伺服器錯誤，請聯繫管理員'

    case 502:
      // Bad Gateway
      return '伺服器暫時無法回應，請稍後重試'

    case 503:
      // Service Unavailable
      return '伺服器維護中，請稍後重試'

    default:
      // Unknown error
      return errorMessage ? `操作失敗: ${errorMessage}` : '操作失敗，請重試'
  }
}

/**
 * Check if error is a network/timeout error
 */
export function isNetworkError(error: any): boolean {
  if (!error.response) {
    return true
  }
  return false
}

/**
 * Check if error is a validation error (400/422)
 */
export function isValidationError(error: any): boolean {
  return error.response?.status === 400 || error.response?.status === 422
}

/**
 * Check if error is authentication error (401)
 */
export function isAuthenticationError(error: any): boolean {
  return error.response?.status === 401
}

/**
 * Check if error is permission error (403)
 */
export function isPermissionError(error: any): boolean {
  return error.response?.status === 403
}

/**
 * Check if error is not found error (404)
 */
export function isNotFoundError(error: any): boolean {
  return error.response?.status === 404
}

/**
 * Check if error is server error (500+)
 */
export function isServerError(error: any): boolean {
  return error.response?.status >= 500
}

/**
 * Extract validation errors from API response
 * Returns a map of field name to error message
 */
export function extractValidationErrors(error: any): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!error.response?.data) {
    return errors
  }

  const data = error.response.data

  // Handle nested errors object
  if (data.errors && typeof data.errors === 'object') {
    Object.entries(data.errors).forEach(([key, value]) => {
      if (typeof value === 'string') {
        errors[key] = value
      } else if (Array.isArray(value) && value.length > 0) {
        errors[key] = value[0]
      }
    })
  }

  // Handle general message as fallback
  if (Object.keys(errors).length === 0 && data.message) {
    errors.general = data.message
  }

  return errors
}

/**
 * Retry handler for transient failures
 * Returns true if the error is retryable
 */
export function isRetryable(error: any, attempt: number = 1): boolean {
  // Network errors are retryable
  if (isNetworkError(error)) {
    return attempt <= 3
  }

  // Timeout errors are retryable
  if (error.code === 'ECONNABORTED') {
    return attempt <= 3
  }

  // 429 (Too Many Requests) is retryable with backoff
  if (error.response?.status === 429) {
    return attempt <= 5
  }

  // 502/503 (Bad Gateway/Service Unavailable) are retryable
  if (error.response?.status === 502 || error.response?.status === 503) {
    return attempt <= 3
  }

  return false
}

/**
 * Calculate backoff delay for retry (exponential backoff)
 */
export function getRetryDelay(attempt: number): number {
  // Exponential backoff with jitter: 100ms * 2^(attempt-1) + random jitter
  const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
  const jitter = Math.random() * 1000
  return baseDelay + jitter
}
