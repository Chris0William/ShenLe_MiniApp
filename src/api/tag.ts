import { get, post } from './request'
import type { AddSlTagInput, ListSlTagInput, PagedList, PageSlTagInput, ShenLeId, SlTagCategoryOutput, SlTagOutput, UpdateSlTagInput } from '@/types/shenle'

export const getTagPage = (input: PageSlTagInput) =>
  get<PagedList<SlTagOutput>>('/api/slTag/page', input as unknown as Record<string, unknown>)

export const getTagList = (input: ListSlTagInput = {}) =>
  get<SlTagOutput[]>('/api/slTag/list', input as unknown as Record<string, unknown>)

export const getTagDetail = (id: ShenLeId) =>
  get<SlTagOutput>('/api/slTag/detail', { id })

export const getTagCategoryList = () =>
  get<SlTagCategoryOutput[]>('/api/slTag/getCategoryList')

export const addTag = (input: AddSlTagInput) =>
  post<ShenLeId>('/api/slTag/add', input as unknown as Record<string, unknown>)

export const updateTag = (input: UpdateSlTagInput) =>
  post<void>('/api/slTag/update', input as unknown as Record<string, unknown>)

export const deleteTag = (id: ShenLeId) =>
  post<void>('/api/slTag/delete', { id })
