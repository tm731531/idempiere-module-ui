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
  lookupPriceListInfo,
} from './lookup'
import { toIdempiereDateTime } from './utils'

export interface OrderHeaderData {
  C_BPartner_ID: number
  AD_Org_ID: number
  M_Warehouse_ID: number
  Description?: string
  username?: string
  // Fields that may be pre-filled by callout
  C_DocTypeTarget_ID?: number
  C_BPartner_Location_ID?: number
  Bill_Location_ID?: number
  M_PriceList_ID?: number
  C_PaymentTerm_ID?: number
  PaymentRule?: string
  SalesRep_ID?: number
  DateOrdered?: string
  DateAcct?: string
  DatePromised?: string
  IsSOTrx?: boolean
  DeliveryRule?: string
  DeliveryViaRule?: string
  FreightCostRule?: string
  InvoiceRule?: string
  PriorityRule?: string
}

export interface OrderLineData {
  M_Product_ID: number
  C_UOM_ID?: number
  C_Tax_ID?: number
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

export async function updateOrder(id: number, data: Record<string, any>): Promise<any> {
  const resp = await apiClient.put(`/api/v1/models/C_Order/${id}`, data)
  return resp.data
}

export async function createOrder(data: OrderHeaderData): Promise<any> {
  if (!data.M_Warehouse_ID) {
    throw new Error('請先選擇倉庫（M_Warehouse_ID 為必填）')
  }

  // Only lookup values not already provided by the form (callout may have pre-filled them)
  const [docTypeId, priceListId, paymentTermId, userId, bpLocationId] = await Promise.all([
    data.C_DocTypeTarget_ID ? Promise.resolve(data.C_DocTypeTarget_ID) : lookupDocTypeId('SOO'),
    data.M_PriceList_ID ? Promise.resolve(data.M_PriceList_ID) : lookupSalesPriceListId(),
    data.C_PaymentTerm_ID ? Promise.resolve(data.C_PaymentTerm_ID) : lookupDefaultPaymentTermId(),
    data.SalesRep_ID ? Promise.resolve(data.SalesRep_ID) : lookupCurrentUserId(data.username || ''),
    data.C_BPartner_Location_ID ? Promise.resolve(data.C_BPartner_Location_ID) : lookupBPartnerLocationId(data.C_BPartner_ID),
  ])

  // Resolve currency from the actual price list being used
  let currencyId: number | null = null
  try {
    const plInfo = await lookupPriceListInfo(priceListId)
    currencyId = plInfo.currencyId
  } catch { /* fallback below */ }
  if (!currencyId) {
    currencyId = await lookupSOCurrencyId()
  }

  const now = toIdempiereDateTime(new Date())
  const resp = await apiClient.post('/api/v1/models/C_Order', {
    AD_Org_ID: data.AD_Org_ID,
    C_DocType_ID: 0,
    C_DocTypeTarget_ID: docTypeId,
    C_BPartner_ID: data.C_BPartner_ID,
    C_BPartner_Location_ID: bpLocationId,
    Bill_Location_ID: data.Bill_Location_ID || bpLocationId,
    M_PriceList_ID: priceListId,
    C_PaymentTerm_ID: paymentTermId,
    C_Currency_ID: currencyId,
    M_Warehouse_ID: data.M_Warehouse_ID,
    DateOrdered: data.DateOrdered || now,
    DateAcct: data.DateAcct || now,
    DatePromised: data.DatePromised || now,
    SalesRep_ID: userId,
    IsSOTrx: data.IsSOTrx ?? true,
    DeliveryRule: data.DeliveryRule || 'F',
    DeliveryViaRule: data.DeliveryViaRule || 'P',
    FreightCostRule: data.FreightCostRule || 'I',
    InvoiceRule: data.InvoiceRule || 'I',
    PaymentRule: data.PaymentRule || 'B',
    PriorityRule: data.PriorityRule || '5',
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
  const taxId = data.C_Tax_ID || await lookupDefaultTaxId()
  const payload: Record<string, any> = {
    C_Order_ID: orderId,
    M_Product_ID: data.M_Product_ID,
    QtyOrdered: data.QtyOrdered,
    QtyEntered: data.QtyOrdered,
    PriceEntered: data.PriceEntered,
    PriceActual: data.PriceEntered,
    C_Tax_ID: taxId,
    Description: data.Description || '',
  }
  if (data.C_UOM_ID) payload.C_UOM_ID = data.C_UOM_ID
  const resp = await apiClient.post('/api/v1/models/C_OrderLine', payload)
  return resp.data
}

export async function updateOrderLine(lineId: number, data: Record<string, any>): Promise<any> {
  const resp = await apiClient.put(`/api/v1/models/C_OrderLine/${lineId}`, data)
  return resp.data
}

export async function deleteOrderLine(lineId: number): Promise<void> {
  await apiClient.delete(`/api/v1/models/C_OrderLine/${lineId}`)
}
