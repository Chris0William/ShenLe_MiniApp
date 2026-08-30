import type { PageSlCommunityInput, PageSlPropertyInput, PropertyFilterState, ShenLeId } from '@/types/shenle'
import {
  AREA_SEGMENTS,
  BEDROOM_OPTIONS,
  DECORATION_OPTIONS,
  DEPOSIT_RULE_OPTIONS,
  DISTANCE_OPTIONS,
  ORIENTATION_OPTIONS,
  PRICE_SEGMENTS,
  RENTAL_TYPE_OPTIONS,
} from '@/constants/shenle'

export function clonePropertyFilters(filters?: PropertyFilterState): PropertyFilterState {
  return {
    ...(filters || {}),
    communityTypes: filters?.communityTypes ? [...filters.communityTypes] : undefined,
    realtimeModes: filters?.realtimeModes ? [...filters.realtimeModes] : undefined,
    specialModes: filters?.specialModes ? [...filters.specialModes] : undefined,
  }
}

export function countPropertyFilters(filters: PropertyFilterState) {
  let count = 0
  if (filters.regionId || filters.distanceKm !== undefined)
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

export function countCommunityFilters(filters: PropertyFilterState) {
  let count = 0
  if (filters.regionId || filters.distanceKm !== undefined)
    count += 1
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    count += 1
  if (filters.communityId)
    count += 1
  if (filters.updatedWithinDays)
    count += 1
  if (filters.ownerUserId)
    count += 1
  if (filters.updaterUserId)
    count += 1
  if (filters.onlyManagedByMe)
    count += 1
  if (filters.onlyUpdatedByMe)
    count += 1
  if (filters.communityTypes?.length)
    count += 1
  if (filters.realtimeModes?.length)
    count += 1
  if (filters.specialModes?.length)
    count += 1
  if (filters.onlyContactedByMe || filters.onlyMaintainedByMe)
    count += 1
  if (filters.sortBy === 'distance')
    count += 1
  return count
}

export function hasPropertyFilter(filters: PropertyFilterState, key: string) {
  switch (key) {
    case 'region': return !!filters.regionId || filters.distanceKm !== undefined
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
    userLng: filters.userLng,
    userLat: filters.userLat,
    distanceKm: filters.distanceKm,
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

export function buildCommunityFilterQuery(filters: PropertyFilterState): Omit<PageSlCommunityInput, 'page' | 'pageSize'> {
  return {
    regionId: filters.regionId,
    userLng: filters.userLng,
    userLat: filters.userLat,
    distanceKm: filters.distanceKm,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    updatedWithinDays: filters.updatedWithinDays,
    ownerUserId: filters.ownerUserId,
    updaterUserId: filters.updaterUserId,
    onlyManagedByMe: filters.onlyManagedByMe,
    onlyUpdatedByMe: filters.onlyUpdatedByMe,
    types: filters.communityTypes,
    realtimeModes: filters.realtimeModes,
    specialModes: filters.specialModes,
    onlyContactedByMe: filters.onlyContactedByMe,
    onlyMaintainedByMe: filters.onlyMaintainedByMe,
    sortBy: filters.sortBy || 'latest',
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

function distanceLabel(value?: number) {
  if (value === undefined)
    return ''
  return optionLabel(DISTANCE_OPTIONS, value) || (value < 1 ? `${Math.round(value * 1000)}m` : `${value}km`)
}

export function getPropertyFilterLabels(filters: PropertyFilterState, maps: {
  regionName?: string
  communityName?: string
} = {}) {
  const labels: string[] = []
  if (filters.regionId || filters.distanceKm !== undefined) {
    const parts: string[] = []
    if (filters.regionId)
      parts.push(maps.regionName || filters.regionName || '已选区域')
    if (filters.distanceKm !== undefined)
      parts.push(`附近${distanceLabel(filters.distanceKm)}`)
    labels.push(parts.join(' · '))
  }
  if (filters.communityId)
    labels.push(maps.communityName || filters.communityName || '已选楼盘')
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

export function getCommunityFilterLabels(filters: PropertyFilterState, maps: {
  regionName?: string
  communityName?: string
} = {}) {
  const labels: string[] = []
  if (filters.regionId || filters.distanceKm !== undefined) {
    const parts: string[] = []
    if (filters.regionId)
      parts.push(maps.regionName || filters.regionName || '已选区域')
    if (filters.distanceKm !== undefined)
      parts.push(`附近${distanceLabel(filters.distanceKm)}`)
    labels.push(parts.join(' · '))
  }
  if (filters.communityId)
    labels.push(maps.communityName || filters.communityName || '已选楼盘')
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    labels.push(PRICE_SEGMENTS.find(item => item.min === filters.minPrice && item.max === filters.maxPrice)?.label || rangeLabel(filters.minPrice, filters.maxPrice, '元'))
  if (filters.updatedWithinDays)
    labels.push(`最近${filters.updatedWithinDays}天更新`)
  if (filters.ownerUserId)
    labels.push(`对接人：${filters.ownerUserName || '已选择'}`)
  if (filters.updaterUserId)
    labels.push(`更新人：${filters.updaterUserName || '已选择'}`)
  if (filters.onlyManagedByMe)
    labels.push('仅看我管理')
  if (filters.onlyUpdatedByMe)
    labels.push('仅看我更新')
  if (filters.communityTypes?.length) {
    const typeMap: Record<number, string> = { 1: '小区', 2: '公寓', 3: '小产权' }
    labels.push(filters.communityTypes.map(type => typeMap[type] || `类型${type}`).join('、'))
  }
  if (filters.realtimeModes?.length) {
    const modeMap = { realtime: '实时更新', hot: '热门盘源' } as const
    labels.push(filters.realtimeModes.map(mode => modeMap[mode]).join('、'))
  }
  if (filters.specialModes?.length) {
    const modeMap = { monthlyPayment: '可押一付一', shortRent: '可短租', dailyRent: '可日租' } as const
    labels.push(filters.specialModes.map(mode => modeMap[mode]).join('、'))
  }
  if (filters.onlyContactedByMe)
    labels.push('仅看我对接')
  if (filters.onlyMaintainedByMe)
    labels.push('仅看我维护')
  if (filters.sortBy === 'distance')
    labels.push('距离最近优先')
  return labels
}
