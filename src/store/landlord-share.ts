import { computed, ref } from 'vue'
import { resolveLandlordShare } from '@/api/landlord-share'
import { isLandlordOnlySession, modeStore, onModeChange } from '@/store/mode'

// 扫码筛选是会话级临时授权：令牌只存内存，不落本地存储。
// 退出重进/杀进程后自然回落脱敏预览，与"删掉筛选即回脱敏"语义一致。
const shareToken = ref('')
const ownerName = ref('')
const communityCount = ref(0)
const requiresApproval = ref(false)
const resolving = ref(false)

function normalizeToken(value?: string | null) {
  return String(value || '').trim().replace(/^ls_/i, '')
}

function clearState() {
  shareToken.value = ''
  ownerName.value = ''
  communityCount.value = 0
  requiresApproval.value = false
}

// 分享筛选只属于业务员端；切换到管理端或房东端时立即失效。
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
    if (isLandlordOnlySession()) {
      clearState()
      return false
    }
    const normalized = normalizeToken(value)
    if (!normalized)
      return false
    shareToken.value = normalized
    ownerName.value = ''
    communityCount.value = 0
    requiresApproval.value = false
    return true
  }

  async function resolvePending() {
    if (!shareToken.value || resolving.value)
      return null
    resolving.value = true
    try {
      const result = await resolveLandlordShare(shareToken.value)
      requiresApproval.value = !!result.requiresApproval
      if (!result.requiresApproval) {
        ownerName.value = result.ownerName || ''
        communityCount.value = result.communityCount || 0
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
