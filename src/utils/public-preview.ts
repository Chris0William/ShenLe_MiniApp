export function hasPublicCoordinate(item: { latitude?: unknown, longitude?: unknown }): boolean {
  if (item.latitude === null || item.latitude === undefined || item.longitude === null || item.longitude === undefined)
    return false
  if (String(item.latitude).trim() === '' || String(item.longitude).trim() === '')
    return false
  const latitude = Number(item.latitude)
  const longitude = Number(item.longitude)
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    && (latitude !== 0 || longitude !== 0)
}
