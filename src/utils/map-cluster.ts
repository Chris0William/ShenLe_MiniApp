import type { SlCommunityOutput } from '@/types/shenle'

export interface MapRegionBounds {
  southwest: { latitude: number, longitude: number }
  northeast: { latitude: number, longitude: number }
}

export interface CommunityCluster {
  /** 质心纬度 */
  lat: number
  /** 质心经度 */
  lng: number
  items: SlCommunityOutput[]
}

export interface ClusterResult {
  singles: SlCommunityOutput[]
  clusters: CommunityCluster[]
}

/**
 * 屏幕像素网格聚合：把当前可视区域按 thresholdPx 像素折算成经纬度网格，
 * 同格楼盘合并为一个聚合点。纯函数，便于独立验证。
 */
export function clusterCommunities(
  items: SlCommunityOutput[],
  region: MapRegionBounds | null,
  windowWidthPx: number,
  thresholdPx = 60,
): ClusterResult {
  const valid = items.filter((item) => {
    const lat = Number(item.lat)
    const lng = Number(item.lng)
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
  })

  // 没有可视区域信息时不聚合（首帧），全部按单点返回
  const lngSpan = region ? region.northeast.longitude - region.southwest.longitude : 0
  if (!region || lngSpan <= 0 || windowWidthPx <= 0)
    return { singles: valid, clusters: [] }

  const cellDeg = (thresholdPx * lngSpan) / windowWidthPx
  const buckets = new Map<string, SlCommunityOutput[]>()
  for (const item of valid) {
    const key = `${Math.floor(Number(item.lng) / cellDeg)}_${Math.floor(Number(item.lat) / cellDeg)}`
    buckets.set(key, [...(buckets.get(key) || []), item])
  }

  const singles: SlCommunityOutput[] = []
  const clusters: CommunityCluster[] = []
  for (const group of buckets.values()) {
    if (group.length === 1) {
      singles.push(group[0])
      continue
    }
    const lat = group.reduce((sum, x) => sum + Number(x.lat), 0) / group.length
    const lng = group.reduce((sum, x) => sum + Number(x.lng), 0) / group.length
    clusters.push({ lat, lng, items: group })
  }
  return { singles, clusters }
}

/** 聚合气泡文案：「金地华苑、宏发花园等 12 个楼盘」 */
export function clusterCalloutText(cluster: CommunityCluster) {
  const names = cluster.items.slice(0, 2).map(item => item.name).join('、')
  return `${names}等${cluster.items.length}个楼盘`
}

/** 聚合内所有点几乎重合（无法通过放大拆分）时返回 true */
export function isClusterUnsplittable(cluster: CommunityCluster, epsilonDeg = 0.0002) {
  const lats = cluster.items.map(item => Number(item.lat))
  const lngs = cluster.items.map(item => Number(item.lng))
  return Math.max(...lats) - Math.min(...lats) < epsilonDeg
    && Math.max(...lngs) - Math.min(...lngs) < epsilonDeg
}
