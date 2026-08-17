<script setup lang="ts">
import type { ShenLeId, SlCommissionMode, SlPromotionPropertyOutput } from '@/types/shenle'
import { computed, onMounted, reactive, ref } from 'vue'
import { getPromotionPropertyPage, savePromotion } from '@/api/source-contact-portal'
import { useSourceContactStore } from '@/store/source-contact'
import { useSafeTopStyle } from '@/utils/safe-area'

const PAGE_SIZE = 20
const safeTop = useSafeTopStyle()
const sourceContact = useSourceContactStore()
const editorVisible = ref(false)
const selecting = ref(false)
const selectedIds = ref<ShenLeId[]>([])
const activeItem = ref<SlPromotionPropertyOutput | null>(null)
const items = ref<SlPromotionPropertyOutput[]>([])
const keyword = ref('')
const communityId = ref<ShenLeId | undefined>()
const promotionOnly = ref(false)
const page = ref(0)
const total = ref(0)
const loading = ref(false)
const saving = ref(false)

const promotionDraft = reactive({
  supportsMonthlyRent: false,
  supportsShortRent: false,
  supportsMonthlyPayment: false,
  supportsZeroDeposit: false,
  promotionCommissionMode: null as SlCommissionMode | null,
  promotionCommissionValue: '',
})

const commissionModes: Array<{ value: SlCommissionMode, label: string, unit: string }> = [
  { value: 1, label: '固定金额', unit: '元' },
  { value: 2, label: '租金比例', unit: '%' },
  { value: 3, label: '月租倍数', unit: '倍' },
]

const finished = computed(() => total.value > 0 && items.value.length >= total.value)
const selectedAll = computed(() => items.value.length > 0 && items.value.every(item => selectedIds.value.some(id => String(id) === String(item.propertyId))))
const enabledConditionCount = computed(() => [
  promotionDraft.supportsMonthlyRent,
  promotionDraft.supportsShortRent,
  promotionDraft.supportsMonthlyPayment,
  promotionDraft.supportsZeroDeposit,
].filter(Boolean).length)
const commissionUnit = computed(() => commissionModes.find(item => item.value === promotionDraft.promotionCommissionMode)?.unit || '')

