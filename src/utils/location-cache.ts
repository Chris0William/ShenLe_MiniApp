export interface CachedLocation {
  longitude: number
  latitude: number
  label: string
  updatedAt: number
}

let cachedLocation: CachedLocation | null = null
let pendingLocation: Promise<CachedLocation> | null = null

function requestWxLocation(): Promise<CachedLocation> {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 4000,
      success: res => resolve({
        longitude: res.longitude,
        latitude: res.latitude,
        label: '当前位置',
        updatedAt: Date.now(),
      }),
      fail: reject,
    })
  })
}

export function getCachedLocation() {
  return cachedLocation
}

export async function getLocationOnceCached(force = false) {
  if (!force && cachedLocation)
    return cachedLocation
  if (!force && pendingLocation)
    return pendingLocation

  pendingLocation = requestWxLocation()
    .then((location) => {
      cachedLocation = location
      return location
    })
    .finally(() => {
      pendingLocation = null
    })

  return pendingLocation
}

export function setCachedLocation(longitude: number, latitude: number, label = '选定位置') {
  cachedLocation = { longitude, latitude, label, updatedAt: Date.now() }
  return cachedLocation
}
