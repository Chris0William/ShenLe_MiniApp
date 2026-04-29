import type { ShenLeId } from '@/types/shenle'
import { PROPERTY_STATUS_OPTIONS } from '@/constants/shenle'

export const SHENLE_TOKEN_KEY = 'shenle_token'
export const SHENLE_USER_KEY = 'shenle_user'
export const SHENLE_OPENID_KEY = 'shenle_openid'

export function getApiBaseUrl() {
  return (import.meta.env.VITE_SERVER_BASEURL || 'https://fmcs.deerservice.com/api/sl/').replace(/\/$/, '')
}

export function resolveAssetUrl(url?: string | null) {
  if (!url)
    return '/static/images/placeholder.png'
  if (/^https?:\/\//.test(url))
    return url
  return `${getApiBaseUrl()}${url.startsWith('/') ? url : `/${url}`}`
}

export function formatMoney(value?: number | null) {
  if (value === null || value === undefined)
    return '--'
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

export function formatArea(value?: number | null) {
  if (value === null || value === undefined)
    return '--'
  return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)}㎡`
}

export function getStatusMeta(status?: number | null) {
  return PROPERTY_STATUS_OPTIONS.find(item => item.value === status) || { value: -1, label: '未知', tone: 'default' }
}

export function idToQuery(id: ShenLeId) {
  return encodeURIComponent(String(id))
}
