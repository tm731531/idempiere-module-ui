import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomerListView from '@/views/customer/CustomerListView.vue'

vi.mock('@/api/bpartner', () => ({
  searchCustomers: vi.fn().mockResolvedValue([]),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useRoute: () => ({ params: {} }),
}))

describe('CustomerListView', () => {
  it('renders search input and add button', () => {
    const w = mount(CustomerListView)
    expect(w.find('input').exists()).toBe(true)
    expect(w.find('.fab').exists() || w.text().includes('新增客戶')).toBe(true)
  })
})
