import { describe, expect, it } from 'vitest'
import { buildUploadFormData, parseUploadResponse } from '@/api/file'

describe('file API identifiers', () => {
  it('preserves uploaded snowflake IDs as exact strings', () => {
    const body = parseUploadResponse('{"code":200,"result":{"id":2030123456789012345,"fileName":"room.jpg"}}')

    expect(body.result.id).toBe('2030123456789012345')
  })

  it('serializes negative draft IDs without numeric conversion', () => {
    expect(buildUploadFormData({ belongId: '-2030123456789012345' })).toEqual({
      belongId: '-2030123456789012345',
    })
  })
})
