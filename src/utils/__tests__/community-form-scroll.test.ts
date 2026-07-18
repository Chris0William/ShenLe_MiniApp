import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('community form sheet scrolling', () => {
  it('keeps the header and actions fixed while the form body scrolls', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/common/community-manage/index.vue'),
      'utf8',
    )
    const formSheetRule = source.match(/\.form-sheet\s*\{[\s\S]*?\}/)?.[0] || ''
    const formBodyRule = source.match(/\.form-body\s*\{[\s\S]*?\}/)?.[0] || ''

    expect(source).toContain('<scroll-view scroll-y class="form-body"')
    expect(formSheetRule).toContain('height: 86vh;')
    expect(formSheetRule).toContain('flex-direction: column;')
    expect(formBodyRule).toContain('height: 0;')
    expect(formBodyRule).toContain('flex: 1;')
  })
})
