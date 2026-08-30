<script setup lang="ts">
import type { ShenLeId, SlPromotionPropertyOutput, SlSourceContactCommunityOutput } from '@/types/shenle'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { getPromotionPropertyPage, savePromotion } from '@/api/source-contact-portal'
import SlCommissionSettings from '@/components/sl-commission-settings/sl-commission-settings.vue'
import { useSourceContactStore } from '@/store/source-contact'
import { COMMISSION_PERCENT_MAX, formatCommissionRange } from '@/utils/commission'
import { useSafeTopStyle } from '@/utils/safe-area'

type Screen = 'home' | 'communities' | 'properties' | 'editor'

const PAGE_SIZE = 30
const COMMUNITY_RENDER_BATCH = 20
const safeTop = useSafeTopStyle()
const sourceContact = useSourceContactStore()
const screen = ref<Screen>('home')
const selectedCommunity = ref<SlSourceContactCommunityOutput | null>(null)
const items = ref<SlPromotionPropertyOutput[]>([])
const activeItem = ref<SlPromotionPropertyOutput | null>(null)
const selectedIds = ref<ShenLeId[]>([])
const selecting = ref(false)
const keyword = ref('')
const promotionOnly = ref(false)
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const communityPage = ref(1)
const communityScrollTop = ref(0)

const draft = reactive({
  supportsShortRent: false,
  minimumShortRentMonths: '',
  shortRentCanMarkup: false,
  supportsDailyRent: false,
  dailyRentCommissionAmount: '',
  dailyRentCommissionPercent: '',
  dailyRentPrice: '',
  supportsMonthlyPayment: false,
  monthlyPaymentRange: [0, 0] as number[],
})

const title = computed(() => {
  if (screen.value === 'home')
    return '推广'
  if (screen.value === 'communities')
    return '特殊条件推广'
  if (screen.value === 'properties')
    return selectedCommunity.value?.name || '房源'
  return activeItem.value ? (activeItem.value.roomNo || activeItem.value.title) : `批量设置 ${selectedIds.value.length} 套`
})

const subtitle = computed(() => {
  if (screen.value === 'home')
    return ''
  if (screen.value === 'communities')
    return '选择楼盘后设置房源推广条件'
  if (screen.value === 'properties')
    return `${total.value} 套房源`
  return '设置短租、日租和押一付一条件'
})

const finished = computed(() => total.value > 0 && items.value.length >= total.value)
const selectedAll = computed(() => items.value.length > 0 && items.value.every(item => isSelected(item.propertyId)))
const enabledCount = computed(() => [draft.supportsShortRent, draft.supportsDailyRent, draft.supportsMonthlyPayment].filter(Boolean).length)
const communityPageCount = computed(() => Math.max(1, Math.ceil(sourceContact.communities.length / COMMUNITY_RENDER_BATCH)))
const visibleCommunities = computed(() => {
  const start = (communityPage.value - 1) * COMMUNITY_RENDER_BATCH
  return sourceContact.communities.slice(start, start + COMMUNITY_RENDER_BATCH)
})

function sameId(left?: ShenLeId | null, right?: ShenLeId | null) {
  return left !== undefined && left !== null && right !== undefined && right !== null && String(left) === String(right)
}

function isSelected(id: ShenLeId) {
  return selectedIds.value.some(item => sameId(item, id))
}

function money(value?: number | null, unit = '元') {
  return value === null || value === undefined ? '未设置' : `${value}${unit}`
}

function rentRange(item: SlSourceContactCommunityOutput) {
  const min = Number(item.minRentPrice || 0)
  const max = Number(item.maxRentPrice || 0)
  if (min > 0 && max > 0 && min !== max)
    return `¥${min}-${max}/月`
  if (min > 0)
    return `¥${min}/月起`
  return '租金未设置'
}

function networkFeeText(item: SlSourceContactCommunityOutput) {
  if (item.networkFeeMode === 2)
    return '自理'
  return item.networkFee === null || item.networkFee === undefined ? '未设置' : `${item.networkFee}元/月`
}

