import type { PageSlCommunityInput, PageSlPropertyInput, PropertyFilterState, ShenLeId } from '@/types/shenle'
import {
  AREA_SEGMENTS,
  BEDROOM_OPTIONS,
  DECORATION_OPTIONS,
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
    elevatorModes: filters?.elevatorModes ? [...filters.elevatorModes] : undefined,
    bedroomsList: filters?.bedroomsList ? [...filters.bedroomsList] : undefined,
    livingRooms: filters?.livingRooms ? [...filters.livingRooms] : undefined,
    bathrooms: filters?.bathrooms ? [...filters.bathrooms] : undefined,
    layoutCombinations: filters?.layoutCombinations ? [...filters.layoutCombinations] : undefined,
    orientations: filters?.orientations ? [...filters.orientations] : undefined,
    decorations: filters?.decorations ? [...filters.decorations] : undefined,
    rentalTypes: filters?.rentalTypes ? [...filters.rentalTypes] : undefined,
  }
}

/** 合并单选与多选（多选优先），生成统一多选集合 */
export function normalizeMulti(values?: string[], single?: string): string[] | undefined {
  const list = (values || []).filter(Boolean)
  if (list.length > 0)
    return [...new Set(list)]
  return single ? [single] : undefined
}

/** 户型三段合并：返回室数统一集合（旧单选兜底） */
export function normalizeBedrooms(filters: PropertyFilterState): number[] | undefined {
  const list = filters.bedroomsList?.filter(value => value > 0) || []
  if (list.length > 0)
    return [...new Set(list)]
  return filters.bedrooms ? [filters.bedrooms] : undefined
}

/** 户型预设：编译为组合串（卫不限） */
export const LAYOUT_PRESETS = [
  { key: 'studio', label: '单间', combo: '1,0,*' },
  { key: 'oneOne', label: '一室一厅', combo: '1,1,*' },
  { key: 'twoOne', label: '两室一厅', combo: '2,1,*' },
  { key: 'threeOne', label: '三室一厅', combo: '3,1,*' },
] as const

export type LayoutPresetKey = typeof LAYOUT_PRESETS[number]['key']

/** 组合串 → 展示标签："1,0,*"→"单间"（命中预设）或 "2室2厅1卫" */
export function combinationLabel(combo: string): string {
  const preset = LAYOUT_PRESETS.find(item => item.combo === combo)
  if (preset)
    return preset.label
  const [b, l, w] = combo.split(',')
  const parts: string[] = []
  if (b !== '*')
    parts.push(`${b}室`)
  if (l !== '*')
    parts.push(`${l}厅`)
  if (w !== '*')
    parts.push(`${w}卫`)
  return parts.join('') || combo
}

/** 户型标签：x室x厅x卫（按需省略未选段） */
export function layoutLabel(filters: PropertyFilterState): string {
  const combos = filters.layoutCombinations || []
  if (combos.length)
    return combos.map(combinationLabel).join('/')
  const parts: string[] = []
  const bedrooms = normalizeBedrooms(filters)
  if (bedrooms?.length === 1)
    parts.push(`${bedrooms[0]}室`)
  else if (bedrooms?.length)
    parts.push(`${bedrooms.join('/')}室`)
  if (filters.livingRooms?.length === 1)
    parts.push(`${filters.livingRooms[0]}厅`)
  else if (filters.livingRooms?.length)
    parts.push(`${filters.livingRooms.join('/')}厅`)
  if (filters.bathrooms?.length === 1)
    parts.push(`${filters.bathrooms[0]}卫`)
  else if (filters.bathrooms?.length)
    parts.push(`${filters.bathrooms.join('/')}卫`)
  return parts.join('')
}

export function hasLayoutFilter(filters: PropertyFilterState): boolean {
  return !!(filters.layoutCombinations?.length || normalizeBedrooms(filters)?.length || filters.livingRooms?.length || filters.bathrooms?.length)
}

/** 户型条件标签列表（chip 栏用）：预设名或 x室x厅x卫 */
export function layoutComboLabels(filters: PropertyFilterState): string[] {
  return (filters.layoutCombinations || []).map(combinationLabel)
}

export function countPropertyFilters(filters: PropertyFilterState) {
  let count = 0
  if (filters.regionId || filters.distanceKm !== undefined)
    count += 1
  if (hasLayoutFilter(filters))
    count += 1
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    count += 1
  if (normalizeMulti(filters.orientations, filters.orientation))
    count += 1
  if (normalizeMulti(filters.decorations, filters.decoration))
    count += 1
  if (normalizeMulti(filters.rentalTypes, filters.rentalType))
    count += 1
  if (filters.minArea !== undefined || filters.maxArea !== undefined)
    count += 1
  if (filters.communityId)
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
  if (filters.elevatorModes?.length)
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
    case 'more': return filters.minArea !== undefined || filters.maxArea !== undefined || !!filters.communityId
    default: return false
  }
}

