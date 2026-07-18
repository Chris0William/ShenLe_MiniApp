<script setup lang="ts">
import type { ImageOutput, ShenLeId, SlCommunityOutput, SlPropertyImageOutput, SlPropertyOutput } from '@/types/shenle'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getCommunityDetail } from '@/api/community'
import { downloadFile } from '@/api/file'
import { getPropertyDetail } from '@/api/property'
import SlSupplyContacts from '@/components/sl-supply-contacts/sl-supply-contacts.vue'
import { ensureCanUse } from '@/utils/auth-guard'
import { formatArea, formatMoney, getStatusMeta, resolveAssetUrl } from '@/utils/shenle'
import { saveVideoToAlbum, showVideoSaveActionSheet } from '@/utils/video-save'

definePage({
  style: {
    navigationBarTitleText: '房源详情',
  },
})

const id = ref('')
const detail = ref<SlPropertyOutput | null>(null)
const communityDetail = ref<SlCommunityOutput | null>(null)
const loading = ref(true)
const gallery = ref<PropertyDetailMedia[]>([])
const previewVideo = ref<PropertyDetailMedia | null>(null)
const status = computed(() => getStatusMeta(detail.value?.status))
const videoPreviewVisible = computed({
  get: () => !!previewVideo.value,
  set: (visible: boolean) => {
    if (!visible)
      previewVideo.value = null
  },
})

type MediaKind = 'image' | 'video' | 'file'

interface PropertyDetailMedia {
  id?: string | number | null
  url: string
  kind: MediaKind
  fileName?: string | null
  fileType?: string | null
  suffix?: string | null
  posterFileId?: ShenLeId | null
  posterUrl?: string
}

const IMAGE_SUFFIXES = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic']
const VIDEO_SUFFIXES = ['.mp4', '.mov', '.m4v', '.avi', '.webm']

function extensionOf(value?: string | null) {
  const clean = String(value || '').split('?')[0].toLowerCase()
  const index = clean.lastIndexOf('.')
  return index >= 0 ? clean.slice(index) : ''
}

function mediaKind(media?: Partial<ImageOutput> | null): MediaKind {
  const fileType = String(media?.fileType || '').toLowerCase()
  const suffix = extensionOf(media?.suffix || media?.url)
  if (fileType.startsWith('video') || VIDEO_SUFFIXES.includes(suffix))
    return 'video'
  if (fileType.startsWith('image') || IMAGE_SUFFIXES.includes(suffix))
    return 'image'
  return 'file'
}

function normalizeMedia(media: ImageOutput | SlPropertyImageOutput, url?: string): PropertyDetailMedia {
  return {
    id: media.id,
    url: url || resolveAssetUrl(media.url),
    kind: mediaKind(media),
    fileName: media.fileName,
    fileType: media.fileType,
    suffix: media.suffix,
    posterFileId: media.posterFileId,
    posterUrl: media.posterUrl ? resolveAssetUrl(media.posterUrl) : '',
  }
}

function mediaKey(media: PropertyDetailMedia, index: number) {
  return `${String(media.id || media.url)}-${index}`
}

async function loadGallery(nextDetail: SlPropertyOutput) {
  const images = nextDetail.images || []
  const medias = await Promise.all(images.map(async (image) => {
    if (mediaKind(image) === 'image') {
      try {
        return normalizeMedia(image, await downloadFile(image.id))
      }
      catch {}
    }
    const media = normalizeMedia(image)
    if (media.kind === 'video' && media.posterFileId) {
      try {
        media.posterUrl = await downloadFile(media.posterFileId)
      }
      catch {}
    }
    return media
  }))

  if (!medias.length && nextDetail.coverImageId) {
    const cover = {
      id: nextDetail.coverImageId,
      url: nextDetail.coverImage,
      fileType: nextDetail.coverFileType,
      suffix: nextDetail.coverSuffix || extensionOf(nextDetail.coverImage),
      posterFileId: nextDetail.coverPosterFileId,
      posterUrl: nextDetail.coverPosterUrl,
    }
    if (mediaKind(cover) === 'image') {
      try {
        medias.push(normalizeMedia(cover, await downloadFile(nextDetail.coverImageId)))
      }
      catch {
        medias.push(normalizeMedia(cover))
      }
    }
    else {
      const media = normalizeMedia(cover)
      if (media.posterFileId) {
        try {
          media.posterUrl = await downloadFile(media.posterFileId)
        }
        catch {}
      }
      medias.push(media)
    }
  }

  gallery.value = medias.length ? medias : [{ url: resolveAssetUrl(nextDetail.coverImage), kind: 'image' }]
}

