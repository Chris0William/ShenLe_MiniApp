<script setup lang="ts">
import type { PropertyFilterState, ShenLeId, SlRegionTreeOutput, SlSupplyOperatorOutput } from '@/types/shenle'
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import { getRegionTree } from '@/api/region'
import { getSupplyOperators } from '@/api/supply-activity'
import { DISTANCE_OPTIONS } from '@/constants/shenle'
import { getLocationOnceCached } from '@/utils/location-cache'
import { clonePropertyFilters, hasLayoutFilter, layoutLabel, normalizeMulti, sameId } from '@/utils/property-filter'

type DropdownName = 'location' | 'price' | 'layout' | 'more'
type RealtimeMode = NonNullable<PropertyFilterState['realtimeModes']>[number]
type SpecialMode = NonNullable<PropertyFilterState['specialModes']>[number]

interface RegionHit {
  node: SlRegionTreeOutput
  parent?: SlRegionTreeOutput
}

const props = defineProps<{
  filters: PropertyFilterState
  keyword?: string
  mountKey?: string
  guarded?: boolean
  guardTip?: string
  showMineFilters?: boolean
  showOperatorFilters?: boolean
}>()

const emit = defineEmits<{
  confirm: [filters: PropertyFilterState, keyword?: string]
  reset: []
  guarded: [tip?: string]
}>()

const PRICE_MAX = 10000
const PRICE_STEP = 100
const COMMUNITY_TYPE_OPTIONS = [
  { value: 2, label: '公寓' },
  { value: 3, label: '小产权' },
  { value: 1, label: '小区' },
] as const
const REALTIME_OPTIONS: Array<{ value: RealtimeMode, label: string }> = [
  { value: 'realtime', label: '实时更新' },
  { value: 'hot', label: '热门盘源' },
]
const SPECIAL_OPTIONS: Array<{ value: SpecialMode, label: string }> = [
  { value: 'monthlyPayment', label: '可押一付一' },
  { value: 'shortRent', label: '可短租' },
  { value: 'dailyRent', label: '可日租' },
  { value: 'pet', label: '可养宠物' },
]
const ORIENTATION_OPTIONS = [
  { value: 'east', label: '东' },
  { value: 'south', label: '南' },
  { value: 'west', label: '西' },
  { value: 'north', label: '北' },
  { value: 'north-south', label: '南北' },
  { value: 'southeast', label: '东南' },
  { value: 'northeast', label: '东北' },
  { value: 'southwest', label: '西南' },
  { value: 'northwest', label: '西北' },
] as const
const DECORATION_OPTIONS = [
  { value: 'rough', label: '毛坯' },
  { value: 'simple', label: '简装' },
  { value: 'fine', label: '精装' },
  { value: 'luxury', label: '豪装' },
] as const
const RENTAL_TYPE_OPTIONS = [
  { value: 'whole', label: '整租' },
  { value: 'shared', label: '合租' },
  { value: 'sublease', label: '转租' },
] as const
const DEPOSIT_RULE_OPTIONS = [
  { value: '1-1', label: '押一付一' },
  { value: '1-3', label: '押一付三' },
  { value: '2-1', label: '押二付一' },
  { value: '2-3', label: '押二付三' },
  { value: 'half-year', label: '半年付' },
  { value: 'yearly', label: '年付' },
] as const
const LAYOUT_ROOM_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5+' },
] as const
const activeDropdown = ref<DropdownName | null>(null)
const sheetVisible = ref(false)
const draft = ref<PropertyFilterState>({})
const draftKeyword = ref('')
const regionTree = ref<SlRegionTreeOutput[]>([])
const regionLoading = ref(false)
const operatorLoading = ref(false)
const ownerOptions = ref<SlSupplyOperatorOutput[]>([])
const updaterOptions = ref<SlSupplyOperatorOutput[]>([])
const regionParentId = ref<ShenLeId | undefined>()
const instance = getCurrentInstance()

let dragging: 'min' | 'max' | null = null
let trackLeft = 0
let trackWidth = 0

function guardInteraction() {
  if (!props.guarded)
    return false
  activeDropdown.value = null
  sheetVisible.value = false
  emit('guarded', props.guardTip)
  return true
}

const locationActive = computed(() => !!props.filters.regionId || props.filters.distanceKm !== undefined)
const priceActive = computed(() => props.filters.minPrice !== undefined || props.filters.maxPrice !== undefined)
const keywordActive = computed(() => !!props.keyword?.trim())
const typeActive = computed(() => !!props.filters.communityTypes?.length)
const realtimeActive = computed(() => !!props.filters.realtimeModes?.length)
const specialActive = computed(() => !!props.filters.specialModes?.length)
const layoutActive = computed(() => hasLayoutFilter(props.filters))
const layoutTabLabel = computed(() => layoutActive.value ? layoutLabel(props.filters) : '户型')
// 「筛选」总入口：类型/实时/特殊/朝向/装修/租赁/押付/面积 等任何一项激活即高亮
const moreActive = computed(() =>
  typeActive.value || realtimeActive.value || specialActive.value
  || !!normalizeMulti(props.filters.orientations, props.filters.orientation)?.length
  || !!normalizeMulti(props.filters.decorations, props.filters.decoration)?.length
  || !!normalizeMulti(props.filters.rentalTypes, props.filters.rentalType)?.length
  || !!normalizeMulti(props.filters.depositRules, props.filters.depositRule)?.length
  || props.filters.minArea !== undefined || props.filters.maxArea !== undefined
  || props.filters.communityId !== undefined
  || props.filters.updatedWithinDays !== undefined
  || !!props.filters.ownerUserId || !!props.filters.updaterUserId
  || !!props.filters.sortBy,
)
const moreActiveCount = computed(() => {
  let count = 0
  if (typeActive.value) count++
  if (realtimeActive.value) count++
  if (specialActive.value) count++
  if (normalizeMulti(props.filters.orientations, props.filters.orientation)?.length) count++
  if (normalizeMulti(props.filters.decorations, props.filters.decoration)?.length) count++
  if (normalizeMulti(props.filters.rentalTypes, props.filters.rentalType)?.length) count++
  if (normalizeMulti(props.filters.depositRules, props.filters.depositRule)?.length) count++
  if (props.filters.minArea !== undefined || props.filters.maxArea !== undefined) count++
  if (props.filters.communityId) count++
  return count
})
const typeLabel = computed(() => optionGroupLabel(props.filters.communityTypes, COMMUNITY_TYPE_OPTIONS, '类型'))
const realtimeLabel = computed(() => optionGroupLabel(props.filters.realtimeModes, REALTIME_OPTIONS, '实时'))
const specialLabel = computed(() => optionGroupLabel(props.filters.specialModes, SPECIAL_OPTIONS, '特殊'))

