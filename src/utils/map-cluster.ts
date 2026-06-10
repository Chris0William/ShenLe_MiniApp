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

/** 气泡（callout）在屏幕上的近似占位：横向 110px、纵向 60px。两个气泡近到会重叠时就合并 */
const DEFAULT_THRESHOLD_X_PX = 110
const DEFAULT_THRESHOLD_Y_PX = 60

/**
 * 贪心质心聚类：把经纬度按当前可视区域折算成屏幕像素，逐点并入「质心距离小于
 * 气泡占位」的已有簇，否则自成一簇。相比网格法不存在“跨格不合并”的缝隙，
 * 缩放后重算即可获得符合直觉的合并/拆分。纯函数，便于独立验证。
 */
export function clusterCommunities(
  items: SlCommunityOutput[],
  region: MapRegionBounds | null,
  windowWidthPx: number,
  thresholdXPx = DEFAULT_THRESHOLD_X_PX,
  thresholdYPx = DEFAULT_THRESHOLD_Y_PX,
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

  // 每像素对应的经度跨度；纬度跨度在小范围内近似一致
  const degPerPx = lngSpan / windowWidthPx
  const maxDx = thresholdXPx * degPerPx
  const maxDy = thresholdYPx * degPerPx

  interface WorkingCluster { latSum: number, lngSum: number, items: SlCommunityOutput[] }
  const working: WorkingCluster[] = []

  for (const item of valid) {
    const lat = Number(item.lat)
    const lng = Number(item.lng)
    let target: WorkingCluster | null = null
    for (const cluster of working) {
      const cLat = cluster.latSum / cluster.items.length
      const cLng = cluster.lngSum / cluster.items.length
      if (Math.abs(lng - cLng) < maxDx && Math.abs(lat - cLat) < maxDy) {
        target = cluster
        break
      }
    }
    if (target) {
      target.latSum += lat
      target.lngSum += lng
      target.items.push(item)
    }
    else {
      working.push({ latSum: lat, lngSum: lng, items: [item] })
    }
  }

  const singles: SlCommunityOutput[] = []
  const clusters: CommunityCluster[] = []
  for (const cluster of working) {
    if (cluster.items.length === 1) {
      singles.push(cluster.items[0])
      continue
    }
    clusters.push({
      lat: cluster.latSum / cluster.items.length,
      lng: cluster.lngSum / cluster.items.length,
      items: cluster.items,
    })
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