function previewGalleryMedia(media: PropertyDetailMedia) {
  if (media.kind === 'video') {
    previewVideo.value = media
    return
  }

  if (media.kind !== 'image')
    return

  const urls = gallery.value.filter(item => item.kind === 'image').map(item => item.url)
  uni.previewImage({ current: media.url, urls })
}

function savePreviewVideo() {
  if (!previewVideo.value)
    return
  void saveVideoToAlbum({ fileId: previewVideo.value.id, url: previewVideo.value.url })
}

function openSavePreviewMenu() {
  if (!previewVideo.value)
    return
  void showVideoSaveActionSheet({ fileId: previewVideo.value.id, url: previewVideo.value.url })
}

async function loadDetail() {
  if (!id.value)
    return
  loading.value = true
  try {
    const nextDetail = await getPropertyDetail(id.value)
    detail.value = nextDetail
    const communityTask = getCommunityDetail(nextDetail.communityId)
      .then((community) => { communityDetail.value = community })
      .catch(() => { communityDetail.value = null })
    await Promise.all([loadGallery(nextDetail), communityTask])
  }
  finally {
    loading.value = false
  }
}

onLoad((query) => {
  // 房源详情需登录（深链/直达兜底）：未登录或游客拦回
  if (!ensureCanUse('登录后即可查看房源详情')) {
    setTimeout(() => uni.navigateBack(), 0)
    return
  }
  id.value = String(query?.id || '')
  loadDetail()
})
</script>

<template>
  <view class="sl-page sl-page--plain detail">
    <view v-if="loading" class="loading sl-card">
      加载房源详情...
    </view>
    <template v-else-if="detail">
      <swiper class="gallery" indicator-dots circular>
        <swiper-item v-for="(media, index) in gallery" :key="mediaKey(media, index)">
          <image
            v-if="media.kind === 'image'"
            class="gallery__image"
            :src="media.url"
            mode="aspectFill"
            @tap="previewGalleryMedia(media)"
          />
          <view v-else-if="media.kind === 'video'" class="gallery__video" @tap="previewGalleryMedia(media)">
            <image v-if="media.posterUrl" class="gallery__poster" :src="media.posterUrl" mode="aspectFill" />
            <view class="gallery__video-overlay">
              <wd-icon name="play-circle" size="46px" color="#fff" />
              <text>{{ media.fileName || '视频预览' }}</text>
            </view>
          </view>
          <view v-else class="gallery__file">
            <wd-icon name="file" size="34px" color="#7d8e86" />
            <text>{{ media.fileName || '附件' }}</text>
          </view>
        </swiper-item>
      </swiper>

      <view class="detail-main sl-card">
        <view class="sl-row-between">
          <text class="detail-title">{{ detail.title }}</text>
          <wd-tag :type="status.tone as any">
            {{ detail.statusName || status.label }}
          </wd-tag>
        </view>
        <text class="detail-community">{{ detail.communityName }} {{ detail.buildingName || '' }}</text>
        <view class="price-line">
          <text class="price">¥{{ formatMoney(detail.rentPrice) }}</text>
          <text class="unit">/月</text>
        </view>
        <view class="facts">
          <view><text>{{ detail.houseType }}</text><text>户型</text></view>
          <view><text>{{ formatArea(detail.area) }}</text><text>面积</text></view>
          <view><text>{{ detail.floorInfo || `${detail.floor || '--'}/${detail.totalFloors || '--'}层` }}</text><text>楼层</text></view>
        </view>
      </view>

      <view v-if="communityDetail && (communityDetail.lastUpdaterName || communityDetail.ownerName)" class="section sl-card">
        <sl-supply-contacts :community="communityDetail" />
      </view>

      <view class="section sl-card">
        <text class="section__title">房源信息</text>
        <view class="info-row">
          <text>朝向</text><text>{{ detail.orientation || '待补充' }}</text>
        </view>
        <view class="info-row">
          <text>装修</text><text>{{ detail.decoration || '待补充' }}</text>
        </view>
        <view class="info-row">
          <text>出租方式</text><text>{{ detail.rentalType || '待补充' }}</text>
        </view>
        <view class="info-row">
          <text>押付</text><text>{{ detail.depositRule || '待补充' }}</text>
        </view>
      </view>

      <view v-if="detail.tags?.length || detail.facilities?.length" class="section sl-card">
        <text class="section__title">标签与配套</text>
        <view class="tag-list">
          <wd-tag v-for="tag in detail.tags" :key="`tag-${String(tag.id)}`" plain>
            {{ tag.name }}
          </wd-tag>
          <wd-tag v-for="tag in detail.facilities" :key="`facility-${String(tag.id)}`" type="success" plain>
            {{ tag.name }}
          </wd-tag>
        </view>
      </view>

      <view class="section sl-card">
        <text class="section__title">描述</text>
        <text class="description">{{ detail.description || detail.remark || '暂无描述' }}</text>
      </view>

      <wd-popup v-model="videoPreviewVisible" custom-style="border-radius: 24rpx; overflow: hidden; width: 680rpx;" @touchmove.stop.prevent>
        <view class="video-preview" @tap.stop @touchmove.stop.prevent>
          <view class="video-preview__head">
            <text class="video-preview__title">{{ previewVideo?.fileName || '视频预览' }}</text>
            <view class="video-preview__actions">
              <wd-button size="small" plain icon="download" @click.stop="savePreviewVideo">
                保存
              </wd-button>
              <wd-icon name="close" size="20px" color="#72817b" @click.stop="previewVideo = null" />
            </view>
          </view>
          <video v-if="previewVideo" class="video-preview__player" :src="previewVideo.url" controls autoplay @longpress.stop="openSavePreviewMenu" />
        </view>
      </wd-popup>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail {
  padding-top: 0;
}