/** 已选 chip 栏数据：所有激活条件 → 可删除标签 */
interface ActiveChip {
  key: string
  label: string
  remove: () => void
}
const activeChips = computed<ActiveChip[]>(() => {
  const filters = props.filters
  const chips: ActiveChip[] = []
  const clone = () => clonePropertyFilters(filters)
  if (filters.regionName || filters.regionId) {
    chips.push({
      key: 'region',
      label: filters.regionName || '已选区域',
      remove: () => { const next = clone(); next.regionId = undefined; next.regionName = undefined; applyChip(next) },
    })
  }
  if (filters.distanceKm !== undefined) {
    chips.push({
      key: 'distance',
      label: `附近${distanceLabel(filters.distanceKm)}`,
      remove: () => { const next = clone(); next.distanceKm = undefined; applyChip(next) },
    })
  }
  if (priceActive.value) {
    chips.push({
      key: 'price',
      label: priceRangeLabel(filters, '租金'),
      remove: () => { const next = clone(); next.minPrice = undefined; next.maxPrice = undefined; applyChip(next) },
    })
  }
  if (layoutActive.value) {
    chips.push({
      key: 'layout',
      label: layoutLabel(filters),
      remove: () => {
        const next = clone()
        next.bedrooms = undefined
        next.bedroomsList = undefined
        next.livingRooms = undefined
        next.bathrooms = undefined
        applyChip(next)
      },
    })
  }
  const multiChip = (key: string, values: string[] | undefined, single: string | undefined, options: readonly { value: string, label: string }[], clear: (next: PropertyFilterState) => void) => {
    const list = normalizeMulti(values, single)
    if (!list?.length)
      return
    chips.push({
      key,
      label: list.map(value => options.find(item => item.value === value)?.label || value).join('/'),
      remove: () => { const next = clone(); clear(next); applyChip(next) },
    })
  }
  multiChip('orientation', filters.orientations, filters.orientation, ORIENTATION_OPTIONS,
    next => { next.orientation = undefined; next.orientations = undefined })
  multiChip('decoration', filters.decorations, filters.decoration, DECORATION_OPTIONS,
    next => { next.decoration = undefined; next.decorations = undefined })
  multiChip('rentalType', filters.rentalTypes, filters.rentalType, RENTAL_TYPE_OPTIONS,
    next => { next.rentalType = undefined; next.rentalTypes = undefined })
  multiChip('depositRule', filters.depositRules, filters.depositRule, DEPOSIT_RULE_OPTIONS,
    next => { next.depositRule = undefined; next.depositRules = undefined })
  if (filters.minArea !== undefined || filters.maxArea !== undefined) {
    chips.push({
      key: 'area',
      label: rangeLabel(filters.minArea, filters.maxArea, '㎡'),
      remove: () => { const next = clone(); next.minArea = undefined; next.maxArea = undefined; applyChip(next) },
    })
  }
  if (filters.communityId) {
    chips.push({
      key: 'community',
      label: filters.communityName || '已选楼盘',
      remove: () => { const next = clone(); next.communityId = undefined; next.communityName = undefined; applyChip(next) },
    })
  }
  if (typeActive.value) {
    chips.push({
      key: 'types',
      label: optionGroupLabel(filters.communityTypes, COMMUNITY_TYPE_OPTIONS, '类型'),
      remove: () => { const next = clone(); next.communityTypes = undefined; applyChip(next) },
    })
  }
  if (realtimeActive.value) {
    chips.push({
      key: 'realtime',
      label: optionGroupLabel(filters.realtimeModes, REALTIME_OPTIONS, '实时'),
      remove: () => { const next = clone(); next.realtimeModes = undefined; applyChip(next) },
    })
  }
  if (specialActive.value) {
    chips.push({
      key: 'special',
      label: optionGroupLabel(filters.specialModes, SPECIAL_OPTIONS, '特殊'),
      remove: () => { const next = clone(); next.specialModes = undefined; applyChip(next) },
    })
  }
  if (filters.updatedWithinDays) {
    chips.push({
      key: 'updated',
      label: `近${filters.updatedWithinDays}天更新`,
      remove: () => { const next = clone(); next.updatedWithinDays = undefined; applyChip(next) },
    })
  }
  if (filters.ownerUserId) {
    chips.push({
      key: 'owner',
      label: `对接:${filters.ownerUserName || '已选'}`,
      remove: () => { const next = clone(); next.ownerUserId = undefined; next.ownerUserName = undefined; applyChip(next) },
    })
  }
  if (filters.updaterUserId) {
    chips.push({
      key: 'updater',
      label: `更新:${filters.updaterUserName || '已选'}`,
      remove: () => { const next = clone(); next.updaterUserId = undefined; next.updaterUserName = undefined; applyChip(next) },
    })
  }
  if (filters.onlyContactedByMe) {
    chips.push({ key: 'mineContact', label: '仅看我对接', remove: () => { const next = clone(); next.onlyContactedByMe = undefined; applyChip(next) } })
  }
  if (filters.onlyMaintainedByMe) {
    chips.push({ key: 'mineMaintain', label: '仅看我维护', remove: () => { const next = clone(); next.onlyMaintainedByMe = undefined; applyChip(next) } })
  }
  return chips
})

function applyChip(next: PropertyFilterState) {
  if (guardInteraction())
    return
  draft.value = clonePropertyFilters(next)
  activeDropdown.value = null
  sheetVisible.value = false
  emit('confirm', clonePropertyFilters(next), props.keyword)
}

const locationLabel = computed(() => {
  const parts: string[] = []
  if (props.filters.regionName)
    parts.push(props.filters.regionName)
  else if (props.filters.regionId)
    parts.push('已选区域')
  if (props.filters.distanceKm !== undefined)
    parts.push(distanceLabel(props.filters.distanceKm))
  return parts.length ? parts.join(' ') : '位置'
})

const priceLabel = computed(() => priceRangeLabel(props.filters, '租金'))
const selectedParent = computed(() => regionParentId.value === undefined ? undefined : findRegion(regionParentId.value)?.node)
const childRegions = computed(() => selectedParent.value?.children || [])
const priceMinValue = computed(() => draft.value.minPrice ?? 0)
const priceMaxValue = computed(() => draft.value.maxPrice ?? PRICE_MAX)
const priceMinLabel = computed(() => priceBoundaryLabel(priceMinValue.value))
const priceMaxLabel = computed(() => priceBoundaryLabel(priceMaxValue.value))
const minPct = computed(() => (priceMinValue.value / PRICE_MAX) * 100)
const maxPct = computed(() => (priceMaxValue.value / PRICE_MAX) * 100)

watch(() => props.filters, () => {
  if (!activeDropdown.value && !sheetVisible.value)
    syncDraft()
}, { deep: true })

watch(() => props.keyword, () => {
  if (!sheetVisible.value)
    draftKeyword.value = props.keyword || ''
})

onMounted(() => {
  syncDraft()
  loadRegions()
})

function syncDraft() {
  draft.value = clonePropertyFilters(props.filters)
  draftKeyword.value = props.keyword || ''
  normalizeDraftPrice()
  syncRegionCursor()
}

function normalizeDraftPrice() {
  const min = draft.value.minPrice
  const max = draft.value.maxPrice
  if (min !== undefined && max !== undefined && min > max) {
    draft.value.minPrice = max
    draft.value.maxPrice = min
  }
}

async function loadRegions() {
  if (regionLoading.value || regionTree.value.length)
    return
  regionLoading.value = true
  try {
    regionTree.value = await getRegionTree()
    syncRegionCursor()
  }
  finally {
    regionLoading.value = false
  }
}

