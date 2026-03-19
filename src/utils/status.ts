/** 状态颜色映射 */
const STATUS_COLORS: Record<number, string> = {
  0: '#22C55E', // 空置
  1: '#F97316', // 预定
  2: '#9CA3AF', // 已租
}

/** 状态名称映射 */
const STATUS_NAMES: Record<number, string> = {
  0: '空置',
  1: '预定',
  2: '已租',
}

export function getStatusColor(status: number): string {
  return STATUS_COLORS[status] || STATUS_COLORS[0]
}

export function getStatusName(status: number): string {
  return STATUS_NAMES[status] || '未知'
}
