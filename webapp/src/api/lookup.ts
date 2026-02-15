/**
 * Lookup API Module
 *
 * 動態查詢 iDempiere reference ID 並快取
 * 取代硬編碼的 C_BP_Group_ID, C_DocType_ID, C_UOM_ID
 */

import { apiClient } from './client'

// In-memory cache: cleared on logout / client change
const cache: Record<string, any> = {}

export function clearLookupCache(): void {
  for (const key of Object.keys(cache)) {
    delete cache[key]
  }
}

/**
 * Lookup C_BP_Group_ID for default customer group in current client.
 * Prefers IsDefault=true, falls back to first active record.
 */
export async function lookupCustomerGroupId(): Promise<number> {
  if (cache['C_BP_Group_ID'] !== undefined) return cache['C_BP_Group_ID']

  const resp = await apiClient.get('/api/v1/models/C_BP_Group', {
    params: {
      '$filter': 'IsActive eq true',
      '$select': 'C_BP_Group_ID,Name,IsDefault',
      '$orderby': 'IsDefault desc, Name asc',
      '$top': 5,
    },
  })

  const records = resp.data.records || []
  const defaultGroup = records.find((r: any) => r.IsDefault) || records[0]
  const id = defaultGroup?.id || 0
  cache['C_BP_Group_ID'] = id
  return id
}

/**
 * Lookup C_DocType_ID by DocBaseType.
 * 'MMM' = Material Movement, 'MMR' = Material Receipt
 */
