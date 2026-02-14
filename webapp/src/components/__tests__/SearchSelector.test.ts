import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchSelector from '@/components/SearchSelector.vue'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ context: { organizationId: 1 } }),
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

  it('shows inline-create toggle when quickCreate enabled', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { 'row-count': 100 } })

    const w = mount(SearchSelector, {
      props: { modelValue: null, tableName: 'C_BPartner', displayField: 'Name', searchField: 'Name', quickCreate: true },
    })

    await new Promise(r => setTimeout(r, 50))
    await w.vm.$nextTick()

    expect(w.find('.inline-create-toggle').exists()).toBe(true)
  })

  it('includes IsActive filter in count query', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { 'row-count': 3 } })
      .mockResolvedValueOnce({ data: { records: [] } })

    mount(SearchSelector, {
      props: { modelValue: null, tableName: 'C_BPartner', displayField: 'Name', searchField: 'Name' },
    })

    await new Promise(r => setTimeout(r, 50))

    const countCall = vi.mocked(apiClient.get).mock.calls[0]!
    expect(countCall[1]?.params?.['$filter']).toContain('IsActive eq true')
  })

  it('combines IsActive with custom filter', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { 'row-count': 3 } })
      .mockResolvedValueOnce({ data: { records: [] } })

    const w = mount(SearchSelector, {
      props: { modelValue: null, tableName: 'C_BPartner', displayField: 'Name', searchField: 'Name', filter: 'IsCustomer eq true' },
    })

    await new Promise(r => setTimeout(r, 50))
    await w.vm.$nextTick()

    // Check the loadAllOptions call (second call) which also uses buildFilter
    const calls = vi.mocked(apiClient.get).mock.calls
    const hasIsActive = calls.some(c => c[1]?.params?.['$filter']?.includes('IsActive eq true'))
    const hasCustomFilter = calls.some(c => c[1]?.params?.['$filter']?.includes('IsCustomer eq true'))
    expect(hasIsActive).toBe(true)
    expect(hasCustomFilter).toBe(true)
  })

  it('resolves existing ID to display name in search mode', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { 'row-count': 100 } })  // count → search mode
      .mockResolvedValueOnce({ data: { C_BPartner_ID: 42, Name: '張三' } })  // resolveCurrentLabel

    const w = mount(SearchSelector, {
      props: { modelValue: 42, tableName: 'C_BPartner', displayField: 'Name', searchField: 'Name' },
    })

    await new Promise(r => setTimeout(r, 50))
    await w.vm.$nextTick()

    const input = w.find('input[type="text"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('張三')
  })

  it('does not resolve label when modelValue is null in search mode', async () => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { 'row-count': 100 } })  // count → search mode

    const w = mount(SearchSelector, {
      props: { modelValue: null, tableName: 'C_BPartner', displayField: 'Name', searchField: 'Name' },
    })

    await new Promise(r => setTimeout(r, 50))
    await w.vm.$nextTick()

    // Only 1 API call (count), no resolve call for null modelValue
    const getCalls = vi.mocked(apiClient.get).mock.calls
    expect(getCalls.length).toBe(1)
    const input = w.find('input[type="text"]')
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('shows fallback when label resolution fails in search mode', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { 'row-count': 100 } })  // count → search mode
      .mockRejectedValueOnce(new Error('not found'))  // resolveCurrentLabel fails

    const w = mount(SearchSelector, {
      props: { modelValue: 99, tableName: 'C_BPartner', displayField: 'Name', searchField: 'Name' },
    })

    await new Promise(r => setTimeout(r, 50))
    await w.vm.$nextTick()

    const input = w.find('input[type="text"]')
    expect((input.element as HTMLInputElement).value).toBe('#99')
  })
})
