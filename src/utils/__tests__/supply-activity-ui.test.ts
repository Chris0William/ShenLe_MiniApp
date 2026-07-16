import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatRecentSupplyActivity, formatSupplyTime } from '../supply-activity'

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('supply activity formatting', () => {
  it('formats same-day and prior-year timestamps predictably', () => {
    const now = new Date('2026-07-16T12:00:00')
    expect(formatSupplyTime('2026-07-16T09:05:00', now)).toBe('今天 09:05')
    expect(formatSupplyTime('2025-12-30T18:00:00', now)).toBe('2025年12月30日')
    expect(formatSupplyTime('', now)).toBe('')
  })

  it('builds the map ticker copy from real activity data', () => {
    expect(formatRecentSupplyActivity({
      id: '1',
      communityId: '2',
      communityName: '马山头花园',
      operatorUserId: '3',
      operatorNickName: '张三',
      action: 'property.batchUpdate',
      actionName: '批量更新房源',
      affectedCount: 12,
      updateTime: '2026-07-16T09:05:00',
    })).toBe('张三 最近更新 马山头花园 · 12 项')
  })
})

describe('supply contact and leaderboard UI contract', () => {
  const contactPages = [
    'src/pages/common/community-properties/index.vue',
    'src/pages/common/property-form/index.vue',
    'src/pages/common/property-detail/index.vue',
  ]

  it.each(contactPages)('%s loads the community and renders shared contacts', (pagePath) => {
    const page = source(pagePath)
    expect(page).toContain('getCommunityDetail')
    expect(page).toContain('SlSupplyContacts')
    expect(page).toContain('<sl-supply-contacts')
  })

  it('provides direct phone calls without duplicating page handlers', () => {
    const contacts = source('src/components/sl-supply-contacts/sl-supply-contacts.vue')
    expect(contacts).toContain('uni.makePhoneCall')
    expect(contacts).toContain('盘源更新人')
    expect(contacts).toContain('盘源对接人')
  })

  it('loads recent activity and all supported leaderboard sorts on the map', () => {
    const map = source('src/pages/user/map/index.vue')
    expect(map).toContain('getRecentSupplyActivity')
    expect(map).toContain('getSupplyLeaderboard')
    expect(map).toContain('chart-bar')
    expect(map).toContain("'affectedCount'")
    expect(map).toContain("'activityCount'")
    expect(map).toContain("'communityCount'")
  })
})
