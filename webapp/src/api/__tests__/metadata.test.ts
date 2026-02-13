import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), defaults: { headers: { common: {} } } },
}))

describe('metadata API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should fetch AD_Field list for a tab', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        records: [{
          id: 100, Name: 'DocumentNo', SeqNo: 10,
          IsDisplayed: true, FieldGroup: '基本資訊', IsReadOnly: false,
          AD_Column_ID: { id: 200 },
        }],
      },
    })

    const { fetchFieldsForTab } = await import('@/api/metadata')
    const fields = await fetchFieldsForTab(100)
    expect(fields).toHaveLength(1)
    expect(fields[0].name).toBe('DocumentNo')
  })

  it('should fetch AD_Column details', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        id: 200, ColumnName: 'DocumentNo',
        AD_Reference_ID: { id: 10 }, FieldLength: 30,
        IsMandatory: true, DefaultValue: '', AD_Reference_Value_ID: null,
      },
    })

    const { fetchColumn } = await import('@/api/metadata')
    const col = await fetchColumn(200)
    expect(col.columnName).toBe('DocumentNo')
    expect(col.referenceId).toBe(10)
    expect(col.isMandatory).toBe(true)
  })
})
