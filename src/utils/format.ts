/** 格式化价格 */
export function formatPrice(price: number): string {
  return `¥${price.toLocaleString()}/月`
}

/** 格式化面积 */
export function formatArea(area: number): string {
  return `${area}㎡`
}

/** 格式化户型 */
export function formatHouseType(bedrooms: number, livingRooms: number, bathrooms: number): string {
  return `${bedrooms}室${livingRooms}厅${bathrooms}卫`
}

/** 格式化楼层 */
export function formatFloor(floor: number, totalFloor: number): string {
  return `${floor}/${totalFloor}层`
}
