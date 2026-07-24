import type { ShenLeId, SlSupplyLeaderboardDetailPageOutput, SlSupplyLeaderboardDimension, SlSupplyLeaderboardOutput, SlSupplyOperatorOutput, SlSupplyRecentOutput } from '@/types/shenle'
import { get, post } from './request'

export function getRecentSupplyActivity(days = 7, limit = 20) {
  return get<SlSupplyRecentOutput[]>('/api/slSupplyActivity/recent', { days, limit })
}

export function getSupplyLeaderboard(days = 7, limit = 10, sortBy = 'affectedCount') {
  return get<SlSupplyLeaderboardOutput[]>('/api/slSupplyActivity/leaderboard', { days, limit, sortBy })
}

export function getSupplyLeaderboardDetails(
  userId: ShenLeId,
  days: number,
  dimension: SlSupplyLeaderboardDimension,
  page = 1,
  pageSize = 20,
  activityId?: ShenLeId,
) {
  return get<SlSupplyLeaderboardDetailPageOutput>('/api/slSupplyActivity/leaderboardDetail', {
    userId,
    days,
    dimension,
    page,
    pageSize,
    activityId,
  })
}

export function getSupplyOperators(type: 'owner' | 'updater') {
  return get<SlSupplyOperatorOutput[]>('/api/slSupplyActivity/operators', { type })
}

export function backfillSupplyActivity() {
  return post<number>('/api/slSupplyActivity/backfill')
}
