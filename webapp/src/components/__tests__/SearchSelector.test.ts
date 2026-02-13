import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchSelector from '@/components/SearchSelector.vue'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}))

describe('SearchSelector', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders dropdown when few items', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { 'row-count': 5 } })  // count
      .mockResolvedValueOnce({ data: { records: [
        { id: 1, Name: 'Item 1' },
        { id: 2, Name: 'Item 2' },
      ] } })

    const w = mount(SearchSelector, {
      props: { modelValue: null, tableName: 'C_BPartner', displayField: 'Name', searchField: 'Name' },
    })

    // Wait for async mount
    await new Promise(r => setTimeout(r, 50))
    await w.vm.$nextTick()

    expect(w.find('select').exists()).toBe(true)
  })

  it('renders search input when many items', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { 'row-count': 100 } })

    const w = mount(SearchSelector, {
      props: { modelValue: null, tableName: 'C_BPartner', displayField: 'Name', searchField: 'Name' },
    })

    await new Promise(r => setTimeout(r, 50))
    await w.vm.$nextTick()

    expect(w.find('input[type="text"]').exists()).toBe(true)
  })

  it('shows quick-create button when enabled', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { 'row-count': 100 } })

    const w = mount(SearchSelector, {
      props: { modelValue: null, tableName: 'C_BPartner', displayField: 'Name', searchField: 'Name', quickCreate: true },
    })

    await new Promise(r => setTimeout(r, 50))
    await w.vm.$nextTick()

    expect(w.find('.quick-create-btn').exists()).toBe(true)
  })
})
