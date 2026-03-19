/** 后端 AdminResult 响应信封 */
export interface AdminResult<T = any> {
  code: number
  type: string
  message: string
  result: T
  extras: any
  time: string
}

/** 分页结果 */
export interface PagedList<T> {
  page: number
  pageSize: number
  items: T[]
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

/** 分页输入基类 */
export interface BasePageInput {
  page: number
  pageSize: number
}

/** ID 输入基类 */
export interface BaseIdInput {
  id: string
}

/** 图片输出 */
export interface ImageOutput {
  id: string
  fileName: string
  url: string
}
