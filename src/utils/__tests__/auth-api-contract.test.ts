import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('authentication API contract', () => {
  it('uses the Furion route generated for GetUserInfo', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/api/auth.ts'), 'utf8')

    expect(source).toContain("'/api/sysAuth/userInfo'")
    expect(source).not.toContain("'/api/sysAuth/getUserInfo'")
  })

  it('does not emit unsupported attribute selectors into component wxss', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sl-login-consent/sl-login-consent.vue'), 'utf8')

    expect(source).not.toContain('.phone-auth-button[disabled]')
    expect(source).toContain('phone-auth-button--disabled')
  })
})
