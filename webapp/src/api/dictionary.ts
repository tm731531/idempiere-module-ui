import { apiClient } from './client'
import { escapeODataString } from './utils'

/** Tables that our app actively uses */
export const APP_TABLE_NAMES = [
  'C_BPartner', 'C_BPartner_Location', 'C_Order', 'C_OrderLine',
  'C_Payment', 'M_InOut', 'M_InOutLine', 'M_Production', 'M_ProductionLine',
  'R_Request', 'S_Resource', 'S_ResourceAssignment', 'M_Product',
  'AD_Field', 'AD_Column', 'AD_Table',
]

export interface TableInfo {
  id: number
  tableName: string
  name: string
  isAppTable: boolean
}

export interface ColumnInfo {
  id: number
  columnName: string
  name: string
  isMandatory: boolean
  isUpdateable: boolean
  isKey: boolean
  referenceType: string
  referenceId: number
  fieldLength: number
  defaultValue: string
  validationRule: string
}

export async function listAppTables(): Promise<TableInfo[]> {
  const filter = APP_TABLE_NAMES.map(t => `TableName eq '${t}'`).join(' or ')
  const resp = await apiClient.get('/api/v1/models/AD_Table', {
    params: {
      '$filter': `(${filter}) and IsActive eq true`,
      '$select': 'AD_Table_ID,TableName,Name',
      '$orderby': 'TableName',
      '$top': 100,
    },
  })
  return (resp.data.records || []).map((r: any) => ({
    id: r.id,
    tableName: r.TableName,
    name: r.Name,
    isAppTable: true,
  }))
}

export async function searchTables(query: string): Promise<TableInfo[]> {
  const escaped = escapeODataString(query)
  const resp = await apiClient.get('/api/v1/models/AD_Table', {
    params: {
      '$filter': `IsActive eq true and (contains(TableName,'${escaped}') or contains(Name,'${escaped}'))`,
      '$select': 'AD_Table_ID,TableName,Name',
      '$orderby': 'TableName',
      '$top': 50,
    },
  })
  return (resp.data.records || []).map((r: any) => ({
    id: r.id,
    tableName: r.TableName,
    name: r.Name,
    isAppTable: APP_TABLE_NAMES.includes(r.TableName),
  }))
}

export async function getTableColumns(tableId: number): Promise<ColumnInfo[]> {
  const resp = await apiClient.get('/api/v1/models/AD_Column', {
    params: {
      '$filter': `AD_Table_ID eq ${tableId} and IsActive eq true`,
      '$select': 'AD_Column_ID,ColumnName,Name,IsMandatory,IsUpdateable,IsKey,AD_Reference_ID,FieldLength,DefaultValue,AD_Val_Rule_ID',
      '$orderby': 'ColumnName',
      '$top': 500,
    },
  })
  return (resp.data.records || []).map((r: any) => ({
    id: r.id,
    columnName: r.ColumnName,
    name: r.Name,
    isMandatory: r.IsMandatory === true,
    isUpdateable: r.IsUpdateable === true,
    isKey: r.IsKey === true,
    referenceType: r.AD_Reference_ID && typeof r.AD_Reference_ID === 'object'
      ? r.AD_Reference_ID.identifier
      : '',
    referenceId: r.AD_Reference_ID && typeof r.AD_Reference_ID === 'object'
      ? r.AD_Reference_ID.id
      : (r.AD_Reference_ID || 0),
    fieldLength: r.FieldLength || 0,
    defaultValue: r.DefaultValue || '',
    validationRule: r.AD_Val_Rule_ID && typeof r.AD_Val_Rule_ID === 'object'
      ? r.AD_Val_Rule_ID.identifier
      : '',
  }))
}

export async function updateColumn(
  columnId: number,
  data: { IsMandatory?: boolean; IsUpdateable?: boolean; DefaultValue?: string | null },
): Promise<void> {
  await apiClient.put(`/api/v1/models/AD_Column/${columnId}`, data)
}
