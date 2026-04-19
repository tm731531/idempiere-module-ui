import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'
import { listResourceTypes, deactivateResource, listResources } from '@/api/resource'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}))

describe('resource API', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('listResources', () => {
    it('maps S_ResourceType_ID object to resourceTypeId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          records: [
            { id: 1, Name: '醫師A', IsActive: true, S_ResourceType_ID: { id: 10 } },
          ],
        },
      })
      const result = await listResources()
      expect(result[0]!.resourceTypeId).toBe(10)
    })

    it('handles numeric S_ResourceType_ID', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          records: [{ id: 2, Name: '醫師B', IsActive: true, S_ResourceType_ID: 20 }],
        },
      })
      const result = await listResources()
      expect(result[0]!.resourceTypeId).toBe(20)
    })

    it('sets resourceTypeId null when S_ResourceType_ID absent', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { records: [{ id: 3, Name: '醫師C', IsActive: true }] },
      })
      const result = await listResources()
      expect(result[0]!.resourceTypeId).toBeNull()
    })
  })

  describe('listResourceTypes', () => {
    it('returns mapped resource types', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          records: [{ id: 10, S_ResourceType_ID: 10, Name: '治療師' }],
        },
      })
      const result = await listResourceTypes()
      expect(result).toHaveLength(1)
      expect(result[0]!.Name).toBe('治療師')
      expect(result[0]!.id).toBe(10)
    })

    it('returns empty array when no types', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [] } })
      const result = await listResourceTypes()
      expect(result).toEqual([])
    })
  })

  describe('deactivateResource', () => {
    it('calls PUT with IsActive false', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({ data: {} })
      await deactivateResource(42)
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/models/S_Resource/42',
        { IsActive: false }
      )
    })
  })
})
