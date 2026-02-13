import { apiClient } from './client'
import { lookupDocTypeId } from './lookup'
import { toIdempiereDateTime } from './utils'

export interface PaymentData {
  C_BPartner_ID: number
  PayAmt: number
  TenderType: string  // X=Cash, K=Check, C=Credit Card, T=Direct Deposit
  C_Order_ID?: number
  AD_Org_ID: number
  Description?: string
}

export const TENDER_TYPES = [
  { value: 'X', label: '現金' },
  { value: 'K', label: '支票' },
  { value: 'C', label: '信用卡' },
  { value: 'T', label: '轉帳' },
]

export async function listPayments(filter?: string): Promise<any[]> {
  const params: Record<string, string> = {
    '$select': 'C_Payment_ID,DocumentNo,DocStatus,C_BPartner_ID,PayAmt,TenderType,DateTrx',
    '$expand': 'C_BPartner_ID',
    '$orderby': 'DateTrx desc',
    '$top': '100',
  }
  if (filter) params['$filter'] = filter
  const resp = await apiClient.get('/api/v1/models/C_Payment', { params })
  return resp.data.records || []
}

export async function getPayment(id: number): Promise<any> {
  const resp = await apiClient.get(`/api/v1/models/C_Payment/${id}`, {
    params: { '$expand': 'C_BPartner_ID' },
  })
  return resp.data
}

export async function createPayment(data: PaymentData): Promise<any> {
  const docTypeId = await lookupDocTypeId('ARR')  // AR Receipt

  const resp = await apiClient.post('/api/v1/models/C_Payment', {
    AD_Org_ID: data.AD_Org_ID,
    C_DocType_ID: docTypeId,
    C_BPartner_ID: data.C_BPartner_ID,
    PayAmt: data.PayAmt,
    TenderType: data.TenderType,
    DateTrx: toIdempiereDateTime(new Date()),
    DateAcct: toIdempiereDateTime(new Date()),
    IsReceipt: true,
    C_Order_ID: data.C_Order_ID || undefined,
    Description: data.Description || '',
  })
  return resp.data
}
