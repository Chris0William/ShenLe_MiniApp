import fs from 'node:fs'
import path from 'node:path'
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

  it('rejects non-success upload HTTP responses before parsing JSON', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/api/file.ts'), 'utf8')

    expect(source).toContain('res.statusCode < 200 || res.statusCode >= 300')
    expect(source).toMatch(/上传失败（HTTP \$\{res\.statusCode\}）/)
  })

  it('uses the dedicated business route for media names', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/api/file.ts'), 'utf8')

    expect(source).toMatch(/post<string>\('\/api\/slMedia\/rename'/)
    expect(source).not.toContain('/api/sysFile/updateFile')
  })
})
