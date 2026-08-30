import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = [
  'src/components/sl-login-consent/sl-login-consent.vue',
  'src/components/sl-property-batch/sl-property-batch.vue',
  'src/components/source-contact-promotion/source-contact-promotion.vue',
  'src/components/source-contact-room-state/source-contact-room-state.vue',
  'src/pages/landlord/account/index.vue',
]

describe('component wxss selector compatibility', () => {
  it.each(COMPONENTS)('%s uses class-based component selectors', (file) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')
    const style = source.slice(source.indexOf('<style'))

    expect(style).not.toMatch(/\[[^\]]+\]/)
    expect(style).not.toMatch(/(?:^|[,\s>+~])(?:input|text|view|image|picker)(?=[\s.#[\]:,>+~{]|$)/m)
  })
})
