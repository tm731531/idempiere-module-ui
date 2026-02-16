import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DimensionDataView from '@/views/admin/DimensionDataView.vue'

// Mock dependencies
vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}))

vi.mock('@/api/lookup', () => ({
  lookupDefaultCurrencyId: vi.fn().mockResolvedValue(121),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    context: { organizationId: 1000000, warehouseId: 1000003, clientId: 1000000, roleId: 1000000 },
    user: { name: 'Test' },
    isAuthenticated: true,
  }),
}))

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ name: 'dimension-data', params: {} }),
}))

vi.mock('@/composables/useDocumentForm', () => ({
  useDocumentForm: () => ({
    fieldDefs: { value: [] },
    visibleFieldDefs: { value: [] },
    formData: { value: {} },
    recordData: { value: null },
    fkLabels: { value: {} },
    pageLoading: { value: false },
    pageError: { value: '' },
    isCreate: { value: true },
    readOnly: { value: false },
    mandatoryErrors: { value: [] },
    isValid: { value: true },
    docStatus: { value: 'DR' },
    load: vi.fn().mockResolvedValue(undefined),
    initDefaults: vi.fn(),
    populateFromRecord: vi.fn(),
    getFormPayload: vi.fn().mockReturnValue({ Name: 'Test', Value: 'Test' }),
    getUpdatePayload: vi.fn().mockReturnValue({ Name: 'Test' }),
  }),
}))

vi.mock('@/components/DynamicForm.vue', () => ({
  default: {
    name: 'DynamicForm',
    template: '<div class="mock-dynamic-form" />',
    props: ['fieldDefs', 'modelValue'],
  },
}))

import { apiClient } from '@/api/client'

describe('DimensionDataView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function getCard(w: ReturnType<typeof mount>, idx: number) {
    const cards = w.findAll('.table-card')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return cards[idx]!
  }

  it('renders three table selector cards in initial state', () => {
    const w = mount(DimensionDataView)
    const cards = w.findAll('.table-card')
    expect(cards).toHaveLength(3)
    expect(getCard(w, 0).text()).toContain('活動')
    expect(getCard(w, 1).text()).toContain('行銷活動')
    expect(getCard(w, 2).text()).toContain('專案')
  })

  it('shows page title as 行銷設定 initially', () => {
    const w = mount(DimensionDataView)
    expect(w.find('h2').text()).toBe('行銷設定')
  })

  it('loads records when selecting a table', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { records: [{ id: 1, Name: 'Marketing', Description: 'Test' }] },
    })

    const w = mount(DimensionDataView)
    await getCard(w, 0).trigger('click')
    await flushPromises()

    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/models/C_Activity',
      expect.objectContaining({
        params: expect.objectContaining({
          '$filter': 'IsActive eq true',
        }),
      }),
    )
  })

  it('displays record list after selecting a table', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { records: [
        { id: 1, Name: 'Development', Description: '開發活動' },
        { id: 2, Name: 'Marketing', Description: '行銷活動' },
      ] },
    })

    const w = mount(DimensionDataView)
    await getCard(w, 0).trigger('click')
    await flushPromises()

    const rows = w.findAll('.data-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Development')
    expect(rows[1]!.text()).toContain('Marketing')
  })

  it('shows empty state when no records', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { records: [] } })

    const w = mount(DimensionDataView)
    await getCard(w, 0).trigger('click')
    await flushPromises()

    expect(w.find('.empty-state').text()).toContain('尚無資料')
  })

  it('navigates back from list to table selector', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { records: [] } })

    const w = mount(DimensionDataView)
    await getCard(w, 0).trigger('click')
    await flushPromises()

    expect(w.find('h2').text()).toBe('活動')

    await w.find('.back-btn').trigger('click')
    expect(w.find('h2').text()).toBe('行銷設定')
    expect(w.findAll('.table-card')).toHaveLength(3)
  })

  it('navigates home from table selector', async () => {
    const w = mount(DimensionDataView)
    await w.find('.back-btn').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
  })

  it('calls delete endpoint and reloads list', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { records: [{ id: 1, Name: 'Test', Description: '' }] },
    })
    vi.mocked(apiClient.delete).mockResolvedValueOnce({})
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { records: [] } })

    const w = mount(DimensionDataView)
    await getCard(w, 0).trigger('click')
    await flushPromises()

    await w.find('.delete-btn').trigger('click')
    await flushPromises()

    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/models/C_Activity/1')
  })

  it('enters create mode when clicking add button', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { records: [] } })

    const w = mount(DimensionDataView)
    await getCard(w, 0).trigger('click')
    await flushPromises()

    await w.find('.add-fab').trigger('click')
    await flushPromises()

    expect(w.find('h2').text()).toBe('新增活動')
    expect(w.find('.mock-dynamic-form').exists()).toBe(true)
  })

  it('Campaign table includes Costs in select', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { records: [{ id: 1, Name: 'Spring Sale', Description: '', Costs: 50000 }] },
    })

    const w = mount(DimensionDataView)
    await getCard(w, 1).trigger('click')
    await flushPromises()

    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/models/C_Campaign',
      expect.objectContaining({
        params: expect.objectContaining({
          '$select': expect.stringContaining('Costs'),
        }),
      }),
    )

    // Check display shows costs
    expect(w.find('.data-extra').text()).toContain('50,000')
  })
})
