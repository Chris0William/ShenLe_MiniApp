<script setup lang="ts">
import type { PageSlPropertyInput, ShenLeId, SlPropertyListOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { deleteProperty, getPropertyPage, updatePropertyStatus } from '@/api/property'
import { PROPERTY_STATUS_OPTIONS } from '@/constants/shenle'
import { useShenleAuthStore } from '@/store/auth'
import { idToQuery } from '@/utils/shenle'

definePage({
  style: {
    navigationBarTitleText: '楼盘房源',
    enablePullDownRefresh: true,
  },
})

const communityId = ref<ShenLeId>('')
const communityName = ref('')
const keyword = ref('')
const status = ref<number | undefined>()
const page = ref(1)
const pageSize = 10
const total = ref(0)
const items = ref<SlPropertyListOutput[]>([])
const loading = ref(false)
const hasLoaded = ref(false)
const auth = useShenleAuthStore()
const finished = computed(() => total.value > 0 && items.value.length >= total.value)
const canManage = computed(() => auth.isLogin)

function buildQuery(): PageSlPropertyInput {
  return {
    page: page.value,
    pageSize,
    communityId: communityId.value || undefined,
    title: keyword.value.trim() || undefined,
    status: status.value,
  }
}

async function load(reset = false) {
  if (!communityId.value || loading.value)
    return
  if (reset) {
    page.value = 1
    items.value = []
    total.value = 0
  }
  loading.value = true
  try {
    const result = await getPropertyPage(buildQuery())
    total.value = result.total
    items.value = reset ? result.items : [...items.value, ...result.items]
    hasLoaded.value = true
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function selectStatus(value?: number) {
  status.value = value
  load(true)
}

function openDetail(item: SlPropertyListOutput) {
  uni.navigateTo({ url: `/pages/common/property-detail/index?id=${idToQuery(item.id)}` })
}

function openForm(item?: SlPropertyListOutput) {
  const query = item ? `id=${idToQuery(item.id)}` : `communityId=${idToQuery(communityId.value)}`
  uni.navigateTo({ url: `/pages/common/property-form/index?${query}` })
}

async function changeStatus(item: SlPropertyListOutput, nextStatus: number) {
  if (item.status === nextStatus)
    return
  await updatePropertyStatus({ id: item.id, status: nextStatus })
  uni.showToast({ title: '状态已更新', icon: 'success' })
  await load(true)
}

function removeItem(item: SlPropertyListOutput) {
  uni.showModal({
    title: '删除房源',
    content: `确定删除「${item.title}」？`,
    confirmColor: '#c94832',
    success: async (res) => {
      if (!res.confirm)
        return
      await deleteProperty({ id: item.id })
      uni.showToast({ title: '删除成功', icon: 'success' })
      await load(true)
    },
  })
}

function backToMap() {
  const pages = getCurrentPages()
  if (pages.length > 1)
    uni.navigateBack()
  else
    uni.switchTab({ url: '/pages/user/map/index' })
}

onLoad((query) => {
  communityId.value = String(query?.communityId || '')
  communityName.value = decodeURIComponent(String(query?.communityName || ''))
  if (communityName.value)
    uni.setNavigationBarTitle({ title: communityName.value })
  load(true)
})
onPullDownRefresh(() => load(true))
onReachBottom(() => {
  if (!finished.value) {
    page.value += 1
    load()
  }
})
</script>

<template>
  <view class="sl-page community-page">
    <view class="head-card sl-card">
      <view>
        <text class="head-card__title">{{ communityName || '楼盘房源' }}</text>
        <text class="head-card__desc">{{ canManage ? '查看并维护该楼盘下的所有房间。' : '查看该楼盘可出租房源，管理操作登录后显示。' }}</text>
      </view>
      <wd-button v-if="canManage" size="small" type="primary" icon="add" @click="openForm()">
        新增
      </wd-button>
    </view>

    <view class="search sl-card">
      <wd-icon name="search" size="20px" color="#7a8780" />
      <input v-model="keyword" class="search__input" placeholder="搜索房源 / 房号" confirm-type="search" @confirm="load(true)">
      <wd-button size="small" type="primary" @click="load(true)">
        搜索
      </wd-button>
    </view>

    <scroll-view scroll-x class="chips">
      <view class="chips__inner">
        <wd-tag :type="status === undefined ? 'success' : 'default'" @click="selectStatus(undefined)">
          全部
        </wd-tag>
        <wd-tag
          v-for="item in PROPERTY_STATUS_OPTIONS"
          :key="item.value"
          :type="status === item.value ? item.tone as any : 'default'"
          @click="selectStatus(item.value)"
        >
          {{ item.label }}
        </wd-tag>
      </view>
    </scroll-view>

    <view class="result-head">
      <text class="result-head__title">{{ total }} 套房源</text>
      <text class="result-head__desc">支持状态快捷切换和编辑。</text>
    </view>

    <view class="list">
      <view v-for="item in items" :key="String(item.id)" class="property-wrap sl-card">
        <sl-property-card :item="item" compact @tap="openDetail" />
        <view v-if="canManage" class="row-actions">
          <wd-button size="small" type="default" plain @click="openForm(item)">
            编辑
          </wd-button>
          <wd-button
            v-for="option in PROPERTY_STATUS_OPTIONS"
            :key="option.value"
            size="small"
            :type="item.status === option.value ? 'primary' : 'default'"
            plain
            @click="changeStatus(item, option.value)"
          >
            {{ option.label }}
          </wd-button>
          <wd-button size="small" type="danger" plain @click="removeItem(item)">
            删除
          </wd-button>
        </view>
      </view>
    </view>

    <view v-if="loading" class="loading">
      加载中...
    </view>
    <view v-else-if="hasLoaded && !items.length" class="empty sl-card">
      <wd-icon name="home" size="42px" color="#8ea099" />
      <text class="empty__title">暂无房源数据</text>
      <text class="empty__desc">{{ canManage ? '这个楼盘还没有房源，先新增一套。' : '这个楼盘暂时没有可展示房源。' }}</text>
      <wd-button v-if="canManage" size="small" type="primary" @click="openForm()">
        新增房源
      </wd-button>
      <wd-button v-else size="small" plain @click="backToMap">
        返回地图
      </wd-button>
    </view>
    <view v-else-if="finished" class="loading">
      已经到底了
    </view>
  </view>
</template>

<style scoped lang="scss">
.community-page {
  padding-bottom: calc(88rpx + env(safe-area-inset-bottom));
}

.head-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 28rpx;
}

.head-card__title,
.head-card__desc {
  display: block;
}


.head-card__title {
  margin-top: 8rpx;
  font-size: 36rpx;
  font-weight: 850;
}

.head-card__desc {
  margin-top: 8rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14rpx;
  margin-top: 20rpx;
  padding: 18rpx;
}

.search__input {
  min-width: 0;
  font-size: 27rpx;
}

.chips {
  margin-top: 20rpx;
  white-space: nowrap;
}

.chips__inner {
  display: inline-flex;
  gap: 14rpx;
  padding-right: 28rpx;
}

.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 30rpx 2rpx 18rpx;
}

.result-head__title {
  font-size: 31rpx;
  font-weight: 850;
}

.result-head__desc {
  color: var(--sl-muted);
  font-size: 23rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.property-wrap {
  overflow: hidden;
}

.property-wrap :deep(.property) {
  border: 0;
  box-shadow: none;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 0 18rpx 18rpx;
}

.loading,
.empty {
  margin-top: 22rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}

.loading {
  padding: 28rpx 0;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  padding: 70rpx 24rpx;
}

.empty__title {
  color: var(--sl-ink);
  font-size: 30rpx;
  font-weight: 850;
}

.empty__desc {
  color: var(--sl-muted);
  font-size: 24rpx;
}
</style>
