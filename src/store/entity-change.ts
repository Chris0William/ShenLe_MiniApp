import type { ShenLeId } from '@/types/shenle'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type EntityChangeAction = 'created' | 'updated' | 'deleted' | 'status-changed' | 'structural'

export interface EntityChangePayload {
  action: EntityChangeAction
  ids: readonly ShenLeId[]
  communityId?: ShenLeId
  buildingId?: ShenLeId
}

export interface ConsumedEntityChange {
  revision: number
  payload: EntityChangePayload
  requiresReload: boolean
}

type EntityChangeTarget = 'property' | 'community' | 'building'

export const useEntityChangeStore = defineStore('entity-change', () => {
  const propertyRevision = ref(0)
  const communityRevision = ref(0)
  const buildingRevision = ref(0)
  const lastPropertyChange = ref<EntityChangePayload | null>(null)
  const lastCommunityChange = ref<EntityChangePayload | null>(null)
  const lastBuildingChange = ref<EntityChangePayload | null>(null)
  const consumedRevisions = new Map<string, Partial<Record<EntityChangeTarget, number>>>()

  function publishPropertyChange(payload: EntityChangePayload) {
    propertyRevision.value += 1
    lastPropertyChange.value = payload
  }

  function publishCommunityChange(payload: EntityChangePayload) {
    communityRevision.value += 1
    lastCommunityChange.value = payload
  }

  function publishBuildingChange(payload: EntityChangePayload) {
    buildingRevision.value += 1
    lastBuildingChange.value = payload
  }

  function consumeChange(
    target: EntityChangeTarget,
    consumerId: string,
    revision: number,
    payload: EntityChangePayload | null,
  ): ConsumedEntityChange | null {
    if (!payload || revision === 0)
      return null

    const consumerRevisions = consumedRevisions.get(consumerId) || {}
    const consumedRevision = consumerRevisions[target] || 0
    if (consumedRevision >= revision)
      return null

    consumerRevisions[target] = revision
    consumedRevisions.set(consumerId, consumerRevisions)
    return {
      revision,
      payload,
      requiresReload: revision - consumedRevision > 1,
    }
  }

  function consumePropertyChange(consumerId: string) {
    return consumeChange('property', consumerId, propertyRevision.value, lastPropertyChange.value)
  }

  function consumeCommunityChange(consumerId: string) {
    return consumeChange('community', consumerId, communityRevision.value, lastCommunityChange.value)
  }

  function consumeBuildingChange(consumerId: string) {
    return consumeChange('building', consumerId, buildingRevision.value, lastBuildingChange.value)
  }

  return {
    propertyRevision,
    communityRevision,
    buildingRevision,
    lastPropertyChange,
    lastCommunityChange,
    lastBuildingChange,
    publishPropertyChange,
    publishCommunityChange,
    publishBuildingChange,
    consumePropertyChange,
    consumeCommunityChange,
    consumeBuildingChange,
  }
})
