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

export interface FieldDefinition { field: FieldMeta; column: ColumnMeta }

export async function fetchFieldsForTab(tabId: number): Promise<FieldMeta[]> {
  const resp = await apiClient.get('/api/v1/models/AD_Field', {
    params: {
      '$filter': `AD_Tab_ID eq ${tabId} and IsActive eq true and IsDisplayed eq true`,
      '$select': 'AD_Field_ID,Name,SeqNo,IsDisplayed,IsReadOnly,FieldGroup,AD_Column_ID',
      '$orderby': 'SeqNo', '$top': 200,
    },
  })
  return (resp.data.records || []).map((r: any) => ({
    id: r.id, name: r.Name, seqNo: r.SeqNo, isDisplayed: r.IsDisplayed,
    isReadOnly: r.IsReadOnly, fieldGroup: r.FieldGroup || '',
    columnId: r.AD_Column_ID?.id || r.AD_Column_ID,
  }))
}

export async function fetchColumn(columnId: number): Promise<ColumnMeta> {
  const resp = await apiClient.get(`/api/v1/models/AD_Column/${columnId}`, {
    params: { '$select': 'AD_Column_ID,ColumnName,AD_Reference_ID,AD_Reference_Value_ID,FieldLength,IsMandatory,DefaultValue,IsUpdateable' },
  })
  const r = resp.data
  return {
    id: r.id, columnName: r.ColumnName,
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

export async function fetchFieldDefinitions(tabId: number): Promise<FieldDefinition[]> {
  const fields = await fetchFieldsForTab(tabId)
  const columns = await Promise.all(fields.map(f => fetchColumn(f.columnId)))
  return fields.map((field, i) => ({ field, column: columns[i]! }))
}
