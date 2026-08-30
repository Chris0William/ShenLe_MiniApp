import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('landlord portal shell', () => {
  const tabbar = source('src/tabbar/config.ts')
  const uno = source('uno.config.ts')
  const mapPage = source('src/pages/user/map/index.vue')
  const roomPage = source('src/pages/admin/sales-control/index.vue')
  const promotionPage = source('src/pages/admin/dashboard/index.vue')
  const minePage = source('src/pages/admin/mine/index.vue')
  const routes = source('src/router/interceptor.ts')

  it('renders the dedicated map preview, community info, promotion, and mine tabs only in landlord mode', () => {
    expect(tabbar).toContain('text: \'地图预览\'')
    expect(tabbar).toContain('text: \'楼盘信息\'')
    expect(tabbar).toContain('text: \'推广\'')
    expect(tabbar).toContain('landlordTabbarList: CustomTabBarItem[] = [LANDLORD_MAP_TAB, ROOM_STATE_TAB, PROMOTION_TAB, MINE_TAB]')
    expect(tabbar).toContain('icon: \'i-carbon-building-insights-1\'')
    expect(tabbar).toContain('icon: \'i-carbon-bullhorn\'')
    expect(uno).toContain('\'i-carbon-building-insights-1\'')
    expect(uno).toContain('\'i-carbon-bullhorn\'')
    expect(mapPage.match(/<map\b/g)).toHaveLength(1)
    expect(mapPage).toContain('const mapId = \'property-map\'')
    expect(mapPage).toContain(':markers="activeMarkers"')
    expect(roomPage).toContain('<source-contact-room-state v-if="isLandlordView"')
    expect(promotionPage).toContain('<source-contact-promotion v-if="isLandlordView"')
    expect(minePage).toContain('主维护人')
    expect(minePage).toContain('切换到业务员端')
  })

  it('allows restricted maintainers into shared management pages without exposing administrator-only routes', () => {
    expect(routes).toContain('\'/pages/admin/landlord-profile-manage/index\'')
    expect(routes).toContain('\'/pages/common/region-manage/index\'')
    expect(routes).toContain('\'/pages/common/property-form/index\'')
    expect(routes).toContain('if (!auth.canEnterAdmin && !auth.canEnterLandlordPortal)')
    expect(routes).toContain('if (!auth.isAdmin)')
  })

  it('hides dictionary actions from maintainer workbench while keeping supply management entries', () => {
    expect(promotionPage).toContain('{ label: \'销控表\'')
    expect(promotionPage).toContain('{ label: \'楼盘管理\'')
    expect(promotionPage).toContain('if (auth.isAdmin)')
    expect(promotionPage).toContain('{ label: \'区域管理\'')
    expect(promotionPage).toContain('{ label: \'标签管理\'')
  })
})

