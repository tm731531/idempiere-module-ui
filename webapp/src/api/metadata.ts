import { apiClient } from './client'

export interface FieldMeta {
  id: number; name: string; seqNo: number; isDisplayed: boolean
  isReadOnly: boolean; fieldGroup: string; columnId: number
}

export interface ColumnMeta {
  id: number; columnName: string; referenceId: number
  referenceValueId: number | null; fieldLength: number
  isMandatory: boolean; defaultValue: string; isUpdateable: boolean
}

export interface FieldDefinition {
  field: FieldMeta
  column: ColumnMeta
  referenceTableName?: string  // Resolved table name for Ref 18/19/30
}

// ========== FK Table Name Resolution ==========

const refTableCache = new Map<number, string>()

/**
 * For Reference 18 (Table) or 30 (Search), resolve the related table name
 * by querying AD_Ref_Table → AD_Table.
 */
export async function fetchReferenceTableName(referenceValueId: number): Promise<string> {
  if (refTableCache.has(referenceValueId)) return refTableCache.get(referenceValueId)!

  try {
    const resp = await apiClient.get('/api/v1/models/AD_Ref_Table', {
      params: {
        '$filter': `AD_Reference_ID eq ${referenceValueId}`,
        '$select': 'AD_Table_ID',
        '$top': 1,
      },
    })
    const records = resp.data.records || []
    if (records.length > 0) {
      const tableId = records[0].AD_Table_ID?.id || records[0].AD_Table_ID
      if (tableId) {
        const tResp = await apiClient.get(`/api/v1/models/AD_Table/${tableId}`, {
          params: { '$select': 'TableName' },
        })
        const tableName = tResp.data.TableName || ''
        refTableCache.set(referenceValueId, tableName)
        return tableName
      }
    }
  } catch {
    // Silently fall back to empty
  }
  refTableCache.set(referenceValueId, '')
  return ''
}

export function clearRefTableCache(): void {
  refTableCache.clear()
}

// ========== Identifier Column Resolution ==========

const identifierCache = new Map<string, string>()

/**
 * Fetch the first identifier column for a table by querying AD_Column
 * where IsIdentifier=true, ordered by SeqNo.
 * This determines what field to display/search in SearchSelector.
 * Falls back to 'Name' if no identifier column is found.
 */
export async function fetchIdentifierColumn(tableName: string): Promise<string> {
  if (identifierCache.has(tableName)) return identifierCache.get(tableName)!

  try {
    // First resolve table name → AD_Table_ID
    const tableResp = await apiClient.get('/api/v1/models/AD_Table', {
      params: {
        '$filter': `TableName eq '${tableName}'`,
        '$select': 'AD_Table_ID',
        '$top': 1,
      },
    })
    const tables = tableResp.data.records || []
    if (tables.length === 0) {
      identifierCache.set(tableName, 'Name')
      return 'Name'
    }
    const tableId = tables[0].id

    // Query AD_Column for IsIdentifier = true, ordered by SeqNo
    const colResp = await apiClient.get('/api/v1/models/AD_Column', {
      params: {
        '$filter': `AD_Table_ID eq ${tableId} and IsIdentifier eq true and IsActive eq true`,
        '$select': 'ColumnName,SeqNo',
        '$orderby': 'SeqNo',
        '$top': 1,
      },
    })
    const cols = colResp.data.records || []
    const result = cols.length > 0 ? cols[0].ColumnName : 'Name'
    identifierCache.set(tableName, result)
    return result
  } catch {
    identifierCache.set(tableName, 'Name')
    return 'Name'
  }
}

// ========== Default Value Resolution ==========

export interface AuthContext {
  organizationId: number
  warehouseId: number
  clientId: number
}

// Reference types where the DB value is always a string (List, String, Text, Memo)
const STRING_REF_TYPES = new Set([10, 14, 17, 38])

/**
 * Resolve AD_Column.DefaultValue context variables to actual values.
 * - Simple: 'N', '0', 'DR'
 * - Context: '@#Date@' → today, '@AD_Org_ID@' → orgId
 * - SQL: '@SQL=...' → undefined (server handles)
 *
 * @param referenceId - AD_Reference_ID from AD_Column, used to determine
 *   whether numeric-looking defaults (e.g. '5') should stay as strings
 *   (List/String fields) or be converted to numbers (Integer/FK fields).
 */
