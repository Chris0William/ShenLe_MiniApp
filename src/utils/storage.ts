export function getToken(): string {
  return uni.getStorageSync('token') || ''
}

export function setToken(token: string): void {
  uni.setStorageSync('token', token)
}

export function removeToken(): void {
  uni.removeStorageSync('token')
}

export function getAppMode(): string {
  return uni.getStorageSync('appMode') || 'user'
}

export function setAppMode(mode: string): void {
  uni.setStorageSync('appMode', mode)
}
