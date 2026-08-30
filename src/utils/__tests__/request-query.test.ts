import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCommunityPage } from '@/api/community'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('get query serialization', () => {
  it('serializes array filters as repeated query keys for uni.request', async () => {
    const request = vi.fn((options: { url: string, data?: unknown, success: (response: unknown) => void }) => {
      options.success({ statusCode: 200, data: { code: 200, result: { items: [], total: 0 } } })
    })
    vi.stubGlobal('uni', { getStorageSync: vi.fn(() => ''), request })

    await getCommunityPage({
      page: 1,
      pageSize: 10,
      types: [1, 3],
      realtimeModes: ['realtime', 'hot'],
      specialModes: ['shortRent'],
    })

    const options = request.mock.calls[0][0]
    expect(options.url).toContain('types=1&types=3')
    expect(options.url).toContain('realtimeModes=realtime&realtimeModes=hot')
    expect(options.url).toContain('specialModes=shortRent')
    expect(options.data).toBeUndefined()
  })
})
