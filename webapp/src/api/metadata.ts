import { apiClient } from './client'

export interface FieldMeta {
  id: number; name: string; seqNo: number; isDisplayed: boolean
  isReadOnly: boolean; fieldGroup: string; columnId: number
}

export interface ColumnMeta {
  id: number; columnName: string; referenceId: number
  referenceValueId: number | null; fieldLength: number
  isMandatory: boolean; defaultValue: string; isUpdateable: boolean
  validationRuleId: number | null
}

export interface FieldDefinition {
  field: FieldMeta
  column: ColumnMeta
  referenceTableName?: string  // Resolved table name for Ref 18/19/30
  validationRuleSql?: string   // Raw SQL from AD_Val_Rule.Code
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
      },
    })
    const cols = colResp.data.records || []
    // Prefer 'Name' if it's among identifiers (more user-friendly than Value/code)
    const hasName = cols.some((c: any) => c.ColumnName === 'Name')
    const result = hasName ? 'Name' : (cols.length > 0 ? cols[0].ColumnName : 'Name')
    identifierCache.set(tableName, result)
    return result
  } catch {
    identifierCache.set(tableName, 'Name')
    return 'Name'
  }
}

// ========== Secondary Display Column Resolution ==========

const secondaryCache = new Map<string, string>()

/**
 * Check if a table has a Description column that can serve as secondary display.
 * Returns 'Description' if the column exists and is active, empty string otherwise.
 * Reuses the tableId lookup from fetchIdentifierColumn via AD_Table query.
 */
export async function fetchSecondaryDisplayColumn(tableName: string): Promise<string> {
  if (secondaryCache.has(tableName)) return secondaryCache.get(tableName)!

  try {
    const tableResp = await apiClient.get('/api/v1/models/AD_Table', {
      params: {
        '$filter': `TableName eq '${tableName}'`,
        '$select': 'AD_Table_ID',
        '$top': 1,
      },
    })
    const tables = tableResp.data.records || []
    if (tables.length === 0) {
      secondaryCache.set(tableName, '')
      return ''
    }
    const tableId = tables[0].id

    const colResp = await apiClient.get('/api/v1/models/AD_Column', {
      params: {
        '$filter': `AD_Table_ID eq ${tableId} and ColumnName eq 'Description' and IsActive eq true`,
        '$select': 'ColumnName',
        '$top': 1,
      },
    })
    const result = (colResp.data.records || []).length > 0 ? 'Description' : ''
    secondaryCache.set(tableName, result)
    return result
  } catch {
    secondaryCache.set(tableName, '')
    return ''
  }
}

// ========== QuickCreate Eligibility ==========

const quickCreateCache = new Map<string, { eligible: boolean; mandatoryDefaults: Record<string, any> }>()

// Standard columns that are auto-filled by the system on create
const AUTO_FILLED_COLUMNS = new Set([
  'AD_Client_ID', 'AD_Org_ID', 'IsActive',
  'Created', 'CreatedBy', 'Updated', 'UpdatedBy',
])

/**
 * Determine if a table supports inline QuickCreate by checking its mandatory columns.
 * A table is eligible if all mandatory columns (except auto-filled system columns and
 * the table's own PK) either have default values or are just 'Name'/'Value'.
 *
 * Returns { eligible, mandatoryDefaults } where mandatoryDefaults contains the
 * default values for mandatory columns that aren't 'Name' (to be sent as payload).
 */
