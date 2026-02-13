import { apiClient } from './client'

export interface RequestData {
  R_RequestType_ID: number
  R_Status_ID?: number
  C_BPartner_ID?: number
  Summary: string
  AD_Org_ID: number
  [key: string]: any
}

export async function listRequests(filter?: string): Promise<any[]> {
  const params: Record<string, string> = {
    '$select': 'R_Request_ID,Summary,R_Status_ID,C_BPartner_ID,Created,Processed',
    '$expand': 'R_Status_ID,C_BPartner_ID',
    '$orderby': 'Created desc',
    '$top': '100',
  }
  if (filter) params['$filter'] = filter
  const resp = await apiClient.get('/api/v1/models/R_Request', { params })
  return resp.data.records || []
}

export async function getRequest(id: number): Promise<any> {
  const resp = await apiClient.get(`/api/v1/models/R_Request/${id}`, {
    params: { '$expand': 'R_Status_ID,C_BPartner_ID,R_RequestType_ID' },
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
  return updateRequest(id, { R_Status_ID: statusId })
}

export async function listRequestStatuses(requestTypeId?: number): Promise<any[]> {
  const params: Record<string, string> = {
    '$select': 'R_Status_ID,Name,SeqNo',
    '$orderby': 'SeqNo',
    '$filter': 'IsActive eq true',
  }
  if (requestTypeId) {
    params['$filter'] += ` and R_RequestType_ID eq ${requestTypeId}`
  }
  const resp = await apiClient.get('/api/v1/models/R_Status', { params })
  return resp.data.records || []
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
