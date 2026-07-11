import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('source contact self application visibility', () => {
  it('hides self application entries from the new miniapp', () => {
    const files = [
      'src/pages/admin/mine/index.vue',
      'src/pages/common/apply/index.vue',
    ]
    const forbidden = [
      'submitLandlordApply',
      '申请成为盘源对接人',
      '重新申请盘源对接人',
      '盘源对接人申请审核中',
    ]

    for (const file of files) {
      const content = source(file)
      for (const text of forbidden)
        expect(content, `${file} still exposes ${text}`).not.toContain(text)
    }
  })

  it('keeps the administrator pending application area', () => {
    expect(source('src/pages/admin/landlord-manage/index.vue')).toContain('pending-block')
  })
})
