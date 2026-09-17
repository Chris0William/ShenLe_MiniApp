export const LANDLORD_ENROLLMENT_SCENE = 'landlord_enroll'
export const APPLY_ACCESS_SCENE = 'apply_access'
export const APPLY_ACCESS_PATH = '/pages/common/apply/index'

/** 业务员申请身份闸门：未登录/游客/管理员/超管放行；已通过业务员、房东、维护人拦截。 */
export type AccessEntryDecision = 'login' | 'apply' | 'blocked'

export interface AccessEntryIdentity {
  accountType?: number
  isLandlord?: boolean
  isMaintainer?: boolean
}

export function accessEntryDestination(identity?: AccessEntryIdentity | null): AccessEntryDecision {
  if (!identity)
    return 'login'
  const type = identity.accountType || 0
  // 管理员/超管放行（查看申请页），777 已是业务员无需再申请
  if (type >= 888)
    return 'apply'
  if (identity.isLandlord || identity.isMaintainer)
    return 'blocked'
  if (type >= 777)
    return 'blocked'
  return 'apply'
}

export const ACCESS_ENTRY_BLOCKED_FALLBACK = '当前身份无法申请成为业务员'

export function accessEntryBlockedText(identity?: AccessEntryIdentity | null): string {
  if (identity?.isLandlord || identity?.isMaintainer)
    return '当前账号为房东或维护人，无法申请成为业务员，请联系超级管理员调整'
  return '当前账号已是业务员，无需重复申请'
}
