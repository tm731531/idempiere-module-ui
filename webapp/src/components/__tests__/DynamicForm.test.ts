import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DynamicForm from '@/components/DynamicForm.vue'

vi.mock('@/api/metadata', () => ({ fetchRefListItems: vi.fn().mockResolvedValue([]) }))
vi.mock('@/i18n/fieldLabels', () => ({
  getFieldLabel: (_columnName: string, fallback: string) => fallback,
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ context: { organizationId: 1 } }),
}))
vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { records: [{ id: 100 }], 'row-count': 1 } }),
    post: vi.fn().mockResolvedValue({ data: { id: 200 } }),
  },
}))

const makeDef = (name: string, group: string, mandatory: boolean) => ({
  field: { id: 1, name, seqNo: 10, isDisplayed: true, isReadOnly: false, fieldGroup: group, columnId: 1 },
  column: { id: 1, columnName: name, referenceId: 10, referenceValueId: null, fieldLength: 60, isMandatory: mandatory, defaultValue: '', isUpdateable: true },
})

describe('DynamicForm', () => {
  it('separates mandatory and optional fields into sections', () => {
    const defs = [makeDef('Name', '基本', true), makeDef('Desc', '詳細', false)]
    const w = mount(DynamicForm, { props: { fieldDefs: defs, modelValue: {} } })
    // Mandatory section header (static, not a button)
    expect(w.find('.section-header-static').text()).toContain('必填欄位')
    // Optional section header (collapsible button)
    const optHeader = w.find('.section-header')
    expect(optHeader.text()).toContain('更多欄位')
  })

  it('shows mandatory fields always visible', () => {
    const defs = [makeDef('Name', '基本', true), makeDef('Desc', '詳細', false)]
    const w = mount(DynamicForm, { props: { fieldDefs: defs, modelValue: {} } })
    const sections = w.findAll('.form-section')
    // Mandatory section always has content
    expect(sections[0]!.find('.section-content').exists()).toBe(true)
    // Optional section is collapsed by default
    expect(sections[1]!.find('.section-content').exists()).toBe(false)
  })

  it('toggles optional fields on click', async () => {
    const defs = [makeDef('Name', '基本', true), makeDef('Desc', '詳細', false)]
    const w = mount(DynamicForm, { props: { fieldDefs: defs, modelValue: {} } })
    // Click to expand
    await w.find('.section-header').trigger('click')
    const sections = w.findAll('.form-section')
    expect(sections[1]!.find('.section-content').exists()).toBe(true)
  })

  it('shows optional field count in header', () => {
    const defs = [
      makeDef('Name', '基本', true),
      makeDef('Desc', '詳細', false),
      makeDef('Note', '詳細', false),
    ]
    const w = mount(DynamicForm, { props: { fieldDefs: defs, modelValue: {} } })
    expect(w.find('.field-count').text()).toBe('(2)')
  })

  it('handles all mandatory fields (no optional section)', () => {
    const defs = [makeDef('Name', '基本', true), makeDef('Value', '基本', true)]
    const w = mount(DynamicForm, { props: { fieldDefs: defs, modelValue: {} } })
    expect(w.find('.section-header-static').exists()).toBe(true)
    expect(w.find('.optional-section').exists()).toBe(false)
  })

  it('handles all optional fields (no mandatory section)', () => {
    const defs = [makeDef('Desc', '詳細', false)]
    const w = mount(DynamicForm, { props: { fieldDefs: defs, modelValue: {} } })
    expect(w.find('.section-header-static').exists()).toBe(false)
    expect(w.find('.optional-section').exists()).toBe(true)
  })
})
