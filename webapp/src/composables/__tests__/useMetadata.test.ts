import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/metadata', () => ({ fetchFieldDefinitions: vi.fn() }))

describe('useMetadata', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should load and cache field definitions', async () => {
    const { fetchFieldDefinitions } = await import('@/api/metadata')
    vi.mocked(fetchFieldDefinitions).mockResolvedValue([{
      field: { id: 1, name: 'Name', seqNo: 10, isDisplayed: true, isReadOnly: false, fieldGroup: '基本', columnId: 100 },
      column: { id: 100, columnName: 'Name', referenceId: 10, referenceValueId: null, fieldLength: 60, isMandatory: true, defaultValue: '', isUpdateable: true, validationRuleId: null },
    }])

    const { useMetadata } = await import('@/composables/useMetadata')
    const { loadFields, fieldDefs } = useMetadata()
    await loadFields(50)
    expect(fieldDefs.value).toHaveLength(1)
    await loadFields(50) // cached
    expect(fetchFieldDefinitions).toHaveBeenCalledTimes(1)
  })
})
