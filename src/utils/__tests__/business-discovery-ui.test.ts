import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('business discovery experience', () => {
  it('requests only available supply and shows business context without landlord media', () => {
    const map = source('src/pages/user/map/index.vue')
    const properties = source('src/pages/common/community-properties/index.vue')

    expect(map).toContain('availableOnly: isBusinessMode.value || undefined')
    expect(map).toContain('selected.availableCount')
    expect(map).toContain('selected.announcement')
    expect(map).not.toContain('landlord-map-tools')
    expect(properties).toContain('availableOnly: isBusinessView.value || undefined')
    expect(properties).toContain('mediaList.length && !isBusinessView')
    expect(properties).toContain('business-summary')
    expect(properties).not.toContain('viewMode.value !== \'list\' || !canManage.value')
  })

  it('shares room filters and exposes community type and pet choices', () => {
    const properties = source('src/pages/common/community-properties/index.vue')
    const promotion = source('src/components/source-contact-promotion/source-contact-promotion.vue')
    const roomFilter = source('src/components/sl-property-list-filter/sl-property-list-filter.vue')
    const communityFilter = source('src/components/sl-property-filter-bar/sl-property-filter-bar.vue')

    expect(properties).toContain('<sl-property-list-filter')
    expect(promotion).toContain('<sl-property-list-filter')
    expect(roomFilter).toContain('按房号结尾匹配')
    expect(communityFilter).toContain('\'type\' | \'realtime\'')
    expect(communityFilter).toContain('{ value: \'pet\', label: \'可养宠物\' }')
  })

  it('renders every pet status through the shared styled component below commission', () => {
    const map = source('src/pages/user/map/index.vue')
    const properties = source('src/pages/common/community-properties/index.vue')
    const rooms = source('src/components/source-contact-room-state/source-contact-room-state.vue')
    const pet = source('src/components/sl-pet-policy-text/sl-pet-policy-text.vue')

    expect(map).toContain('<sl-pet-policy-text')
    expect(properties).toContain('<sl-pet-policy-text')
    expect(rooms).toContain('<sl-pet-policy-text')
    expect(map.indexOf('map-card__commission')).toBeLessThan(map.indexOf('map-card__pet'))
    expect(properties.indexOf('business-summary__commission-value')).toBeLessThan(properties.indexOf('business-summary__pet'))
    expect(pet).toContain('#bd8117')
    expect(pet).toContain('#1f2924')
    expect(pet).toContain('#d0a75a')
  })
})
