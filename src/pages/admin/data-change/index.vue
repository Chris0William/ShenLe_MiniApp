<script setup lang="ts">
import type { DataChangeRecord } from '@/api/data-change'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getDataChangePage, restoreDataChange } from '@/api/data-change'
import { useShenleAuthStore } from '@/store/auth'
import { useSafeTopStyle } from '@/utils/safe-area'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '数据变更记录', disableScroll: true } })

const auth = useShenleAuthStore()
const safeTop = useSafeTopStyle()
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const loaded = ref(false)
const entityType = ref('')
const action = ref('')
const items = ref<DataChangeRecord[]>([])
const detailVisible = ref(false)
const selected = ref<DataChangeRecord | null>(null)
const restoreVisible = ref(false)
const restoreReason = ref('')
const restoring = ref(false)

const entityOptions = [
  { value: '', label: '全部对象' },
  { value: 'community', label: '楼盘' },
  { value: 'building', label: '楼栋' },
  { value: 'property', label: '房源' },
  { value: 'community-config', label: '楼盘经营配置' },
  { value: 'property-config', label: '房源经营配置' },
]
const actionOptions = [
  { value: '', label: '全部动作' },
  { value: 'add', label: '新增' },
  { value: 'update', label: '编辑' },
  { value: 'status', label: '状态修改' },
  { value: 'delete', label: '删除' },
  { value: 'restore', label: '恢复' },
  { value: 'assign-owner', label: '分配盘源对接人' },
  { value: 'unassign-owner', label: '取消盘源对接人' },
  { value: 'hot-level', label: '调整火热等级' },
  { value: 'config-add', label: '新增经营配置' },
  { value: 'config-update', label: '修改经营配置' },
  { value: 'config-sync', label: '同步经营配置' },
  { value: 'config-delete', label: '删除经营配置' },
]
const finished = computed(() => items.value.length >= total.value && loaded.value)

const entityLabel = (value: string) => entityOptions.find(item => item.value === value)?.label || value
const actionLabel = (value: string) => actionOptions.find(item => item.value === value)?.label || value
const fieldLabels: Record<string, string> = {
  name: '名称',
  type: '类型',
  regionId: '区域',
  address: '地址',
  lng: '经度',
  lat: '纬度',
  ownerId: '盘源对接人',
  status: '状态',
  coverImageId: '封面',
  remark: '备注',
  communityId: '楼盘',
  buildingId: '楼栋',
  roomNo: '房号',
  floor: '楼层',
  totalFloors: '总楼层',
  title: '标题',
  bedrooms: '室',
  livingRooms: '厅',
  bathrooms: '卫',
  area: '面积',
  orientation: '朝向',
  decoration: '装修',
  rentalType: '出租类型',
  rentPrice: '租金',
  deposit: '押金',
  depositRule: '付款方式',
  minLease: '最短租期',
  tagIds: '标签',
  facilityIds: '配套',
  description: '描述',
  landlordName: '联系人',
  landlordPhone: '联系电话',
  unit: '单元',
  orderNo: '排序',
  hasElevator: '电梯',
  managementFee: '管理费',
  networkFee: '网络费',
  networkFeeMode: '网络费用方式',
  waterFee: '水费',
  electricityFee: '电费',
  commissionMode: '佣金方式',
  commissionValue: '佣金数值',
  halfYearCommissionPercent: '半年佣金',
  oneYearCommissionPercent: '一年佣金',
  managementPackageMode: '管理情况',
  networkPackageMode: '网络情况',
  petPolicy: '宠物情况',
  hotLevel: '火热等级',
  hotExpireTime: '火热到期时间',
  propertyId: '房源',
  supportsMonthlyRent: '支持月租',
  supportsShortRent: '支持短租',
  minimumShortRentMonths: '最低短租月数',
  shortRentCanMarkup: '短租可加价',
  supportsDailyRent: '支持日租',
  dailyRentCommissionAmount: '日租佣金金额',
  dailyRentCommissionPercent: '日租佣金比例',
  dailyRentPrice: '日租价格',
  supportsMonthlyPayment: '支持押一付一',
  monthlyPaymentHalfYearCommissionPercent: '押一付一半年佣金',
  monthlyPaymentOneYearCommissionPercent: '押一付一年佣金',
  supportsZeroDeposit: '支持零押金',
  promotionCommissionMode: '推广佣金方式',
  promotionCommissionValue: '推广佣金数值',
  hotLevelChange: '火热等级',
}
function parseObject(value?: string | null) {
  if (!value)
    return {} as Record<string, unknown>
  try {
    return JSON.parse(value) as Record<string, unknown>
  }
  catch {
    return {} as Record<string, unknown>
  }
}
function changedFields(item: DataChangeRecord) {
  if (!item.changedFields)
    return []
  try {
    const fields = JSON.parse(item.changedFields) as string[]
    return fields.map(field => fieldLabels[field] || field)
  }
  catch { return [] }
}
function valueText(value: unknown) {
  if (value === null || value === undefined || value === '')
    return '空'
  if (typeof value === 'boolean')
    return value ? '是' : '否'
  if (Array.isArray(value))
    return value.join(', ')
  return String(value)
}
const diffRows = computed(() => {
  if (!selected.value)
    return []
  const before = parseObject(selected.value.beforeSnapshot)
  const after = parseObject(selected.value.afterSnapshot)
  let fields: string[] = []
  try {
    fields = selected.value.changedFields ? JSON.parse(selected.value.changedFields) as string[] : []
  }
  catch {
    fields = []
  }
  return fields.map(field => ({ label: fieldLabels[field] || field, before: valueText(before[field]), after: valueText(after[field]) }))
})
const recordName = (item: DataChangeRecord) => item.entityName || `${entityLabel(item.entityType)} #${item.entityId}`

