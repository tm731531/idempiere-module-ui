import { apiClient } from './client'

export interface AttachmentEntry {
  name: string
  contentType: string
}

export async function listAttachments(
  tableName: string,
  recordId: number,
): Promise<AttachmentEntry[]> {
  try {
    const resp = await apiClient.get(
      `/api/v1/models/${tableName}/${recordId}/attachments`,
    )
    return resp.data?.attachments || []
  } catch {
    return []
  }
}

export async function uploadAttachment(
  tableName: string,
  recordId: number,
  fileName: string,
  base64Data: string,
): Promise<void> {
  await apiClient.post(
    `/api/v1/models/${tableName}/${recordId}/attachments`,
    { name: fileName, data: base64Data },
  )
}

export async function deleteAttachment(
  tableName: string,
  recordId: number,
  fileName: string,
): Promise<void> {
  await apiClient.delete(
    `/api/v1/models/${tableName}/${recordId}/attachments/${encodeURIComponent(fileName)}`,
  )
}

export function getAttachmentUrl(
  tableName: string,
  recordId: number,
  fileName: string,
): string {
  return `/api/v1/models/${tableName}/${recordId}/attachments/${encodeURIComponent(fileName)}`
}
