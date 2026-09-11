import type { AdminResult, ApplyAccessInput, MyAccessOutput, PagedList, PageSlUserInput, SaveSlUserAccessDraftInput, SetSlUserNickNameInput, SetSlUserRoleInput, ShenLeId, SlAccessMaterialOutput, SlPendingUserOutput, SlUserApplicationActionInput, SlUserApplicationDetailOutput, SlUserOutput } from '@/types/shenle'
import { getApiBaseUrl, SHENLE_TOKEN_KEY } from '@/utils/shenle'
import { get, post } from './request'

export function getUserPage(input: PageSlUserInput) {
  return get<PagedList<SlUserOutput>>('/api/slUserManage/page', input as unknown as Record<string, unknown>)
}

export function setUserRole(input: SetSlUserRoleInput) {
  return post<void>('/api/slUserManage/setRole', input as unknown as Record<string, unknown>)
}

export function getMyAccess(silent = false) {
  return get<MyAccessOutput>('/api/slAccess/myStatus', undefined, { silent })
}

export function applyAccess(input: ApplyAccessInput | number = 0) {
  const payload = typeof input === 'number' ? { applyType: input } : input
  return post<void>('/api/slAccess/submitApplication', payload as unknown as Record<string, unknown>)
}

export function saveAccessApplicationDraft(input: SaveSlUserAccessDraftInput) {
  return post<ShenLeId>('/api/slAccess/saveApplicationDraft', input as unknown as Record<string, unknown>)
}

export function deleteAccessApplicationMaterial(applicationId: ShenLeId, fileId: ShenLeId) {
  return post<void>('/api/slAccess/deleteApplicationMaterial', { applicationId, fileId })
}

export function uploadAccessApplicationMaterial(applicationId: ShenLeId, filePath: string): Promise<SlAccessMaterialOutput> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(SHENLE_TOKEN_KEY) as string
    uni.uploadFile({
      url: `${getApiBaseUrl()}/api/slAccess/uploadApplicationMaterial`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      formData: { ApplicationId: String(applicationId) },
      success(res) {
        try {
          const body = JSON.parse(res.data) as AdminResult<SlAccessMaterialOutput>
          if (body.code === 200) {
            resolve(body.result)
            return
          }
          reject(new Error(body.message || '证明材料上传失败'))
        }
        catch (error) {
          reject(error)
        }
      },
      fail: reject,
    })
  })
}

export function downloadAccessApplicationMaterial(fileId: ShenLeId): Promise<string> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(SHENLE_TOKEN_KEY) as string
    uni.downloadFile({
      url: `${getApiBaseUrl()}/api/slAccess/applicationMaterialPreview/${fileId}`,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        if (res.statusCode === 200 && res.tempFilePath)
          resolve(res.tempFilePath)
        else
          reject(new Error(`证明材料预览失败（HTTP ${res.statusCode}）`))
      },
      fail: reject,
    })
  })
}

export function getPendingUsers() {
  return get<SlPendingUserOutput[]>('/api/slUserManage/pending')
}

export function getUserApplicationDetail(applicationId: ShenLeId) {
  return get<SlUserApplicationDetailOutput>('/api/slUserManage/applicationDetail', { applicationId })
}

export function approveUser(input: SlUserApplicationActionInput | ShenLeId) {
  const payload = typeof input === 'object' ? input : { userId: input }
  return post<void>('/api/slUserManage/approve', payload as unknown as Record<string, unknown>)
}

export function rejectUser(input: SlUserApplicationActionInput | ShenLeId) {
  const payload = typeof input === 'object' ? input : { userId: input }
  return post<void>('/api/slUserManage/reject', payload as unknown as Record<string, unknown>)
}

export function setUserNickName(input: SetSlUserNickNameInput) {
  return post<void>('/api/slUserManage/setNickName', input as unknown as Record<string, unknown>)
}

export function deleteUser(userId: ShenLeId) {
  return post<void>('/api/slUserManage/deleteUser', { userId })
}
