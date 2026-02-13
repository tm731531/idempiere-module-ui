import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '@/views/LoginView.vue'

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn(), get: vi.fn(), put: vi.fn(), defaults: { headers: { common: {} } } },
  clearSessionExpired: vi.fn(),
}))
vi.mock('@/api/lookup', () => ({ clearLookupCache: vi.fn() }))

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ query: {} }),
}))

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('should render credentials form by default', () => {
    const wrapper = mount(LoginView)
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toContain('登入')
  })
})
