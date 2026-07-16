import type { ShenLeId, SlSupplyLeaderboardOutput, SlSupplyOperatorOutput, SlSupplyRecentOutput } from '@/types/shenle'
import { get, post } from './request'

export function getRecentSupplyActivity(days = 7, limit = 20) {
  return get<SlSupplyRecentOutput[]>('/api/slSupplyActivity/recent', { days, limit })
}

export function getSupplyActivityDetails(userId: ShenLeId, days = 7, limit = 50) {
  return get<SlSupplyRecentOutput[]>('/api/slSupplyActivity/recent', { days, limit, userId })
}

export function getSupplyLeaderboard(days = 7, limit = 10, sortBy = 'affectedCount') {
  return get<SlSupplyLeaderboardOutput[]>('/api/slSupplyActivity/leaderboard', { days, limit, sortBy })
}

export function getSupplyOperators(type: 'owner' | 'updater') {
  return get<SlSupplyOperatorOutput[]>('/api/slSupplyActivity/operators', { type })
}

export function backfillSupplyActivity() {
  return post<number>('/api/slSupplyActivity/backfill')
}
