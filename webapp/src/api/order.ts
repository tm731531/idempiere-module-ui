import { apiClient } from './client'
import {
  lookupDocTypeId,
  lookupSalesPriceListId,
  lookupDefaultPaymentTermId,
  lookupDefaultTaxId,
  lookupCurrentUserId,
  lookupBPartnerLocationId,
  lookupSOCurrencyId,
  lookupEachUomId,
} from './lookup'
import { toIdempiereDateTime } from './utils'

export interface OrderHeaderData {
  C_BPartner_ID: number
  AD_Org_ID: number
  M_Warehouse_ID: number
  Description?: string
  username?: string
}

export interface OrderLineData {
  M_Product_ID: number
  QtyOrdered: number
  PriceEntered: number
  Description?: string
}

export async function listOrders(filter?: string): Promise<any[]> {
  const params: Record<string, string> = {
    '$select': 'C_Order_ID,DocumentNo,DocStatus,C_BPartner_ID,GrandTotal,DateOrdered',
    '$expand': 'C_BPartner_ID',
    '$orderby': 'DateOrdered desc',
    '$top': '100',
  }
  if (filter) params['$filter'] = filter
  const resp = await apiClient.get('/api/v1/models/C_Order', { params })
  return resp.data.records || []
}

export async function getOrder(id: number): Promise<any> {
  const resp = await apiClient.get(`/api/v1/models/C_Order/${id}`, {
    params: { '$expand': 'C_BPartner_ID,C_DocType_ID' },
  })
  return resp.data
}

export async function createOrder(data: OrderHeaderData): Promise<any> {
  if (!data.M_Warehouse_ID) {
    throw new Error('請先選擇倉庫（M_Warehouse_ID 為必填）')
  }

  // Parallel lookups for mandatory references
  const [docTypeId, priceListId, paymentTermId, userId, bpLocationId, currencyId] = await Promise.all([
    lookupDocTypeId('SOO'),
    lookupSalesPriceListId(),
    lookupDefaultPaymentTermId(),
    lookupCurrentUserId(data.username || ''),
    lookupBPartnerLocationId(data.C_BPartner_ID),
    lookupSOCurrencyId(),
  ])

  const now = toIdempiereDateTime(new Date())
  const resp = await apiClient.post('/api/v1/models/C_Order', {
    AD_Org_ID: data.AD_Org_ID,
    C_DocType_ID: 0,
    C_DocTypeTarget_ID: docTypeId,
    C_BPartner_ID: data.C_BPartner_ID,
    C_BPartner_Location_ID: bpLocationId,
    Bill_Location_ID: bpLocationId,
    M_PriceList_ID: priceListId,
    C_PaymentTerm_ID: paymentTermId,
    C_Currency_ID: currencyId,
    M_Warehouse_ID: data.M_Warehouse_ID,
    DateOrdered: now,
    DateAcct: now,
    DatePromised: now,
    SalesRep_ID: userId,
    IsSOTrx: true,
    DeliveryRule: 'F',
    DeliveryViaRule: 'P',
    FreightCostRule: 'I',
    InvoiceRule: 'I',
    PaymentRule: 'B',
    PriorityRule: '5',
    Description: data.Description || '',
  })
  return resp.data
}

export async function getOrderLines(orderId: number): Promise<any[]> {
  const resp = await apiClient.get('/api/v1/models/C_OrderLine', {
    params: {
      '$filter': `C_Order_ID eq ${orderId}`,
      '$expand': 'M_Product_ID',
      '$orderby': 'Line',
    },
  })
  return resp.data.records || []
}

export async function addOrderLine(orderId: number, data: OrderLineData): Promise<any> {
  const taxId = await lookupDefaultTaxId()
  const resp = await apiClient.post('/api/v1/models/C_OrderLine', {
    C_Order_ID: orderId,
    M_Product_ID: data.M_Product_ID,
    QtyOrdered: data.QtyOrdered,
    PriceEntered: data.PriceEntered,
    PriceActual: data.PriceEntered,
    C_Tax_ID: taxId,
    Description: data.Description || '',
  })
  return resp.data
}

export async function updateOrderLine(lineId: number, data: Record<string, any>): Promise<any> {
  const resp = await apiClient.put(`/api/v1/models/C_OrderLine/${lineId}`, data)
  return resp.data
}

export async function deleteOrderLine(lineId: number): Promise<void> {
  await apiClient.delete(`/api/v1/models/C_OrderLine/${lineId}`)
}
