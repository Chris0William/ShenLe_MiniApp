import type { LoginUserOutput } from '@/types/shenle'

type AccessUser = Partial<LoginUserOutput> | null | undefined
type PortalMode = 'user' | 'admin' | 'landlord'

const authorizationFields = [
  'accountType',
  'rbacEnabled',
  'isRbacManaged',
  'hasPhone',
  'isLandlord',
  'isMaintainer',
  'isSourceContact',
  'communityManageScope',
  'landlordCommunityCount',
  'maintainedCommunityCount',
  'canViewRealData',
  'canCreateCommunity',
  'canCreateSupply',
  'canWriteAssignedSupply',
  'canWriteAllSupply',
  'canBatchWriteSupply',
  'canViewSupplyContactPhone',
  'canViewSupplyActivity',
  'canUseMineFilters',
  'canFilterBySupplyOperator',
  'canAssignCommunityContact',
  'canManageSourceContacts',
  'canManageUsers',
  'canEnterLandlordPortal',
  'canEnterRestrictedAdmin',
  'canManageLandlords',
  'canSetCommunityHotLevel',
] as const

export function authorizationSignature(user: AccessUser): string {
  return JSON.stringify([
    String(user?.id ?? ''),
    String(user?.authorizationRevision ?? 0),
    authorizationFields.map(key => user?.[key] ?? null),
    [...new Set(user?.permissionKeys || [])].sort(),
    [...new Set(user?.roleCodes || [])].sort(),
  ])
}

// 新权限接管后只读有效键，空集合表示撤销，不能退回数字等级。
export function hasPermission(user: AccessUser, key: string, legacyAllowed = false): boolean {
  return user?.isRbacManaged === true ? !!user.permissionKeys?.includes(key) : legacyAllowed
}

export function isAdministratorIdentity(user: AccessUser) {
  return (user?.accountType || 0) >= 888
    || (user?.isRbacManaged === true && !!user.roleCodes?.includes('admin'))
}

export function getPortalAccess(user: AccessUser) {
  const administrator = isAdministratorIdentity(user)
  const landlordOnly = !!user?.isLandlord && !administrator
  return {
    landlordOnly,
    business: !landlordOnly && hasPermission(user, 'portal.business', true),
    admin: !landlordOnly && hasPermission(user, 'portal.admin', administrator || !!user?.canEnterRestrictedAdmin),
    landlord: !!user?.isLandlord && hasPermission(user, 'portal.landlord', !!user?.canEnterLandlordPortal),
  }
}

export function resolvePortalMode(requested: PortalMode, user: AccessUser, authenticated: boolean): PortalMode {
  if (!authenticated)
    return 'user'
  const portal = getPortalAccess(user)
  if (portal.landlordOnly)
    return portal.landlord ? 'landlord' : 'user'
  if ((requested === 'user' && portal.business) || (requested === 'admin' && portal.admin) || (requested === 'landlord' && portal.landlord))
    return requested
  if (portal.business)
    return 'user'
  if (portal.admin)
    return 'admin'
  if (portal.landlord)
    return 'landlord'
  return 'user'
}
