import axios from 'axios'
import { getApiBaseUrl } from '@/config'

export const apiClient = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Dynamic baseURL from config.json
apiClient.interceptors.request.use((config) => {
  const apiBase = getApiBaseUrl()
  if (apiBase) {
    config.baseURL = apiBase
  }
  return config
})

// Session expired state
export const sessionState = { expired: false }
export function clearSessionExpired() { sessionState.expired = false }

// 401 interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      if (!url.includes('/api/v1/auth/')) {
        sessionState.expired = true
      }
    }
    return Promise.reject(error)
  }
)

// Generic CRUD methods
export const api = {
  async getRecords(model: string, params?: Record<string, unknown>) {
    const response = await apiClient.get(`/api/v1/models/${model}`, { params })
    return response.data
  },

  async getRecord(model: string, id: number) {
    const response = await apiClient.get(`/api/v1/models/${model}/${id}`)
    return response.data
  },

  async createRecord(model: string, data: Record<string, unknown>) {
    const response = await apiClient.post(`/api/v1/models/${model}`, data)
    return response.data
  },

  async updateRecord(model: string, id: number, data: Record<string, unknown>) {
    const response = await apiClient.put(`/api/v1/models/${model}/${id}`, data)
    return response.data
  },

  async deleteRecord(model: string, id: number) {
    const response = await apiClient.delete(`/api/v1/models/${model}/${id}`)
    return response.data
  },
}

export default api
