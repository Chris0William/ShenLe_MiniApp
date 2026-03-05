import { get, post } from './http'
import type { PagedList, BaseIdInput } from '@/types/common'
import type {
  PageSlTagInput,
  ListSlTagInput,
  AddSlTagInput,
  UpdateSlTagInput,
  SlTagOutput,
  SlTagCategoryOutput,
} from '@/types/tag'

/** 获取标签分页列表 */
export const getTagPage = (input: PageSlTagInput) =>
  get<PagedList<SlTagOutput>>('/api/slTag/page', input)

/** 获取标签列表 */
export const getTagList = (input: ListSlTagInput) =>
  get<SlTagOutput[]>('/api/slTag/list', input)

/** 获取标签详情 */
export const getTagDetail = (id: string) =>
  get<SlTagOutput>('/api/slTag/detail', { id })

/** 获取标签分类列表 */
export const getTagCategoryList = () =>
  get<SlTagCategoryOutput[]>('/api/slTag/categoryList')

/** 新增标签 */
export const addTag = (input: AddSlTagInput) =>
  post<string>('/api/slTag/add', input)

/** 更新标签 */
export const updateTag = (input: UpdateSlTagInput) =>
  post<void>('/api/slTag/update', input)

/** 删除标签 */
export const deleteTag = (input: BaseIdInput) =>
  post<void>('/api/slTag/delete', input)
