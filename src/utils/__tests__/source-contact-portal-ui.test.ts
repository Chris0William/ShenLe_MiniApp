import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('source contact operation portal shell', () => {
  const tabbar = source('src/tabbar/config.ts')
  const mapPage = source('src/pages/user/map/index.vue')
  const roomPage = source('src/pages/admin/sales-control/index.vue')
  const promotionPage = source('src/pages/admin/dashboard/index.vue')
  const minePage = source('src/pages/admin/mine/index.vue')
  const routes = source('src/router/interceptor.ts')

  it('renders the dedicated map, room-state, promotion, and mine tabs only in source-contact mode', () => {
    expect(tabbar).toContain('text: \'房态\'')
    expect(tabbar).toContain('text: \'推广\'')
    expect(tabbar).toContain('landlordTabbarList: CustomTabBarItem[] = [MAP_TAB, ROOM_STATE_TAB, PROMOTION_TAB, MINE_TAB]')
    expect(mapPage).toContain('<source-contact-map v-if="isLandlordView"')
    expect(roomPage).toContain('<source-contact-room-state v-if="isLandlordView"')
    expect(promotionPage).toContain('<source-contact-promotion v-if="isLandlordView"')
    expect(minePage).toContain('系统维护人')
    expect(minePage).toContain('切换到盘源对接人端')
  })

  it('keeps account and room-state routes behind source-contact or administrator access', () => {
    expect(routes).toContain('\'/pages/admin/sales-control/index\'')
    expect(routes).toContain('\'/pages/landlord/account/index\'')
    expect(routes).toContain('!auth.isAdmin && !auth.isLandlord')
  })
})

describe('source contact operation portal behavior', () => {
  const api = source('src/api/source-contact-portal.ts')
  const map = source('src/components/source-contact-map/source-contact-map.vue')
  const rooms = source('src/components/source-contact-room-state/source-contact-room-state.vue')
  const promotion = source('src/components/source-contact-promotion/source-contact-promotion.vue')
  const management = source('src/pages/admin/landlord-manage/index.vue')

  it('uses the owner-scoped backend contract for profile, operation settings, and promotion', () => {
    expect(api).toContain('/api/slSourceContactPortal/profile')
    expect(api).toContain('/api/slSourceContactPortal/communityList')
    expect(api).toContain('/api/slSourceContactPortal/saveCommunityConfig')
    expect(api).toContain('/api/slSourceContactPortal/savePropertyConfig')
    expect(api).toContain('/api/slSourceContactPortal/batchSaveCommission')
    expect(api).toContain('/api/slSourceContactPortal/savePromotion')
  })

  it('does not turn missing coordinates into a marker at zero longitude and latitude', () => {
    expect(map).toContain('item.lat === null || item.lat === undefined')
    expect(map).toContain('item.lng === null || item.lng === undefined')
    expect(map).toContain('(latitude !== 0 || longitude !== 0)')
    expect(map).toContain('名下楼盘尚未设置坐标')
    expect(map).toContain('mapVisible.value = true')
    expect(map).toContain('componentInstance?.proxy as any')
  })

  it('keeps the map page fixed while preserving gestures inside the native map', () => {
    const mapPage = source('src/pages/user/map/index.vue')
    expect(mapPage).toContain('disableScroll: true')
    expect(mapPage).not.toContain('enablePullDownRefresh: true')
  })

  it('supports room-state edits, inherited operation values, and explicit batch overwrite', () => {
    expect(rooms).toContain('PROPERTY_STATUS_OPTIONS')
    expect(rooms).toContain('effectiveManagementFee')
    expect(rooms).toContain('全选本栋')
    expect(rooms).toContain('本次将覆盖已选择')
    expect(rooms).toContain('sourceContact.invalidate()')
    expect(rooms).not.toContain('<wd-popup')
  })

  it('supports single and batch promotion without overstating unloaded selections', () => {
    expect(promotion).toContain('可月租')
    expect(promotion).toContain('可短租')
    expect(promotion).toContain('押一付一')
    expect(promotion).toContain('零押金')
    expect(promotion).toContain('全选已加载')
    expect(promotion).toContain('批量保存会统一覆盖所选房源的推广条件')
    expect(promotion).toContain('Promise.all([sourceContact.load(true), load(true)])')
    expect(promotion).toContain('custom-style="width: 100%;"')
    expect(promotion).toContain('const safeTop = useSafeTopStyle()')
    expect(promotion).toContain('<view class="promotion-page" :style="safeTop">')
    expect(promotion).not.toContain('<wd-popup')
  })

  it('lets super administrators assign, replace, or clear a system maintainer', () => {
    expect(management).toContain('分配维护人')
    expect(management).toContain('暂不分配')
    expect(management).toContain('setSourceContactSupportUser')
    expect(management).toContain('supportUserId: supportUserId.value')
    expect(management).toContain('user.accountType >= 888 && user.status === 1')
  })
})

describe('source contact terminology', () => {
  it('does not expose deprecated landlord wording in the new user-facing surfaces', () => {
    const content = [
      source('src/components/sl-source-contact-header/sl-source-contact-header.vue'),
      source('src/components/source-contact-map/source-contact-map.vue'),
      source('src/components/source-contact-room-state/source-contact-room-state.vue'),
      source('src/components/source-contact-promotion/source-contact-promotion.vue'),
      source('src/pages/landlord/account/index.vue'),
    ].join('\n')

    expect(content).not.toContain('房东')
    expect(content).not.toContain('二房东')
  })
})
