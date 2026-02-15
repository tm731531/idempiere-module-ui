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
    expect(fields[0]!.name).toBe('DocumentNo')
  })

  it('resolves SYSDATE to current datetime', async () => {
    const { resolveDefaultValue } = await import('@/api/metadata')
    const ctx = { organizationId: 1, warehouseId: 1, clientId: 1 }
    const result = resolveDefaultValue('SYSDATE', ctx)
    // Should be ISO datetime without milliseconds
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  })

  it('resolves simple literals', async () => {
    const { resolveDefaultValue } = await import('@/api/metadata')
    const ctx = { organizationId: 1, warehouseId: 1, clientId: 1 }
    expect(resolveDefaultValue('Y', ctx)).toBe(true)
    expect(resolveDefaultValue('N', ctx)).toBe(false)
    expect(resolveDefaultValue('0', ctx)).toBe(0)
    expect(resolveDefaultValue('DR', ctx)).toBe('DR')
  })

  it('keeps numeric default as string for List reference (ref 17)', async () => {
    const { resolveDefaultValue } = await import('@/api/metadata')
    const ctx = { organizationId: 1, warehouseId: 1, clientId: 1 }
    // PriorityUser default '5' must stay as string for List fields
    expect(resolveDefaultValue('5', ctx, 17)).toBe('5')
    // But Integer field (ref 11) should convert to number
    expect(resolveDefaultValue('5', ctx, 11)).toBe(5)
  })

  it('should include validationRuleId from AD_Column', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        id: 2173, ColumnName: 'C_DocTypeTarget_ID',
        AD_Reference_ID: { id: 18 }, FieldLength: 0,
        IsMandatory: true, DefaultValue: '',
        AD_Reference_Value_ID: { id: 170 },
        AD_Val_Rule_ID: { id: 133 },
      },
    })

    const { fetchColumn } = await import('@/api/metadata')
    const col = await fetchColumn(2173)
    expect(col.validationRuleId).toBe(133)
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

describe('sqlWhereToODataFilter', () => {
  it('converts IN clause to or chain', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    const result = sqlWhereToODataFilter("DocBaseType IN ('SOO','POO')", {})
    expect(result).toBe("(DocBaseType eq 'SOO' or DocBaseType eq 'POO')")
  })

  it('resolves boolean context variable to OData boolean', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    const result = sqlWhereToODataFilter("IsSOTrx='@IsSOTrx@'", { IsSOTrx: true })
    expect(result).toBe('IsSOTrx eq true')
  })

  it('resolves numeric context variable', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    const result = sqlWhereToODataFilter("AD_Client_ID=@#AD_Client_ID@", { AD_Client_ID: 11 })
    expect(result).toContain('AD_Client_ID eq 11')
  })

  it('strips table prefixes', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    const result = sqlWhereToODataFilter("C_DocType.DocBaseType='SOO'", {})
    expect(result).toContain("DocBaseType eq 'SOO'")
  })

  it('strips COALESCE wrapper', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    const result = sqlWhereToODataFilter("COALESCE(DocSubTypeSO,' ')<>'RM'", {})
    expect(result).toContain("DocSubTypeSO ne 'RM'")
  })

  it('converts full C_DocTypeTarget validation rule', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    const sql = "C_DocType.DocBaseType IN ('SOO','POO') AND C_DocType.IsSOTrx='@IsSOTrx@' AND COALESCE(C_DocType.DocSubTypeSO,' ')<>'RM' AND C_DocType.AD_Client_ID=@#AD_Client_ID@"
    const result = sqlWhereToODataFilter(sql, { IsSOTrx: true, AD_Client_ID: 11 })
    expect(result).toContain("DocBaseType eq 'SOO'")
    expect(result).toContain("DocBaseType eq 'POO'")
    expect(result).toContain('IsSOTrx eq true')
    expect(result).toContain("DocSubTypeSO ne 'RM'")
    expect(result).toContain('AD_Client_ID eq 11')
  })

  it('converts AND to lowercase and', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    const result = sqlWhereToODataFilter("A='1' AND B='2'", {})
    expect(result).toContain(' and ')
    expect(result).not.toContain('AND')
  })

  it('returns null for SQL with IS NULL (unsupported by iDempiere REST)', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    expect(sqlWhereToODataFilter("C_BPartner_ID IS NULL", {})).toBeNull()
  })

  it('returns null for SQL with IS NOT NULL', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    expect(sqlWhereToODataFilter("C_BPartner_ID IS NOT NULL", {})).toBeNull()
  })

  it('converts boolean N to OData false', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    const result = sqlWhereToODataFilter("IsSOTrx='@IsSOTrx@'", { IsSOTrx: false })
    expect(result).toBe('IsSOTrx eq false')
  })

  it('returns null for SQL with subqueries', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    const sql = "EXISTS (SELECT 1 FROM M_PriceList_Version WHERE M_PriceList_ID=M_PriceList.M_PriceList_ID AND IsActive='Y')"
    expect(sqlWhereToODataFilter(sql, {})).toBeNull()
  })

  it('returns null when context variable is missing', async () => {
    const { sqlWhereToODataFilter } = await import('@/api/metadata')
    const sql = "IsSOTrx='@IsSOTrx@'"
    expect(sqlWhereToODataFilter(sql, {})).toBeNull()
  })
})
