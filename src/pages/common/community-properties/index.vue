<script setup lang="ts">
import type { PageSlPropertyInput, ShenLeId, SlPropertyListOutput } from '@/types/shenle'
import type { MediaKind } from '@/utils/media'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getCommunityDetail } from '@/api/community'
import { downloadFile } from '@/api/file'
import { deleteProperty, getPropertyPage, updatePropertyStatus } from '@/api/property'
import { PROPERTY_STATUS_OPTIONS } from '@/constants/shenle'
import { useShenleAuthStore } from '@/store/auth'
import { mediaKindOf } from '@/utils/media'
import { idToQuery, resolveAssetUrl } from '@/utils/shenle'

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

// ===== 楼盘媒体横滑栏 =====
interface CommunityMediaItem {
  id: ShenLeId
  name: string
  kind: MediaKind
  url: string
}

const mediaList = ref<CommunityMediaItem[]>([])
const previewVideoMedia = ref<CommunityMediaItem | null>(null)
const videoPreviewVisible = computed({
  get: () => !!previewVideoMedia.value,
  set: (visible: boolean) => {
    if (!visible)
      previewVideoMedia.value = null
  },
})

async function loadMedia() {
  if (!communityId.value)
    return
  try {
    const detail = await getCommunityDetail(communityId.value)
    const list: CommunityMediaItem[] = (detail.images || []).map(media => ({
      id: media.id,
      name: media.fileName || `文件${media.id}`,
      kind: mediaKindOf(media.fileType, media.suffix || media.url),
      url: resolveAssetUrl(media.url),
    }))
    // 部分导入批次媒体池绑定缺失：媒体池为空但有封面时至少展示封面
    if (!list.length && detail.coverImageId && detail.coverImage) {
      list.push({
        id: detail.coverImageId,
        name: detail.name || '封面',
        kind: mediaKindOf(detail.coverFileType, detail.coverSuffix || detail.coverImage),
        url: resolveAssetUrl(detail.coverImage),
      })
    }
    mediaList.value = list
    // 私有图需鉴权下载后才能显示缩略图，逐个替换为本地路径
    for (const item of list) {
      if (item.kind === 'image')
        downloadFile(item.id).then((path) => { item.url = path }).catch(() => {})
    }
  }
  catch {
    mediaList.value = []
  }
}

function openMedia(media: CommunityMediaItem) {
  if (media.kind === 'video') {
    previewVideoMedia.value = media
    return
  }
  const images = mediaList.value.filter(item => item.kind === 'image')
  uni.previewImage({
    current: media.url,
    urls: images.map(item => item.url),
  })
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
  loadMedia()
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
    <scroll-view v-if="mediaList.length" scroll-x class="media-strip">
      <view class="media-strip__inner">
        <view v-for="media in mediaList" :key="String(media.id)" class="media-item" @tap="openMedia(media)">
          <image v-if="media.kind === 'image'" class="media-item__thumb" :src="media.url" mode="aspectFill" />
          <view v-else class="media-item__thumb media-item__thumb--video">
            <wd-icon name="play-circle" size="26px" color="#fff" />
          </view>
          <text class="media-item__name">{{ media.name }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="search sl-card">
      <wd-icon name="search" size="20px" color="#7a8780" />
      <input v-model="keyword" class="search__input" placeholder="搜索房源 / 房号" confirm-type="search" @confirm="load(true)">
      <wd-button size="small" type="primary" @click="load(true)">
        搜索
      </wd-button>
    </view>

    <scroll-view scroll-x class="chips">
      <view class="chips__inner">
        <view class="status-chip" :class="{ 'status-chip--active': status === undefined }" @tap="selectStatus(undefined)">
          全部
        </view>
        <view
          v-for="item in PROPERTY_STATUS_OPTIONS"
          :key="item.value"
          class="status-chip"
          :class="{ 'status-chip--active': status === item.value }"
          @tap="selectStatus(item.value)"
        >
          {{ item.label }}
        </view>
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

    <view v-if="canManage" class="fab" @tap="openForm()">
      <wd-icon name="add" size="26px" color="#fff" />
    </view>

    <wd-popup v-model="videoPreviewVisible" custom-style="border-radius: 24rpx; overflow: hidden; width: 680rpx;">
      <view class="video-preview">
        <view class="video-preview__head">
          <text>{{ previewVideoMedia?.name || '视频预览' }}</text>
          <wd-icon name="close" size="20px" color="#72817b" @click="previewVideoMedia = null" />
        </view>
        <video v-if="previewVideoMedia" class="video-preview__player" :src="previewVideoMedia.url" controls autoplay />
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.community-page {
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.media-strip {
  margin-top: 6rpx;
  white-space: nowrap;
}

.media-strip__inner {
  display: inline-flex;
  gap: 16rpx;
  padding: 4rpx 4rpx 8rpx;
}

.media-item {
  display: inline-flex;
  width: 180rpx;
  flex-direction: column;
  gap: 8rpx;
}

.media-item__thumb {
  width: 180rpx;
  height: 132rpx;
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 18rpx;
  background: #edf2eb;
}

.media-item__thumb--video {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f6a4c, #173f34);
}

.media-item__name {
  overflow: hidden;
  padding: 0 4rpx;
  color: var(--sl-muted);
  font-size: 21rpx;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  padding: 4rpx 28rpx 8rpx 4rpx;
}

.status-chip {
  display: inline-flex;
  height: 60rpx;
  align-items: center;
  padding: 0 30rpx;
  border: 1rpx solid rgb(18 107 79 / 16%);
  border-radius: 999rpx;
  background: #fff;
  color: #5e6c65;
  font-size: 25rpx;
  font-weight: 700;
  transition: all 0.15s ease;
}

.status-chip--active {
  border-color: transparent;
  background: linear-gradient(135deg, var(--sl-brand, #126b4f), #24815f);
  box-shadow: 0 8rpx 20rpx rgb(18 107 79 / 22%);
  color: #fff;
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

.fab {
  position: fixed;
  right: 34rpx;
  bottom: calc(92rpx + env(safe-area-inset-bottom));
  z-index: 8;
  display: flex;
  width: 96rpx;
  height: 96rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: linear-gradient(135deg, var(--sl-brand, #126b4f), #24815f);
  box-shadow: 0 18rpx 38rpx rgb(18 107 79 / 28%);
}

.video-preview {
  background: #fff;
}

.video-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  color: var(--sl-ink);
  font-size: 28rpx;
  font-weight: 900;
}

.video-preview__player {
  display: block;
  width: 680rpx;
  height: 420rpx;
  background: #10261f;
}
</style>
