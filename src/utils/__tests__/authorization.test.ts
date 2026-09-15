import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getPortalAccess, hasPermission, isAdministratorIdentity, resolvePortalMode } from '@/utils/authorization'

describe('rBAC portal and action compatibility', () => {
  it('defaults to deny for a managed user with no permission keys', () => {
    expect(hasPermission({ isRbacManaged: true, accountType: 888 }, 'supply.read', true)).toBe(false)
  })

  it('retains the legacy fallback only for unmigrated users', () => {
    expect(hasPermission({ isRbacManaged: false }, 'supply.read', true)).toBe(true)
    expect(hasPermission({ isRbacManaged: true, permissionKeys: ['supply.read'] }, 'supply.write', true)).toBe(false)
  })

  it('allows a custom nonnumeric role to use its granted portal', () => {
    const user = { accountType: 666, isRbacManaged: true, permissionKeys: ['portal.admin', 'supply.read'] }
    expect(getPortalAccess(user).admin).toBe(true)
    expect(resolvePortalMode('user', user, true)).toBe('admin')
    expect(isAdministratorIdentity(user)).toBe(false)
  })

  it('does not turn a portal-only grant into administrator identity or a landlord exemption', () => {
    const user = { accountType: 777, isLandlord: true, isRbacManaged: true, roleCodes: ['maintainer'], permissionKeys: ['portal.admin', 'portal.landlord'] }
    expect(isAdministratorIdentity(user)).toBe(false)
    expect(getPortalAccess(user).landlordOnly).toBe(true)
    expect(getPortalAccess(user).admin).toBe(false)
    expect(isAdministratorIdentity({ ...user, roleCodes: ['admin'] })).toBe(true)
  })

  it.each([888, 999])('preserves all portals for a legacy administrator %i with a landlord profile', (accountType) => {
    const user = { accountType, isLandlord: true, canEnterLandlordPortal: true }
    expect(getPortalAccess(user)).toEqual({ landlordOnly: false, business: true, admin: true, landlord: true })
  })

  it('does not treat a legacy landlord-maintainer as an administrator', () => {
    const user = { accountType: 777, isLandlord: true, isMaintainer: true, canEnterRestrictedAdmin: true, canEnterLandlordPortal: true }
    expect(getPortalAccess(user).admin).toBe(false)
    expect(resolvePortalMode('admin', user, true)).toBe('landlord')
  })

  it('keeps the landlord identity requirement even when a portal grant exists', () => {
    expect(getPortalAccess({ isRbacManaged: true, permissionKeys: ['portal.landlord'] }).landlord).toBe(false)
  })

  it('does not restore an explicitly denied admin portal from account rank', () => {
    const user = { accountType: 888, isRbacManaged: true, permissionKeys: ['portal.business'] }
    expect(getPortalAccess(user).admin).toBe(false)
    expect(resolvePortalMode('admin', user, true)).toBe('user')
  })

  it('does not restore an explicitly denied landlord portal from admin identity', () => {
    const user = { accountType: 888, isLandlord: true, isRbacManaged: true, permissionKeys: ['portal.admin', 'portal.business'] }
    expect(getPortalAccess(user).landlord).toBe(false)
  })

  it('uses the public preview shell when all portals are denied', () => {
    expect(resolvePortalMode('admin', { isRbacManaged: true, permissionKeys: [] }, true)).toBe('user')
    expect(resolvePortalMode('landlord', { isRbacManaged: true, isLandlord: true, permissionKeys: [] }, true)).toBe('user')
  })

  it('keeps legacy account levels separate from managed business roles', () => {
    const userManage = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/user-manage/index.vue'), 'utf8')
    const authorization = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/authorization/index.vue'), 'utf8')
    expect(userManage).toContain('item.isRbacManaged')
    expect(userManage).toContain('item.rbacRoleNames')
    expect(userManage).toContain('权限设置')
    expect(authorization).toContain('setOverrideExpire')
    expect(authorization).toContain('clearOverrideExpire')
  })
})
