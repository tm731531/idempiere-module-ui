import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}))

describe('assignment API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('listAssignments queries with date range', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [{ id: 1 }] } })
    const { listAssignments } = await import('@/api/assignment')
    const from = new Date('2026-02-14T09:00:00')
    const to = new Date('2026-02-14T18:00:00')
    const results = await listAssignments(from, to)
    expect(results).toHaveLength(1)
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/models/S_ResourceAssignment', expect.anything())
  })

  it('createAssignment formats dates correctly', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } })
    const { createAssignment } = await import('@/api/assignment')
    await createAssignment({
      S_Resource_ID: 1,
      AssignDateFrom: '2026-02-14T09:00:00',
      AssignDateTo: '2026-02-14T10:00:00',
      Name: 'Test Appointment',
      AD_Org_ID: 11,
    })
    expect(apiClient.post).toHaveBeenCalled()
  })

  it('updateAssignment strips IsConfirmed', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { id: 1 } })
    const { updateAssignment } = await import('@/api/assignment')
    await updateAssignment(1, { Name: 'Updated', IsConfirmed: true })
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/models/S_ResourceAssignment/1',
      { Name: 'Updated' },
    )
  })

  it('checkConflict detects overlapping assignments', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [{ id: 99 }] } })
    const { checkConflict } = await import('@/api/assignment')
    const from = new Date('2026-02-14T09:00:00')
    const to = new Date('2026-02-14T10:00:00')
    const hasConflict = await checkConflict(1, from, to)
    expect(hasConflict).toBe(true)
  })

  it('checkConflict returns false when no overlap', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [] } })
    const { checkConflict } = await import('@/api/assignment')
    const from = new Date('2026-02-14T09:00:00')
    const to = new Date('2026-02-14T10:00:00')
    const hasConflict = await checkConflict(1, from, to)
    expect(hasConflict).toBe(false)
  })
})
