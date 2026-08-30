import type { AppMode } from '@/store/mode'

export type PropertyMediaSource = 'community' | 'upload'

export interface PropertyManagementAccess {
  isAdmin: boolean
  isLandlord: boolean
  isMaintainer?: boolean
  mode: AppMode
}

export const PROPERTY_MEDIA_SOURCE_ACTIONS: {
  name: string
  subname: string
  value: PropertyMediaSource
}[] = [
  { name: '从楼盘选择', subname: '复用当前楼盘已上传的图片或视频', value: 'community' },
  { name: '上传媒体', subname: '从相册或相机添加图片、视频', value: 'upload' },
]

export function canManagePropertyWrites(access: PropertyManagementAccess): boolean {
  return (access.isAdmin && access.mode === 'admin')
    || (!!access.isMaintainer && access.mode === 'admin')
    || (access.isLandlord && access.mode === 'landlord')
}

export function toOptionalNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim()))
    return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

export function resolvePropertyMediaSource(value: unknown): PropertyMediaSource | null {
  return value === 'community' || value === 'upload' ? value : null
}
