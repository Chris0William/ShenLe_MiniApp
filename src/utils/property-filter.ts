import type { PageSlPropertyInput, PropertyFilterState, ShenLeId } from '@/types/shenle'
import {
  AREA_SEGMENTS,
  BEDROOM_OPTIONS,
  DECORATION_OPTIONS,
  DEPOSIT_RULE_OPTIONS,
  ORIENTATION_OPTIONS,
  PRICE_SEGMENTS,
  RENTAL_TYPE_OPTIONS,
} from '@/constants/shenle'

export function clonePropertyFilters(filters?: PropertyFilterState): PropertyFilterState {
  return { ...(filters || {}) }
}

export function countPropertyFilters(filters: PropertyFilterState) {
  let count = 0
  if (filters.regionId)
    count += 1
  if (filters.bedrooms)
    count += 1
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    count += 1
  if (filters.orientation)
    count += 1
  if (filters.decoration)
    count += 1
  if (filters.rentalType)
    count += 1
  if (filters.minArea !== undefined || filters.maxArea !== undefined)
    count += 1
  if (filters.communityId)
    count += 1
  if (filters.depositRule)
    count += 1
  return count
}

export function hasPropertyFilter(filters: PropertyFilterState, key: string) {
  switch (key) {
    case 'region': return !!filters.regionId
    case 'bedrooms': return !!filters.bedrooms
    case 'price': return filters.minPrice !== undefined || filters.maxPrice !== undefined
    case 'orientation': return !!filters.orientation
    case 'decoration': return !!filters.decoration
    case 'rentalType': return !!filters.rentalType
    case 'more': return filters.minArea !== undefined || filters.maxArea !== undefined || !!filters.communityId || !!filters.depositRule
    default: return false
  }
}

export function buildPropertyFilterQuery(filters: PropertyFilterState): Omit<PageSlPropertyInput, 'page' | 'pageSize'> {
  return {
    regionId: filters.regionId,
    communityId: filters.communityId,
    bedrooms: filters.bedrooms,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    orientation: filters.orientation,
    decoration: filters.decoration,
    rentalType: filters.rentalType,
    minArea: filters.minArea,
    maxArea: filters.maxArea,
    depositRule: filters.depositRule,
  }
}

export function sameId(left?: ShenLeId, right?: ShenLeId) {
  return left !== undefined && right !== undefined && String(left) === String(right)
}

function rangeLabel(min?: number, max?: number, unit = '') {
  if (min === undefined && max === undefined)
    return ''
  if (min !== undefined && max !== undefined)
    return `${min}-${max}${unit}`
  if (min !== undefined)
    return `${min}${unit}以上`
  return `${max}${unit}以下`
}

function optionLabel<T extends { label: string, value: unknown }>(options: readonly T[], value?: unknown) {
  return options.find(item => item.value === value)?.label
}

export function getPropertyFilterLabels(filters: PropertyFilterState, maps: {
  regionName?: string
  communityName?: string
} = {}) {
  const labels: string[] = []
  if (filters.regionId)
    labels.push(maps.regionName || '已选区域')
  if (filters.communityId)
    labels.push(maps.communityName || '已选楼盘')
  if (filters.bedrooms)
    labels.push(optionLabel(BEDROOM_OPTIONS, filters.bedrooms) || `${filters.bedrooms}室`)
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    labels.push(PRICE_SEGMENTS.find(item => item.min === filters.minPrice && item.max === filters.maxPrice)?.label || rangeLabel(filters.minPrice, filters.maxPrice, '元'))
  }
  if (filters.orientation)
    labels.push(optionLabel(ORIENTATION_OPTIONS, filters.orientation) || filters.orientation)
  if (filters.decoration)
    labels.push(optionLabel(DECORATION_OPTIONS, filters.decoration) || filters.decoration)
  if (filters.rentalType)
    labels.push(optionLabel(RENTAL_TYPE_OPTIONS, filters.rentalType) || filters.rentalType)
  if (filters.minArea !== undefined || filters.maxArea !== undefined) {
    labels.push(AREA_SEGMENTS.find(item => item.min === filters.minArea && item.max === filters.maxArea)?.label || rangeLabel(filters.minArea, filters.maxArea, '㎡'))
  }
  if (filters.depositRule)
    labels.push(optionLabel(DEPOSIT_RULE_OPTIONS, filters.depositRule) || filters.depositRule)
  return labels
}
