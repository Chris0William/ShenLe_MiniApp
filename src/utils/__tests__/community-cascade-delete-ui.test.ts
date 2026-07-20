import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('community cascade deletion UI contract', () => {
  it('warns with descendant counts before explicitly requesting cascade deletion', () => {
    const page = source('src/pages/common/community-manage/index.vue')

    expect(page).toContain('item.buildingCount')
    expect(page).toContain('item.propertyCount')
    expect(page).toContain('删除楼盘及全部数据')
    expect(page).toContain('confirmText: hasDescendants ? \'全部删除\' : \'删除\'')
    expect(page).toContain('deleteCommunity(item.id, true)')
  })

  it('keeps the API non-cascading unless the caller opts in', () => {
    const api = source('src/api/community.ts')

    expect(api).toContain('deleteCommunity(id: ShenLeId, cascade = false)')
    expect(api).toContain(`post<void>('/api/slCommunity/delete', { id, cascade })`)
  })
})

describe('community management navigation', () => {
  it('only exposes building management as the path to property management', () => {
    const page = source('src/pages/common/community-manage/index.vue')

    expect(page).toContain('@click="goBuildings(item)"')
    expect(page).not.toContain('goProperties')
    expect(page).not.toContain('/pages/common/community-properties/index')
  })
})
