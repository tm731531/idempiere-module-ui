import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('config', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Reset module state between tests
    vi.resetModules()
  })

  it('should load config from /aesthetics/config.json', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ apiBaseUrl: '' }),
    }))

    const { loadConfig } = await import('@/config')
    const config = await loadConfig()

    expect(config.apiBaseUrl).toBe('')
    expect(fetch).toHaveBeenCalledWith('/aesthetics/config.json')
  })
})
