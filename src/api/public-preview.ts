import type { PagedList, SlPublicRegionPreviewOutput, SlPublicRegionQueryInput } from '@/types/shenle'
import { post } from './request'

export function getPublicRegionMap(input: Partial<SlPublicRegionQueryInput> = {}) {
  return post<SlPublicRegionPreviewOutput[]>('/api/slPublic/regionMap', input as unknown as Record<string, unknown>, { auth: false })
}

export function getPublicRegionPage(input: SlPublicRegionQueryInput) {
  return post<PagedList<SlPublicRegionPreviewOutput>>('/api/slPublic/regionPage', input as unknown as Record<string, unknown>, { auth: false })
}
