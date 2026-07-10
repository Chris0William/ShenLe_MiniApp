import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useEntityChangeStore } from '@/store/entity-change'

describe('entity change store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('increments property revisions and records the last payload', () => {
    const store = useEntityChangeStore()
    const first = { action: 'updated', ids: ['property-1'], buildingId: 'building-1' } as const
    const second = { action: 'deleted', ids: ['property-2'], buildingId: 'building-1' } as const

    store.publishPropertyChange(first)
    store.publishPropertyChange(second)

    expect(store.propertyRevision).toBe(2)
    expect(store.lastPropertyChange).toEqual(second)
  })

  it('tracks property, community, and building revisions independently', () => {
    const store = useEntityChangeStore()
    const community = { action: 'updated', ids: ['community-1'] } as const
    const building = { action: 'created', ids: ['building-1'], communityId: 'community-1' } as const

    store.publishCommunityChange(community)
    store.publishBuildingChange(building)

    expect(store.propertyRevision).toBe(0)
    expect(store.communityRevision).toBe(1)
    expect(store.buildingRevision).toBe(1)
    expect(store.lastCommunityChange).toEqual(community)
    expect(store.lastBuildingChange).toEqual(building)
  })

  it('lets each consumer receive a revision without hiding it from another consumer', () => {
    const store = useEntityChangeStore()
    const payload = { action: 'updated', ids: ['property-1'] } as const

    store.publishPropertyChange(payload)

    expect(store.consumePropertyChange('property-list')).toEqual({ revision: 1, payload, requiresReload: false })
    expect(store.consumePropertyChange('property-list')).toBeNull()
    expect(store.consumePropertyChange('sales-control')).toEqual({ revision: 1, payload, requiresReload: false })
  })

  it('marks a revision gap when multiple changes occur before a consumer reads them', () => {
    const store = useEntityChangeStore()
    const first = { action: 'updated', ids: ['property-1'] } as const
    const second = { action: 'deleted', ids: ['property-2'] } as const

    store.publishPropertyChange(first)
    store.publishPropertyChange(second)

    expect(store.consumePropertyChange('property-list')).toEqual({
      revision: 2,
      payload: second,
      requiresReload: true,
    })
  })

  it('consumes community and building changes independently for the same page', () => {
    const store = useEntityChangeStore()
    const community = { action: 'updated', ids: ['community-1'] } as const
    const building = { action: 'structural', ids: ['building-1'], communityId: 'community-1' } as const

    store.publishCommunityChange(community)
    store.publishBuildingChange(building)

    expect(store.consumeCommunityChange('dashboard')).toEqual({ revision: 1, payload: community, requiresReload: false })
    expect(store.consumeBuildingChange('dashboard')).toEqual({ revision: 1, payload: building, requiresReload: false })
    expect(store.consumeCommunityChange('dashboard')).toBeNull()
    expect(store.consumeBuildingChange('dashboard')).toBeNull()
  })

  it('delivers the next publication to consumers that already consumed an older revision', () => {
    const store = useEntityChangeStore()
    const first = { action: 'updated', ids: ['property-1'] } as const
    const second = { action: 'deleted', ids: ['property-2'] } as const

    store.publishPropertyChange(first)
    store.consumePropertyChange('property-list')
    store.publishPropertyChange(second)

    expect(store.consumePropertyChange('property-list')).toEqual({ revision: 2, payload: second, requiresReload: false })
  })
})
