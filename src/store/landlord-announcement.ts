import type { ShenLeId } from '@/types/shenle'
import { computed, ref } from 'vue'
import { getDisplayedLandlordAnnouncement } from '@/api/landlord-announcement'
import { modeStore, onModeChange } from '@/store/mode'
import { resolveRichTextImages } from '@/utils/shenle'

// 房东公告状态：本地记「已永久忽略的版本」；新版本号大于它时重新弹出
const DISMISSED_VERSION_KEY = 'shenle_announcement_dismissed_version'

const announcement = ref<{ id: ShenLeId, title?: string | null, content?: string | null, version: number } | null>(null)
const visible = ref(false)
const loading = ref(false)
// 会话内已弹过（防切换页面重复弹）
let sessionShownVersion = 0

function dismissedVersion(): number {
  return Number(uni.getStorageSync(DISMISSED_VERSION_KEY) || 0)
}

/** 房东端进入时调用：仅当存在显示公告且版本号大于已忽略版本时弹出 */
async function checkAndShow() {
  if (modeStore.mode !== 'landlord' || visible.value || loading.value)
    return
  loading.value = true
  try {
    const result = await getDisplayedLandlordAnnouncement()
    if (!result || !result.content)
      return
    announcement.value = result
    if (result.version <= dismissedVersion())
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

/** 从公告按钮主动打开（不受“不再提醒”限制） */
async function openFromButton() {
  if (visible.value || loading.value)
    return
  loading.value = true
  try {
    const result = await getDisplayedLandlordAnnouncement()
    if (!result || !result.content) {
      uni.showToast({ title: '暂无公告', icon: 'none' })
      return
    }
    announcement.value = result
    visible.value = true
  }
  catch {
    uni.showToast({ title: '公告加载失败，请重试', icon: 'none' })
  }
  finally {
    loading.value = false
  }
}

const closing = ref(false)
let closingTimer: ReturnType<typeof setTimeout> | null = null

/** 带收束动画的关闭：0.28s 缩回按钮位置后隐藏 */
function animateClose(dismissForever: boolean) {
  if (closing.value)
    return
  closing.value = true
  if (dismissForever && announcement.value)
    uni.setStorageSync(DISMISSED_VERSION_KEY, announcement.value.version)
  if (closingTimer)
    clearTimeout(closingTimer)
  closingTimer = setTimeout(() => {
    closing.value = false
    visible.value = false
  }, 280)
}

/** 不再提醒：同一公告永久不再弹出（新版本除外） */
function dismissForever() {
  animateClose(true)
}

/** 关闭：本次收起，重进/重登还会弹 */
function closeOnce() {
  animateClose(false)
}

// 离开房东端时关闭弹窗
onModeChange((next) => {
  if (next !== 'landlord')
    visible.value = false
})

export function useLandlordAnnouncementStore() {
  const shouldRender = computed(() => modeStore.mode === 'landlord' && visible.value && !!announcement.value)
  // rich-text 不解析相对路径；存量内容图片 src 是 COS 对象键，渲染前补全
  const contentHtml = computed(() => resolveRichTextImages(announcement.value?.content))
  return { announcement, contentHtml, visible, closing, loading, shouldRender, checkAndShow, openFromButton, dismissForever, closeOnce }
}
