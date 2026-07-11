import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const legacyRoleTerm = '\u623f\u4e1c'

function source(file: string) {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

function collectFiles(entry: string): string[] {
  const absolute = path.resolve(process.cwd(), entry)
  const stat = fs.statSync(absolute)
  if (stat.isFile())
    return [absolute]

  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((item) => {
    const child = path.join(absolute, item.name)
    if (item.isDirectory())
      return item.name === '__tests__' ? [] : collectFiles(child)
    return /\.(?:html|js|json|ts|vue)$/.test(item.name) ? [child] : []
  })
}

describe('source contact terminology', () => {
  it('removes the legacy role term from the active miniapp and website', () => {
    const files = [
      ...collectFiles('src'),
      ...collectFiles('website'),
    ]
    const offenders = files
      .filter(file => source(file).includes(legacyRoleTerm))
      .map(file => path.relative(process.cwd(), file))

    expect(offenders).toEqual([])
  })

  it('removes property-level contact editing and calling from the miniapp', () => {
    const files = [
      'src/pages/common/property-form/index.vue',
      'src/pages/common/property-detail/index.vue',
      'src/components/sl-property-batch/sl-property-batch.vue',
      'src/utils/property-batch.ts',
    ]
    const forbiddenIdentifiers = ['landlordName', 'landlordPhone', 'callLandlord']

    for (const file of files) {
      const content = source(file)
      for (const identifier of forbiddenIdentifiers)
        expect(content, `${file} still contains ${identifier}`).not.toContain(identifier)
    }
  })

  it('removes the website consultation section and form', () => {
    const html = source('website/index.html')
    const script = source('website/assets/main.js')

    expect(html).not.toContain('id="contact"')
    expect(html).not.toContain('contact-form')
    expect(script).not.toContain('contactForm')
  })
})
