import { apiClient } from './client'
import { lookupCustomerGroupId } from './lookup'

export interface CustomerCreateData {
  name: string
  taxId?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  countryId?: number  // default 316 = Taiwan
}

export interface CustomerCreateResult {
  bpartnerId: number
  locationId: number
  bpLocationId: number
  userId: number
}

export async function createCustomer(data: CustomerCreateData, orgId: number): Promise<CustomerCreateResult> {
  const countryId = data.countryId || 316  // Taiwan

  // 1. Create C_Location
  const locResp = await apiClient.post('/api/v1/models/C_Location', {
    AD_Org_ID: orgId,
    C_Country_ID: countryId,
    Address1: data.address || '',
    City: data.city || '',
  })
  const locationId = locResp.data.id

  let bpartnerId = 0
  let bpLocationId = 0
  let userId = 0

  try {
    // 2. Create C_BPartner
    const groupId = await lookupCustomerGroupId()
    const bpResp = await apiClient.post('/api/v1/models/C_BPartner', {
      AD_Org_ID: orgId,
      Name: data.name,
      TaxID: data.taxId || '',
      IsCustomer: true,
      C_BP_Group_ID: groupId,
    })
    bpartnerId = bpResp.data.id

    // 3. Create C_BPartner_Location (link address)
    const bpLocResp = await apiClient.post('/api/v1/models/C_BPartner_Location', {
      AD_Org_ID: orgId,
      C_BPartner_ID: bpartnerId,
      C_Location_ID: locationId,
      Name: data.address || data.name,
    })
    bpLocationId = bpLocResp.data.id

    // 4. Create AD_User (contact)
    const userResp = await apiClient.post('/api/v1/models/AD_User', {
      AD_Org_ID: orgId,
      C_BPartner_ID: bpartnerId,
      Name: data.name,
      Phone: data.phone || '',
      EMail: data.email || '',
    })
    userId = userResp.data.id

  } catch (error) {
    // Rollback: delete created records in reverse order
    if (bpLocationId) { try { await apiClient.delete(`/api/v1/models/C_BPartner_Location/${bpLocationId}`) } catch { /* best-effort */ } }
    if (bpartnerId) { try { await apiClient.delete(`/api/v1/models/C_BPartner/${bpartnerId}`) } catch { /* best-effort */ } }
    try { await apiClient.delete(`/api/v1/models/C_Location/${locationId}`) } catch { /* best-effort */ }
    throw error
  }

  return { bpartnerId, locationId, bpLocationId, userId }
}

export async function searchCustomers(query: string): Promise<any[]> {
  const safe = query.replace(/'/g, "''")
  const resp = await apiClient.get('/api/v1/models/C_BPartner', {
    params: {
      '$filter': `IsCustomer eq true and IsActive eq true and (contains(Name,'${safe}') or contains(TaxID,'${safe}'))`,
      '$select': 'C_BPartner_ID,Name,TaxID',
      '$orderby': 'Name',
      '$top': 50,
    },
  })
  return resp.data.records || []
}

export async function getCustomerDetail(id: number): Promise<any> {
  return (await apiClient.get(`/api/v1/models/C_BPartner/${id}`)).data
}
