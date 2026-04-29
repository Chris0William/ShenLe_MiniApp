import { get, post } from './request'
import type {
  AddSlPropertyInput,
  BaseIdInput,
  ListSlPropertyInput,
  PageSlPropertyInput,
  PagedList,
  SlPropertyGlobalStatsOutput,
  SlPropertyListOutput,
  SlPropertyOutput,
  SlPropertyStatsOutput,
  SlPropertyStatusOutput,
  UpdateSlPropertyInput,
  UpdateSlPropertyStatusInput,
} from '@/types/shenle'

export const getPropertyGlobalStats = () =>
  get<SlPropertyGlobalStatsOutput>('/api/slProperty/globalStats')

export const getPropertyStats = (input: ListSlPropertyInput) =>
  get<SlPropertyStatsOutput>('/api/slProperty/stats', input as unknown as Record<string, unknown>)

export const getPropertyPage = (input: PageSlPropertyInput) =>
  get<PagedList<SlPropertyListOutput>>('/api/slProperty/page', input as unknown as Record<string, unknown>)

export const getPropertyList = (input: ListSlPropertyInput) =>
  get<SlPropertyListOutput[]>('/api/slProperty/list', input as unknown as Record<string, unknown>)

export const getPropertyDetail = (id: string | number) =>
  get<SlPropertyOutput>('/api/slProperty/detail', { id })

export const getPropertyStatusList = () =>
  get<SlPropertyStatusOutput[]>('/api/slProperty/getStatusList')

export const addProperty = (input: AddSlPropertyInput) =>
  post<string | number>('/api/slProperty/add', input as unknown as Record<string, unknown>)

export const updateProperty = (input: UpdateSlPropertyInput) =>
  post<void>('/api/slProperty/update', input as unknown as Record<string, unknown>)

export const deleteProperty = (input: BaseIdInput) =>
  post<void>('/api/slProperty/delete', input as unknown as Record<string, unknown>)

export const updatePropertyStatus = (input: UpdateSlPropertyStatusInput) =>
  post<void>('/api/slProperty/updateStatus', input as unknown as Record<string, unknown>)