function findRegion(id?: ShenLeId): RegionHit | undefined {
  if (id === undefined)
    return undefined
  let hit: RegionHit | undefined
  const walk = (nodes: SlRegionTreeOutput[], parent?: SlRegionTreeOutput) => {
    for (const node of nodes) {
      if (sameId(node.id, id)) {
        hit = { node, parent }
        return
      }
      if (node.children?.length) {
        walk(node.children, node)
        if (hit)
          return
      }
    }
  }
  walk(regionTree.value)
  return hit
}

function syncRegionCursor() {
  const hit = findRegion(draft.value.regionId)
  regionParentId.value = hit?.parent?.id ?? hit?.node?.id
}

function toggleDropdown(name: DropdownName) {
  if (guardInteraction())
    return
  if (activeDropdown.value === name) {
    closeDropdown()
    return
  }
  if (!activeDropdown.value)
    syncDraft()
  activeDropdown.value = name
  sheetVisible.value = false
  loadRegions()
  nextTick(() => measureTrack())
}

function closeDropdown() {
  activeDropdown.value = null
  syncDraft()
}

function openSheet() {
  if (guardInteraction())
    return
  activeDropdown.value = null
  syncDraft()
  sheetVisible.value = true
  loadRegions()
  loadOperators()
  nextTick(() => measureTrack())
}

function closeSheet() {
  sheetVisible.value = false
  syncDraft()
}

function clearLocation() {
  draft.value.regionId = undefined
  draft.value.regionName = undefined
  draft.value.distanceKm = undefined
  regionParentId.value = undefined
}

function selectRegionParent(region?: SlRegionTreeOutput) {
  if (!region) {
    clearLocation()
    return
  }
  regionParentId.value = region.id
  draft.value.regionId = region.id
  draft.value.regionName = region.name
  applyRegionReferencePoint(region)
}

function selectParentAll() {
  if (!selectedParent.value)
    return
  draft.value.regionId = selectedParent.value.id
  draft.value.regionName = selectedParent.value.name
  applyRegionReferencePoint(selectedParent.value)
}

function selectRegionChild(region: SlRegionTreeOutput) {
  draft.value.regionId = region.id
  draft.value.regionName = region.name
  applyRegionReferencePoint(region)
}

function applyRegionReferencePoint(region: SlRegionTreeOutput) {
  if (draft.value.distanceKm === undefined)
    return
  if (region.centerLng !== undefined && region.centerLat !== undefined) {
    draft.value.userLng = Number(region.centerLng)
    draft.value.userLat = Number(region.centerLat)
  }
}

async function selectDistance(value?: number) {
  draft.value.distanceKm = value
  if (value === undefined)
    return
  await ensureReferencePoint()
}

async function ensureReferencePoint() {
  const region = draft.value.regionId ? findRegion(draft.value.regionId)?.node : selectedParent.value
  if (region?.centerLng !== undefined && region.centerLat !== undefined) {
    draft.value.userLng = Number(region.centerLng)
    draft.value.userLat = Number(region.centerLat)
    return true
  }
  if (draft.value.userLng !== undefined && draft.value.userLat !== undefined)
    return true
  try {
    const position = await getLocationOnceCached()
    draft.value.userLng = position.longitude
    draft.value.userLat = position.latitude
    return true
  }
  catch {
    uni.showToast({ title: '附近距离需要定位授权', icon: 'none' })
    return false
  }
}

async function selectSort(value: 'latest' | 'distance') {
  if (value === 'distance' && !await ensureReferencePoint())
    return
  draft.value.sortBy = value === 'latest' ? undefined : value
}

async function loadOperators() {
  if (!props.showOperatorFilters || operatorLoading.value || ownerOptions.value.length || updaterOptions.value.length)
    return
  operatorLoading.value = true
  try {
    const [owners, updaters] = await Promise.all([
      getSupplyOperators('owner'),
      getSupplyOperators('updater'),
    ])
    ownerOptions.value = owners
    updaterOptions.value = updaters
  }
  finally {
    operatorLoading.value = false
  }
}

function selectOperator(type: 'owner' | 'updater', item?: SlSupplyOperatorOutput) {
  const idKey = type === 'owner' ? 'ownerUserId' : 'updaterUserId'
  const nameKey = type === 'owner' ? 'ownerUserName' : 'updaterUserName'
  if (!item || sameId(draft.value[idKey], item.userId)) {
    draft.value[idKey] = undefined
    draft.value[nameKey] = undefined
    return
  }
  draft.value[idKey] = item.userId
  draft.value[nameKey] = item.nickName
}

function toggleArrayValue<T>(values: T[] | undefined, value: T) {
  const next = [...(values || [])]
  const index = next.indexOf(value)
  if (index >= 0)
    next.splice(index, 1)
  else
    next.push(value)
  return next.length ? next : undefined
}

/** 户型三段多选（室/厅/卫） */
function toggleLayoutValue(key: 'bedroomsList' | 'livingRooms' | 'bathrooms', value: number) {
  const next = toggleArrayValue(draft.value[key], value)
  draft.value[key] = next
  if (key === 'bedroomsList')
    draft.value.bedrooms = next?.length === 1 ? next[0] : undefined
}

/** 多选开关（朝向/装修/租赁/押付）：写多选数组并清空旧单选 */
function toggleMultiValue(key: 'orientations' | 'decorations' | 'rentalTypes' | 'depositRules', value: string) {
  const singleKey = ({ orientations: 'orientation', decorations: 'decoration', rentalTypes: 'rentalType', depositRules: 'depositRule' })[key]
  const next = toggleArrayValue(draft.value[key], value)
  draft.value[key] = next
  draft.value[singleKey] = next?.length === 1 ? next[0] : undefined
}

function toggleCommunityType(value: number) {
  draft.value.communityTypes = toggleArrayValue(draft.value.communityTypes, value)
}

function toggleRealtimeMode(value: RealtimeMode) {
  draft.value.realtimeModes = toggleArrayValue(draft.value.realtimeModes, value)
}

function toggleSpecialMode(value: SpecialMode) {
  draft.value.specialModes = toggleArrayValue(draft.value.specialModes, value)
}

function toggleRelationFilter(key: 'onlyContactedByMe' | 'onlyMaintainedByMe') {
  draft.value[key] = !draft.value[key] || undefined
}

function quickToggleRelationFilter(key: 'onlyContactedByMe' | 'onlyMaintainedByMe') {
  if (guardInteraction())
    return
  const next = clonePropertyFilters(props.filters)
  next[key] = !next[key] || undefined
  draft.value = clonePropertyFilters(next)
  activeDropdown.value = null
  sheetVisible.value = false
  emit('confirm', next, props.keyword)
}

function setPriceRange(min: number, max: number) {
  const boundedMin = Math.max(0, Math.min(PRICE_MAX, min))
  const boundedMax = Math.max(0, Math.min(PRICE_MAX, max))
  const nextMin = Math.min(boundedMin, boundedMax)
  const nextMax = Math.max(boundedMin, boundedMax)
  draft.value.minPrice = nextMin > 0 ? nextMin : undefined
  draft.value.maxPrice = nextMax < PRICE_MAX ? nextMax : undefined
}