describe('landlord portal behavior', () => {
  const api = source('src/api/source-contact-portal.ts')
  const landlordApi = source('src/api/landlord.ts')
  const mapPage = source('src/pages/user/map/index.vue')
  const rooms = source('src/components/source-contact-room-state/source-contact-room-state.vue')
  const promotion = source('src/components/source-contact-promotion/source-contact-promotion.vue')
  const management = source('src/pages/admin/landlord-profile-manage/index.vue')

  it('uses the landlord-scoped backend contract', () => {
    expect(api).toContain('/api/slLandlordPortal/profile')
    expect(api).toContain('/api/slLandlordPortal/communityList')
    expect(api).toContain('/api/slLandlordPortal/saveCommunityConfig')
    expect(api).toContain('/api/slLandlordPortal/savePropertyConfig')
    expect(api).toContain('/api/slLandlordPortal/batchSaveCommission')
    expect(api).toContain('/api/slLandlordPortal/savePromotion')
  })

  it('does not turn missing coordinates into a marker at zero longitude and latitude', () => {
    expect(mapPage).toContain('item.lat === null || item.lat === undefined')
    expect(mapPage).toContain('item.lng === null || item.lng === undefined')
    expect(mapPage).toContain('(latitude !== 0 || longitude !== 0)')
    expect(mapPage).toContain('名下楼盘尚未设置坐标')
  })

  it('reuses the original property map for landlord markers and overlays', () => {
    expect(mapPage.match(/<map\b/g)).toHaveLength(1)
    expect(mapPage).toContain('mapContext = uni.createMapContext(mapId)')
    expect(mapPage).toContain('const activeMarkers = computed(() => isLandlordView.value ? landlordMarkers.value : markers.value)')
    expect(mapPage).toContain('<template v-if="isLandlordView">')
    expect(mapPage).not.toContain('source-contact-map')
  })

  it('keeps the map page fixed while preserving gestures inside the native map', () => {
    expect(mapPage).toContain('disableScroll: true')
    expect(mapPage).not.toContain('enablePullDownRefresh: true')
  })

  it('keeps landlord share dynamics inside the selected community scope', () => {
    expect(mapPage).toContain('getCommunityTickers(hasLandlordShare.value ? landlordShare.shareToken.value : undefined)')
    expect(mapPage).toContain('await loadCommunityTickerData()')
    expect(source('src/api/community.ts')).toContain('landlordShareToken')
  })

  it('clears the persisted landlord share context when switching to another portal', () => {
    const mode = source('src/store/mode.ts')
    const share = source('src/store/landlord-share.ts')
    expect(mode).toContain('export function onModeChange')
    expect(mode).toContain('listener(next, previous)')
    expect(share).toContain('onModeChange((next) =>')
    expect(share).toContain('if (next !== \'user\')')
    expect(share).toContain('modeStore.mode === \'user\' && !!shareToken.value')
  })

  it('supports property status edits, inherited operation values, and explicit batch overwrite', () => {
    expect(rooms).toContain('PROPERTY_STATUS_OPTIONS')
    expect(rooms).toContain('effectiveManagementFee')
    expect(rooms).toContain('全选本栋')
    expect(rooms).toContain('本次将覆盖已选择')
    expect(rooms).toContain('sourceContact.invalidate()')
    expect(rooms).not.toContain('<wd-popup')
    expect(rooms).toContain('buildingTotalFloors=${')
  })

  it('keeps community fees at the community list level and uses shared commission sliders', () => {
    const region = source('src/pages/common/region-manage/index.vue')
    const commission = source('src/components/sl-commission-settings/sl-commission-settings.vue')
    expect(rooms).toContain('设置费用')
    expect(rooms).toContain('openCommunityConfig(item)')
    expect(rooms).not.toContain('楼盘费用设置')
    expect(rooms).toContain('<sl-commission-settings')
    expect(source('src/pages/common/property-form/index.vue')).toContain('<sl-commission-settings')
    expect(source('src/components/sl-property-batch/sl-property-batch.vue')).toContain('<sl-commission-settings')
    expect(promotion).toContain('<sl-commission-settings v-model="draft.monthlyPaymentRange"')
    expect(promotion).not.toContain('<wd-slider v-model="draft.monthlyPaymentRange"')
    expect(commission).toContain(':max="COMMISSION_PERCENT_MAX"')
    expect(commission).toContain('半年佣金')
    expect(commission).toContain('一年佣金')
    expect(region).toContain('saveRegionBoundary')
    expect(region).toContain('@tap="onMapTap"')
    expect(region).toContain('startEditBoundary(item)')
    expect(region).toContain('saveEditBoundary')
  })

  it('renders large landlord community collections in bounded batches', () => {
    expect(rooms).toContain('const COMMUNITY_RENDER_BATCH = 20')
    expect(rooms).toContain('sourceContact.communities.slice(start, start + COMMUNITY_RENDER_BATCH)')
    expect(rooms).toContain('@scrolltolower="changeCommunityPage(communityPage + 1)"')
    expect(rooms).toContain('{{ communityPage }} / {{ communityPageCount }}')
    expect(promotion).toContain('const COMMUNITY_RENDER_BATCH = 20')
    expect(promotion).toContain('sourceContact.communities.slice(start, start + COMMUNITY_RENDER_BATCH)')
    expect(promotion).toContain('@scrolltolower="changeCommunityPage(communityPage + 1)"')
    expect(promotion).toContain('{{ communityPage }} / {{ communityPageCount }}')
  })

  it('supports only the confirmed special promotion conditions for single and batch editing', () => {
    expect(promotion).toContain('特殊条件推广')
    expect(promotion).toContain('首页推广')
    expect(promotion).toContain('暂未开通')
    expect(promotion).toContain('可短租')
    expect(promotion).toContain('可日租')
    expect(promotion).toContain('可押一付一')
    expect(promotion).not.toContain('可月租')
    expect(promotion).not.toContain('零押金')
    expect(promotion).toContain('全选已加载')
    expect(promotion).toContain('统一覆盖已选')
    expect(promotion).toContain('<view class="promotion-page" :style="safeTop">')
    expect(promotion).not.toContain('<wd-popup')
  })

  it('lets super administrators manage landlords, maintainers, primary contact display, and community assignment', () => {
    expect(management).toContain('仅超级管理员可管理房东端')
    expect(management).toContain('function goBack()')
    expect(management).toContain('class="head__back"')
    expect(management).toContain('name="arrow-left"')
    expect(management).toContain('设为主维护人')
    expect(management).toContain('主维护人')
    expect(management).toContain('保存楼盘归属')
    expect(management).toContain('const ASSIGNMENT_PAGE_SIZE = 20')
    expect(management).toContain('assignmentChanges')
    expect(management).toContain('{{ assignmentPage }} / {{ assignmentPageCount }}')
    expect(management).toContain('pageSize: ASSIGNMENT_PAGE_SIZE')
    expect(landlordApi).toContain('/api/slLandlordManage/setMaintainers')
    expect(landlordApi).toContain('/api/slLandlordManage/setContactDisplay')
    expect(landlordApi).toContain('/api/slLandlordManage/batchAssignCommunities')
  })

  it('supports an optional rejection reason in the application review sheet', () => {
    const detail = source('src/pages/admin/application-detail/index.vue')
    expect(detail).toContain('rejectReason')
    expect(detail).toContain('submitReject')
    expect(detail).toContain('拒绝原因可选')
    expect(detail).toContain('rejectUser({ applicationId: detail.value.applicationId, rejectReason: reason || undefined })')
  })
})

describe('landlord portal terminology', () => {
  it('uses landlord and business-side terms without deprecated portal labels', () => {
    const content = [
      source('src/components/sl-source-contact-header/sl-source-contact-header.vue'),
      source('src/pages/user/map/index.vue'),
      source('src/components/source-contact-room-state/source-contact-room-state.vue'),
      source('src/components/source-contact-promotion/source-contact-promotion.vue'),
      source('src/pages/landlord/account/index.vue'),
      source('src/pages/admin/mine/index.vue'),
    ].join('\n')

    expect(content).toContain('房东')
    expect(content).toContain('业务员端')
    expect(content).not.toContain('盘源对接人端')
    expect(content).not.toContain('用户端')
    expect(content).not.toContain('系统维护人')
    expect(content).not.toContain('二房东')
  })
})
