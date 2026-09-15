import type { ShenLeId } from '@/types/shenle'
import { get, post } from './request'

export interface PermissionDefinition {
  key: string
  name: string
  group: string
  hasDataScope: boolean
}

export interface AuthorizationScope {
  permissionKey: string
  scopeType: number
  effect: number
  communityIds: ShenLeId[]
  excludedCommunityIds: ShenLeId[]
}

export interface PermissionOverride {
  permissionKey: string
  effect: number
  expireTime?: string | null
}

export interface AuthorizationRole {
  id?: ShenLeId
  version: number
  roleCode: string
  roleName: string
  description?: string
  enabled: boolean
  isSystem?: boolean
  permissionKeys: string[]
  scopes: AuthorizationScope[]
  reason: string
  userCount?: number
}

export interface EffectivePermission {
  key: string
  allowed: boolean
  source: string
  scopes: number[]
}

export interface AuthorizationUser {
  userId: ShenLeId
  nickName?: string
  isManaged: boolean
  version: number
  roleIds: ShenLeId[]
  roleNames?: string[]
  overrides: PermissionOverride[]
  scopes: AuthorizationScope[]
  effective: { isManaged: boolean, permissions: EffectivePermission[] }
  reason?: string
}

export const getPermissionCatalog = () => get<PermissionDefinition[]>('/api/slRbac/catalog')
export const getAuthorizationRoles = () => get<AuthorizationRole[]>('/api/slRbac/roles')
export const getAuthorizationRole = (id: ShenLeId) => get<AuthorizationRole>('/api/slRbac/roleDetail', { id })
export const getAuthorizationUser = (id: ShenLeId) => get<AuthorizationUser>('/api/slRbac/userDetail', { id })
export const saveAuthorizationRole = (input: AuthorizationRole) => post<ShenLeId>('/api/slRbac/saveRole', input as unknown as Record<string, unknown>)
export function saveAuthorizationUser(input: AuthorizationUser) {
  return post<void>('/api/slRbac/saveUser', {
    userId: input.userId,
    version: input.version,
    roleIds: input.roleIds,
    overrides: input.overrides,
    scopes: input.scopes,
    reason: input.reason,
  })
}
