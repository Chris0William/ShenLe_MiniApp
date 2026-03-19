/** 价格区间选项 */
export const PRICE_RANGES = [
  { label: '不限', min: undefined, max: undefined },
  { label: '1000以下', min: 0, max: 1000 },
  { label: '1000-1500', min: 1000, max: 1500 },
  { label: '1500-2000', min: 1500, max: 2000 },
  { label: '2000-3000', min: 2000, max: 3000 },
  { label: '3000以上', min: 3000, max: undefined },
]

/** 户型选项 */
export const BEDROOM_OPTIONS = [
  { label: '不限', value: undefined },
  { label: '1室', value: 1 },
  { label: '2室', value: 2 },
  { label: '3室', value: 3 },
  { label: '4室+', value: 4 },
]

/** 朝向选项 */
export const ORIENTATIONS = ['南', '北', '东', '西', '南北', '东南', '东北', '西南', '西北']

/** 装修选项 */
export const DECORATIONS = ['毛坯', '简装', '精装', '豪装']

/** 租赁方式 */
export const RENTAL_TYPES = ['整租', '合租']

/** 押付规则 */
export const DEPOSIT_RULES = [
  { label: '押一付一', deposit: 1, payment: 1 },
  { label: '押一付三', deposit: 1, payment: 3 },
  { label: '押二付一', deposit: 2, payment: 1 },
  { label: '半年付', deposit: 1, payment: 6 },
  { label: '年付', deposit: 1, payment: 12 },
]
