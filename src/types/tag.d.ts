import type { BasePageInput } from './common'

/** 标签分页查询输入 */
export interface PageSlTagInput extends BasePageInput {
  name?: string
  category?: string
  status?: number
}

/** 标签列表查询输入 */
export interface ListSlTagInput {
  category?: string
  status?: number
}

/** 新增标签输入 */
export interface AddSlTagInput {
  name: string
  category: string
  color?: string
  icon?: string
  orderNo?: number
  status?: number
  remark?: string
}

/** 更新标签输入 */
export interface UpdateSlTagInput extends AddSlTagInput {
  id: number
}

/** 标签输出 (matches backend SlTagOutput) */
export interface SlTagOutput {
  id: number
  name: string
  category: string
  color?: string
  icon?: string
  orderNo: number
  status: number
  remark?: string
  createTime: string
  updateTime?: string
}

/** 标签分类输出 (matches backend SlTagCategoryOutput) */
export interface SlTagCategoryOutput {
  value: string
  label: string
}
