import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DynamicForm from '@/components/DynamicForm.vue'

vi.mock('@/api/metadata', () => ({ fetchRefListItems: vi.fn().mockResolvedValue([]) }))

const makeDef = (name: string, group: string, mandatory: boolean) => ({
  field: { id: 1, name, seqNo: 10, isDisplayed: true, isReadOnly: false, fieldGroup: group, columnId: 1 },
  column: { id: 1, columnName: name, referenceId: 10, referenceValueId: null, fieldLength: 60, isMandatory: mandatory, defaultValue: '', isUpdateable: true },
})

describe('DynamicForm', () => {
  it('renders grouped field sections', () => {
    const defs = [makeDef('Name', '基本', true), makeDef('Desc', '詳細', false)]
    const w = mount(DynamicForm, { props: { fieldDefs: defs, modelValue: {} } })
    const headers = w.findAll('.section-header')
    expect(headers).toHaveLength(2)
    expect(headers[0].text()).toContain('基本')
    expect(headers[1].text()).toContain('詳細')
  })

  it('auto-expands first group and groups with mandatory fields', () => {
    const defs = [makeDef('Name', '基本', true), makeDef('Desc', '詳細', false)]
    const w = mount(DynamicForm, { props: { fieldDefs: defs, modelValue: {} } })
    // First group should be expanded (has content visible)
    const sections = w.findAll('.form-section')
    expect(sections[0].find('.section-content').exists()).toBe(true)
  })
})
