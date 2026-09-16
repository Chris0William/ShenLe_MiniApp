import type { ShenLeId, SlLandlordAnnouncementDisplayedOutput, SlLandlordAnnouncementListOutput } from '@/types/shenle'
import { get, post } from './request'

export interface SaveSlLandlordAnnouncementInput {
  id?: ShenLeId | null
  title?: string | null
  content?: string | null
  blocksJson?: string | null
  displayAfterSave?: boolean
}

export function saveLandlordAnnouncement(input: SaveSlLandlordAnnouncementInput) {
  return post<ShenLeId>('/api/slLandlordAnnouncement/save', input as unknown as Record<string, unknown>)
}

export function getLandlordAnnouncementList() {
  return post<SlLandlordAnnouncementListOutput[]>('/api/slLandlordAnnouncement/list', {})
}

export function setLandlordAnnouncementDisplayed(id: ShenLeId) {
  return post<void>('/api/slLandlordAnnouncement/setDisplayed', { id })
}

export function deleteLandlordAnnouncement(id: ShenLeId) {
  return post<void>('/api/slLandlordAnnouncement/delete', { id })
}

export function getDisplayedLandlordAnnouncement() {
  // 弹窗预取：静默失败，不弹全局错误提示（silent 透传 request 层）
  return get<SlLandlordAnnouncementDisplayedOutput | null>('/api/slLandlordAnnouncement/displayed', undefined, { silent: true })
}