.loading {
  margin-top: 40rpx;
  padding: 40rpx;
  color: var(--sl-muted);
  text-align: center;
}

.gallery {
  height: 520rpx;
  margin: 0 -28rpx;
  background: #e8eee6;
}

.gallery__image {
  width: 100%;
  height: 100%;
}

.gallery__video,
.gallery__file {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  padding: 40rpx;
  text-align: center;
}

.gallery__video {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #0f6a4c, #163b32);
  color: #fff;
  font-size: 28rpx;
  font-weight: 900;
}

.gallery__poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.gallery__video-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  padding: 40rpx;
  background: rgb(16 38 31 / 22%);
}

.gallery__file {
  background: #edf2eb;
  color: var(--sl-muted);
  font-size: 26rpx;
  font-weight: 800;
}

.detail-main,
.section {
  margin-top: 22rpx;
  padding: 28rpx;
}

.detail-title {
  max-width: 520rpx;
  font-size: 38rpx;
  font-weight: 850;
  line-height: 1.25;
}

.detail-community {
  display: block;
  margin-top: 14rpx;
  color: var(--sl-muted);
  font-size: 25rpx;
}

.price-line {
  margin-top: 22rpx;
}

.price {
  color: #c26916;
  font-size: 48rpx;
  font-weight: 900;
}

.unit {
  color: #c26916;
  font-size: 24rpx;
}

.facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 26rpx;
}

.facts view {
  padding: 18rpx 10rpx;
  border-radius: 18rpx;
  background: #f2f6f0;
  text-align: center;
}

.facts text:first-child {
  display: block;
  font-size: 28rpx;
  font-weight: 800;
}

.facts text:last-child {
  display: block;
  margin-top: 8rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.section__title {
  display: block;
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 800;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--sl-line);
  color: var(--sl-muted);
  font-size: 26rpx;
}

.info-row:last-child {
  border-bottom: 0;
}

.info-row text:last-child {
  color: var(--sl-ink);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.description {
  color: #4e5d56;
  font-size: 27rpx;
  line-height: 1.7;
}

.video-preview {
  background: #fff;
}

.video-preview__head {
  position: relative;
  display: flex;
  min-height: 88rpx;
  box-sizing: border-box;
  align-items: center;
  padding: 20rpx 224rpx 20rpx 24rpx;
  color: var(--sl-ink);
  font-size: 28rpx;
  font-weight: 900;
}

.video-preview__title {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-preview__actions {
  position: absolute;
  z-index: 2;
  top: 50%;
  right: 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  transform: translateY(-50%);
}

.video-preview__player {
  display: block;
  width: 680rpx;
  height: 420rpx;
  background: #10261f;
}
</style>