export async function lookupDocTypeId(docBaseType: string): Promise<number> {
  const cacheKey = `C_DocType_${docBaseType}`
  if (cache[cacheKey] !== undefined) return cache[cacheKey]

  const resp = await apiClient.get('/api/v1/models/C_DocType', {
    params: {
      '$filter': `DocBaseType eq '${docBaseType}' and IsActive eq true`,
      '$select': 'C_DocType_ID,Name',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache[cacheKey] = id
  return id
}

/**
 * Lookup C_DocType_ID for Internal Use Inventory.
 * DocBaseType='MMI' and Name contains 'Internal Use'.
 */
export async function lookupInternalUseDocTypeId(): Promise<number> {
  const cacheKey = 'C_DocType_InternalUse'
  if (cache[cacheKey] !== undefined) return cache[cacheKey]

  const resp = await apiClient.get('/api/v1/models/C_DocType', {
    params: {
      '$filter': "DocBaseType eq 'MMI' and contains(Name,'Internal Use') and IsActive eq true",
      '$select': 'C_DocType_ID,Name',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache[cacheKey] = id
  return id
}

/**
 * Lookup or create C_Charge for clinic dispense (internal use).
 */
export async function lookupDispenseChargeId(orgId: number): Promise<number> {
  const cacheKey = 'C_Charge_Dispense'
  if (cache[cacheKey] !== undefined) return cache[cacheKey]

  // Try to find existing "Clinic Dispense" charge
  const resp = await apiClient.get('/api/v1/models/C_Charge', {
    params: {
      '$filter': "Name eq 'Clinic Dispense' and IsActive eq true",
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  if (records.length > 0) {
    cache[cacheKey] = records[0].id
    return records[0].id
  }

  // Create new charge
  const createResp = await apiClient.post('/api/v1/models/C_Charge', {
    'AD_Org_ID': orgId,
    'Name': 'Clinic Dispense',
    'IsSameTax': false,
    'IsSameCurrency': true,
  })

  const id = createResp.data.id
  cache[cacheKey] = id
  return id
}

/**
 * Lookup C_UOM_ID for 'Each' unit.
 * Queries by X12DE355 = 'EA' (ISO standard code for 'Each').
 */
export async function lookupEachUomId(): Promise<number> {
  if (cache['C_UOM_Each'] !== undefined) return cache['C_UOM_Each']

  const resp = await apiClient.get('/api/v1/models/C_UOM', {
    params: {
      '$filter': "X12DE355 eq 'EA' and IsActive eq true",
      '$select': 'C_UOM_ID,Name',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache['C_UOM_Each'] = id
  return id
}

/**
 * Lookup default Tax Category (first active, prefer 'Standard').
 */
export async function lookupDefaultTaxCategoryId(): Promise<number> {
  if (cache['C_TaxCategory_Default'] !== undefined) return cache['C_TaxCategory_Default']

  const resp = await apiClient.get('/api/v1/models/C_TaxCategory', {
    params: {
      '$filter': 'IsActive eq true',
      '$select': 'C_TaxCategory_ID,Name',
      '$orderby': 'Name',
      '$top': '50',
    },
  })

  const records = resp.data.records || []
  // Prefer 'Standard', fallback to first
  const standard = records.find((r: any) => r.Name === 'Standard')
  const id = standard?.id || records[0]?.id || 0
  cache['C_TaxCategory_Default'] = id
  return id
}

/**
 * Lookup default Product Category (first active, prefer 'Standard').
 */
export async function lookupDefaultProductCategoryId(): Promise<number> {
  if (cache['M_Product_Category_Default'] !== undefined) return cache['M_Product_Category_Default']

  const resp = await apiClient.get('/api/v1/models/M_Product_Category', {
    params: {
      '$filter': 'IsActive eq true',
      '$select': 'M_Product_Category_ID,Name',
      '$orderby': 'Name',
      '$top': '50',
    },
  })

  const records = resp.data.records || []
  // Prefer 'Standard', fallback to first
  const standard = records.find((r: any) => r.Name === 'Standard')
  const id = standard?.id || records[0]?.id || 0
  cache['M_Product_Category_Default'] = id
  return id
}

// ========== Purchase Order Lookups ==========

/**
 * Lookup purchase price list (IsSOPriceList=false).
 */
export async function lookupPurchasePriceListId(): Promise<number> {
  if (cache['M_PriceList_PO'] !== undefined) return cache['M_PriceList_PO']

  const resp = await apiClient.get('/api/v1/models/M_PriceList', {
    params: {
      '$filter': 'IsSOPriceList eq false and IsActive eq true',
      '$select': 'M_PriceList_ID,Name,C_Currency_ID,IsDefault',
      '$orderby': 'IsDefault desc',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache['M_PriceList_PO'] = id
  // Also cache currency from this price list
  if (records[0]?.C_Currency_ID) {
    cache['C_Currency_PO'] = records[0].C_Currency_ID?.id || records[0].C_Currency_ID
  }
  return id
}

/**
 * Lookup currency from PO price list.
 */
export async function lookupPOCurrencyId(): Promise<number> {
  if (cache['C_Currency_PO'] !== undefined) return cache['C_Currency_PO']
  // Trigger price list lookup which caches currency
  await lookupPurchasePriceListId()
  return cache['C_Currency_PO'] || 0
}

/**
 * Lookup default payment term.
 */
export async function lookupDefaultPaymentTermId(): Promise<number> {
  if (cache['C_PaymentTerm'] !== undefined) return cache['C_PaymentTerm']

  const resp = await apiClient.get('/api/v1/models/C_PaymentTerm', {
    params: {
      '$filter': 'IsActive eq true',
      '$select': 'C_PaymentTerm_ID,Name,IsDefault',
      '$orderby': 'IsDefault desc, Name asc',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache['C_PaymentTerm'] = id
  return id
}

/**
 * Lookup default tax.
 */
export async function lookupDefaultTaxId(): Promise<number> {
  if (cache['C_Tax'] !== undefined) return cache['C_Tax']

  const resp = await apiClient.get('/api/v1/models/C_Tax', {
    params: {
      '$filter': 'IsActive eq true',
      '$select': 'C_Tax_ID,Name,IsDefault',
      '$orderby': 'IsDefault desc, Name asc',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache['C_Tax'] = id
  return id
}

export interface TaxOption {
  id: number
  name: string
  rate: number
  isDefault: boolean
}

/**
 * Lookup all active taxes for the current client.
 */
export async function lookupTaxes(): Promise<TaxOption[]> {
  if (cache['C_Tax_List']) return cache['C_Tax_List'] as TaxOption[]

  const resp = await apiClient.get('/api/v1/models/C_Tax', {
    params: {
      // Exclude summary taxes (parent groups like GST/PST) — only show leaf taxes
      '$filter': 'IsActive eq true and IsSummary eq false',
      '$select': 'C_Tax_ID,Name,Rate,IsDefault,SOPOType',
      '$orderby': 'IsDefault desc, Name asc',
      '$top': '50',
    },
  })
  const records = resp.data.records || []
  const list = records.map((r: any) => ({
    id: r.id,
    name: r.Name || '',
    rate: r.Rate ?? 0,
    isDefault: r.IsDefault === true,
  }))
  cache['C_Tax_List'] = list
  return list
}

/**
 * Create a new C_Tax record.
 * Invalidates the tax list cache so next lookupTaxes() fetches fresh data.
 */
export async function createTax(data: {
  name: string
  rate: number
  isTaxIncluded?: boolean
}): Promise<TaxOption> {
  // Lookup required C_TaxCategory_ID dynamically
  const catResp = await apiClient.get('/api/v1/models/C_TaxCategory', {
    params: {
      '$filter': 'IsActive eq true',
      '$select': 'C_TaxCategory_ID,Name',
      '$orderby': 'IsDefault desc, Name asc',
      '$top': '1',
    },
  })
  const cats = catResp.data.records || []
  if (cats.length === 0) throw new Error('找不到稅務類別')
  const taxCategoryId = cats[0].id

  const payload: Record<string, any> = {
    Name: data.name,
    Rate: data.rate,
    C_TaxCategory_ID: taxCategoryId,
    SOPOType: 'B',           // Both
    IsDocumentLevel: true,
    IsSummary: false,
    IsDefault: false,
    IsTaxExempt: data.rate === 0,
    IsSalesTax: false,
    RequiresTaxCertificate: false,
    ValidFrom: '1970-01-01T00:00:00Z',
  }
  const resp = await apiClient.post('/api/v1/models/C_Tax', payload)
  // Invalidate cache
  delete cache['C_Tax_List']

  const created = resp.data
  return {
    id: created.id,
    name: created.Name || data.name,
    rate: created.Rate ?? data.rate,
    isDefault: false,
  }
}

/**
 * Lookup current user's AD_User_ID by username.
 */
export async function lookupCurrentUserId(username: string): Promise<number> {
  if (cache['AD_User'] !== undefined) return cache['AD_User']

  const safe = username.replace(/'/g, "''")
  const resp = await apiClient.get('/api/v1/models/AD_User', {
    params: {
      '$filter': `Name eq '${safe}' and IsActive eq true`,
      '$select': 'AD_User_ID,Name',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache['AD_User'] = id
  return id
}

// ========== Sales Order / Aesthetics Lookups ==========

/**
 * Lookup sales price list (IsSOPriceList=true).
 * Also caches the currency from this price list.
 */
export async function lookupSalesPriceListId(): Promise<number> {
  if (cache['M_PriceList_SO'] !== undefined) return cache['M_PriceList_SO']

  const resp = await apiClient.get('/api/v1/models/M_PriceList', {
    params: {
      '$filter': 'IsSOPriceList eq true and IsActive eq true',
      '$select': 'M_PriceList_ID,Name,C_Currency_ID,IsDefault',
      '$orderby': 'IsDefault desc',
      '$top': 1,
    },
  })

  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache['M_PriceList_SO'] = id
  if (records[0]?.C_Currency_ID) {
    cache['C_Currency_SO'] = records[0].C_Currency_ID?.id || records[0].C_Currency_ID
  }
  return id
}

export async function lookupSOCurrencyId(): Promise<number> {
  if (cache['C_Currency_SO'] !== undefined) return cache['C_Currency_SO']
  await lookupSalesPriceListId()
  return cache['C_Currency_SO'] || 0
}

export interface BPartnerOrderInfo {
  shipLocationId: number | null
  billLocationId: number | null
  userId: number | null       // AD_User_ID (ship-to contact)
  billUserId: number | null   // Bill_User_ID
  priceListId: number | null
  poPriceListId: number | null
  paymentTermId: number | null
  poPaymentTermId: number | null
  paymentRule: string | null
  paymentRulePO: string | null
  salesRepId: number | null
  invoiceRule: string | null
  deliveryRule: string | null
  freightCostRule: string | null
  deliveryViaRule: string | null
  poReference: string | null
  soDescription: string | null
}

const extractId = (v: any): any => v?.id ?? v ?? null

export async function lookupBPartnerOrderInfo(bpartnerId: number): Promise<BPartnerOrderInfo> {
  const bpSelect = [
    'M_PriceList_ID', 'PO_PriceList_ID',
    'C_PaymentTerm_ID', 'PO_PaymentTerm_ID',
    'PaymentRule', 'PaymentRulePO',
    'SalesRep_ID', 'InvoiceRule', 'DeliveryRule',
    'FreightCostRule', 'DeliveryViaRule',
    'POReference', 'SO_Description',
  ].join(',')

  const [bpResp, shipLocResp, billLocResp, userResp] = await Promise.all([
    apiClient.get(`/api/v1/models/C_BPartner/${bpartnerId}`, {
      params: { '$select': bpSelect },
    }),
    apiClient.get('/api/v1/models/C_BPartner_Location', {
      params: {
        '$filter': `C_BPartner_ID eq ${bpartnerId} and IsActive eq true and IsShipTo eq true`,
        '$select': 'C_BPartner_Location_ID',
        '$orderby': 'C_BPartner_Location_ID desc', '$top': '1',
      },
    }),
    apiClient.get('/api/v1/models/C_BPartner_Location', {
      params: {
        '$filter': `C_BPartner_ID eq ${bpartnerId} and IsActive eq true and IsBillTo eq true`,
        '$select': 'C_BPartner_Location_ID',
        '$orderby': 'C_BPartner_Location_ID desc', '$top': '1',
      },
    }),
    apiClient.get('/api/v1/models/AD_User', {
      params: {
        '$filter': `C_BPartner_ID eq ${bpartnerId} and IsActive eq true`,
        '$select': 'AD_User_ID',
        '$orderby': 'AD_User_ID desc', '$top': '1',
      },
    }),
  ])
  const bp = bpResp.data
  const shipLocs = shipLocResp.data.records || []
  const billLocs = billLocResp.data.records || []
  const users = userResp.data.records || []
  return {
    shipLocationId: shipLocs[0]?.id || null,
    billLocationId: billLocs[0]?.id || null,
    userId: users[0]?.id || null,
    billUserId: users[0]?.id || null,
    priceListId: extractId(bp.M_PriceList_ID),
    poPriceListId: extractId(bp.PO_PriceList_ID),
    paymentTermId: extractId(bp.C_PaymentTerm_ID),
    poPaymentTermId: extractId(bp.PO_PaymentTerm_ID),
    paymentRule: extractId(bp.PaymentRule),
    paymentRulePO: extractId(bp.PaymentRulePO),
    salesRepId: extractId(bp.SalesRep_ID),
    invoiceRule: extractId(bp.InvoiceRule),
    deliveryRule: extractId(bp.DeliveryRule),
    freightCostRule: extractId(bp.FreightCostRule),
    deliveryViaRule: extractId(bp.DeliveryViaRule),
    poReference: bp.POReference || null,
    soDescription: bp.SO_Description || null,
  }
}

/**
 * Lookup default C_DocType_ID for order creation.
 * Mirrors iDempiere CalloutOrder logic: filter by DocBaseType + IsSOTrx,
 * exclude Return Material (RM), prefer DocSubTypeSO='SO' (Standard Order).
 */
export async function lookupDefaultSODocTypeId(isSOTrx: boolean, clientId: number): Promise<number | null> {
  const baseType = isSOTrx ? 'SOO' : 'POO'
  const resp = await apiClient.get('/api/v1/models/C_DocType', {
    params: {
      '$filter': `DocBaseType eq '${baseType}' and IsSOTrx eq ${isSOTrx} and IsActive eq true and AD_Client_ID eq ${clientId}`,
      '$select': 'C_DocType_ID,Name,DocSubTypeSO',
      '$orderby': 'IsDefault desc, C_DocType_ID asc',
      '$top': '50',
    },
  })
  const records = resp.data.records || []
  // Exclude Return Material (RM)
  const filtered = records.filter((r: any) => {
    const sub = r.DocSubTypeSO?.id ?? r.DocSubTypeSO ?? ''
    return sub !== 'RM'
  })
  if (filtered.length === 0) return null
  // Prefer Standard Order (SO) subtype
  const standard = filtered.find((r: any) => {
    const sub = r.DocSubTypeSO?.id ?? r.DocSubTypeSO ?? ''
    return sub === 'SO' || sub === ''
  })
  return (standard || filtered[0]).id
}

/** DocType info for callout logic */
export interface DocTypeInfo {
  docSubTypeSO: string | null
  isSOTrx: boolean
}

export async function lookupDocTypeInfo(docTypeId: number): Promise<DocTypeInfo> {
  const resp = await apiClient.get(`/api/v1/models/C_DocType/${docTypeId}`, {
    params: { '$select': 'DocSubTypeSO,IsSOTrx' },
  })
  const d = resp.data
  return {
    docSubTypeSO: extractId(d.DocSubTypeSO),
    isSOTrx: d.IsSOTrx === true || d.IsSOTrx === 'Y',
  }
}

/** PriceList info for callout logic */
export interface PriceListInfo {
  currencyId: number | null
  isTaxIncluded: boolean
}

export async function lookupPriceListInfo(priceListId: number): Promise<PriceListInfo> {
  const resp = await apiClient.get(`/api/v1/models/M_PriceList/${priceListId}`, {
    params: { '$select': 'C_Currency_ID,IsTaxIncluded' },
  })
  const d = resp.data
  return {
    currencyId: extractId(d.C_Currency_ID),
    isTaxIncluded: d.IsTaxIncluded === true || d.IsTaxIncluded === 'Y',
  }
}

/**
 * Update a price list's IsTaxIncluded setting.
 */
export async function updatePriceListTaxIncluded(priceListId: number, isTaxIncluded: boolean): Promise<void> {
  await apiClient.put(`/api/v1/models/M_PriceList/${priceListId}`, {
    IsTaxIncluded: isTaxIncluded,
  })
}

/** Lookup default warehouse for an org */
export async function lookupOrgWarehouse(orgId: number): Promise<number | null> {
  const resp = await apiClient.get('/api/v1/models/AD_OrgInfo', {
    params: {
      '$filter': `AD_Org_ID eq ${orgId}`,
      '$select': 'M_Warehouse_ID',
      '$top': '1',
    },
  })
  const records = resp.data.records || []
  return extractId(records[0]?.M_Warehouse_ID)
}

export async function lookupBPartnerLocationId(bpartnerId: number): Promise<number> {
  const resp = await apiClient.get('/api/v1/models/C_BPartner_Location', {
    params: {
      '$filter': `C_BPartner_ID eq ${bpartnerId} and IsActive eq true`,
      '$select': 'C_BPartner_Location_ID',
      '$top': '1',
    },
  })
  const records = resp.data.records || []
  if (records.length === 0) {
    throw new Error('此客戶沒有地址，請先編輯客戶資料新增地址')
  }
  return records[0].id
}

/**
 * Lookup all active warehouses for the current org.
 * Returns list for dropdown selection.
 */
export async function lookupWarehouses(orgId?: number): Promise<{ id: number; name: string }[]> {
  const filter = orgId && orgId > 0
    ? `IsActive eq true and AD_Org_ID eq ${orgId}`
    : 'IsActive eq true'
  const resp = await apiClient.get('/api/v1/models/M_Warehouse', {
    params: {
      '$filter': filter,
      '$select': 'M_Warehouse_ID,Name',
      '$orderby': 'Name',
      '$top': '50',
    },
  })
  return (resp.data.records || []).map((r: any) => ({ id: r.id, name: r.Name }))
}

/**
 * Lookup locators for a warehouse.
 */
export async function lookupLocators(warehouseId: number): Promise<{ id: number; name: string }[]> {
  const resp = await apiClient.get('/api/v1/models/M_Locator', {
    params: {
      '$filter': `M_Warehouse_ID eq ${warehouseId} and IsActive eq true`,
      '$select': 'M_Locator_ID,Value',
      '$orderby': 'Value',
      '$top': '50',
    },
  })
  return (resp.data.records || []).map((r: any) => ({ id: r.id, name: r.Value || `Locator #${r.id}` }))
}

/**
 * Create a new M_Locator in a warehouse.
 * Mandatory: M_Warehouse_ID, Value, X, Y, Z.
 */
export async function createLocator(warehouseId: number, value: string): Promise<{ id: number; name: string }> {
  const resp = await apiClient.post('/api/v1/models/M_Locator', {
    M_Warehouse_ID: warehouseId,
    Value: value,
    X: '0',
    Y: '0',
    Z: '0',
    IsDefault: false,
    PriorityNo: 50,
  })
  return { id: resp.data.id, name: resp.data.Value || value }
}

// ========== Price List Product Lookups ==========

export interface PriceListProduct {
  productId: number
  productName: string
  uomId: number
  priceStd: number
  priceList: number
  priceLimit: number
}

/**
 * Get the latest M_PriceList_Version_ID for a price list.
 */
export async function lookupPriceListVersionId(priceListId: number): Promise<number | null> {
  const cacheKey = `M_PriceList_Version_${priceListId}`
  if (cache[cacheKey] !== undefined) return cache[cacheKey]

  const resp = await apiClient.get('/api/v1/models/M_PriceList_Version', {
    params: {
      '$filter': `M_PriceList_ID eq ${priceListId} and IsActive eq true`,
      '$select': 'M_PriceList_Version_ID,ValidFrom',
      '$orderby': 'ValidFrom desc',
      '$top': '1',
    },
  })
  const records = resp.data.records || []
  const id = records[0]?.id || null
  if (id) cache[cacheKey] = id
  return id
}

/**
 * Get all products on a price list version with their prices.
 * Returns products sorted by name for display in a selector.
 */
export async function lookupProductsOnPriceList(priceListId: number): Promise<PriceListProduct[]> {
  const versionId = await lookupPriceListVersionId(priceListId)
  if (!versionId) return []

  const resp = await apiClient.get('/api/v1/models/M_ProductPrice', {
    params: {
      '$filter': `M_PriceList_Version_ID eq ${versionId} and IsActive eq true`,
      '$select': 'M_Product_ID,PriceStd,PriceList,PriceLimit',
      '$expand': 'M_Product_ID',
      '$top': '500',
    },
  })
  const records = resp.data.records || []
  return records.map((r: any) => {
    const prod = r.M_Product_ID
    const prodId = prod?.id ?? prod
    const prodName = (typeof prod === 'object' ? (prod?.Name || prod?.identifier) : null) || `#${prodId}`
    const uomId = (typeof prod === 'object' ? prod?.C_UOM_ID?.id : null) ?? 0
    return {
      productId: prodId,
      productName: prodName,
      uomId,
      priceStd: r.PriceStd ?? 0,
      priceList: r.PriceList ?? 0,
      priceLimit: r.PriceLimit ?? 0,
    }
  }).sort((a: PriceListProduct, b: PriceListProduct) => a.productName.localeCompare(b.productName))
}

export async function lookupDefaultBankAccountId(): Promise<number> {
  if (cache['C_BankAccount'] !== undefined) return cache['C_BankAccount']
  const resp = await apiClient.get('/api/v1/models/C_BankAccount', {
    params: {
      '$filter': 'IsActive eq true',
      '$select': 'C_BankAccount_ID,Name,IsDefault',
      '$orderby': 'IsDefault desc, Name asc',
      '$top': '1',
    },
  })
  const records = resp.data.records || []
  const id = records[0]?.id || 0
  cache['C_BankAccount'] = id
  return id
}
