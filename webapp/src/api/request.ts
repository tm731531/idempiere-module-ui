import { apiClient } from './client'

export interface RequestData {
  R_RequestType_ID: number
  R_Status_ID?: number
  C_BPartner_ID?: number
  Summary: string
  AD_Org_ID: number
  [key: string]: any
}

/**
 * R_Status row shape after migration. IsClosed determines terminal state.
 */
export interface RequestStatus {
  R_Status_ID: number
  Name: string
  SeqNo?: number
  IsClosed?: boolean
  IsActive?: boolean
}

export async function listRequests(filter?: string, top = 100): Promise<any[]> {
  const params: Record<string, string> = {
    '$select': 'R_Request_ID,DocumentNo,Summary,R_Status_ID,C_BPartner_ID,Created,Updated,CreatedBy,UpdatedBy,LastResult,SalesRep_ID,DateNextAction,Priority',
    '$expand': 'R_Status_ID,C_BPartner_ID,CreatedBy,UpdatedBy,SalesRep_ID',
    '$orderby': 'Created desc',
    '$top': String(top),
  }
  if (filter) params['$filter'] = filter
  const resp = await apiClient.get('/api/v1/models/R_Request', { params })
  return resp.data.records || []
}

export async function getRequest(id: number): Promise<any> {
  const resp = await apiClient.get(`/api/v1/models/R_Request/${id}`, {
    params: {
      '$select': 'R_Request_ID,Summary,R_Status_ID,C_BPartner_ID,R_RequestType_ID,Created,Updated,CreatedBy,UpdatedBy,LastResult,SalesRep_ID,DateNextAction',
      '$expand': 'R_Status_ID,C_BPartner_ID,R_RequestType_ID,CreatedBy,UpdatedBy,SalesRep_ID',
    },
  })
  return resp.data
}

export async function createRequest(data: RequestData): Promise<any> {
  const resp = await apiClient.post('/api/v1/models/R_Request', data)
  return resp.data
}

export async function updateRequest(id: number, data: Record<string, any>): Promise<any> {
  const resp = await apiClient.put(`/api/v1/models/R_Request/${id}`, data)
  return resp.data
}

export async function updateRequestStatus(id: number, statusId: number): Promise<any> {
  const resp = await apiClient.put(`/api/v1/models/R_Request/${id}`, { R_Status_ID: statusId })
  return resp.data
}

export async function listRequestStatuses(requestTypeId?: number): Promise<RequestStatus[]> {
  const params: Record<string, string> = {
    '$select': 'R_Status_ID,Name,SeqNo,IsActive,IsClosed',
    '$orderby': 'SeqNo',
    // Include all statuses, not just active ones (some may be inactive but still needed)
  }
  if (requestTypeId) {
    params['$filter'] = `R_RequestType_ID eq ${requestTypeId}`
  }
  const resp = await apiClient.get('/api/v1/models/R_Status', { params })
  return (resp.data.records || []).map((r: any) => ({
    R_Status_ID: r.id ?? r.R_Status_ID,
    Name: r.Name,
    SeqNo: r.SeqNo,
    IsActive: r.IsActive === true || r.IsActive === 'Y',
    IsClosed: r.IsClosed === true || r.IsClosed === 'Y',
  }))
}

export async function listRequestTypes(): Promise<any[]> {
  const resp = await apiClient.get('/api/v1/models/R_RequestType', {
    params: {
      '$select': 'R_RequestType_ID,Name',
      '$filter': 'IsActive eq true',
      '$orderby': 'Name',
    },
  })
  return resp.data.records || []
}
