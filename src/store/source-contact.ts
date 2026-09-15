import type { ShenLeId, SlSourceContactCommunityOutput, SlSourceContactProfileOutput } from '@/types/shenle'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { getSourceContactCommunityList, getSourceContactProfile } from '@/api/source-contact-portal'
import { modeStore, onModeChange } from '@/store/mode'
import { captureSessionContext, isCurrentSession } from '@/utils/session-context'

export const useSourceContactStore = defineStore('source-contact-portal', () => {
  const profile = ref<SlSourceContactProfileOutput | null>(null)
  const communities = ref<SlSourceContactCommunityOutput[]>([])
  const loading = ref(false)
  const loadedAt = ref(0)
  const activeCommunityId = ref<ShenLeId | null>(null)
  let activeRequest: Promise<void> | null = null
  let generation = 0
  let loadedSession: ReturnType<typeof captureSessionContext> | null = null
  let loadedMode = modeStore.mode
  let activeSession: ReturnType<typeof captureSessionContext> | null = null
  let activeMode = modeStore.mode

  const hasCommunities = computed(() => communities.value.length > 0)

  async function load(force = false) {
    const session = captureSessionContext()
    const mode = modeStore.mode
    if (!session.token) {
      clear()
      return
    }
    if (loadedSession && (!isCurrentSession(loadedSession) || loadedMode !== mode))
      clear()
    if (!force && profile.value && Date.now() - loadedAt.value < 60_000)
      return
    if (!force && activeRequest && activeSession && isCurrentSession(activeSession) && activeMode === mode)
      return activeRequest

    const requestGeneration = ++generation
    activeSession = session
    activeMode = mode
    loading.value = true
    const promise = Promise.all([
      getSourceContactProfile(),
      getSourceContactCommunityList(),
    ]).then(([nextProfile, nextCommunities]) => {
      if (requestGeneration !== generation || !isCurrentSession(session) || modeStore.mode !== mode)
        return
      profile.value = nextProfile
      communities.value = nextCommunities
      loadedAt.value = Date.now()
      loadedSession = session
      loadedMode = mode
    }).catch((error) => {
      if (requestGeneration === generation && isCurrentSession(session) && modeStore.mode === mode)
        throw error
    }).finally(() => {
      if (requestGeneration === generation) {
        loading.value = false
        activeRequest = null
      }
    })
    activeRequest = promise
    return promise
  }

  function invalidate() {
    generation += 1
    activeRequest = null
    loading.value = false
    loadedAt.value = 0
  }

  function selectCommunity(id: ShenLeId | null) {
    activeCommunityId.value = id
  }

  function clear() {
    invalidate()
    loadedSession = null
    activeSession = null
    profile.value = null
    communities.value = []
    loadedAt.value = 0
    activeCommunityId.value = null
  }

  uni.$on('shenle:session-changed', clear)
  uni.$on('shenle:access-changed', clear)
  uni.$on('shenle:unauthorized', clear)
  const stopModeListener = onModeChange(clear)
  onScopeDispose(() => {
    uni.$off('shenle:session-changed', clear)
    uni.$off('shenle:access-changed', clear)
    uni.$off('shenle:unauthorized', clear)
    stopModeListener()
  })

  return { profile, communities, loading, hasCommunities, activeCommunityId, load, invalidate, selectCommunity, clear }
})
