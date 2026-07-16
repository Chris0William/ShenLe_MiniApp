import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MEDIA_SELECTION_BATCH_LIMIT } from '../media'

const pagePaths = [
  'src/pages/common/community-manage/index.vue',
  'src/pages/common/building-manage/index.vue',
  'src/pages/common/property-form/index.vue',
]

describe('media selection batch limit', () => {
  it('limits each picker invocation without limiting accumulated media', () => {
    expect(MEDIA_SELECTION_BATCH_LIMIT).toBe(9)

    for (const pagePath of pagePaths) {
      const source = fs.readFileSync(path.resolve(process.cwd(), pagePath), 'utf8')
      expect(source, pagePath).toContain('count: MEDIA_SELECTION_BATCH_LIMIT')
      expect(source, pagePath).not.toMatch(/9\s*-\s*form\.(?:media|imageIds)\.length/)
      expect(source, pagePath).not.toMatch(/(?:Media limit is 9|最多上传 9)/)
    }
  })
})
