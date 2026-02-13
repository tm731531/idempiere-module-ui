import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}))

describe('attachment API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('listAttachments returns entries', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { attachments: [{ name: 'photo.jpg', contentType: 'image/jpeg' }] },
    })
    const { listAttachments } = await import('@/api/attachment')
    const result = await listAttachments('C_BPartner', 100)
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('photo.jpg')
  })

  it('listAttachments returns empty on error', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'))
    const { listAttachments } = await import('@/api/attachment')
    const result = await listAttachments('C_BPartner', 100)
    expect(result).toEqual([])
  })

  it('uploadAttachment sends base64 data', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} })
    const { uploadAttachment } = await import('@/api/attachment')
    await uploadAttachment('C_BPartner', 100, 'test.jpg', 'base64data')
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/models/C_BPartner/100/attachments',
      { name: 'test.jpg', data: 'base64data' },
    )
  })

  it('deleteAttachment calls correct endpoint', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} })
    const { deleteAttachment } = await import('@/api/attachment')
    await deleteAttachment('C_BPartner', 100, 'test.jpg')
    expect(apiClient.delete).toHaveBeenCalledWith(
      '/api/v1/models/C_BPartner/100/attachments/test.jpg',
    )
  })

  it('getAttachmentUrl encodes filename', async () => {
    const { getAttachmentUrl } = await import('@/api/attachment')
    const url = getAttachmentUrl('C_BPartner', 100, 'photo 2.jpg')
    expect(url).toBe('/api/v1/models/C_BPartner/100/attachments/photo%202.jpg')
  })
})
