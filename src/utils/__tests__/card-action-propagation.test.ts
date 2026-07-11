import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function source(file: string) {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

describe('clickable card action propagation', () => {
  it('stops building edit and delete actions at a native view boundary', () => {
    const page = source('src/pages/common/building-manage/index.vue')
    expect(page).toContain('<view class="actions" @tap.stop>')
  })

  it('guards other custom buttons nested in clickable cards', () => {
    const propertyList = source('src/pages/admin/property-list/index.vue')
    const salesControl = source('src/pages/admin/sales-control/index.vue')

    expect(propertyList).toContain('<view class="preview-card__action" @tap.stop>')
    expect(salesControl).toContain('<view class="community-card__property-action" @tap.stop>')
  })
})