export async function checkQuickCreateEligibility(tableName: string): Promise<{ eligible: boolean; mandatoryDefaults: Record<string, any> }> {
  if (quickCreateCache.has(tableName)) return quickCreateCache.get(tableName)!

  try {
    // Get table ID
    const tableResp = await apiClient.get('/api/v1/models/AD_Table', {
      params: {
        '$filter': `TableName eq '${tableName}'`,
        '$select': 'AD_Table_ID',
        '$top': 1,
      },
    })
    const tables = tableResp.data.records || []
    if (tables.length === 0) {
      const result = { eligible: false, mandatoryDefaults: {} }
      quickCreateCache.set(tableName, result)
      return result
    }
    const tableId = tables[0].id
    const pkColumn = `${tableName}_ID`

    // Get all mandatory columns for this table
    const colResp = await apiClient.get('/api/v1/models/AD_Column', {
      params: {
        '$filter': `AD_Table_ID eq ${tableId} and IsMandatory eq true and IsActive eq true`,
        '$select': 'ColumnName,DefaultValue,AD_Reference_ID',
        '$top': 100,
      },
    })
    const cols = colResp.data.records || []

    const mandatoryDefaults: Record<string, any> = {}
    let eligible = true

    for (const col of cols) {
      const cn = col.ColumnName
      const refId = col.AD_Reference_ID?.id || col.AD_Reference_ID

      // Skip auto-filled system columns and PK
      if (AUTO_FILLED_COLUMNS.has(cn) || cn === pkColumn) continue

      // 'Name' or 'Value' — user provides via QuickCreate input
      if (cn === 'Name' || cn === 'Value') continue

      // Has a default value — resolve and include in defaults
      if (col.DefaultValue) {
        const resolved = resolveDefaultValue(col.DefaultValue, { organizationId: 0, warehouseId: 0, clientId: 0 }, refId)
        if (resolved !== undefined) {
          mandatoryDefaults[cn] = resolved
          continue
        }
      }

      // Mandatory column without default and not Name/Value — not eligible
      eligible = false
      break
    }

    const result = { eligible, mandatoryDefaults }
    quickCreateCache.set(tableName, result)
    return result
  } catch {
    const result = { eligible: false, mandatoryDefaults: {} }
    quickCreateCache.set(tableName, result)
    return result
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

// ========== Validation Rule Resolution ==========

const valRuleCache = new Map<number, string>()

export async function fetchValidationRule(ruleId: number): Promise<string> {
  if (valRuleCache.has(ruleId)) return valRuleCache.get(ruleId)!
  try {
    const resp = await apiClient.get(`/api/v1/models/AD_Val_Rule/${ruleId}`, {
      params: { '$select': 'Code' },
    })
    const code = resp.data.Code || ''
    valRuleCache.set(ruleId, code)
    return code
  } catch {
    valRuleCache.set(ruleId, '')
    return ''
  }
}

// SQL keywords that indicate unconvertible expressions
// IS NULL/IS NOT NULL: iDempiere REST OData parser doesn't support the IS operator
const UNCONVERTIBLE_SQL = /\b(SELECT|EXISTS|FROM|JOIN|UNION|GROUP\s+BY|HAVING|ORDER\s+BY|IS\s+NULL|IS\s+NOT\s+NULL)\b/i

/**
 * Convert iDempiere SQL WHERE clause to OData $filter.
 * Supports common patterns: IN, =, <>, AND, COALESCE, table prefixes, context variables.
 * Returns null for complex SQL that cannot be converted (subqueries, EXISTS, etc.).
 */
export function sqlWhereToODataFilter(
  sql: string,
  context: Record<string, any>,
): string | null {
  // Skip complex SQL that cannot be represented in OData
  if (UNCONVERTIBLE_SQL.test(sql)) return null

  let odata = sql

  // Check if all context variables can be resolved; skip if any are missing
  const contextVarPattern = /@#?(\w+)@/g
  let match: RegExpExecArray | null
  while ((match = contextVarPattern.exec(sql)) !== null) {
    const varName = match[1] as string
    if (context[varName] === undefined) return null
  }

  // 1. Strip table prefixes (C_DocType.DocBaseType → DocBaseType)
  odata = odata.replace(/\w+\.(\w+)/g, '$1')

  // 2. Strip COALESCE(Column,'default') → Column
  odata = odata.replace(/COALESCE\s*\(\s*(\w+)\s*,\s*'[^']*'\s*\)/gi, '$1')

  // 3. Resolve context variables: @VarName@ or @#VarName@
  // Handle both quoted ('@Var@') and unquoted (@Var@) contexts
  odata = odata.replace(/'@#?(\w+)@'/g, (_, varName: string) => {
    const val = context[varName]
    if (typeof val === 'boolean') return val ? "'Y'" : "'N'"
    return `'${val}'`
  })
  odata = odata.replace(/@#?(\w+)@/g, (_, varName: string) => {
    const val = context[varName]
    if (typeof val === 'boolean') return val ? "'Y'" : "'N'"
    if (typeof val === 'number') return String(val)
    return `'${val}'`
  })

  // 3b. Resolve boolean literal comparisons left by context variable substitution
  // e.g. '@IsSOTrx@'='Y' with IsSOTrx=true → 'Y'='Y' (tautology) or 'N'='Y' (contradiction)
  odata = odata.replace(/'([YN])'\s*=\s*'([YN])'/g, (_, left: string, right: string) =>
    left === right ? '1=1' : '1=0',
  )

  // 4. Convert IN('a','b') → (Column eq 'a' or Column eq 'b')
  odata = odata.replace(
    /(\w+)\s+IN\s*\(([^)]+)\)/gi,
    (_, col: string, values: string) => {
      const parts = values.split(',').map((v: string) => `${col} eq ${v.trim()}`)
      return `(${parts.join(' or ')})`
    },
  )

  // 5. Convert <> to neq (iDempiere REST uses 'neq', NOT 'ne')
  odata = odata.replace(/<>/g, ' neq ')

  // 6. Convert = to eq (but not in context of <= >= or already-processed 'eq')
  odata = odata.replace(/(?<![<>!])=(?!=)/g, ' eq ')

  // 7. AND → and, OR → or
  odata = odata.replace(/\bAND\b/gi, 'and')
  odata = odata.replace(/\bOR\b/gi, 'or')

  // 8. Convert SQL YesNo ('Y'/'N') to OData booleans (true/false)
  // iDempiere SQL uses ='Y'/='N' but REST OData expects eq true/eq false
  odata = odata.replace(/\beq\s+'Y'/g, 'eq true')
  odata = odata.replace(/\beq\s+'N'/g, 'eq false')
  odata = odata.replace(/\bneq\s+'Y'/g, 'neq true')
  odata = odata.replace(/\bneq\s+'N'/g, 'neq false')

  // 10. Simplify boolean tautologies (1 eq 1) and contradictions (1 eq 0)
  // These arise from resolved context comparisons like '@IsSOTrx@'='Y' → '1 eq 1'
  // Tautology in AND: drop the clause. Contradiction in AND: whole filter is null.
  // Tautology in OR: whole group is always true. Contradiction in OR: drop the branch.
  // For simplicity, handle the common AND-connected case and OR-connected case.
  if (odata.includes('1 eq 0')) {
    // Split by OR first, drop branches containing contradiction
    const orParts = odata.split(/\bor\b/gi).map(p => p.trim())
    const filtered = orParts.filter(p => !p.includes('1 eq 0'))
    if (filtered.length === 0) return null
    odata = filtered.join(' or ')
  }
  // Drop tautology clauses from AND chains
  if (odata.includes('1 eq 1')) {
    const parts = odata.split(/\band\b/gi).map(p => p.trim())
    const filtered = parts.filter(p => !p.includes('1 eq 1'))
    odata = filtered.length > 0 ? filtered.join(' and ') : parts[0]! // keep at least something
  }
  // Clean up parentheses around now-simplified expressions
  odata = odata.replace(/\(\s*(\w+\s+eq\s+\S+)\s*\)/g, '$1')

  // 11. Clean up whitespace
  odata = odata.replace(/\s+/g, ' ').trim()

  return odata || null
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
    params: { '$select': 'AD_Column_ID,ColumnName,AD_Reference_ID,AD_Reference_Value_ID,FieldLength,IsMandatory,DefaultValue,IsUpdateable,AD_Val_Rule_ID' },
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
      '$select': 'AD_Column_ID,ColumnName,AD_Reference_ID,AD_Reference_Value_ID,FieldLength,IsMandatory,DefaultValue,IsUpdateable,AD_Val_Rule_ID',
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
    validationRuleId: r.AD_Val_Rule_ID?.id || r.AD_Val_Rule_ID || null,
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

  // Ref 18 (Table) and 30 (Search): resolve via AD_Ref_Table if referenceValueId exists
  const fkDefs = defs.filter(d =>
    [18, 30].includes(d.column.referenceId) && d.column.referenceValueId
  )
  if (fkDefs.length > 0) {
    await Promise.all(fkDefs.map(async (d) => {
      d.referenceTableName = await fetchReferenceTableName(d.column.referenceValueId!)
    }))
  }

  // Ref 18/30 without referenceValueId: fallback to column name derivation
  for (const d of defs) {
    if ([18, 30].includes(d.column.referenceId) && !d.referenceTableName) {
      const cn = d.column.columnName
      if (cn.endsWith('_ID')) {
        d.referenceTableName = cn.slice(0, -3)
      }
    }
  }

  // Resolve validation rules (AD_Val_Rule)
  const valRuleDefs = defs.filter(d => d.column.validationRuleId)
  if (valRuleDefs.length > 0) {
    await Promise.all(valRuleDefs.map(async (d) => {
      const sql = await fetchValidationRule(d.column.validationRuleId!)
      if (sql) d.validationRuleSql = sql
    }))
  }

  return defs
}
