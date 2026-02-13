import { apiClient } from '@/api/client'

const PROCESS_MAP: Record<string, { slug: string; tableId: number }> = {
  C_Order: { slug: 'c_order-process', tableId: 259 },
  M_InOut: { slug: 'm_inout-process', tableId: 319 },
  C_Payment: { slug: 'c_payment-process', tableId: 335 },
  M_Production: { slug: 'm_production-process', tableId: 325 },
  M_Movement: { slug: 'm_movement-process', tableId: 323 },
}

export function canComplete(docStatus: string): boolean {
  return ['DR', 'IP', 'WP'].includes(docStatus)
}

export function isLocked(docStatus: string): boolean {
  return docStatus !== 'DR'
}

export async function completeDocument(
  tableName: string,
  recordId: number,
): Promise<{ success: boolean; error?: string }> {
  const proc = PROCESS_MAP[tableName]
  if (!proc) return { success: false, error: `No process mapping for ${tableName}` }

  try {
    const resp = await apiClient.post(`/api/v1/processes/${proc.slug}`, {
      'record-id': recordId,
      'table-id': proc.tableId,
    })
    if (resp.data?.isError) {
      return { success: false, error: resp.data.summary || '處理失敗' }
    }
    return { success: true }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    return { success: false, error: err.response?.data?.detail || err.message || '處理失敗' }
  }
}
