import { PropertyStatus } from '@/types/shenle'

export const PROPERTY_STATUS_OPTIONS = [
  { value: PropertyStatus.Vacant, label: '空置', tone: 'success' },
  { value: PropertyStatus.Reserved, label: '预定', tone: 'warning' },
  { value: PropertyStatus.Rented, label: '已租', tone: 'default' },
  { value: PropertyStatus.Offline, label: '下架', tone: 'danger' },
] as const

export const PROPERTY_FILTER_CATEGORIES = [
  { key: 'region', label: '区域' },
  { key: 'bedrooms', label: '户型' },
  { key: 'price', label: '租金' },
  { key: 'orientation', label: '朝向' },
  { key: 'decoration', label: '装修' },
  { key: 'rentalType', label: '租赁' },
  { key: 'more', label: '更多' },
] as const

export const BEDROOM_OPTIONS = [
  { label: '不限', value: undefined },
  { label: '1室', value: 1 },
  { label: '2室', value: 2 },
  { label: '3室', value: 3 },
  { label: '4室+', value: 4 },
] as const

export const DISTANCE_OPTIONS = [
  { label: '不限', value: undefined },
  { label: '500m', value: 0.5 },
  { label: '1km', value: 1 },
  { label: '3km', value: 3 },
  { label: '5km', value: 5 },
  { label: '10km', value: 10 },
] as const

export const PRICE_SEGMENTS = [
  { label: '不限', min: undefined, max: undefined },
  { label: '1000以下', min: undefined, max: 1000 },
  { label: '1000-2000', min: 1000, max: 2000 },
  { label: '2000-3000', min: 2000, max: 3000 },
  { label: '3000-5000', min: 3000, max: 5000 },
  { label: '5000-8000', min: 5000, max: 8000 },
  { label: '8000以上', min: 8000, max: undefined },
] as const

export const ORIENTATION_OPTIONS = [
  { label: '东', value: 'east' },
  { label: '南', value: 'south' },
  { label: '西', value: 'west' },
  { label: '北', value: 'north' },
  { label: '南北', value: 'north-south' },
  { label: '东南', value: 'southeast' },
  { label: '东北', value: 'northeast' },
  { label: '西南', value: 'southwest' },
  { label: '西北', value: 'northwest' },
] as const

export const DECORATION_OPTIONS = [
  { label: '毛坯', value: 'rough' },
  { label: '简装', value: 'simple' },
  { label: '精装', value: 'fine' },
  { label: '豪装', value: 'luxury' },
] as const

export const RENTAL_TYPE_OPTIONS = [
  { label: '整租', value: 'whole' },
  { label: '合租', value: 'shared' },
  { label: '转租', value: 'sublease' },
] as const

export const AREA_SEGMENTS = [
  { label: '不限', min: undefined, max: undefined },
  { label: '30㎡以下', min: undefined, max: 30 },
  { label: '30-50㎡', min: 30, max: 50 },
  { label: '50-80㎡', min: 50, max: 80 },
  { label: '80-100㎡', min: 80, max: 100 },
  { label: '100-150㎡', min: 100, max: 150 },
  { label: '150㎡以上', min: 150, max: undefined },
] as const

export const DEPOSIT_RULE_OPTIONS = [
  { label: '押一付一', value: '1-1' },
  { label: '押一付三', value: '1-3' },
  { label: '押二付一', value: '2-1' },
  { label: '押二付三', value: '2-3' },
  { label: '半年付', value: 'half-year' },
  { label: '年付', value: 'yearly' },
] as const
