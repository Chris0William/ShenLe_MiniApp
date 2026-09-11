export const LANDLORD_ENROLLMENT_PATH = '/pages/common/landlord-enroll/index'
export const LANDLORD_ENROLLMENT_SCENE = 'landlord_enroll'
export const LANDLORD_ENROLLMENT_BLOCKED = '当前账号为管理员或维护人，无法申请成为房东，请联系超级管理员调整'

export function enrollmentDestination(user: { accountType?: number, isMaintainer?: boolean, isLandlord?: boolean }) {
  if ((user.accountType || 0) >= 888 || user.isMaintainer)
    return 'blocked'
  return user.isLandlord ? 'landlord' : 'apply'
}