function clearPrice() {
  draft.value.minPrice = undefined
  draft.value.maxPrice = undefined
}

function resetCurrent() {
  if (activeDropdown.value === 'location')
    clearLocation()
  if (activeDropdown.value === 'price')
    clearPrice()
  if (activeDropdown.value === 'layout') {
    draft.value.bedrooms = undefined
    draft.value.bedroomsList = undefined
    draft.value.livingRooms = undefined
    draft.value.bathrooms = undefined
  }
  if (activeDropdown.value === 'more') {
    draft.value.communityTypes = undefined
    draft.value.realtimeModes = undefined
    draft.value.specialModes = undefined
    draft.value.orientation = undefined
    draft.value.orientations = undefined
    draft.value.decoration = undefined
    draft.value.decorations = undefined
    draft.value.rentalType = undefined
    draft.value.rentalTypes = undefined
    draft.value.depositRule = undefined
    draft.value.depositRules = undefined
    draft.value.minArea = undefined
    draft.value.maxArea = undefined
  }
  confirmCurrent()
}

async function confirmCurrent() {
  if ((draft.value.distanceKm !== undefined || draft.value.sortBy === 'distance') && !await ensureReferencePoint())
    return
  activeDropdown.value = null
  emit('confirm', clonePropertyFilters(draft.value), props.keyword)
}

function resetSheet() {
  draft.value = {
    userLng: draft.value.userLng,
    userLat: draft.value.userLat,
  }
  draftKeyword.value = ''
  regionParentId.value = undefined
}

async function confirmSheet() {
  if ((draft.value.distanceKm !== undefined || draft.value.sortBy === 'distance') && !await ensureReferencePoint())
    return
  sheetVisible.value = false
  emit('confirm', clonePropertyFilters(draft.value), draftKeyword.value.trim())
}

function resetAll() {
  if (guardInteraction())
    return
  draft.value = {}
  draftKeyword.value = ''
  regionParentId.value = undefined
  activeDropdown.value = null
  sheetVisible.value = false
  emit('reset')
}

