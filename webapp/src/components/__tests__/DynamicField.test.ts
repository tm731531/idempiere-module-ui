import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DynamicField from '@/components/DynamicField.vue'
import { checkQuickCreateEligibility } from '@/api/metadata'

vi.mock('@/api/metadata', () => ({
  fetchRefListItems: vi.fn().mockResolvedValue([]),
  fetchIdentifierColumn: vi.fn().mockResolvedValue('Name'),
  fetchSecondaryDisplayColumn: vi.fn().mockResolvedValue(''),
  checkQuickCreateEligibility: vi.fn().mockResolvedValue({ eligible: false, mandatoryDefaults: {} }),
}))
vi.mock('@/i18n/fieldLabels', () => ({
  getFieldLabel: (columnName: string, fallback: string) => {
    const map: Record<string, string> = { C_BPartner_ID: '客戶', M_Warehouse_ID: '倉庫' }
    return map[columnName] || fallback
  },
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ context: { organizationId: 1 } }),
}))
vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { records: [{ id: 100, ColumnName: 'Name' }], 'row-count': 1 } }),
    post: vi.fn().mockResolvedValue({ data: { id: 200 } }),
  },
}))

const baseField = { id: 1, name: 'Test', seqNo: 10, isDisplayed: true, isReadOnly: false, fieldGroup: '', columnId: 1 }
const baseColumn = { id: 1, columnName: 'Test', referenceId: 10, referenceValueId: null, fieldLength: 60, isMandatory: true, defaultValue: '', isUpdateable: true, validationRuleId: null }

describe('DynamicField', () => {
  it('renders text input for referenceId=10', () => {
    const w = mount(DynamicField, { props: { field: baseField, column: baseColumn, modelValue: '', disabled: false } })
    expect(w.find('input[type="text"]').exists()).toBe(true)
  })

  it('renders number input for referenceId=11', () => {
    const w = mount(DynamicField, { props: { field: baseField, column: { ...baseColumn, referenceId: 11 }, modelValue: 0, disabled: false } })
    expect(w.find('input[type="number"]').exists()).toBe(true)
  })

  it('renders checkbox for referenceId=20', () => {
    const w = mount(DynamicField, { props: { field: baseField, column: { ...baseColumn, referenceId: 20 }, modelValue: true, disabled: false } })
    expect(w.find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('shows required indicator', () => {
    const w = mount(DynamicField, { props: { field: baseField, column: baseColumn, modelValue: '', disabled: false } })
    expect(w.find('.required').exists()).toBe(true)
  })

  it('shows Chinese label when mapping exists', () => {
    const field = { ...baseField, name: 'Business Partner' }
    const column = { ...baseColumn, columnName: 'C_BPartner_ID', referenceId: 10 }
    const w = mount(DynamicField, { props: { field, column, modelValue: '', disabled: false } })
    expect(w.find('.field-label').text()).toContain('客戶')
  })

  it('falls back to English name when no mapping', () => {
    const field = { ...baseField, name: 'Some Field' }
    const column = { ...baseColumn, columnName: 'SomeUnknown', referenceId: 10 }
    const w = mount(DynamicField, { props: { field, column, modelValue: '', disabled: false } })
    expect(w.find('.field-label').text()).toContain('Some Field')
  })

  it('enables QuickCreate when AD metadata says eligible', async () => {
    vi.mocked(checkQuickCreateEligibility).mockResolvedValue({
      eligible: true,
      mandatoryDefaults: { IsDefault: false },
    })

    const field = { ...baseField, name: 'Request Type' }
    const column = { ...baseColumn, columnName: 'R_RequestType_ID', referenceId: 19 }
    const w = mount(DynamicField, { props: { field, column, modelValue: null, disabled: false } })
    await flushPromises()
    const selector = w.findComponent({ name: 'SearchSelector' })
    expect(selector.exists()).toBe(true)
    expect(selector.props('quickCreate')).toBe(true)
    expect(selector.props('quickCreateDefaults')).toEqual({ IsDefault: false })
  })

  it('does not enable QuickCreate when AD metadata says ineligible', async () => {
    vi.mocked(checkQuickCreateEligibility).mockResolvedValue({
      eligible: false,
      mandatoryDefaults: {},
    })

    const field = { ...baseField, name: 'Warehouse' }
    const column = { ...baseColumn, columnName: 'M_Warehouse_ID', referenceId: 19 }
    const w = mount(DynamicField, { props: { field, column, modelValue: null, disabled: false } })
    await flushPromises()
    const selector = w.findComponent({ name: 'SearchSelector' })
    expect(selector.exists()).toBe(true)
    expect(selector.props('quickCreate')).toBe(false)
  })

  it('renders datetime-local input for referenceId=16', () => {
    const column = { ...baseColumn, referenceId: 16 }
    const w = mount(DynamicField, { props: { field: baseField, column, modelValue: '', disabled: false } })
    const input = w.find('input[type="datetime-local"]')
    expect(input.exists()).toBe(true)
  })
})