export function resolveDefaultValue(defaultExpr: string, ctx: AuthContext, referenceId?: number): any {
  if (!defaultExpr) return undefined

  // Skip SQL defaults
  if (defaultExpr.startsWith('@SQL=')) return undefined

  // Context variables: @#AD_Client_ID@, @AD_Org_ID@, etc.
  if (/^@[#A-Za-z_]+@$/.test(defaultExpr)) {
    const varName = defaultExpr.slice(1, -1)
    const contextMap: Record<string, any> = {
      '#Date': new Date().toISOString().split('T')[0],
      'AD_Org_ID': ctx.organizationId,
      '#AD_Org_ID': ctx.organizationId,
      'M_Warehouse_ID': ctx.warehouseId,
      '#M_Warehouse_ID': ctx.warehouseId,
      'AD_Client_ID': ctx.clientId,
      '#AD_Client_ID': ctx.clientId,
      'IsSOTrx': true,
      '#IsSOTrx': true,
    }
    if (varName in contextMap) return contextMap[varName]
    // Unknown context variable — skip, let server handle
    return undefined
  }

  // Boolean literals
  if (defaultExpr === 'Y') return true
  if (defaultExpr === 'N') return false

  // Date keywords — server-side SQL tokens, resolve to current date/time
  if (defaultExpr === 'SYSDATE' || defaultExpr === 'CURRENT_TIMESTAMP') {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  }
  if (defaultExpr === 'CURRENT_DATE') {
    return new Date().toISOString().split('T')[0]
  }

  // Numeric literals — but only convert if the field is NOT a string-type reference
  // e.g. PriorityUser (List ref 17) has default '5' which must stay as string '5'
  const isStringField = referenceId !== undefined && STRING_REF_TYPES.has(referenceId)
  if (!isStringField) {
    if (/^-?\d+$/.test(defaultExpr)) return parseInt(defaultExpr, 10)
    if (/^-?\d+\.\d+$/.test(defaultExpr)) return parseFloat(defaultExpr)
  }

  return defaultExpr
}

// ========== Field & Column Fetching ==========

export async function fetchFieldsForTab(tabId: number): Promise<FieldMeta[]> {
  const resp = await apiClient.get('/api/v1/models/AD_Field', {
    params: {
      '$filter': `AD_Tab_ID eq ${tabId} and IsActive eq true and IsDisplayed eq true`,
      '$select': 'AD_Field_ID,Name,SeqNo,IsDisplayed,IsReadOnly,AD_FieldGroup_ID,AD_Column_ID',
      '$orderby': 'SeqNo', '$top': 200,
    },
  })
  return (resp.data.records || []).map((r: any) => ({
    id: r.id, name: r.Name, seqNo: r.SeqNo, isDisplayed: r.IsDisplayed,
    isReadOnly: r.IsReadOnly,
    fieldGroup: r.AD_FieldGroup_ID?.identifier || '',
    columnId: r.AD_Column_ID?.id || r.AD_Column_ID,
  }))
}

/**
 * Fetch a single column by ID.
 */
export async function fetchColumn(columnId: number): Promise<ColumnMeta> {
  const resp = await apiClient.get(`/api/v1/models/AD_Column/${columnId}`, {
    params: { '$select': 'AD_Column_ID,ColumnName,AD_Reference_ID,AD_Reference_Value_ID,FieldLength,IsMandatory,DefaultValue,IsUpdateable' },
  })
  const r = resp.data
  return mapColumnRecord(r)
}

/**
 * Batch fetch multiple columns in a single request using OR filter.
 */
export async function fetchColumnsBatch(columnIds: number[]): Promise<ColumnMeta[]> {
  if (columnIds.length === 0) return []

  // Build filter: AD_Column_ID eq 1 or AD_Column_ID eq 2 or ...
  const filter = columnIds.map(id => `AD_Column_ID eq ${id}`).join(' or ')
  const resp = await apiClient.get('/api/v1/models/AD_Column', {
    params: {
      '$filter': filter,
      '$select': 'AD_Column_ID,ColumnName,AD_Reference_ID,AD_Reference_Value_ID,FieldLength,IsMandatory,DefaultValue,IsUpdateable',
      '$top': columnIds.length,
    },
  })
  const records = resp.data.records || []
  return records.map(mapColumnRecord)
}

function mapColumnRecord(r: any): ColumnMeta {
  return {
    id: r.id ?? (r.AD_Column_ID?.id || r.AD_Column_ID),
    columnName: r.ColumnName,
    referenceId: r.AD_Reference_ID?.id || r.AD_Reference_ID,
    referenceValueId: r.AD_Reference_Value_ID?.id || r.AD_Reference_Value_ID || null,
    fieldLength: r.FieldLength || 0,
    isMandatory: r.IsMandatory === true || r.IsMandatory === 'Y',
    defaultValue: r.DefaultValue || '',
    isUpdateable: r.IsUpdateable === true || r.IsUpdateable === 'Y',
  }
}

export async function fetchRefListItems(referenceValueId: number): Promise<{ value: string; name: string }[]> {
  const resp = await apiClient.get('/api/v1/models/AD_Ref_List', {
    params: {
      '$filter': `AD_Reference_ID eq ${referenceValueId} and IsActive eq true`,
      '$select': 'Value,Name', '$orderby': 'Name',
    },
  })
  return (resp.data.records || []).map((r: any) => ({ value: r.Value, name: r.Name }))
}

/**
 * Fetch complete field definitions for a tab.
 * Uses batch column fetch + resolves FK table names for Ref 18/19/30.
 */
export async function fetchFieldDefinitions(tabId: number): Promise<FieldDefinition[]> {
  const fields = await fetchFieldsForTab(tabId)

  // Batch fetch all columns in one request
  const columnIds = fields.map(f => f.columnId)
  const columns = await fetchColumnsBatch(columnIds)

  // Build column lookup by ID
  const columnMap = new Map<number, ColumnMeta>()
  for (const col of columns) {
    columnMap.set(col.id, col)
  }

  const defs: FieldDefinition[] = fields
    .filter(f => columnMap.has(f.columnId))
    .map(field => ({
      field,
      column: columnMap.get(field.columnId)!,
    }))

  // Resolve FK table names
  // Ref 19 (TableDirect): derive from column name
  for (const d of defs) {
    if (d.column.referenceId === 19) {
      const cn = d.column.columnName
      d.referenceTableName = cn.endsWith('_ID') ? cn.slice(0, -3) : cn
    }
  }

  // Ref 18 (Table) and 30 (Search): resolve via AD_Ref_Table
  const fkDefs = defs.filter(d =>
    [18, 30].includes(d.column.referenceId) && d.column.referenceValueId
  )
  if (fkDefs.length > 0) {
    await Promise.all(fkDefs.map(async (d) => {
      d.referenceTableName = await fetchReferenceTableName(d.column.referenceValueId!)
    }))
  }

  return defs
}
