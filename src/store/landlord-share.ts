import { computed, ref } from 'vue'
import { resolveLandlordShare } from '@/api/landlord-share'
import { modeStore, onModeChange } from '@/store/mode'

const SHARE_TOKEN_KEY = 'shenle_landlord_share_token'
const SHARE_OWNER_KEY = 'shenle_landlord_share_owner'
const SHARE_COUNT_KEY = 'shenle_landlord_share_count'

const shareToken = ref<string>(String(uni.getStorageSync(SHARE_TOKEN_KEY) || ''))
const ownerName = ref<string>(String(uni.getStorageSync(SHARE_OWNER_KEY) || ''))
const communityCount = ref<number>(Number(uni.getStorageSync(SHARE_COUNT_KEY) || 0))
const requiresApproval = ref(false)
const resolving = ref(false)

function normalizeToken(value?: string | null) {
  return String(value || '').trim().replace(/^ls_/i, '')
}

function persist() {
  if (shareToken.value)
    uni.setStorageSync(SHARE_TOKEN_KEY, shareToken.value)
  else
    uni.removeStorageSync(SHARE_TOKEN_KEY)
  if (ownerName.value)
    uni.setStorageSync(SHARE_OWNER_KEY, ownerName.value)
  else
    uni.removeStorageSync(SHARE_OWNER_KEY)
  if (communityCount.value)
    uni.setStorageSync(SHARE_COUNT_KEY, communityCount.value)
  else
    uni.removeStorageSync(SHARE_COUNT_KEY)
}

function clearState() {
  shareToken.value = ''
  ownerName.value = ''
  communityCount.value = 0
  requiresApproval.value = false
  persist()
}

// 分享筛选只属于业务员端；切换到管理端或房东端时立即失效并清理持久化状态。
if (modeStore.mode !== 'user')
  clearState()
onModeChange((next) => {
  if (next !== 'user')
    clearState()
})

export function useLandlordShareStore() {
  const active = computed(() => modeStore.mode === 'user' && !!shareToken.value && !requiresApproval.value)
  const hasContext = computed(() => modeStore.mode === 'user' && !!shareToken.value)

  function capture(value?: string | null) {
    const normalized = normalizeToken(value)
    if (!normalized)
      return false
    shareToken.value = normalized
    ownerName.value = ''
    communityCount.value = 0
    requiresApproval.value = false
    persist()
    return true
  }

  async function resolvePending() {
    if (!shareToken.value || resolving.value)
      return null
    resolving.value = true
    try {
      const result = await resolveLandlordShare(shareToken.value)
      requiresApproval.value = result.requiresApproval
      if (!result.requiresApproval) {
        ownerName.value = result.ownerName || ''
        communityCount.value = result.communityCount || 0
        persist()
      }
      return result
    }
    catch {
      return null
    }
    finally {
      resolving.value = false
    }
  }

  function clear() {
    clearState()
  }

  return { shareToken, ownerName, communityCount, requiresApproval, resolving, active, hasContext, capture, resolvePending, clear }
}