export function buildPropertyFilterQuery(filters: PropertyFilterState): Omit<PageSlPropertyInput, 'page' | 'pageSize'> {
  const bedrooms = normalizeBedrooms(filters)
  const combos = filters.layoutCombinations?.length ? [...filters.layoutCombinations] : undefined
  const orientations = normalizeMulti(filters.orientations, filters.orientation)
  const decorations = normalizeMulti(filters.decorations, filters.decoration)
  const rentalTypes = normalizeMulti(filters.rentalTypes, filters.rentalType)
  return {
    regionId: filters.regionId,
    userLng: filters.userLng,
    userLat: filters.userLat,
    distanceKm: filters.distanceKm,
    communityId: filters.communityId,
    bedrooms: !combos && bedrooms?.length === 1 ? bedrooms[0] : undefined,
    bedroomsList: combos ? undefined : bedrooms,
    livingRooms: !combos && filters.livingRooms?.length === 1 ? filters.livingRooms[0] : undefined,
    livingRoomsList: combos ? undefined : filters.livingRooms,
    bathrooms: !combos && filters.bathrooms?.length === 1 ? filters.bathrooms[0] : undefined,
    bathroomsList: combos ? undefined : filters.bathrooms,
    layoutCombinations: combos,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    orientation: orientations?.length === 1 ? orientations[0] : undefined,
    orientations,
    decoration: decorations?.length === 1 ? decorations[0] : undefined,
    decorations,
    rentalType: rentalTypes?.length === 1 ? rentalTypes[0] : undefined,
    rentalTypes,
    minArea: filters.minArea,
    maxArea: filters.maxArea,
  }
}

export function buildCommunityFilterQuery(filters: PropertyFilterState): Omit<PageSlCommunityInput, 'page' | 'pageSize'> {
  const bedrooms = normalizeBedrooms(filters)
  const combos = filters.layoutCombinations?.length ? [...filters.layoutCombinations] : undefined
  return {
    regionId: filters.regionId,
    userLng: filters.userLng,
    userLat: filters.userLat,
    distanceKm: filters.distanceKm,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    bedroomsList: combos ? undefined : bedrooms,
    livingRooms: combos ? undefined : filters.livingRooms,
    bathrooms: combos ? undefined : filters.bathrooms,
    layoutCombinations: combos,
    orientations: normalizeMulti(filters.orientations, filters.orientation),
    decorations: normalizeMulti(filters.decorations, filters.decoration),
    rentalTypes: normalizeMulti(filters.rentalTypes, filters.rentalType),
    minArea: filters.minArea,
    maxArea: filters.maxArea,
    elevatorModes: filters.elevatorModes,
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
  if (hasLayoutFilter(filters))
    labels.push(layoutLabel(filters))
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    labels.push(PRICE_SEGMENTS.find(item => item.min === filters.minPrice && item.max === filters.maxPrice)?.label || rangeLabel(filters.minPrice, filters.maxPrice, '元'))
  }
  const orientations = normalizeMulti(filters.orientations, filters.orientation)
  if (orientations)
    labels.push(orientations.map(value => optionLabel(ORIENTATION_OPTIONS, value) || value).join('/'))
  const decorations = normalizeMulti(filters.decorations, filters.decoration)
  if (decorations)
    labels.push(decorations.map(value => optionLabel(DECORATION_OPTIONS, value) || value).join('/'))
  const rentalTypes = normalizeMulti(filters.rentalTypes, filters.rentalType)
  if (rentalTypes)
    labels.push(rentalTypes.map(value => optionLabel(RENTAL_TYPE_OPTIONS, value) || value).join('/'))
  if (filters.minArea !== undefined || filters.maxArea !== undefined) {
    labels.push(AREA_SEGMENTS.find(item => item.min === filters.minArea && item.max === filters.maxArea)?.label || rangeLabel(filters.minArea, filters.maxArea, '㎡'))
  }
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
    const modeMap = { monthlyPayment: '可押一付一', shortRent: '可短租', dailyRent: '可日租', pet: '可养宠物' } as const
    labels.push(filters.specialModes.map(mode => modeMap[mode]).join('、'))
  }
  if (filters.elevatorModes?.length) {
    const modeMap: Record<number, string> = { 1: '电梯', 2: '楼梯' }
    labels.push(filters.elevatorModes.map(mode => modeMap[mode] || `电梯${mode}`).join('、'))
  }
  if (filters.onlyContactedByMe)
    labels.push('仅看我对接')
  if (filters.onlyMaintainedByMe)
    labels.push('仅看我维护')
  if (filters.sortBy === 'distance')
    labels.push('距离最近优先')
  return labels
}
