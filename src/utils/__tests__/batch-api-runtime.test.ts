import { afterEach, describe, expect, it, vi } from 'vitest'
import { batchAddProperties, batchUpdateProperties } from '@/api/property'
import type { AddSlPropertyInput, BatchSlPropertyResult, UpdateSlPropertyInput } from '@/types/shenle'

interface RequestOptions {
  url: string
  method: string
  data?: unknown
  success: (response: { statusCode: number, data: unknown }) => void
}

const emptyResult: BatchSlPropertyResult = {
  success: true,
  createdIds: [],
  updatedCount: 0,
  deletedCount: 0,
  affectedCount: 0,
  errors: [],
}

function stubUniRequest() {
  const request = vi.fn((options: RequestOptions) => {
    options.success({
      statusCode: 200,
      data: { code: 200, result: emptyResult },
    })
  })

  vi.stubGlobal('uni', {
    getStorageSync: vi.fn(() => ''),
    request,
  })
  return request
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('property batch request payloads', () => {
  it('passes batch-add rows to uni.request as the exact top-level array', async () => {
    const request = stubUniRequest()
    const rows: AddSlPropertyInput[] = [{
      title: '101',
      communityId: 'community-1',
      buildingId: 'building-1',
      rentPrice: 0,
    }]

    await batchAddProperties(rows)

    expect(request).toHaveBeenCalledOnce()
    expect(request.mock.calls[0][0].method).toBe('POST')
    expect(request.mock.calls[0][0].url).toContain('/api/slProperty/batchAdd')
    expect(request.mock.calls[0][0].data).toBe(rows)
    expect(Array.isArray(request.mock.calls[0][0].data)).toBe(true)
  })

  it('passes batch-update rows to uni.request as the exact top-level array', async () => {
    const request = stubUniRequest()
    const rows: UpdateSlPropertyInput[] = [{
      id: 'property-1',
      title: '101',
      communityId: 'community-1',
      buildingId: 'building-1',
      rentPrice: 0,
    }]

    await batchUpdateProperties(rows)

    expect(request).toHaveBeenCalledOnce()
    expect(request.mock.calls[0][0].method).toBe('POST')
    expect(request.mock.calls[0][0].url).toContain('/api/slProperty/batchUpdate')
    expect(request.mock.calls[0][0].data).toBe(rows)
    expect(Array.isArray(request.mock.calls[0][0].data)).toBe(true)
  })
})
