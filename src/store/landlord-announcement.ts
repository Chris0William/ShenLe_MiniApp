import type { ShenLeId } from '@/types/shenle'
import { computed, ref } from 'vue'
import { getDisplayedLandlordAnnouncement } from '@/api/landlord-announcement'
import { modeStore, onModeChange } from '@/store/mode'

// 房东公告弹窗状态：本地只记“已读版本”和“今日不再显示日期”，均会话级+本地级各一份
const READ_VERSION_KEY = 'shenle_announcement_read_version'
const DISMISS_UNTIL_KEY = 'shenle_announcement_dismiss_until'

const announcement = ref<{ id: ShenLeId, title?: string | null, content?: string | null, version: number } | null>(null)
const visible = ref(false)
const loading = ref(false)
// 会话内已弹过（防切换页面重复弹）
let sessionShownVersion = 0

function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

function readVersion(): number {
  return Number(uni.getStorageSync(READ_VERSION_KEY) || 0)
}

function dismissUntil(): string {
  return String(uni.getStorageSync(DISMISS_UNTIL_KEY) || '')
}

/** 房东端进入时调用：满足条件才弹（新版本优先，其次看今日不再显示） */
async function checkAndShow() {
  if (modeStore.mode !== 'landlord' || visible.value || loading.value)
    return
  loading.value = true
  try {
    const result = await getDisplayedLandlordAnnouncement()
    if (!result || !result.content)
      return
    announcement.value = result
    const isNewVersion = result.version > readVersion()
    const dismissedToday = dismissUntil() === todayKey() && result.version <= readVersion()
    if (!isNewVersion && dismissedToday)
      return
    if (sessionShownVersion === result.version)
      return
    sessionShownVersion = result.version
    visible.value = true
  }
  catch {
    // 拉取失败静默，不打扰房东
  }
  finally {
    loading.value = false
  }
}

function dismissForToday() {
  if (announcement.value) {
    uni.setStorageSync(READ_VERSION_KEY, announcement.value.version)
    uni.setStorageSync(DISMISS_UNTIL_KEY, todayKey())
  }
  visible.value = false
}

function closeOnce() {
  if (announcement.value)
    uni.setStorageSync(READ_VERSION_KEY, announcement.value.version)
  visible.value = false
}

// 离开房东端时关闭弹窗
onModeChange((next) => {
  if (next !== 'landlord')
    visible.value = false
})

export function useLandlordAnnouncementStore() {
  const shouldRender = computed(() => modeStore.mode === 'landlord' && visible.value && !!announcement.value)
  return { announcement, visible, shouldRender, checkAndShow, dismissForToday, closeOnce }
}