function callContact(item: SlSourceContactCommunityOutput) {
  if (!item.contactPhone) {
    uni.showToast({ title: '该楼盘未设置联系电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: item.contactPhone })
}

function navigateToCommunity(item: SlSourceContactCommunityOutput) {
  const latitude = Number(item.lat)
  const longitude = Number(item.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
    uni.showToast({ title: '该楼盘未设置有效位置', icon: 'none' })
    return
  }
  uni.openLocation({ latitude, longitude, name: item.name, address: item.address || item.name, scale: 16 })
}

function enterSpecialPromotion() {
  communityPage.value = 1
  screen.value = 'communities'
  void sourceContact.load()
}

async function changeCommunityPage(nextPage: number) {
  const normalizedPage = Math.min(Math.max(1, nextPage), communityPageCount.value)
  if (normalizedPage === communityPage.value)
    return
  communityPage.value = normalizedPage
  communityScrollTop.value = 1
  await nextTick()
  communityScrollTop.value = 0
}

function showHomepageUnavailable() {
  uni.showToast({ title: '首页推广暂未开通', icon: 'none' })
}

async function openCommunity(item: SlSourceContactCommunityOutput) {
  selectedCommunity.value = item
  keyword.value = ''
  promotionOnly.value = false
  selecting.value = false
  selectedIds.value = []
  screen.value = 'properties'
  await loadProperties(true)
}

async function loadProperties(reset = false) {
  if (!selectedCommunity.value || loading.value)
    return
  if (reset) {
    page.value = 1
    items.value = []
    total.value = 0
  }
  else if (finished.value) {
    return
  }

  loading.value = true
  try {
    const result = await getPromotionPropertyPage({
      page: page.value,
      pageSize: PAGE_SIZE,
      communityId: selectedCommunity.value.id,
      keyword: keyword.value.trim() || undefined,
      promotionOnly: promotionOnly.value,
    })
    total.value = result.total
    items.value = reset ? result.items : [...items.value, ...result.items]
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function loadMore() {
  if (loading.value || finished.value)
    return
  page.value += 1
  void loadProperties()
}

function togglePromotionOnly() {
  promotionOnly.value = !promotionOnly.value
  void loadProperties(true)
}

function toggleSelectMode() {
  selecting.value = !selecting.value
  selectedIds.value = []
}

function toggleItem(id: ShenLeId) {
  selectedIds.value = isSelected(id)
    ? selectedIds.value.filter(item => !sameId(item, id))
    : [...selectedIds.value, id]
}

function toggleAll() {
  selectedIds.value = selectedAll.value ? [] : items.value.map(item => item.propertyId)
}

function conditionLabels(item: SlPromotionPropertyOutput) {
  const labels: string[] = []
  if (item.supportsShortRent)
    labels.push('可短租')
  if (item.supportsDailyRent)
    labels.push('可日租')
  if (item.supportsMonthlyPayment)
    labels.push('可押一付一')
  return labels
}

function resetDraft(item?: SlPromotionPropertyOutput | null) {
  draft.supportsShortRent = !!item?.supportsShortRent
  draft.minimumShortRentMonths = item?.minimumShortRentMonths?.toString() || ''
  draft.shortRentCanMarkup = !!item?.shortRentCanMarkup
  draft.supportsDailyRent = !!item?.supportsDailyRent
  draft.dailyRentCommissionAmount = item?.dailyRentCommissionAmount?.toString() || ''
  draft.dailyRentCommissionPercent = item?.dailyRentCommissionPercent?.toString() || ''
  draft.dailyRentPrice = item?.dailyRentPrice?.toString() || ''
  draft.supportsMonthlyPayment = !!item?.supportsMonthlyPayment
  draft.monthlyPaymentRange = [
    Number(item?.monthlyPaymentHalfYearCommissionPercent || 0),
    Number(item?.monthlyPaymentOneYearCommissionPercent || 0),
  ]
}

function openProperty(item: SlPromotionPropertyOutput) {
  if (selecting.value) {
    toggleItem(item.propertyId)
    return
  }
  activeItem.value = item
  resetDraft(item)
  screen.value = 'editor'
}

function openBatchEditor() {
  if (!selectedIds.value.length) {
    uni.showToast({ title: '请先选择房源', icon: 'none' })
    return
  }
  activeItem.value = null
  resetDraft(null)
  screen.value = 'editor'
}

function toRequiredNumber(value: string, label: string, minimum: number, maximum?: number) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < minimum || (maximum !== undefined && number > maximum)) {
    const range = maximum === undefined ? `不少于${minimum}` : `${minimum}-${maximum}`
    throw new Error(`${label}必须为${range}`)
  }
  return number
}

function buildSaveInput() {
  const shortMonths = draft.supportsShortRent ? toRequiredNumber(draft.minimumShortRentMonths, '最低短租月份', 1, 12) : null
  const dailyAmount = draft.supportsDailyRent ? toRequiredNumber(draft.dailyRentCommissionAmount, '日租佣金条件', 1) : null
  const dailyPercent = draft.supportsDailyRent ? toRequiredNumber(draft.dailyRentCommissionPercent, '日租佣金比例', 0, COMMISSION_PERCENT_MAX) : null
  const dailyPrice = draft.supportsDailyRent ? toRequiredNumber(draft.dailyRentPrice, '日租单价', 1) : null
  const monthlyHalf = draft.supportsMonthlyPayment ? Number(draft.monthlyPaymentRange[0] || 0) : null
  const monthlyYear = draft.supportsMonthlyPayment ? Number(draft.monthlyPaymentRange[1] || 0) : null

  return {
    supportsMonthlyRent: false,
    supportsShortRent: draft.supportsShortRent,
    minimumShortRentMonths: shortMonths,
    shortRentCanMarkup: draft.supportsShortRent ? draft.shortRentCanMarkup : false,
    supportsDailyRent: draft.supportsDailyRent,
    dailyRentCommissionAmount: dailyAmount,
    dailyRentCommissionPercent: dailyPercent,
    dailyRentPrice: dailyPrice,
    supportsMonthlyPayment: draft.supportsMonthlyPayment,
    monthlyPaymentHalfYearCommissionPercent: monthlyHalf,
    monthlyPaymentOneYearCommissionPercent: monthlyYear,
    supportsZeroDeposit: false,
  }
}

async function submitPromotion() {
  const propertyIds = activeItem.value ? [activeItem.value.propertyId] : selectedIds.value
  if (!propertyIds.length || saving.value)
    return
  try {
    const values = buildSaveInput()
    saving.value = true
    await savePromotion({ propertyIds, ...values })
    uni.showToast({ title: activeItem.value ? '推广条件已保存' : `已更新${propertyIds.length}套房源`, icon: 'success' })
    screen.value = 'properties'
    activeItem.value = null
    selecting.value = false
    selectedIds.value = []
    await loadProperties(true)
    sourceContact.invalidate()
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

function goBack() {
  if (screen.value === 'editor') {
    screen.value = 'properties'
    activeItem.value = null
    return
  }
  if (screen.value === 'properties') {
    screen.value = 'communities'
    selectedCommunity.value = null
    items.value = []
    selectedIds.value = []
    selecting.value = false
    return
  }
  if (screen.value === 'communities')
    screen.value = 'home'
}

async function refresh() {
  if (screen.value === 'properties') {
    await loadProperties(true)
  }
  else {
    communityPage.value = 1
    await sourceContact.load(true)
  }
  uni.stopPullDownRefresh()
}

async function activate() {
  await sourceContact.load()
}

onMounted(() => sourceContact.load())

defineExpose({ refresh, activate })
</script>

<template>
  <view class="promotion-page" :style="safeTop">
    <sl-source-contact-header :title="title" :subtitle="subtitle" :back="screen !== 'home'" @back="goBack" />

    <scroll-view v-if="screen === 'home'" scroll-y class="content-scroll">
      <view class="entry-list">
        <view class="entry-card entry-card--active" @tap="enterSpecialPromotion">
          <view class="entry-card__icon">
            <wd-icon name="discount" size="24px" color="#126b4f" />
          </view>
          <view class="entry-card__body">
            <text class="entry-card__title">特殊条件推广</text>
          </view>
          <wd-icon name="arrow-right" size="20px" color="#72817b" />
        </view>

        <view class="entry-card entry-card--disabled" @tap="showHomepageUnavailable">
          <view class="entry-card__icon entry-card__icon--muted">
            <wd-icon name="home" size="24px" color="#89968f" />
          </view>
          <view class="entry-card__body">
            <text class="entry-card__title">首页推广</text>
            <text class="entry-card__status">暂未开通</text>
          </view>
          <wd-icon name="arrow-right" size="20px" color="#aab2ae" />
        </view>
      </view>
    </scroll-view>

    <scroll-view v-else-if="screen === 'communities'" :scroll-top="communityScrollTop" scroll-y class="content-scroll" @scrolltolower="changeCommunityPage(communityPage + 1)">
      <view v-if="sourceContact.loading && !sourceContact.communities.length" class="empty-state">
        <wd-loading color="#126b4f" />
        <text>正在加载楼盘</text>
      </view>
      <view v-else-if="!sourceContact.communities.length" class="empty-state">
        <wd-icon name="home" size="34px" color="#8fa098" />
        <text>暂无可管理楼盘</text>
      </view>
      <view v-else class="community-list">
        <view v-for="item in visibleCommunities" :key="String(item.id)" class="community-card" @tap="openCommunity(item)">
          <view class="community-card__head">
            <view class="community-card__title-wrap">
              <text class="community-card__name">{{ item.name }}</text>
              <text class="community-card__rent">{{ rentRange(item) }}</text>
            </view>
            <wd-icon name="arrow-right" size="19px" color="#7e8d85" />
          </view>
          <view class="community-card__stats">
            <text>{{ item.buildingCount }} 栋</text><text>{{ item.propertyCount }} 套</text><text>{{ item.availableCount }} 套可用</text><text>{{ item.rentedCount }} 套已租</text>
          </view>
          <view class="fee-grid">
            <view class="fee-grid__item">
              <text>水费</text><text class="fee-grid__value">{{ money(item.waterFee, '元/吨') }}</text>
            </view>
            <view class="fee-grid__item">
              <text>电费</text><text class="fee-grid__value">{{ money(item.electricityFee, '元/度') }}</text>
            </view>
            <view class="fee-grid__item">
              <text>管理费</text><text class="fee-grid__value">{{ money(item.managementFee, '元/月') }}</text>
            </view>
            <view class="fee-grid__item">
              <text>网络费</text><text class="fee-grid__value">{{ networkFeeText(item) }}</text>
            </view>
            <view class="fee-grid__item fee-grid__item--wide">
              <text>佣金条件</text><text class="fee-grid__value">半年 {{ formatCommissionRange(item.lowestHalfYearCommissionPercent, item.highestHalfYearCommissionPercent) }} · 一年 {{ formatCommissionRange(item.lowestOneYearCommissionPercent, item.highestOneYearCommissionPercent) }}</text>
            </view>
          </view>
          <view class="community-card__foot" @tap.stop>
            <view v-if="item.contactName || item.contactPhone" class="contact-line" @tap="callContact(item)">
              <wd-icon name="call" size="15px" color="#126b4f" /><text>{{ item.contactName || '联系人' }}</text><text v-if="item.contactPhone">{{ item.contactPhone }}</text>
            </view>
            <view class="nav-action" @tap="navigateToCommunity(item)">
              <wd-icon name="location" size="16px" color="#126b4f" /><text>导航</text>
            </view>
          </view>
        </view>
        <view class="community-pager">
          <view class="community-pager__action" :class="{ 'community-pager__action--disabled': communityPage <= 1 }" @tap="changeCommunityPage(communityPage - 1)">
            上一页
          </view>
          <text>{{ communityPage }} / {{ communityPageCount }}</text>
          <view class="community-pager__action" :class="{ 'community-pager__action--disabled': communityPage >= communityPageCount }" @tap="changeCommunityPage(communityPage + 1)">
            下一页
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-else-if="screen === 'properties'" class="properties-page">
      <view class="property-toolbar">
        <view class="property-search">
          <wd-icon name="search" size="17px" color="#8b9791" />
          <input v-model="keyword" class="property-search__input" placeholder="搜索房号或标题" confirm-type="search" @confirm="loadProperties(true)">
        </view>
        <view class="property-toolbar__row">
          <view class="toggle-filter" :class="{ active: promotionOnly }" @tap="togglePromotionOnly">
            仅看已设置
          </view>
          <view v-if="selecting" class="select-all" @tap="toggleAll">
            <view class="check-box" :class="{ active: selectedAll }">
              <wd-icon v-if="selectedAll" name="check" size="14px" color="#fff" />
            </view>
            <text>全选已加载</text>
          </view>
          <wd-button size="small" :plain="!selecting" @click="toggleSelectMode">
            {{ selecting ? '取消选择' : '批量设置' }}
          </wd-button>
        </view>
      </view>

      <scroll-view scroll-y class="content-scroll" @scrolltolower="loadMore">
        <view v-if="loading && !items.length" class="empty-state">
          <wd-loading color="#126b4f" /><text>正在加载房源</text>
        </view>
        <view v-else-if="!items.length" class="empty-state">
          <wd-icon name="view-list" size="34px" color="#8fa098" /><text>暂无符合条件的房源</text>
        </view>
        <view v-else class="property-list">
          <view v-for="item in items" :key="String(item.propertyId)" class="property-row" :class="{ 'property-row--selected': isSelected(item.propertyId) }" @tap="openProperty(item)">
            <view v-if="selecting" class="check-box" :class="{ active: isSelected(item.propertyId) }">
              <wd-icon v-if="isSelected(item.propertyId)" name="check" size="14px" color="#fff" />
            </view>
            <view class="property-row__body">
              <view class="property-row__head">
                <text class="property-row__name">{{ item.roomNo || item.title }}</text><text class="property-row__price">¥{{ item.rentPrice }}/月</text>
              </view>
              <text class="property-row__meta">{{ item.buildingName }} · {{ item.statusName }}</text>
              <view v-if="conditionLabels(item).length" class="condition-list">
                <text v-for="label in conditionLabels(item)" :key="label" class="condition-tag">{{ label }}</text>
              </view>
              <text v-else class="property-row__empty">未设置特殊条件</text>
            </view>
            <wd-icon v-if="!selecting" name="arrow-right" size="18px" color="#8fa098" />
          </view>
          <view v-if="loading" class="load-tip">
            加载中...
          </view>
          <view v-else-if="finished" class="load-tip">
            已经到底了
          </view>
        </view>
      </scroll-view>

      <view v-if="selecting" class="selection-footer">
        <text class="selection-footer__count">已选择 {{ selectedIds.length }} 套</text><wd-button type="primary" size="small" :disabled="!selectedIds.length" @click="openBatchEditor">
          设置推广条件
        </wd-button>
      </view>
    </view>

    <view v-else class="editor-page">
      <scroll-view scroll-y class="content-scroll">
        <view v-if="!activeItem" class="batch-notice">
          本次会统一覆盖已选 {{ selectedIds.length }} 套房源的特殊推广条件。
        </view>

        <view class="form-section">
          <view class="form-section__head">
            <text class="form-section__title">可短租</text><wd-switch v-model="draft.supportsShortRent" size="22px" />
          </view>
          <template v-if="draft.supportsShortRent">
            <label class="form-field"><text>最低短租月份</text><view class="form-field__input"><input v-model="draft.minimumShortRentMonths" class="form-field__control" type="number" placeholder="1-12"><text class="form-field__unit">个月</text></view></label>
            <view class="fixed-rule">
              默认按比例结算佣金
            </view>
            <view class="switch-row">
              <text>可加价</text><wd-switch v-model="draft.shortRentCanMarkup" size="22px" />
            </view>
            <text v-if="draft.shortRentCanMarkup" class="rule-tip">请电话沟通具体加价规则</text>
          </template>
        </view>

        <view class="form-section">
          <view class="form-section__head">
            <text class="form-section__title">可日租</text><wd-switch v-model="draft.supportsDailyRent" size="22px" />
          </view>
          <template v-if="draft.supportsDailyRent">
            <label class="form-field"><text>佣金条件</text><view class="form-field__input"><input v-model="draft.dailyRentCommissionAmount" class="form-field__control" type="digit" placeholder="不少于1"><text class="form-field__unit">元</text></view></label>
            <label class="form-field"><text>佣金比例</text><view class="form-field__input"><input v-model="draft.dailyRentCommissionPercent" class="form-field__control" type="digit" placeholder="0-300"><text class="form-field__unit">%</text></view></label>
            <label class="form-field"><text>日租单价</text><view class="form-field__input"><input v-model="draft.dailyRentPrice" class="form-field__control" type="digit" placeholder="不少于1"><text class="form-field__unit">元/天</text></view></label>
          </template>
        </view>

        <view class="form-section">
          <view class="form-section__head">
            <text class="form-section__title">可押一付一</text><wd-switch v-model="draft.supportsMonthlyPayment" size="22px" />
          </view>
          <template v-if="draft.supportsMonthlyPayment">
            <sl-commission-settings v-model="draft.monthlyPaymentRange" class="monthly-payment-commission" />
          </template>
        </view>

        <view class="enabled-summary">
          已启用 {{ enabledCount }} 项特殊条件
        </view>
      </scroll-view>
      <view class="editor-footer">
        <wd-button block type="primary" :loading="saving" @click="submitPromotion">
          保存推广条件
        </wd-button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.promotion-page {
  display: flex;
  width: 100%;
  height: 100vh;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  padding-right: 22rpx;
  padding-bottom: calc(126rpx + env(safe-area-inset-bottom));
  padding-left: 22rpx;
}
.content-scroll {
  min-height: 0;
  flex: 1;
}
.entry-list,
.community-list,
.property-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 16rpx 0 28rpx;
}
.entry-card,
.community-card,
.property-row,
.form-section,
.batch-notice {
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 8rpx;
  background: #fff;
}
.entry-card {
  display: flex;
  min-height: 122rpx;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx;
}
.entry-card--disabled {
  background: #f7f8f7;
}
.entry-card__icon {
  display: flex;
  width: 70rpx;
  height: 70rpx;
  flex: 0 0 70rpx;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background: #ecf5ee;
}
.entry-card__icon--muted {
  background: #ecefed;
}
.entry-card__body {
  min-width: 0;
  flex: 1;
}
.entry-card__title {
  display: block;
  font-size: 30rpx;
  font-weight: 850;
}
.entry-card__status {
  display: block;
  margin-top: 8rpx;
  color: #89968f;
  font-size: 23rpx;
}
.community-card {
  padding: 22rpx;
}
.community-card__head,
.property-row__head,
.form-section__head,
.switch-row,
.community-card__foot,
.property-toolbar__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}
.community-card__title-wrap,
.property-row__body {
  min-width: 0;
  flex: 1;
}
.community-card__name,
.property-row__name,
.form-section__title {
  display: block;
  overflow: hidden;
  font-size: 29rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.community-card__rent {
  display: block;
  margin-top: 7rpx;
  color: #b96418;
  font-size: 23rpx;
  font-weight: 780;
}
.community-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 18rpx;
  margin-top: 16rpx;
  color: #66756e;
  font-size: 22rpx;
}
.fee-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 18rpx;
}
.fee-grid__item {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
  padding: 12rpx 14rpx;
  border-radius: 7rpx;
  background: #f3f7f1;
  color: #65736c;
  font-size: 21rpx;
}

.fee-grid__item--wide {
  grid-column: 1 / -1;
}

.fee-grid__item--wide .fee-grid__value {
  flex: 1;
  line-height: 1.45;
  text-align: right;
  white-space: normal;
}
.fee-grid__value {
  min-width: 0;
  overflow: hidden;
  color: #26362f;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.community-card__foot {
  min-height: 58rpx;
  margin-top: 18rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #edf1ee;
}
.contact-line,
.nav-action {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7rpx;
  color: #126b4f;
  font-size: 22rpx;
  font-weight: 760;
}
.contact-line {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nav-action {
  min-width: 96rpx;
  min-height: 48rpx;
  flex: 0 0 auto;
  justify-content: center;
  border: 1rpx solid rgb(18 107 79 / 18%);
  border-radius: 7rpx;
  background: #f4f8f5;
}
.community-pager {
  display: flex;
  min-height: 82rpx;
  align-items: center;
  justify-content: center;
  color: #8a9791;
  font-size: 21rpx;
  gap: 22rpx;
}
.community-pager__action {
  display: flex;
  min-width: 112rpx;
  min-height: 52rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #dce5df;
  border-radius: 7rpx;
  background: #fff;
  color: #126b4f;
  font-weight: 700;
}
.community-pager__action--disabled {
  color: #a9b2ad;
  background: #f4f6f4;
}
.properties-page,
.editor-page {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}
.property-toolbar {
  flex: 0 0 auto;
  padding: 14rpx 0 8rpx;
}
.property-search {
  display: flex;
  min-height: 68rpx;
  align-items: center;
  gap: 12rpx;
  padding: 0 18rpx;
  border: 1rpx solid #dce5df;
  border-radius: 8rpx;
  background: #fff;
}
.property-search__input {
  min-width: 0;
  flex: 1;
  font-size: 25rpx;
}
.property-toolbar__row {
  margin-top: 12rpx;
}
.toggle-filter,
.select-all {
  display: flex;
  min-height: 54rpx;
  align-items: center;
  gap: 8rpx;
  color: #596961;
  font-size: 22rpx;
}
.toggle-filter {
  padding: 0 16rpx;
  border: 1rpx solid #dce5df;
  border-radius: 7rpx;
  background: #fff;
}
.toggle-filter.active {
  border-color: rgb(18 107 79 / 28%);
  background: #ecf5ee;
  color: #126b4f;
  font-weight: 800;
}
.property-row {
  display: flex;
  min-height: 128rpx;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;
}
.property-row--selected {
  border-color: rgb(18 107 79 / 35%);
  background: #f3f8f4;
}
.property-row__price {
  flex: 0 0 auto;
  color: #b96418;
  font-size: 23rpx;
  font-weight: 820;
}
.property-row__meta,
.property-row__empty {
  display: block;
  margin-top: 7rpx;
  color: #718078;
  font-size: 21rpx;
}
.condition-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 10rpx;
}
.condition-tag {
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
  background: #ecf5ee;
  color: #126b4f;
  font-size: 19rpx;
  font-weight: 760;
}
.check-box {
  display: flex;
  width: 38rpx;
  height: 38rpx;
  flex: 0 0 38rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #b8c4be;
  border-radius: 7rpx;
  background: #fff;
}
.check-box.active {
  border-color: #126b4f;
  background: #126b4f;
}
.selection-footer,
.editor-footer {
  display: flex;
  min-height: 92rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid #e4ebe6;
  background: #f7faf4;
}
.selection-footer__count {
  color: #42534a;
  font-size: 24rpx;
  font-weight: 760;
}
.form-section,
.batch-notice {
  margin-top: 16rpx;
  padding: 22rpx;
}
.batch-notice,
.fixed-rule,
.rule-tip,
.enabled-summary {
  color: #5f6f67;
  font-size: 22rpx;
  line-height: 1.6;
}
.fixed-rule,
.rule-tip {
  margin-top: 14rpx;
  padding: 12rpx 14rpx;
  border-radius: 7rpx;
  background: #f3f7f1;
}
.rule-tip {
  color: #a75c1a;
  background: #fff7e8;
}
.form-field {
  display: block;
  margin-top: 18rpx;
  color: #4e5e56;
  font-size: 23rpx;
}
.form-field__input {
  display: flex;
  min-height: 70rpx;
  align-items: center;
  gap: 10rpx;
  margin-top: 9rpx;
  padding: 0 16rpx;
  border: 1rpx solid #dce5df;
  border-radius: 8rpx;
  background: #f9fbf9;
}
.form-field__control {
  min-width: 0;
  flex: 1;
  font-size: 25rpx;
}
.form-field__unit {
  flex: 0 0 auto;
  color: #728078;
  font-size: 22rpx;
}
.switch-row {
  min-height: 64rpx;
  margin-top: 16rpx;
  color: #4e5e56;
  font-size: 23rpx;
}
.monthly-payment-commission {
  display: block;
  margin-top: 18rpx;
}
.enabled-summary,
.load-tip,
.empty-state {
  text-align: center;
}
.enabled-summary {
  padding: 24rpx 0 30rpx;
}
.load-tip {
  padding: 20rpx;
  color: #839087;
  font-size: 22rpx;
}
.empty-state {
  display: flex;
  min-height: 360rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14rpx;
  color: #7b8982;
  font-size: 24rpx;
}
</style>
