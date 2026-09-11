import type { ShenLeId } from '@/types/shenle'
import { get, post } from './request'

export interface LandlordEnrollment {
  id: ShenLeId
  nickName?: string
  phone?: string
  applyTime?: string
}

export const getEnrollmentStatus = () => get<number>('/api/slLandlordEnrollment/status')
export const submitEnrollment = () => post<void>('/api/slLandlordEnrollment/apply')
export const getEnrollmentCode = () => post<string>('/api/slLandlordEnrollment/code')
export const getPendingEnrollments = () => get<LandlordEnrollment[]>('/api/slLandlordEnrollment/pending')
export const reviewEnrollment = (id: ShenLeId, approve: boolean) => post<void>('/api/slLandlordEnrollment/review', { id, approve })
