import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DynamicField from '@/components/DynamicField.vue'

vi.mock('@/api/metadata', () => ({ fetchRefListItems: vi.fn().mockResolvedValue([]) }))

const baseField = { id: 1, name: 'Test', seqNo: 10, isDisplayed: true, isReadOnly: false, fieldGroup: '', columnId: 1 }
const baseColumn = { id: 1, columnName: 'Test', referenceId: 10, referenceValueId: null, fieldLength: 60, isMandatory: true, defaultValue: '', isUpdateable: true }

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
})
