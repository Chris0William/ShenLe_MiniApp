import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function source(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

describe('legacy mini program entry route', () => {
  it('redirects the old experience-code path to the current map home', () => {
    const entry = source('src/pages/index/index.vue')
    expect(entry).toContain(`uni.reLaunch({ url: '/pages/user/map/index' })`)
  })

  it('uses the current map home in generated base configuration', () => {
    const generator = source('scripts/create-base-files.js')
    expect(generator).toContain(`path: 'pages/user/map/index'`)
    expect(generator).not.toContain(`path: 'pages/index/index'`)
  })
})