function distanceLabel(value?: number) {
  if (value === undefined)
    return '不限'
  return DISTANCE_OPTIONS.find(item => item.value === value)?.label || (value < 1 ? `${Math.round(value * 1000)}m` : `${value}km`)
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

function priceBoundaryLabel(value: number) {
  return value <= 0 || value >= PRICE_MAX ? '不限' : `¥${value}`
}

function priceRangeLabel(filters: Pick<PropertyFilterState, 'minPrice' | 'maxPrice'>, fallback: string) {
  const min = filters.minPrice ?? 0
  const max = filters.maxPrice ?? PRICE_MAX
  if (min <= 0 && max >= PRICE_MAX)
    return fallback
  if (min > 0 && max >= PRICE_MAX)
    return `¥${min}以上`
  if (min <= 0)
    return `¥${max}以下`
  return `¥${min}-${max}`
}

function optionGroupLabel<T>(values: T[] | undefined, options: readonly { value: T, label: string }[], fallback: string) {
  if (!values?.length)
    return fallback
  if (values.length === 1)
    return options.find(item => item.value === values[0])?.label || fallback
  return `${fallback} ${values.length}`
}

function measureTrack() {
  const query = uni.createSelectorQuery().in(instance)
  query.select('.range-track').boundingClientRect((rect) => {
    const node = Array.isArray(rect) ? rect[0] : rect
    if (!node)
      return
    trackLeft = node.left || 0
    trackWidth = node.width || 0
  }).exec()
}

function onTrackTouchStart() {
  measureTrack()
}

function onThumbTouchStart(which: 'min' | 'max') {
  dragging = which
  measureTrack()
}

function valueFromX(x: number) {
  if (!trackWidth)
    return 0
  const pct = Math.max(0, Math.min(1, (x - trackLeft) / trackWidth))
  return Math.round((pct * PRICE_MAX) / PRICE_STEP) * PRICE_STEP
}

function onThumbTouchMove(event: TouchEvent) {
  if (!dragging || !trackWidth)
    return
  const x = event.touches[0]?.clientX ?? trackLeft
  const value = valueFromX(x)
  if (dragging === 'min')
    setPriceRange(Math.min(value, priceMaxValue.value), priceMaxValue.value)
  else
    setPriceRange(priceMinValue.value, Math.max(value, priceMinValue.value))
}

function onThumbTouchEnd() {
  dragging = null
}
</script>

<template>
  <view class="filter-shell" :class="{ 'open': activeDropdown || sheetVisible, 'sheet-open': sheetVisible }">
    <view class="filter-bar">
      <view
        class="filter-tab"
        :class="{ active: locationActive, open: activeDropdown === 'location' }"
        @tap="toggleDropdown('location')"
      >
        <text class="filter-tab__label">{{ locationLabel }}</text>
        <view class="filter-tab__arrow">
          <wd-icon name="arrow-down" size="12px" color="currentColor" />
        </view>
      </view>
      <view
        class="filter-tab"
        :class="{ active: priceActive, open: activeDropdown === 'price' }"
        @tap="toggleDropdown('price')"
      >
        <text class="filter-tab__label">{{ priceLabel }}</text>
        <view class="filter-tab__arrow">
          <wd-icon name="arrow-down" size="12px" color="currentColor" />
        </view>
      </view>
      <view
        class="filter-tab"
        :class="{ active: layoutActive, open: activeDropdown === 'layout' }"
        @tap="toggleDropdown('layout')"
      >
        <text class="filter-tab__label">{{ layoutTabLabel }}</text>
        <view class="filter-tab__arrow">
          <wd-icon name="arrow-down" size="12px" color="currentColor" />
        </view>
      </view>
      <view
        class="filter-tab"
        :class="{ active: moreActive, open: activeDropdown === 'more' }"
        @tap="toggleDropdown('more')"
      >
        <text class="filter-tab__label">筛选</text>
        <view v-if="moreActiveCount > 0" class="filter-tab__badge">{{ moreActiveCount }}</view>
        <view class="filter-tab__arrow">
          <wd-icon name="arrow-down" size="12px" color="currentColor" />
        </view>
      </view>
      <view class="filter-reset" @tap="resetAll">
        <text>重置</text>
      </view>
      <view class="filter-search" :class="{ active: keywordActive || sheetVisible }" @tap="openSheet">
        <wd-icon name="search" size="18px" :color="keywordActive || sheetVisible ? '#2f66ee' : '#293241'" />
      </view>
    </view>

    <!-- 已选条件 chip 栏：任何筛选激活时显示，点 × 即时移除 -->
    <scroll-view v-if="activeChips.length" scroll-x class="active-chip-bar" enhanced :show-scrollbar="false">
      <view class="active-chip-bar__inner">
        <view v-for="chip in activeChips" :key="chip.key" class="active-chip" @tap="chip.remove()">
          <text class="active-chip__label">{{ chip.label }}</text>
          <view class="active-chip__close" aria-label="移除筛选条件">
            <wd-icon name="close" size="11px" color="#126b4f" />
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="showMineFilters && !guarded" class="mine-quick-row">
      <view
        class="mine-quick"
        :class="{ active: props.filters.onlyContactedByMe }"
        @tap="quickToggleRelationFilter('onlyContactedByMe')"
      >
        <wd-icon name="link" size="14px" :color="props.filters.onlyContactedByMe ? '#fff' : '#126b4f'" />
        <text>仅看我对接</text>
      </view>
      <view
        class="mine-quick"
        :class="{ active: props.filters.onlyMaintainedByMe }"
        @tap="quickToggleRelationFilter('onlyMaintainedByMe')"
      >
        <wd-icon name="service" size="14px" :color="props.filters.onlyMaintainedByMe ? '#fff' : '#126b4f'" />
        <text>仅看我维护</text>
      </view>
    </view>

    <view v-if="activeDropdown" class="filter-mask" @tap="closeDropdown" @touchmove.stop.prevent />

    <view v-if="activeDropdown" class="dropdown-panel" @touchmove.stop.prevent>
      <view v-if="activeDropdown === 'location'" class="dropdown-section">
        <text class="section-title">附近距离</text>
        <scroll-view scroll-x class="chip-scroll">
          <view class="chip-scroll__inner">
            <view
              v-for="item in DISTANCE_OPTIONS"
              :key="item.label"
              class="filter-chip"
              :class="{ active: draft.distanceKm === item.value }"
              @tap="selectDistance(item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </scroll-view>

        <view class="region-split">
          <scroll-view scroll-y class="region-left">
            <view class="region-left__item" :class="{ active: !draft.regionId }" @tap="selectRegionParent()">
              <text>不限</text>
            </view>
            <view
              v-for="region in regionTree"
              :key="String(region.id)"
              class="region-left__item"
              :class="{ active: sameId(regionParentId, region.id) }"
              @tap="selectRegionParent(region)"
            >
              <text>{{ region.name }}</text>
            </view>
            <view v-if="!regionTree.length" class="region-empty">
              {{ regionLoading ? '加载中...' : '暂无区域' }}
            </view>
          </scroll-view>
          <scroll-view scroll-y class="region-right">
            <view v-if="!selectedParent" class="region-right__item active">
              <text>全部区域</text>
            </view>
            <template v-else>
              <view class="region-right__item" :class="{ active: sameId(draft.regionId, selectedParent.id) }" @tap="selectParentAll">
                <text>全部区域</text>
              </view>
              <view
                v-for="child in childRegions"
                :key="String(child.id)"
                class="region-right__item"
                :class="{ active: sameId(draft.regionId, child.id) }"
                @tap="selectRegionChild(child)"
              >
                <text>{{ child.name }}</text>
              </view>
            </template>
          </scroll-view>
        </view>
      </view>

      <view v-if="activeDropdown === 'price'" class="dropdown-section dropdown-section--short">
        <view class="range-title">
          <text>{{ priceMinLabel }}</text>
          <text class="range-title__dash">—</text>
          <text>{{ priceMaxLabel }}</text>
        </view>
        <view class="range-slider" @touchstart="onTrackTouchStart">
          <view class="range-track">
            <view class="range-active" :style="{ left: `${minPct}%`, width: `${maxPct - minPct}%` }" />
            <view
              class="range-thumb"
              :style="{ left: `${minPct}%` }"
              @touchstart.stop="onThumbTouchStart('min')"
              @touchmove.stop.prevent="onThumbTouchMove"
              @touchend.stop="onThumbTouchEnd"
              @touchcancel.stop="onThumbTouchEnd"
            />
            <view
              class="range-thumb"
              :style="{ left: `${maxPct}%` }"
              @touchstart.stop="onThumbTouchStart('max')"
              @touchmove.stop.prevent="onThumbTouchMove"
              @touchend.stop="onThumbTouchEnd"
              @touchcancel.stop="onThumbTouchEnd"
            />
          </view>
          <view class="range-ticks">
            <text>¥0</text>
            <text>¥5000</text>
            <text>¥10000</text>
          </view>
        </view>
      </view>

      <view v-if="activeDropdown === 'layout'" class="dropdown-section dropdown-section--short">
        <view class="layout-head">
          <text class="section-title">选择户型</text>
          <text class="layout-head__hint">可多选，同段为「或」关系</text>
        </view>
        <view class="layout-group">
          <text class="layout-group__tag">室</text>
          <view class="option-row option-row--tight">
            <view
              v-for="item in LAYOUT_ROOM_OPTIONS"
              :key="`b${item.value}`"
              class="filter-chip filter-chip--square"
              :class="{ active: draft.bedroomsList?.includes(item.value) }"
              @tap="toggleLayoutValue('bedroomsList', item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>
        <view class="layout-group">
          <text class="layout-group__tag">厅</text>
          <view class="option-row option-row--tight">
            <view
              v-for="item in LAYOUT_ROOM_OPTIONS.slice(0, 4)"
              :key="`l${item.value}`"
              class="filter-chip filter-chip--square"
              :class="{ active: draft.livingRooms?.includes(item.value) }"
              @tap="toggleLayoutValue('livingRooms', item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>
        <view class="layout-group">
          <text class="layout-group__tag">卫</text>
          <view class="option-row option-row--tight">
            <view
              v-for="item in LAYOUT_ROOM_OPTIONS.slice(0, 4)"
              :key="`w${item.value}`"
              class="filter-chip filter-chip--square"
              :class="{ active: draft.bathrooms?.includes(item.value) }"
              @tap="toggleLayoutValue('bathrooms', item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="activeDropdown === 'more'" class="dropdown-section dropdown-section--scroll">
        <scroll-view scroll-y class="more-scroll">
          <text class="section-title">楼盘类型</text>
          <view class="option-row">
            <view
              v-for="item in COMMUNITY_TYPE_OPTIONS"
              :key="item.value"
              class="filter-chip"
              :class="{ active: draft.communityTypes?.includes(item.value) }"
              @tap="toggleCommunityType(item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>

          <text class="section-title">朝向</text>
          <view class="option-row">
            <view
              v-for="item in ORIENTATION_OPTIONS"
              :key="item.value"
              class="filter-chip filter-chip--square"
              :class="{ active: normalizeMulti(draft.orientations, draft.orientation)?.includes(item.value) }"
              @tap="toggleMultiValue('orientations', item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>

          <text class="section-title">装修</text>
          <view class="option-row">
            <view
              v-for="item in DECORATION_OPTIONS"
              :key="item.value"
              class="filter-chip"
              :class="{ active: normalizeMulti(draft.decorations, draft.decoration)?.includes(item.value) }"
              @tap="toggleMultiValue('decorations', item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>

          <text class="section-title">租赁方式</text>
          <view class="option-row">
            <view
              v-for="item in RENTAL_TYPE_OPTIONS"
              :key="item.value"
              class="filter-chip"
              :class="{ active: normalizeMulti(draft.rentalTypes, draft.rentalType)?.includes(item.value) }"
              @tap="toggleMultiValue('rentalTypes', item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>

          <text class="section-title">押付方式</text>
          <view class="option-row">
            <view
              v-for="item in DEPOSIT_RULE_OPTIONS"
              :key="item.value"
              class="filter-chip"
              :class="{ active: normalizeMulti(draft.depositRules, draft.depositRule)?.includes(item.value) }"
              @tap="toggleMultiValue('depositRules', item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>

          <text class="section-title">实时盘源</text>
          <view class="option-row">
            <view
              v-for="item in REALTIME_OPTIONS"
              :key="item.value"
              class="filter-chip"
              :class="{ active: draft.realtimeModes?.includes(item.value) }"
              @tap="toggleRealtimeMode(item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>

          <text class="section-title">特殊条件</text>
          <view class="option-row">
            <view
              v-for="item in SPECIAL_OPTIONS"
              :key="item.value"
              class="filter-chip"
              :class="{ active: draft.specialModes?.includes(item.value) }"
              @tap="toggleSpecialMode(item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="panel-actions">
        <wd-button size="large" type="info" plain block @click="resetCurrent">
          重置
        </wd-button>
        <wd-button size="large" type="primary" block @click="confirmCurrent">
          确定
        </wd-button>
      </view>
    </view>

    <!-- 自实现底部弹层：wd-popup 在本组件环境下过渡状态机会卡死在屏幕外，弃用。
         v-if + fixed 定位 + CSS 动画，行为确定；catchtouchmove 防滚动穿透 -->
    <view v-if="sheetVisible" class="sheet-mask" @tap="closeSheet" @touchmove.stop.prevent />
    <view v-if="sheetVisible" class="sheet-wrap" @touchmove.stop.prevent>
      <view class="sheet-panel">
        <view class="sheet-head">
          <text class="sheet-title">筛选</text>
          <view class="sheet-close" @tap="closeSheet">
            <wd-icon name="close" size="18px" color="#4b5563" />
          </view>
        </view>

        <view class="sheet-search-row">
          <wd-icon name="search" size="18px" color="#9aa3af" />
          <input
            v-model="draftKeyword"
            class="sheet-input"
            placeholder="输入楼盘名称"
            confirm-type="search"
            @confirm="confirmSheet"
          >
        </view>

        <scroll-view scroll-y class="sheet-body">
          <view class="sheet-block">
            <text class="sheet-block__title">附近距离</text>
            <scroll-view scroll-x class="chip-scroll">
              <view class="chip-scroll__inner">
                <view
                  v-for="item in DISTANCE_OPTIONS"
                  :key="item.label"
                  class="filter-chip"
                  :class="{ active: draft.distanceKm === item.value }"
                  @tap="selectDistance(item.value)"
                >
                  <text>{{ item.label }}</text>
                </view>
              </view>
            </scroll-view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">选区域</text>
            <!-- 与外层「位置」下拉保持同一套级联交互，避免两处区域选择长得不一样 -->
            <view class="region-split region-split--sheet">
              <scroll-view scroll-y class="region-left">
                <view class="region-left__item" :class="{ active: !draft.regionId }" @tap="selectRegionParent()">
                  <text>不限</text>
                </view>
                <view
                  v-for="region in regionTree"
                  :key="String(region.id)"
                  class="region-left__item"
                  :class="{ active: sameId(regionParentId, region.id) }"
                  @tap="selectRegionParent(region)"
                >
                  <text>{{ region.name }}</text>
                </view>
                <view v-if="!regionTree.length" class="region-empty">
                  {{ regionLoading ? '加载中...' : '暂无区域' }}
                </view>
              </scroll-view>
              <scroll-view scroll-y class="region-right">
                <view v-if="!selectedParent" class="region-right__item active">
                  <text>全部区域</text>
                </view>
                <template v-else>
                  <view class="region-right__item" :class="{ active: sameId(draft.regionId, selectedParent.id) }" @tap="selectParentAll">
                    <text>全部区域</text>
                  </view>
                  <view
                    v-for="child in childRegions"
                    :key="String(child.id)"
                    class="region-right__item"
                    :class="{ active: sameId(draft.regionId, child.id) }"
                    @tap="selectRegionChild(child)"
                  >
                    <text>{{ child.name }}</text>
                  </view>
                </template>
              </scroll-view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">租金范围</text>
            <view class="range-title range-title--sheet">
              <text>{{ priceMinLabel }}</text>
              <text class="range-title__dash">—</text>
              <text>{{ priceMaxLabel }}</text>
            </view>
            <view class="range-slider" @touchstart="onTrackTouchStart">
              <view class="range-track">
                <view class="range-active" :style="{ left: `${minPct}%`, width: `${maxPct - minPct}%` }" />
                <view
                  class="range-thumb"
                  :style="{ left: `${minPct}%` }"
                  @touchstart.stop="onThumbTouchStart('min')"
                  @touchmove.stop.prevent="onThumbTouchMove"
                  @touchend.stop="onThumbTouchEnd"
                  @touchcancel.stop="onThumbTouchEnd"
                />
                <view
                  class="range-thumb"
                  :style="{ left: `${maxPct}%` }"
                  @touchstart.stop="onThumbTouchStart('max')"
                  @touchmove.stop.prevent="onThumbTouchMove"
                  @touchend.stop="onThumbTouchEnd"
                  @touchcancel.stop="onThumbTouchEnd"
                />
              </view>
              <view class="range-ticks">
                <text>¥0</text>
                <text>¥5000</text>
                <text>¥10000</text>
              </view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">楼盘类型</text>
            <view class="option-row">
              <view
                v-for="item in COMMUNITY_TYPE_OPTIONS"
                :key="item.value"
                class="filter-chip"
                :class="{ active: draft.communityTypes?.includes(item.value) }"
                @tap="toggleCommunityType(item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">户型</text>
            <view class="layout-group">
              <text class="layout-group__tag">室</text>
              <view class="option-row option-row--tight">
                <view
                  v-for="item in LAYOUT_ROOM_OPTIONS"
                  :key="`sb${item.value}`"
                  class="filter-chip filter-chip--square"
                  :class="{ active: draft.bedroomsList?.includes(item.value) }"
                  @tap="toggleLayoutValue('bedroomsList', item.value)"
                >
                  <text>{{ item.label }}</text>
                </view>
              </view>
            </view>
            <view class="layout-group">
              <text class="layout-group__tag">厅</text>
              <view class="option-row option-row--tight">
                <view
                  v-for="item in LAYOUT_ROOM_OPTIONS.slice(0, 4)"
                  :key="`sl${item.value}`"
                  class="filter-chip filter-chip--square"
                  :class="{ active: draft.livingRooms?.includes(item.value) }"
                  @tap="toggleLayoutValue('livingRooms', item.value)"
                >
                  <text>{{ item.label }}</text>
                </view>
              </view>
            </view>
            <view class="layout-group">
              <text class="layout-group__tag">卫</text>
              <view class="option-row option-row--tight">
                <view
                  v-for="item in LAYOUT_ROOM_OPTIONS.slice(0, 4)"
                  :key="`sw${item.value}`"
                  class="filter-chip filter-chip--square"
                  :class="{ active: draft.bathrooms?.includes(item.value) }"
                  @tap="toggleLayoutValue('bathrooms', item.value)"
                >
                  <text>{{ item.label }}</text>
                </view>
              </view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">朝向</text>
            <view class="option-row">
              <view
                v-for="item in ORIENTATION_OPTIONS"
                :key="item.value"
                class="filter-chip filter-chip--square"
                :class="{ active: normalizeMulti(draft.orientations, draft.orientation)?.includes(item.value) }"
                @tap="toggleMultiValue('orientations', item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">装修</text>
            <view class="option-row">
              <view
                v-for="item in DECORATION_OPTIONS"
                :key="item.value"
                class="filter-chip"
                :class="{ active: normalizeMulti(draft.decorations, draft.decoration)?.includes(item.value) }"
                @tap="toggleMultiValue('decorations', item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">租赁方式</text>
            <view class="option-row">
              <view
                v-for="item in RENTAL_TYPE_OPTIONS"
                :key="item.value"
                class="filter-chip"
                :class="{ active: normalizeMulti(draft.rentalTypes, draft.rentalType)?.includes(item.value) }"
                @tap="toggleMultiValue('rentalTypes', item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">押付方式</text>
            <view class="option-row">
              <view
                v-for="item in DEPOSIT_RULE_OPTIONS"
                :key="item.value"
                class="filter-chip"
                :class="{ active: normalizeMulti(draft.depositRules, draft.depositRule)?.includes(item.value) }"
                @tap="toggleMultiValue('depositRules', item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">实时</text>
            <view class="option-row">
              <view
                v-for="item in REALTIME_OPTIONS"
                :key="item.value"
                class="filter-chip"
                :class="{ active: draft.realtimeModes?.includes(item.value) }"
                @tap="toggleRealtimeMode(item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">特殊</text>
            <view class="option-row">
              <view
                v-for="item in SPECIAL_OPTIONS"
                :key="item.value"
                class="filter-chip"
                :class="{ active: draft.specialModes?.includes(item.value) }"
                @tap="toggleSpecialMode(item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">排序方式</text>
            <view class="option-row">
              <view class="filter-chip" :class="{ active: draft.sortBy !== 'distance' }" @tap="selectSort('latest')">
                <text>更新时间优先</text>
              </view>
              <view class="filter-chip" :class="{ active: draft.sortBy === 'distance' }" @tap="selectSort('distance')">
                <text>距离优先</text>
              </view>
            </view>
          </view>

          <view v-if="showMineFilters" class="sheet-block">
            <text class="sheet-block__title">个人关系</text>
            <view class="option-row">
              <view class="filter-chip" :class="{ active: draft.onlyContactedByMe }" @tap="toggleRelationFilter('onlyContactedByMe')">
                <text>仅看我对接</text>
              </view>
              <view class="filter-chip" :class="{ active: draft.onlyMaintainedByMe }" @tap="toggleRelationFilter('onlyMaintainedByMe')">
                <text>仅看我维护</text>
              </view>
            </view>
          </view>

          <template v-if="showOperatorFilters">
            <view class="sheet-block">
              <text class="sheet-block__title">盘源对接人</text>
              <scroll-view scroll-x class="chip-scroll">
                <view class="chip-scroll__inner">
                  <view class="filter-chip" :class="{ active: !draft.ownerUserId }" @tap="selectOperator('owner')">
                    <text>全部</text>
                  </view>
                  <view
                    v-for="item in ownerOptions"
                    :key="String(item.userId)"
                    class="filter-chip"
                    :class="{ active: sameId(draft.ownerUserId, item.userId) }"
                    @tap="selectOperator('owner', item)"
                  >
                    <text>{{ item.nickName }}</text>
                  </view>
                </view>
              </scroll-view>
            </view>

            <view class="sheet-block">
              <text class="sheet-block__title">盘源更新人</text>
              <scroll-view scroll-x class="chip-scroll">
                <view class="chip-scroll__inner">
                  <view class="filter-chip" :class="{ active: !draft.updaterUserId }" @tap="selectOperator('updater')">
                    <text>全部</text>
                  </view>
                  <view
                    v-for="item in updaterOptions"
                    :key="String(item.userId)"
                    class="filter-chip"
                    :class="{ active: sameId(draft.updaterUserId, item.userId) }"
                    @tap="selectOperator('updater', item)"
                  >
                    <text>{{ item.nickName }}</text>
                  </view>
                </view>
              </scroll-view>
              <text v-if="operatorLoading" class="operator-loading">正在加载人员...</text>
            </view>
          </template>
        </scroll-view>

        <view class="sheet-footer">
          <wd-button size="large" type="info" plain block @click="resetSheet">
            重置
          </wd-button>
          <wd-button size="large" type="primary" block @click="confirmSheet">
            确定
          </wd-button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.filter-shell {
  position: relative;
  z-index: 12;
  margin-top: 22rpx;
}

.filter-shell.open {
  z-index: 80;
}

/* sheet 弹层必须盖过自定义 tabbar(z-index:1000)；
   根元素的层叠上下文会把内部 popup 的 z-index 困住，必须在根上提级 */
.filter-shell.sheet-open {
  z-index: 2000;
}

.filter-bar {
  position: relative;
  z-index: 84;
  display: flex;
  min-height: 88rpx;
  align-items: center;
  box-sizing: border-box;
  padding: 0 14rpx 0 18rpx;
  border: 1rpx solid #eef1f7;
  border-radius: 26rpx;
  background: #fff;
  box-shadow: 0 16rpx 36rpx rgb(31 49 81 / 8%);
}

.filter-tab {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  padding: 20rpx 4rpx;
  color: #293241;
  font-size: 25rpx;
  font-weight: 600;
}

.filter-tab.active,
.filter-tab.open {
  color: #2f66ee;
}

.filter-tab.open .filter-tab__arrow {
  transform: rotate(180deg);
}

.filter-tab__label {
  display: block;
  overflow: hidden;
  max-width: 100rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-tab__arrow {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: currentcolor;
  transition: transform 0.18s ease;
}

.filter-reset {
  display: flex;
  height: 56rpx;
  flex: 0 0 auto;
  align-items: center;
  margin-right: 6rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: #f4f6fa;
  color: #4b5563;
  font-size: 24rpx;
  font-weight: 700;
}

.filter-search {
  display: flex;
  width: 60rpx;
  height: 60rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #f7f8fb;
}

.filter-search.active {
  background: rgb(47 102 238 / 10%);
}

.mine-quick-row {
  position: relative;
  z-index: 84;
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
}

.mine-quick {
  display: flex;
  height: 56rpx;
  align-items: center;
  gap: 8rpx;
  box-sizing: border-box;
  padding: 0 18rpx;
  border: 1rpx solid rgb(18 107 79 / 18%);
  border-radius: 8rpx;
  background: #f5faf6;
  color: #126b4f;
  font-size: 22rpx;
  font-weight: 800;
}

.mine-quick.active {
  border-color: #126b4f;
  background: #126b4f;
  color: #fff;
}

.filter-mask {
  position: fixed;
  z-index: 82;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgb(16 24 40 / 30%);
}

.dropdown-panel {
  position: absolute;
  z-index: 86;
  top: calc(100% + 12rpx);
  right: 0;
  left: 0;
  overflow: hidden;
  border: 1rpx solid #eef1f7;
  border-radius: 26rpx;
  background: #fff;
  box-shadow: 0 24rpx 54rpx rgb(30 51 92 / 16%);
  animation: dropdown-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes dropdown-in {
  from {
    transform: translateY(-14rpx);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.dropdown-section {
  padding: 28rpx 26rpx 22rpx;
}

.dropdown-section--short {
  min-height: 220rpx;
}

.section-title,
.sheet-block__title {
  display: block;
  margin-bottom: 18rpx;
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
}

.chip-row,
.option-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
}

.operator-loading {
  display: block;
  margin-top: 12rpx;
  color: #8b95a5;
  font-size: 23rpx;
}

.chip-scroll {
  white-space: nowrap;
}

.chip-scroll__inner {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 18rpx;
  padding: 8rpx 2rpx;
}

.chip-row--large {
  padding-top: 8rpx;
}

.filter-chip {
  box-sizing: border-box;
  min-width: 118rpx;
  padding: 18rpx 24rpx;
  border: 1rpx solid transparent;
  border-radius: 16rpx;
  background: #f4f6fa;
  color: #374151;
  font-size: 26rpx;
  line-height: 1;
  text-align: center;
}

.filter-chip.active {
  border-color: #2f66ee;
  background: #2f66ee;
  box-shadow: 0 12rpx 24rpx rgb(47 102 238 / 22%);
  color: #fff;
  font-weight: 800;
}

.region-split {
  display: flex;
  overflow: hidden;
  height: 420rpx;
  margin: 26rpx -26rpx -22rpx;
  border-top: 1rpx solid #eef1f7;
}

.region-split--sheet {
  height: 460rpx;
  margin: 20rpx 0 0;
  border: 1rpx solid #eef1f7;
  border-radius: 18rpx;
}

.region-left {
  width: 210rpx;
  height: 100%;
  flex: 0 0 210rpx;
  background: #f7f8fb;
}

.region-right {
  height: 100%;
  flex: 1;
  background: #fff;
}

.region-left__item,
.region-right__item {
  position: relative;
  padding: 28rpx 28rpx;
  color: #4b5563;
  font-size: 27rpx;
}

.region-left__item.active {
  background: #fff;
  color: #2f66ee;
  font-weight: 800;
}

.region-left__item.active::before {
  position: absolute;
  top: 24rpx;
  bottom: 24rpx;
  left: 0;
  width: 6rpx;
  border-radius: 0 999rpx 999rpx 0;
  background: #2f66ee;
  content: '';
}

.region-right__item.active {
  color: #2f66ee;
  font-weight: 800;
}

.region-empty {
  padding: 34rpx 18rpx;
  color: #9aa3af;
  font-size: 24rpx;
  text-align: center;
}

.range-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  margin: 6rpx 0 34rpx;
  color: #2f66ee;
  font-size: 34rpx;
  font-weight: 850;
}

.range-title--sheet {
  margin-top: 0;
}

.range-title__dash {
  color: #a3aab8;
  font-weight: 600;
}

.range-slider {
  padding: 30rpx 22rpx 12rpx;
}

.range-track {
  position: relative;
  height: 8rpx;
  border-radius: 999rpx;
  background: #dfe5ef;
}

.range-active {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 999rpx;
  background: #2f66ee;
}

.range-thumb {
  position: absolute;
  z-index: 2;
  top: 50%;
  width: 48rpx;
  height: 48rpx;
  box-sizing: border-box;
  margin-top: -24rpx;
  margin-left: -24rpx;
  border: 7rpx solid #2f66ee;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 8rpx 20rpx rgb(47 102 238 / 24%);
}

.range-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 26rpx;
  color: #9aa3af;
  font-size: 22rpx;
}

.panel-actions,
.sheet-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22rpx;
  padding: 22rpx 26rpx 26rpx;
  border-top: 1rpx solid #eef1f7;
  background: #fff;
}

.sheet-mask {
  position: fixed;
  z-index: 2000;
  inset: 0;
  background: rgb(17 24 39 / 55%);
  animation: sheet-fade-in 0.2s ease both;
}

.sheet-wrap {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2001;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom);
  border-radius: 32rpx 32rpx 0 0;
  background: #fff;
  animation: sheet-slide-up 0.25s ease both;
}

