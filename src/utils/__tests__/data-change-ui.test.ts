import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcRoot = resolve(__dirname, '../..')
const page = readFileSync(resolve(srcRoot, 'pages/admin/data-change/index.vue'), 'utf8')
const mine = readFileSync(resolve(srcRoot, 'pages/admin/mine/index.vue'), 'utf8')

describe('data change management UI', () => {
  it('exposes super-admin-only entry and filters', () => {
    expect(mine).toContain('数据变更记录')
    expect(mine).toContain('if (auth.isSuperAdmin)')
    expect(page).toContain('全部对象')
    expect(page).toContain('全部动作')
  })

  it('shows field differences and requires a restore reason', () => {
    expect(page).toContain('恢复到此版本')
    expect(page).toContain('请填写恢复原因')
    expect(page).toContain('beforeSnapshot')
    expect(page).toContain('afterSnapshot')
  })
})