function goBack() {
  uni.navigateBack()
}
async function load(reset = false) {
  if (loading.value)
    return
  if (reset) {
    page.value = 1
    items.value = []
    total.value = 0
    loaded.value = false
  }
  loading.value = true
  try {
    const result = await getDataChangePage({ page: page.value, pageSize: 20, entityType: entityType.value || undefined, action: action.value || undefined })
    items.value = reset ? result.items : [...items.value, ...result.items]
    total.value = result.total
    loaded.value = true
  }
  finally { loading.value = false }
}
function changeFilter(kind: 'entity' | 'action', event: { detail: { value: string | number } }) {
  const options = kind === 'entity' ? entityOptions : actionOptions
  const value = options[Number(event.detail.value)]?.value || ''
  if (kind === 'entity')
    entityType.value = value
  else action.value = value
  void load(true)
}
function openDetail(item: DataChangeRecord) {
  selected.value = item
  detailVisible.value = true
}
function canRestore(item: DataChangeRecord) {
  return ['update', 'status'].includes(item.action) && !!item.beforeSnapshot && !!item.afterSnapshot
}
function openRestore() {
  restoreReason.value = ''
  restoreVisible.value = true
}
async function submitRestore() {
  if (!selected.value || restoring.value)
    return
  const reason = restoreReason.value.trim()
  if (!reason) {
    uni.showToast({ title: '请填写恢复原因', icon: 'none' })
    return
  }
  restoring.value = true
  try {
    await restoreDataChange(selected.value.id, reason)
    restoreVisible.value = false
    detailVisible.value = false
    uni.showToast({ title: '已恢复', icon: 'success', duration: 2500 })
    await load(true)
  }
  finally { restoring.value = false }
}

onLoad(() => {
  if (!auth.isSuperAdmin) {
    uni.showToast({ title: '无权限', icon: 'none' })
    setTimeout(goBack, 500)
    return
  }
  void load(true)
})
onReachBottom(() => {
  if (!loading.value && !finished.value) {
    page.value += 1
    void load()
  }
})
</script>

