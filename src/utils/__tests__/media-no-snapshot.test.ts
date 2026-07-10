import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { mediaKindOf } from '../media'

const forbiddenQuery = ['ci', '-process', '=', 'snap', 'shot'].join('')
const deadHelperName = ['video', 'Snapshot', 'Url'].join('')
const sourceExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.scss', '.ts', '.tsx', '.vue'])

function productionSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory())
      return entry.name === '__tests__' ? [] : productionSourceFiles(entryPath)
    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : []
  })
}

describe('video poster fallback', () => {
  it.each([
    ['video/mp4', null, 'video'],
    [null, 'https://example.com/demo.mov?token=1', 'video'],
    ['image/jpeg', 'https://example.com/demo.jpg', 'image'],
  ] as const)('classifies %s / %s as %s', (fileType, url, expected) => {
    expect(mediaKindOf(fileType, url)).toBe(expected)
  })

  it('keeps every production source free of the forbidden query', () => {
    for (const sourcePath of productionSourceFiles(path.resolve(process.cwd(), 'src'))) {
      const source = fs.readFileSync(sourcePath, 'utf8')
      expect(source, path.relative(process.cwd(), sourcePath)).not.toContain(forbiddenQuery)
    }
  })

  it('does not retain the retired snapshot URL helper', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/media.ts'), 'utf8')
    expect(source).not.toContain(deadHelperName)
  })

  it('keeps the no-snapshot community cover overlay transparent', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/common/community-manage/index.vue'), 'utf8')
    const overlayRule = source.match(/\.card-cover__overlay\s*\{[\s\S]*?\}/)?.[0] || ''

    expect(overlayRule).toContain('background: transparent;')
  })
})
