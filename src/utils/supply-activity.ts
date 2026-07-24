import type { SlSupplyRecentOutput } from '@/types/shenle'

function parseApiDate(value?: string | null) {
  if (!value)
    return null
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatSupplyTime(value?: string | null, now = new Date()) {
  const date = parseApiDate(value)
  if (!date)
    return ''

  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  const pad = (part: number) => String(part).padStart(2, '0')
  if (sameDay)
    return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (date.getFullYear() === now.getFullYear())
    return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatSupplyDateTime(value?: string | null, now = new Date()) {
  const date = parseApiDate(value)
  if (!date)
    return ''

  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  const pad = (part: number) => String(part).padStart(2, '0')
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (sameDay)
    return `今天 ${time}`
  if (date.getFullYear() === now.getFullYear())
    return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}

export function formatRecentSupplyActivity(item: SlSupplyRecentOutput) {
  const affected = item.affectedCount > 1 ? ` · ${item.affectedCount} 项` : ''
  return `${item.operatorNickName || '用户'} 最近更新 ${item.communityName}${affected}`
}
