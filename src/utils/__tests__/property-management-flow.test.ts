import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('management property entry flow', () => {
  const dashboard = source('src/pages/admin/dashboard/index.vue')
  const propertyList = source('src/pages/admin/property-list/index.vue')
  const buildingManage = source('src/pages/common/building-manage/index.vue')
  const communityProperties = source('src/pages/common/community-properties/index.vue')

  it('removes dashboard property-management and publish shortcuts', () => {
    expect(dashboard).not.toContain('<text>房源管理</text>')
    expect(dashboard).not.toContain('<text>发布房源</text>')
    expect(dashboard).not.toContain("go('/pages/common/property-form/index')")
  })

  it('keeps the property tab browse-only and routes administrators through buildings', () => {
    expect(propertyList).not.toContain('function openForm()')
    expect(propertyList).not.toContain('@click="openForm"')
    expect(propertyList).toContain('/pages/common/building-manage/index?communityId=')
    expect(propertyList).toContain('/pages/common/community-properties/index?communityId=')
    expect(propertyList).toContain('canManage.value')
  })

  it('passes complete building context from building management to the scoped property page', () => {
    expect(buildingManage).toContain('buildingId=${idToQuery(item.id)}')
    expect(buildingManage).toContain('buildingName=${encodeURIComponent(item.name)}')
    expect(buildingManage).toContain('buildingTotalFloors=${')
  })

  it('filters managed properties by building and gates write entries on a concrete building', () => {
    expect(communityProperties).toContain('buildingId: buildingId.value || undefined')
    expect(communityProperties).toContain('canManagePropertyWrites({')
    expect(communityProperties).toContain('isLandlord: auth.isLandlord')
    expect(communityProperties).toContain('canManageBuildingScope')
    expect(communityProperties).toContain('新增房源')
    expect(communityProperties).toContain('批量管理')
  })
})

describe('property form ownership and media entry', () => {
  const form = source('src/pages/common/property-form/index.vue')

  it('requires building context for add while edit continues to load ownership from detail', () => {
    expect(form).toContain('请从具体楼栋进入新增房源')
    expect(form).toContain('query?.communityId')
    expect(form).toContain('query?.buildingId')
    expect(form).toContain('getPropertyDetail(editId.value)')
    expect(form).toContain('getBuildingDetail(detail.buildingId)')
    expect(form).toContain('getBuildingDetail(form.buildingId)')
    expect(form).toContain('totalFloors: toOptionalNumber(form.totalFloors)')
  })

  it('renders community, building, and total floors as read-only context', () => {
    const ownership = form.match(/<text class="form-card__title">位置归属<\/text>[\s\S]*?<\/view>\s*<view class="form-card sl-card">/)?.[0] || ''

    expect(ownership).toContain('contextCommunityName')
    expect(ownership).toContain('contextBuildingName')
    expect(ownership).toContain('contextTotalFloorsLabel')
    expect(ownership).toContain('ownership-value')
    expect(ownership).not.toContain('<picker')
    expect(ownership).not.toContain('v-model="form.totalFloors"')
  })

  it('uses one add-media tile and a wot action sheet for both media sources', () => {
    expect(form.match(/>添加媒体<\/text>/g)).toHaveLength(1)
    expect(form).toContain('<wd-action-sheet')
    expect(form).toContain('PROPERTY_MEDIA_SOURCE_ACTIONS')
    expect(form).toContain('resolvePropertyMediaSource(event.item.value)')
    expect(form).not.toContain('<view class="media-actions">')
  })
})

describe('one-click building creation', () => {
  const buildingManage = source('src/pages/common/building-manage/index.vue')
  const types = source('src/types/shenle.ts')

  it('shows the action only for a selected community with an empty building list', () => {
    expect(buildingManage).toContain('v-if="communityId && !list.length && !loading"')
    expect(buildingManage).toContain('一键创建楼栋')
    expect(buildingManage).toContain(':loading="oneClickCreating"')
  })

  it('creates a same-name default building with no floors or media', () => {
    expect(buildingManage).toContain('name: headerTitle.value')
    expect(buildingManage).toContain('totalFloors: null')
    expect(buildingManage).toContain('orderNo: 100')
    expect(buildingManage).toContain('status: 0')
    expect(buildingManage).toContain('coverImageId: null')
    expect(buildingManage).toContain('imageIds: []')
    expect(types).toMatch(/totalFloors\?: number \| null/)
  })

  it('separates successful creation from refresh failure and limits duplicate recovery to add failure', () => {
    const handler = buildingManage.match(/async function createDefaultBuilding\(\)[\s\S]*?\n\}/)?.[0] || ''
    const mutationTry = handler.match(/try \{([\s\S]*?)\}\s*catch/)?.[1] || ''

    expect(buildingManage).toContain('if (oneClickCreating.value)')
    expect(mutationTry).toContain('await addBuilding(payload)')
    expect(mutationTry).not.toContain('await loadData()')
    expect(handler).toContain('item.name === headerTitle.value')
    expect(handler).toContain('楼栋已创建，请下拉刷新')
  })
})
