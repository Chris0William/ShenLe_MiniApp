export const COMMISSION_PERCENT_MAX = 300

export function normalizeCommissionPercent(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number))
    return 0
  return Math.min(COMMISSION_PERCENT_MAX, Math.max(0, Math.round(number)))
}

export function formatCommissionRange(min?: number | null, max?: number | null) {
  const values = [min, max].filter((value): value is number => value !== null && value !== undefined)
  if (!values.length)
    return '未设置'
  const lower = Math.min(...values)
  const upper = Math.max(...values)
  if (lower === upper)
    return `${lower}%`
  return `${lower}%-${upper}%`
}