<template>
  <view class="page" :style="safeTop">
    <view class="head">
      <view class="back" role="button" aria-label="返回" @tap="goBack">
        <wd-icon name="arrow-left" size="20px" color="#126b4f" />
      </view>
      <view class="head__main">
        <text class="title">数据变更记录</text><text class="desc">查看关键楼盘、楼栋和房源的修改版本</text>
      </view>
    </view>
    <view class="filters sl-card">
      <picker :range="entityOptions" range-key="label" :value="entityOptions.findIndex(item => item.value === entityType)" @change="changeFilter('entity', $event)">
        <view class="filter">
          <text>{{ entityLabel(entityType) }}</text><wd-icon name="arrow-down" size="16px" color="#718078" />
        </view>
      </picker>
      <picker :range="actionOptions" range-key="label" :value="actionOptions.findIndex(item => item.value === action)" @change="changeFilter('action', $event)">
        <view class="filter">
          <text>{{ actionLabel(action) }}</text><wd-icon name="arrow-down" size="16px" color="#718078" />
        </view>
      </picker>
    </view>
    <view class="result-head">
      <text>{{ total }} 条记录</text><wd-loading v-if="loading && !items.length" color="#126b4f" />
    </view>
    <scroll-view scroll-y class="list">
      <view v-for="item in items" :key="String(item.id)" class="record sl-card" @tap="openDetail(item)">
        <view class="record__top">
          <text class="record__title">{{ recordName(item) }}</text><text class="record__action">{{ actionLabel(item.action) }}</text>
        </view>
        <text class="record__fields">{{ changedFields(item).join('、') || '记录版本' }}</text>
        <view class="record__meta">
          <text>{{ item.operatorNickName || '未知用户' }}</text><text>{{ item.occurredTime }}</text>
        </view>
      </view>
      <view v-if="!loading && loaded && !items.length" class="empty">
        暂无变更记录
      </view>
      <view v-if="finished && items.length" class="end">
        已经到底了
      </view>
    </scroll-view>

    <wd-popup v-model="detailVisible" position="bottom" :z-index="2200" safe-area-inset-bottom custom-style="max-height: 82vh; border-radius: 24rpx 24rpx 0 0; overflow: hidden;" @touchmove.stop.prevent>
      <view v-if="selected" class="detail" @tap.stop @touchmove.stop.prevent>
        <view class="detail__head">
          <view><text class="detail__title">{{ recordName(selected) }}</text><text class="detail__meta">{{ entityLabel(selected.entityType) }} · {{ actionLabel(selected.action) }} · {{ selected.operatorNickName }} · {{ selected.occurredTime }}</text></view><view class="close" role="button" aria-label="关闭" @tap="detailVisible = false">
            <wd-icon name="close" size="20px" color="#718078" />
          </view>
        </view>
        <scroll-view scroll-y class="detail__scroll">
          <view v-if="selected.reason" class="reason">
            <text class="label">操作原因</text><text>{{ selected.reason }}</text>
          </view>
          <view v-if="diffRows.length" class="diff-list">
            <view v-for="row in diffRows" :key="row.label" class="diff-row">
              <text class="label">{{ row.label }}</text><view class="diff-values">
                <text class="before">{{ row.before }}</text><wd-icon name="arrow-right" size="15px" color="#9aa7a0" /><text class="after">{{ row.after }}</text>
              </view>
            </view>
          </view>
          <view v-else class="empty">
            该记录没有可展示的字段差异
          </view>
        </scroll-view>
        <wd-button v-if="canRestore(selected)" block type="primary" @click="openRestore">
          恢复到此版本
        </wd-button>
      </view>
    </wd-popup>
    <wd-popup v-model="restoreVisible" position="bottom" :z-index="2300" safe-area-inset-bottom custom-style="border-radius: 24rpx 24rpx 0 0; overflow: hidden;" @touchmove.stop.prevent>
      <view class="restore" @tap.stop @touchmove.stop.prevent>
        <text class="detail__title">确认恢复</text><text class="restore__hint">系统会先校验当前数据仍是该版本的修改结果。若之后已有新的修改，恢复会被拒绝。</text><wd-textarea v-model="restoreReason" label="恢复原因" placeholder="请填写恢复原因" :maxlength="300" /><view class="restore__actions">
          <wd-button plain :disabled="restoring" @click="restoreVisible = false">
            取消
          </wd-button><wd-button type="primary" :loading="restoring" @click="submitRestore">
            确认恢复
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.page {
  height: calc(100vh - var(--window-top));
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 12rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  background: #f4f7f2;
  color: #1e2f27;
}
.head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 4rpx 2rpx 18rpx;
}
.back {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  flex: 0 0 56rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgb(18 107 79 / 8%);
}
.head__main {
  min-width: 0;
}
.title {
  display: block;
  font-size: 34rpx;
  font-weight: 850;
}
.desc {
  display: block;
  margin-top: 6rpx;
  color: #78867e;
  font-size: 23rpx;
}
.filters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rpx;
  padding: 0;
  overflow: hidden;
}
.filter {
  display: flex;
  min-height: 78rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
  background: #fff;
  font-size: 26rpx;
}
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 70rpx;
  color: #718078;
  font-size: 24rpx;
}
.list {
  flex: 1;
  min-height: 0;
}
.record {
  margin-bottom: 16rpx;
  padding: 24rpx;
}
.record__top,
.record__meta,
.detail__head,
.diff-values,
.restore__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.record__title,
.detail__title {
  font-size: 28rpx;
  font-weight: 700;
}
.record__action {
  color: #126b4f;
  font-size: 24rpx;
  font-weight: 700;
}
.record__fields {
  display: block;
  margin-top: 14rpx;
  color: #54645b;
  font-size: 25rpx;
}
.record__meta {
  margin-top: 18rpx;
  color: #8a968f;
  font-size: 22rpx;
}
.empty,
.end {
  padding: 40rpx 0;
  color: #89968f;
  text-align: center;
  font-size: 24rpx;
}
.detail {
  padding: 30rpx 28rpx 24rpx;
}
.detail__head {
  align-items: flex-start;
}
.detail__meta {
  display: block;
  margin-top: 8rpx;
  color: #84918a;
  font-size: 22rpx;
}
.close {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
}
.detail__scroll {
  max-height: 58vh;
  margin: 24rpx 0;
}
.reason {
  display: grid;
  gap: 10rpx;
  padding: 18rpx;
  border-radius: 8rpx;
  background: #f4f7f2;
  color: #526159;
  font-size: 24rpx;
}
.label {
  color: #829088;
  font-size: 23rpx;
}
.diff-list {
  margin-top: 16rpx;
}
.diff-row {
  padding: 18rpx 0;
  border-bottom: 1rpx solid #edf1ed;
}
.diff-values {
  justify-content: flex-start;
  margin-top: 10rpx;
  color: #526159;
  font-size: 24rpx;
}
.before {
  color: #a16252;
}
.after {
  color: #126b4f;
}
.restore {
  padding: 32rpx 28rpx 24rpx;
}
.restore__hint {
  display: block;
  margin: 16rpx 0;
  color: #718078;
  font-size: 24rpx;
  line-height: 1.55;
}
.restore__actions {
  justify-content: flex-end;
  margin-top: 20rpx;
}
</style>