@keyframes sheet-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes sheet-slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.sheet-panel {
  display: flex;
  height: 80vh;
  flex-direction: column;
  background: #fff;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 30rpx 20rpx;
}

.sheet-title {
  color: #111827;
  font-size: 36rpx;
  font-weight: 900;
}

.sheet-close {
  display: flex;
  width: 58rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #f4f6fa;
}

.sheet-search-row {
  display: flex;
  min-height: 76rpx;
  align-items: center;
  gap: 14rpx;
  margin: 0 30rpx 18rpx;
  padding: 0 22rpx;
  border-radius: 18rpx;
  background: #f5f7fb;
}

.sheet-input {
  min-width: 0;
  flex: 1;
  color: #111827;
  font-size: 27rpx;
}

.sheet-body {
  min-height: 0;
  flex: 1;
  box-sizing: border-box;
  padding: 0 30rpx 24rpx;
}

.sheet-block {
  padding: 26rpx 0 6rpx;
}

/* ===== 已选条件 chip 栏 ===== */
.active-chip-bar {
  position: relative;
  z-index: 84;
  margin-top: 14rpx;
  white-space: nowrap;
}

.active-chip-bar__inner {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 14rpx;
  padding: 6rpx 2rpx;
}

.active-chip {
  display: inline-flex;
  height: 52rpx;
  align-items: center;
  gap: 10rpx;
  box-sizing: border-box;
  padding: 0 10rpx 0 20rpx;
  border: 1rpx solid rgb(18 107 79 / 22%);
  border-radius: 999rpx;
  background: #eef7f1;
  animation: chip-in 0.24s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.active-chip:active {
  opacity: 0.4;
  transform: scale(0.9);
}

@keyframes chip-in {
  from {
    transform: scale(0.5);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.active-chip__label {
  max-width: 240rpx;
  overflow: hidden;
  color: #126b4f;
  font-size: 23rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-chip__close {
  display: flex;
  width: 36rpx;
  height: 36rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgb(18 107 79 / 10%);
}

/* ===== 顶部 tab 数量角标 ===== */
.filter-tab__badge {
  min-width: 30rpx;
  height: 30rpx;
  box-sizing: border-box;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: #e4a11b;
  color: #fff;
  font-size: 19rpx;
  font-weight: 800;
  line-height: 30rpx;
  text-align: center;
}

/* ===== 户型三段选择器 ===== */
.layout-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.layout-head__hint {
  color: #8b95a5;
  font-size: 22rpx;
}

.layout-group {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 14rpx 0;
}

.layout-group__tag {
  flex: 0 0 44rpx;
  color: #111827;
  font-size: 26rpx;
  font-weight: 800;
  text-align: center;
}

.option-row--tight {
  gap: 14rpx;
}

.filter-chip--square {
  min-width: 84rpx;
  padding: 16rpx 0;
}

/* ===== 「筛选」总下拉：可滚动 ===== */
.dropdown-section--scroll {
  padding: 28rpx 26rpx 0;
}

.more-scroll {
  max-height: 620rpx;
}

.more-scroll .section-title {
  margin-top: 22rpx;
}

.more-scroll .section-title:first-child {
  margin-top: 0;
}
</style>
