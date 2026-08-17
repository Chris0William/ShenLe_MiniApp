import type { ShenLeId, SlSourceContactCommunityOutput, SlSourceContactProfileOutput } from '@/types/shenle'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getSourceContactCommunityList, getSourceContactProfile } from '@/api/source-contact-portal'

export const useSourceContactStore = defineStore('source-contact-portal', () => {
  const profile = ref<SlSourceContactProfileOutput | null>(null)
  const communities = ref<SlSourceContactCommunityOutput[]>([])
  const loading = ref(false)
  const loadedAt = ref(0)
  const activeCommunityId = ref<ShenLeId | null>(null)
  let activeRequest: Promise<void> | null = null

  const hasCommunities = computed(() => communities.value.length > 0)

  async function load(force = false) {
    if (!force && profile.value && Date.now() - loadedAt.value < 60_000)
      return
    if (activeRequest)
      return activeRequest

    loading.value = true
    activeRequest = Promise.all([
      getSourceContactProfile(),
      getSourceContactCommunityList(),
    ]).then(([nextProfile, nextCommunities]) => {
      profile.value = nextProfile
      communities.value = nextCommunities
      loadedAt.value = Date.now()
    }).finally(() => {
      loading.value = false
      activeRequest = null
    })
    return activeRequest
  }

  function invalidate() {
    loadedAt.value = 0
  }

  function selectCommunity(id: ShenLeId | null) {
    activeCommunityId.value = id
  }

  function clear() {
    profile.value = null
    communities.value = []
    loadedAt.value = 0
    activeCommunityId.value = null
  }

  return { profile, communities, loading, hasCommunities, activeCommunityId, load, invalidate, selectCommunity, clear }
})
