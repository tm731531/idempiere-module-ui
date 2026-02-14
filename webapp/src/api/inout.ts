import { apiClient } from './client'
import { lookupDocTypeId, lookupBPartnerLocationId } from './lookup'
import { toIdempiereDateTime } from './utils'

export interface InOutData {
  C_BPartner_ID: number
  M_Warehouse_ID: number
  AD_Org_ID: number
  IsSOTrx: boolean  // true=Shipment, false=Receipt
  C_Order_ID?: number
  MovementDate?: string  // yyyy-MM-dd format
  Description?: string
}

export interface InOutLineData {
  M_Product_ID: number
  MovementQty: number
  M_Locator_ID: number
  Description?: string
}

export async function listInOuts(filter?: string): Promise<any[]> {
  const params: Record<string, string> = {
    '$select': 'M_InOut_ID,DocumentNo,DocStatus,C_BPartner_ID,MovementDate,IsSOTrx',
    '$expand': 'C_BPartner_ID',
    '$orderby': 'MovementDate desc',
    '$top': '100',
  }
  if (filter) params['$filter'] = filter
  const resp = await apiClient.get('/api/v1/models/M_InOut', { params })
  return resp.data.records || []
}

export async function getInOut(id: number): Promise<any> {
  const resp = await apiClient.get(`/api/v1/models/M_InOut/${id}`, {
    params: { '$expand': 'C_BPartner_ID' },
  })
  return resp.data
}

export async function createInOut(data: InOutData): Promise<any> {
  if (!data.M_Warehouse_ID) throw new Error('請先選擇倉庫（M_Warehouse_ID 為必填）')

  const docBaseType = data.IsSOTrx ? 'MMS' : 'MMR'  // Material Movement Shipment vs Receipt
  const [docTypeId, bpLocationId] = await Promise.all([
    lookupDocTypeId(docBaseType),
    lookupBPartnerLocationId(data.C_BPartner_ID),
  ])

  const movDate = data.MovementDate
    ? new Date(data.MovementDate + 'T00:00:00')
    : new Date()

  const payload: Record<string, any> = {
    AD_Org_ID: data.AD_Org_ID,
    C_DocType_ID: docTypeId,
    C_BPartner_ID: data.C_BPartner_ID,
    C_BPartner_Location_ID: bpLocationId,
    M_Warehouse_ID: data.M_Warehouse_ID,
    MovementDate: toIdempiereDateTime(movDate),
    DateAcct: toIdempiereDateTime(movDate),
    IsSOTrx: data.IsSOTrx,
    MovementType: data.IsSOTrx ? 'C-' : 'V+',
    Description: data.Description || '',
  }
  if (data.C_Order_ID) {
    payload.C_Order_ID = data.C_Order_ID
  }

  const resp = await apiClient.post('/api/v1/models/M_InOut', payload)
  return resp.data
}

export async function getInOutLines(inoutId: number): Promise<any[]> {
  const resp = await apiClient.get('/api/v1/models/M_InOutLine', {
    params: {
      '$filter': `M_InOut_ID eq ${inoutId}`,
      '$expand': 'M_Product_ID',
      '$orderby': 'Line',
    },
  })
  return resp.data.records || []
}

export async function addInOutLine(inoutId: number, data: InOutLineData): Promise<any> {
  const resp = await apiClient.post('/api/v1/models/M_InOutLine', {
    M_InOut_ID: inoutId,
    M_Product_ID: data.M_Product_ID,
    MovementQty: data.MovementQty,
    M_Locator_ID: data.M_Locator_ID,
    Description: data.Description || '',
  })
  return resp.data
}

export async function deleteInOutLine(lineId: number): Promise<void> {
  await apiClient.delete(`/api/v1/models/M_InOutLine/${lineId}`)
}