function callSupport() {
  const phone = sourceContact.profile?.supportUserPhone
  if (!phone) {
    uni.showToast({ title: '维护人暂未设置联系电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: phone })
}

async function load(reset = false) {
  if (loading.value || (!reset && finished.value))
    return
  const nextPage = reset ? 1 : page.value + 1
  if (reset) {
    page.value = 0
    total.value = 0
    items.value = []
  }
  loading.value = true
  try {
    const result = await getPromotionPropertyPage({
      page: nextPage,
      pageSize: PAGE_SIZE,
      keyword: keyword.value.trim() || undefined,
      communityId: communityId.value,
      promotionOnly: promotionOnly.value,
    })
    page.value = nextPage
    total.value = result.total
    items.value = reset ? result.items : [...items.value, ...result.items]
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function selectCommunity(id?: ShenLeId) {
  communityId.value = id
  selectedIds.value = []
  void load(true)
}

function toggleSelectMode() {
  selecting.value = !selecting.value
  selectedIds.value = []
}

function toggleItem(id: ShenLeId) {
  const exists = selectedIds.value.some(item => String(item) === String(id))
  selectedIds.value = exists
    ? selectedIds.value.filter(item => String(item) !== String(id))
    : [...selectedIds.value, id]
}

function toggleAll() {
  selectedIds.value = selectedAll.value ? [] : items.value.map(item => item.propertyId)
}

function resetDraft(item?: SlPromotionPropertyOutput | null) {
  promotionDraft.supportsMonthlyRent = Boolean(item?.supportsMonthlyRent)
  promotionDraft.supportsShortRent = Boolean(item?.supportsShortRent)
  promotionDraft.supportsMonthlyPayment = Boolean(item?.supportsMonthlyPayment)
  promotionDraft.supportsZeroDeposit = Boolean(item?.supportsZeroDeposit)
  promotionDraft.promotionCommissionMode = item?.promotionCommissionMode || null
  promotionDraft.promotionCommissionValue = item?.promotionCommissionValue?.toString() || ''
}

function openItem(item: SlPromotionPropertyOutput) {
  if (selecting.value) {
    toggleItem(item.propertyId)
    return
  }
  activeItem.value = item
  resetDraft(item)
  editorVisible.value = true
}

function openBatchEditor() {
  if (!selectedIds.value.length) {
    uni.showToast({ title: '请先选择房源', icon: 'none' })
    return
  }
  activeItem.value = null
  resetDraft(null)
  editorVisible.value = true
}

function closeEditor() {
  if (!saving.value)
    editorVisible.value = false
}

function conditionLabels(item: SlPromotionPropertyOutput) {
  const labels: string[] = []
  if (item.supportsMonthlyRent)
    labels.push('月租')
  if (item.supportsShortRent)
    labels.push('短租')
  if (item.supportsMonthlyPayment)
    labels.push('押一付一')
  if (item.supportsZeroDeposit)
    labels.push('零押金')
  return labels
}

function commissionText(mode?: SlCommissionMode | null, value?: number | null) {
  if (!mode || !value)
    return '未设置'
  if (mode === 1)
    return `${value} 元`
  if (mode === 2)
    return `${value}% 租金`
  return `${value} 倍月租`
}

async function submitPromotion() {
  const ids = activeItem.value ? [activeItem.value.propertyId] : selectedIds.value
  if (!ids.length || saving.value)
    return
  const enabled = enabledConditionCount.value > 0
  const commissionValue = promotionDraft.promotionCommissionValue.trim()
    ? Number(promotionDraft.promotionCommissionValue)
    : null
  if (enabled && (!promotionDraft.promotionCommissionMode || !commissionValue || commissionValue <= 0)) {
    uni.showToast({ title: '启用推广条件后必须设置推广佣金', icon: 'none' })
    return
  }
  saving.value = true
  try {
    await savePromotion({
      propertyIds: ids,
      supportsMonthlyRent: promotionDraft.supportsMonthlyRent,
      supportsShortRent: promotionDraft.supportsShortRent,
      supportsMonthlyPayment: promotionDraft.supportsMonthlyPayment,
      supportsZeroDeposit: promotionDraft.supportsZeroDeposit,
      promotionCommissionMode: enabled ? promotionDraft.promotionCommissionMode : null,
      promotionCommissionValue: enabled ? commissionValue : null,
    })
    editorVisible.value = false
    selecting.value = false
    selectedIds.value = []
    sourceContact.invalidate()
    await Promise.all([sourceContact.load(true), load(true)])
    uni.showToast({ title: enabled ? '推广设置已保存' : '已关闭推广', icon: 'success' })
  }
  finally {
    saving.value = false
  }
}

async function refresh() {
  await sourceContact.load(true)
  await load(true)
}

onMounted(async () => {
  await sourceContact.load()
  await load(true)
})

defineExpose({ refresh })
</script>

<template>
  <view class="promotion-page" :style="safeTop">
    <template v-if="!editorVisible">
      <view class="promotion-head">
        <view class="promotion-head__main">
          <text class="promotion-head__title">特殊出租条件</text>
          <text class="promotion-head__subtitle">已推广 {{ sourceContact.profile?.promotedCount || 0 }} / {{ sourceContact.profile?.propertyCount || 0 }} 套</text>
        </view>
      </view>

      <view class="support-tip" @tap="callSupport">
        <wd-icon name="service" size="16px" color="#126b4f" />
        <text>{{ sourceContact.profile?.supportUserName ? `系统维护人：${sourceContact.profile.supportUserName}` : '系统维护人暂未分配' }}</text>
        <text v-if="sourceContact.profile?.supportUserPhone" class="support-tip__phone">联系</text>
      </view>

      <view class="filter-block">
        <view class="search-row">
          <wd-icon name="search" size="18px" color="#7a8780" />
          <input v-model="keyword" class="search-row__input" placeholder="搜索房号或标题" confirm-type="search" @confirm="load(true)">
          <wd-button size="small" type="primary" @click="load(true)">
            搜索
          </wd-button>
        </view>
        <scroll-view scroll-x class="community-filter">
          <view class="community-filter__inner">
            <view class="filter-chip" :class="{ 'filter-chip--active': communityId === undefined }" @tap="selectCommunity(undefined)">
              全部楼盘
            </view>
            <view v-for="community in sourceContact.communities" :key="String(community.id)" class="filter-chip" :class="{ 'filter-chip--active': String(communityId) === String(community.id) }" @tap="selectCommunity(community.id)">
              {{ community.name }}
            </view>
          </view>
        </scroll-view>
        <view class="filter-actions">
          <view class="filter-toggle">
            <wd-switch v-model="promotionOnly" size="20px" @change="load(true)" />
            <text>仅看已推广</text>
          </view>
          <view v-if="selecting" class="select-all" @tap="toggleAll">
            <view class="check-box" :class="{ 'check-box--active': selectedAll }">
              <wd-icon v-if="selectedAll" name="check" size="14px" color="#fff" />
            </view>
            <text>全选已加载</text>
          </view>
          <wd-button size="small" :plain="!selecting" @click="toggleSelectMode">
            {{ selecting ? '取消选择' : '批量设置' }}
          </wd-button>
        </view>
      </view>

      <scroll-view scroll-y class="promotion-scroll" @scrolltolower="load(false)">
        <view v-if="loading && !items.length" class="empty-state">
          <wd-loading color="#126b4f" /><text>正在加载房源</text>
        </view>
        <view v-else-if="!items.length" class="empty-state">
          <wd-icon name="discount" size="34px" color="#8fa098" /><text>没有符合条件的房源</text>
        </view>
        <view v-else class="promotion-list">
          <view v-for="item in items" :key="String(item.propertyId)" class="promotion-row" :class="{ 'promotion-row--selected': selectedIds.some(id => String(id) === String(item.propertyId)) }" @tap="openItem(item)">
            <view v-if="selecting" class="row-check" :class="{ 'row-check--active': selectedIds.some(id => String(id) === String(item.propertyId)) }">
              <wd-icon v-if="selectedIds.some(id => String(id) === String(item.propertyId))" name="check" size="14px" color="#fff" />
            </view>
            <view class="promotion-row__main">
              <view class="promotion-row__head">
                <text class="promotion-row__name">{{ item.roomNo || item.title }}</text>
                <text class="promotion-row__price">¥{{ item.rentPrice }}/月</text>
              </view>
              <text class="promotion-row__path">{{ item.communityName }} / {{ item.buildingName }} · {{ item.statusName }}</text>
              <view v-if="conditionLabels(item).length" class="condition-list">
                <text v-for="label in conditionLabels(item)" :key="label" class="condition-tag">{{ label }}</text>
              </view>
              <text v-else class="not-promoted">未设置推广条件</text>
              <view class="commission-line">
                <text>标准佣金 {{ commissionText(item.effectiveCommissionMode, item.effectiveCommissionValue) }}</text>
                <text v-if="item.isPromoted">推广佣金 {{ commissionText(item.promotionCommissionMode, item.promotionCommissionValue) }}</text>
              </view>
            </view>
            <wd-icon v-if="!selecting" name="arrow-right" size="18px" color="#8fa098" />
          </view>
          <view class="load-tip">
            {{ loading ? '加载中...' : finished ? '已经到底了' : '上拉加载更多' }}
          </view>
        </view>
      </scroll-view>

      <view v-if="selecting" class="batch-footer">
        <text>已选择 {{ selectedIds.length }} 套</text>
        <wd-button type="primary" size="small" :disabled="!selectedIds.length" @click="openBatchEditor">
          设置推广
        </wd-button>
      </view>
    </template>

    <template v-else>
      <view class="editor-head">
        <view class="head-icon" @tap="closeEditor">
          <wd-icon name="arrow-left" size="20px" color="#126b4f" />
        </view>
        <view class="editor-head__text">
          <text class="editor-head__title">{{ activeItem ? (activeItem.roomNo || activeItem.title) : `批量设置 ${selectedIds.length} 套` }}</text>
          <text class="editor-head__subtitle">选择特殊出租条件并设置新的推广佣金</text>
        </view>
      </view>

      <scroll-view scroll-y class="editor-scroll">
        <view v-if="!activeItem" class="batch-notice">
          批量保存会统一覆盖所选房源的推广条件，不修改标准佣金和其他房源资料。
        </view>
        <view class="form-section">
          <text class="form-section__title">出租条件</text>
          <view class="condition-options">
            <view class="condition-option">
              <text>可月租</text><wd-switch v-model="promotionDraft.supportsMonthlyRent" size="22px" />
            </view>
            <view class="condition-option">
              <text>可短租</text><wd-switch v-model="promotionDraft.supportsShortRent" size="22px" />
            </view>
            <view class="condition-option">
              <text>押一付一</text><wd-switch v-model="promotionDraft.supportsMonthlyPayment" size="22px" />
            </view>
            <view class="condition-option">
              <text>零押金</text><wd-switch v-model="promotionDraft.supportsZeroDeposit" size="22px" />
            </view>
          </view>
        </view>

        <view class="form-section" :class="{ 'form-section--disabled': !enabledConditionCount }">
          <text class="form-section__title">推广佣金</text>
          <text class="form-section__hint">启用任一条件后必须设置，独立于标准佣金</text>
          <view class="mode-grid">
            <view v-for="mode in commissionModes" :key="mode.value" class="mode-option" :class="{ 'mode-option--active': promotionDraft.promotionCommissionMode === mode.value }" @tap="promotionDraft.promotionCommissionMode = mode.value">
              {{ mode.label }}
            </view>
          </view>
          <view class="commission-input">
            <input v-model="promotionDraft.promotionCommissionValue" class="commission-input__control" type="digit" :disabled="!enabledConditionCount" placeholder="请输入佣金数值">
            <text class="commission-input__unit">{{ commissionUnit }}</text>
          </view>
        </view>

        <view v-if="activeItem" class="compare-block">
          <view class="compare-block__item">
            <text class="compare-block__label">当前标准佣金</text>
            <text class="compare-block__value">{{ commissionText(activeItem.effectiveCommissionMode, activeItem.effectiveCommissionValue) }}</text>
          </view>
          <view class="compare-block__item">
            <text class="compare-block__label">当前推广佣金</text>
            <text class="compare-block__value">{{ commissionText(activeItem.promotionCommissionMode, activeItem.promotionCommissionValue) }}</text>
          </view>
        </view>
      </scroll-view>

      <view class="editor-footer">
        <wd-button block type="primary" custom-style="width: 100%;" :loading="saving" @click="submitPromotion">
          {{ enabledConditionCount ? '保存推广设置' : '关闭推广' }}
        </wd-button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.promotion-page {
  display: flex;
  width: 100%;
  height: calc(100vh - 112rpx - env(safe-area-inset-bottom));
  padding: 22rpx 24rpx 0;
  box-sizing: border-box;
  overflow: hidden;
  flex-direction: column;
}

.promotion-head,
.editor-head,
.filter-actions,
.search-row,
.support-tip,
.batch-footer,
.editor-footer {
  display: flex;
  flex: none;
  align-items: center;
}

.promotion-head,
.editor-head {
  min-height: 76rpx;
  gap: 14rpx;
}

.promotion-head__main,
.editor-head__text {
  min-width: 0;
  flex: 1;
}

.promotion-head__title,
.editor-head__title,
.form-section__title {
  display: block;
  color: #1e2f27;
  font-size: 30rpx;
  font-weight: 800;
}

.promotion-head__subtitle,
.editor-head__subtitle,
.form-section__hint {
  display: block;
  margin-top: 5rpx;
  color: #72817b;
  font-size: 21rpx;
}

.head-icon {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgb(18 107 79 / 14%);
  border-radius: 8rpx;
  background: #fff;
}

.support-tip {
  min-height: 56rpx;
  margin-top: 10rpx;
  padding: 0 16rpx;
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 7rpx;
  background: #fff;
  color: #5c6b64;
  font-size: 21rpx;
  gap: 9rpx;
}

.support-tip__phone {
  margin-left: auto;
  color: #126b4f;
  font-weight: 700;
}

.filter-block,
.form-section,
.compare-block,
.batch-notice {
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 8rpx;
  background: #fff;
}

.filter-block {
  flex: none;
  margin-top: 14rpx;
  padding: 14rpx;
}

.search-row {
  height: 70rpx;
  padding-left: 14rpx;
  border: 1rpx solid #dfe6e1;
  border-radius: 7rpx;
  background: #f9fbf9;
  gap: 10rpx;
}

.search-row__input {
  min-width: 0;
  flex: 1;
  font-size: 23rpx;
}

.community-filter {
  width: 100%;
  margin-top: 12rpx;
  white-space: nowrap;
}

.community-filter__inner {
  display: inline-flex;
  gap: 10rpx;
}

.filter-chip {
  display: inline-flex;
  height: 56rpx;
  align-items: center;
  padding: 0 18rpx;
  border: 1rpx solid #dfe6e1;
  border-radius: 7rpx;
  background: #fff;
  color: #65746d;
  font-size: 21rpx;
}

.filter-chip--active {
  border-color: #126b4f;
  background: #e9f4ee;
  color: #126b4f;
  font-weight: 700;
}

.filter-actions {
  min-height: 62rpx;
  justify-content: space-between;
  margin-top: 10rpx;
  gap: 12rpx;
}

.filter-toggle,
.select-all {
  display: flex;
  align-items: center;
  color: #596861;
  font-size: 21rpx;
  gap: 9rpx;
}

.check-box,
.row-check {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #b7c1bb;
  border-radius: 5rpx;
}

.check-box {
  width: 32rpx;
  height: 32rpx;
}

.check-box--active,
.row-check--active {
  border-color: #126b4f;
  background: #126b4f;
}

.promotion-scroll,
.editor-scroll {
  min-height: 0;
  flex: 1;
}

.promotion-list {
  padding: 14rpx 0 24rpx;
}

.promotion-row {
  position: relative;
  display: flex;
  min-height: 166rpx;
  align-items: center;
  padding: 20rpx;
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 8rpx;
  background: #fff;
  gap: 14rpx;
}

.promotion-row + .promotion-row {
  margin-top: 12rpx;
}

.promotion-row--selected {
  border-color: #126b4f;
  background: #f5faf7;
}

.row-check {
  width: 34rpx;
  height: 34rpx;
  flex: none;
}

.promotion-row__main {
  min-width: 0;
  flex: 1;
}

.promotion-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.promotion-row__name {
  overflow: hidden;
  font-size: 27rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.promotion-row__price {
  flex: none;
  color: #bd6417;
  font-size: 23rpx;
  font-weight: 800;
}

.promotion-row__path {
  display: block;
  margin-top: 7rpx;
  color: #72817b;
  font-size: 20rpx;
}

.condition-list {
  display: flex;
  margin-top: 11rpx;
  flex-wrap: wrap;
  gap: 8rpx;
}

.condition-tag {
  padding: 5rpx 10rpx;
  border-radius: 5rpx;
  background: #fff0d5;
  color: #945908;
  font-size: 19rpx;
}

.not-promoted {
  display: block;
  margin-top: 11rpx;
  color: #909b95;
  font-size: 20rpx;
}

.commission-line {
  display: flex;
  margin-top: 11rpx;
  color: #53635c;
  flex-wrap: wrap;
  font-size: 19rpx;
  gap: 14rpx;
}

.load-tip {
  padding: 24rpx 0;
  color: #8b9791;
  font-size: 21rpx;
  text-align: center;
}

.batch-footer,
.editor-footer {
  min-height: 92rpx;
  justify-content: space-between;
  padding-top: 12rpx;
  color: #53635c;
  font-size: 22rpx;
}

.batch-notice {
  margin-top: 14rpx;
  padding: 18rpx;
  background: #fff7e7;
  color: #80520f;
  font-size: 22rpx;
  line-height: 1.55;
}

.form-section,
.compare-block {
  margin-top: 14rpx;
  padding: 22rpx;
}

.condition-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 16rpx;
  gap: 12rpx;
}

.condition-option {
  display: flex;
  min-height: 72rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 14rpx;
  border: 1rpx solid #dfe6e1;
  border-radius: 7rpx;
  background: #f9fbf9;
  font-size: 22rpx;
}

.form-section--disabled {
  opacity: 0.6;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 16rpx;
  gap: 10rpx;
}

.mode-option {
  display: flex;
  min-height: 68rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #dfe6e1;
  border-radius: 7rpx;
  color: #5c6b64;
  font-size: 21rpx;
}

.mode-option--active {
  border-color: #126b4f;
  background: #e9f4ee;
  color: #126b4f;
  font-weight: 700;
}

.commission-input {
  display: flex;
  height: 76rpx;
  align-items: center;
  margin-top: 14rpx;
  padding: 0 16rpx;
  border: 1rpx solid #dfe6e1;
  border-radius: 7rpx;
  background: #f9fbf9;
  color: #72817b;
  gap: 10rpx;
}

.commission-input__control {
  min-width: 0;
  flex: 1;
  color: #1e2f27;
  font-size: 24rpx;
}

.compare-block {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.compare-block__item {
  min-width: 0;
  padding: 14rpx;
  border-radius: 6rpx;
  background: #f5f8f6;
}

.compare-block__label,
.compare-block__value {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-block__label {
  color: #72817b;
  font-size: 19rpx;
}

.compare-block__value {
  margin-top: 6rpx;
  font-size: 22rpx;
  font-weight: 700;
}

.empty-state {
  display: flex;
  min-height: 360rpx;
  align-items: center;
  justify-content: center;
  color: #7a8780;
  flex-direction: column;
  font-size: 23rpx;
  gap: 13rpx;
}
</style>
