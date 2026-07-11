import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('property return refresh contract', () => {
  const form = source('src/pages/common/property-form/index.vue')
  const properties = source('src/pages/common/community-properties/index.vue')

  it('publishes created and updated property changes before returning', () => {
    expect(form).toContain('useEntityChangeStore')
    expect(form).toContain("action: 'updated'")
    expect(form).toContain("action: 'created'")
    expect(form).toContain('changeStore.publishPropertyChange')
  })

  it('consumes property changes on show and patches a single edited row in place', () => {
    expect(properties).toContain('onShow')
    expect(properties).toContain('consumePropertyChange(CHANGE_CONSUMER)')
    expect(properties).toContain('patchBatchUpdatedItems(change.payload.ids)')
    expect(properties).toContain('reloadLoadedRangePreservingScroll')
  })

  it('patches status and deletion locally instead of resetting the list', () => {
    const statusHandler = properties.match(/async function changeStatus[\s\S]*?\n\}/)?.[0] || ''
    const deleteHandler = properties.match(/function removeItem[\s\S]*?\n\}/)?.[0] || ''

    expect(statusHandler).toContain('item.status = nextStatus')
    expect(statusHandler).not.toContain('load(true)')
    expect(deleteHandler).toContain('items.value = items.value.filter')
    expect(deleteHandler).not.toContain('load(true)')
  })
})

describe('revision-aware management pages', () => {
  const pages = [
    'src/pages/admin/dashboard/index.vue',
    'src/pages/admin/property-list/index.vue',
    'src/pages/admin/sales-control/index.vue',
    'src/pages/common/building-manage/index.vue',
    'src/pages/common/community-manage/index.vue',
  ]

  it.each(pages)('%s refreshes only after consuming a relevant revision', (pagePath) => {
    const page = source(pagePath)
    expect(page).toContain('onShow')
    expect(page).toContain('useEntityChangeStore')
    expect(page).toMatch(/consume(Property|Community|Building)Change/)
  })
})
