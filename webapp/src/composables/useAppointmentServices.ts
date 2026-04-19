import { ref } from 'vue'
import { apiClient } from '@/api/client'

export interface AppointmentService {
  Value: string           // e.g. "CONSULT", "TREAT"
  Name: string            // display name in zh-TW
  durationMinutes: number // 0 = no preset duration
}

// Module-level cache — shared across all components in a session
let cached: AppointmentService[] | null = null
let loadingPromise: Promise<AppointmentService[]> | null = null

/**
 * Load service presets from AD_Reference 'AppointmentService'.
 * AD_Ref_List entries: Value = service key, Name = display name,
 * Description = duration in minutes (e.g. "30").
 * Returns empty list when AD_Reference is not configured.
 */
export async function loadAppointmentServices(): Promise<AppointmentService[]> {
  if (cached !== null) return cached
  if (loadingPromise !== null) return loadingPromise

  loadingPromise = (async () => {
    try {
      const refResp = await apiClient.get('/api/v1/models/AD_Reference', {
        params: {
          '$filter': "Name eq 'AppointmentService'",
          '$select': 'AD_Reference_ID',
          '$top': '1',
        },
      })
      const refRecords: any[] = refResp.data?.records ?? []
      if (refRecords.length === 0) {
        cached = []
        return cached
      }

      const refId: number = refRecords[0]!.id ?? refRecords[0]!.AD_Reference_ID
      if (!refId) {
        cached = []
        return cached
      }

      const listResp = await apiClient.get('/api/v1/models/AD_Ref_List', {
        params: {
          '$filter': `AD_Reference_ID eq ${refId}`,
          '$select': 'Value,Name,Description',
          '$orderby': 'Name',
          '$top': '100',
        },
      })
      const listRecords: any[] = listResp.data?.records ?? []
      cached = listRecords.map((r) => ({
        Value: String(r.Value ?? ''),
        Name: String(r.Name ?? r.Value ?? ''),
        durationMinutes: parseDuration(r.Description),
      }))
      return cached
    } catch {
      cached = []
      return cached
    } finally {
      loadingPromise = null
    }
  })()

  return loadingPromise
}

function parseDuration(val: unknown): number {
  const n = Number(val)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

export function getServiceDuration(value: string): number {
  if (!cached) return 0
  return cached.find((s) => s.Value === value)?.durationMinutes ?? 0
}

export function getServiceName(value: string): string {
  if (!cached) return value
  return cached.find((s) => s.Value === value)?.Name ?? value
}

export function clearAppointmentServiceCache(): void {
  cached = null
  loadingPromise = null
}

export function useAppointmentServices() {
  const services = ref<AppointmentService[]>(cached ?? [])

  async function load() {
    services.value = await loadAppointmentServices()
  }

  return { services, load, getServiceDuration, getServiceName }
}
