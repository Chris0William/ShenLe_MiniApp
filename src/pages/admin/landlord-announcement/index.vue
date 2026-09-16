<script setup lang="ts">
import type { ShenLeId, SlLandlordAnnouncementListOutput } from '@/types/shenle'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import {
  deleteLandlordAnnouncement,
  getLandlordAnnouncementList,
  saveLandlordAnnouncement,
  setLandlordAnnouncementDisplayed,
} from '@/api/landlord-announcement'
import { uploadFile } from '@/api/file'
import { useShenleAuthStore } from '@/store/auth'
import { useSafeTopStyle } from '@/utils/safe-area'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '房东公告', disableScroll: true } })

interface TextBlock {
  type: 'text'
  text: string
  size: 's' | 'm' | 'l' | 'xl'
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
}
interface ImageBlock {
  type: 'image'
  url: string
}
type Block = TextBlock | ImageBlock

const FONT_SIZES = { s: '24rpx', m: '28rpx', l: '34rpx', xl: '42rpx' } as const
const FONT_SIZE_LABELS = { s: '小', m: '标准', l: '大', xl: '特大' } as const
const COLOR_OPTIONS = ['#1e2f27', '#126b4f', '#e4a11b', '#c94832', '#2f66ee', '#7c3aed', '#0e7490', '#92400e'] as const

const auth = useShenleAuthStore()
const safeTop = useSafeTopStyle()
const screen = ref<'list' | 'edit' | 'preview'>('list')
const list = ref<SlLandlordAnnouncementListOutput[]>([])
const loading = ref(false)
const saving = ref(false)

const editTitle = ref('')
const blocks = ref<Block[]>([])
const editingId = ref<ShenLeId | null>(null)

const previewHtml = computed(() => blocksToHtml(blocks.value))

function blocksToHtml(items: Block[]) {
  return items.map((block) => {
    if (block.type === 'image')
      return `<img src="${block.url}" style="width:100%;border-radius:8px;margin:8px 0;display:block;" />`
    const style = [
      `font-size:${FONT_SIZES[block.size]}`,
      `color:${block.color}`,
      block.bold ? 'font-weight:700' : '',
      block.italic ? 'font-style:italic' : '',
      `text-align:${block.align}`,
    ].filter(Boolean).join(';')
    const lines = block.text.split('\n').map(line => `<div>${escapeHtml(line) || '&nbsp;'}</div>`).join('')
    return `<div style="${style};line-height:1.6;margin:6px 0;">${lines}</div>`
  }).join('')
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function blocksFromJson(json?: string | null): Block[] {
  if (!json)
    return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

async function refresh() {
  loading.value = true
  try {
    list.value = await getLandlordAnnouncementList()
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  }
  finally {
    loading.value = false
  }
}

onLoad(() => {
  if (!auth.isSuperAdmin) {
    uni.showToast({ title: '仅超级管理员可管理公告', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  refresh()
})

function openCreate() {
  editingId.value = null
  editTitle.value = ''
  blocks.value = [{ type: 'text', text: '', size: 'm', color: COLOR_OPTIONS[0], bold: false, italic: false, align: 'left' }]
  screen.value = 'edit'
}

function openEdit(item: SlLandlordAnnouncementListOutput) {
  editingId.value = item.id
  editTitle.value = item.title || ''
  const restored = blocksFromJson(item.blocksJson)
  blocks.value = restored.length ? restored : [{ type: 'text', text: stripHtml(item.content || ''), size: 'm', color: COLOR_OPTIONS[0], bold: false, italic: false, align: 'left' }]
  screen.value = 'edit'
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
}

function addTextBlock() {
  blocks.value.push({ type: 'text', text: '', size: 'm', color: COLOR_OPTIONS[0], bold: false, italic: false, align: 'left' })
}

async function addImageBlock() {
  try {
    const choose = await new Promise<string>((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: res => resolve(res.tempFilePaths[0]),
        fail: reject,
      })
    })
    uni.showLoading({ title: '上传图片中' })
    const uploaded = await uploadFile(choose, { fileType: 'landlord_announcement' })
    if (!uploaded.url)
      throw new Error('图片上传失败')
    blocks.value.push({ type: 'image', url: uploaded.url })
  }
  catch (error) {
    if ((error as unknown as { errMsg?: string })?.errMsg?.includes('cancel'))
      return
    uni.showToast({ title: error instanceof Error ? error.message : '图片上传失败', icon: 'none' })
  }
  finally {
    uni.hideLoading()
  }
}

function removeBlock(index: number) {
  blocks.value.splice(index, 1)
}

function moveBlock(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= blocks.value.length)
    return
  const [item] = blocks.value.splice(index, 1)
  blocks.value.splice(target, 0, item)
}

async function save(displayAfterSave = true) {
  if (saving.value)
    return
  const hasContent = blocks.value.some(block => (block.type === 'text' ? block.text.trim() : true))
  if (!editTitle.value.trim() && !hasContent) {
    uni.showToast({ title: '标题和内容不能同时为空', icon: 'none' })
    return
  }
  saving.value = true
  try {
    await saveLandlordAnnouncement({
      id: editingId.value,
      title: editTitle.value.trim() || null,
      content: blocksToHtml(blocks.value),
      blocksJson: JSON.stringify(blocks.value),
      displayAfterSave,
    })
    uni.showToast({ title: displayAfterSave ? '已保存并设为显示' : '已保存', icon: 'success' })
    screen.value = 'list'
    await refresh()
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

async function markDisplayed(item: SlLandlordAnnouncementListOutput) {
  try {
    await setLandlordAnnouncementDisplayed(item.id)
    uni.showToast({ title: '已设为当前显示', icon: 'success' })
    await refresh()
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '设置失败', icon: 'none' })
  }
}

function confirmDelete(item: SlLandlordAnnouncementListOutput) {
  uni.showModal({
    title: '删除公告',
    content: `确定删除「${item.title || `版本 ${item.version}`}」吗？${item.isDisplayed ? '该公告正在显示，删除后房东端将无公告弹出。' : ''}`,
    confirmColor: '#c94832',
    success: async (result) => {
      if (!result.confirm)
        return
      try {
        await deleteLandlordAnnouncement(item.id)
        uni.showToast({ title: '已删除', icon: 'success' })
        await refresh()
      }
      catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : '删除失败', icon: 'none' })
      }
    },
  })
}

function previewBlockStyle(block: TextBlock) {
  return {
    fontSize: FONT_SIZES[block.size],
    color: block.color,
    fontWeight: block.bold ? '700' : '400',
    fontStyle: block.italic ? 'italic' : 'normal',
    textAlign: block.align,
  }
}
</script>

<template>
  <view class="page" :style="safeTop">
    <view class="nav-head">
      <view class="nav-back" @tap="screen = 'list'">
        <wd-icon v-if="screen !== 'list'" name="arrow-left" size="20px" color="#1e2f27" />
      </view>
      <text class="nav-title">{{ screen === 'edit' ? (editingId ? '编辑公告' : '新建公告') : '房东公告' }}</text>
      <view class="nav-spacer" />
    </view>

    <!-- 列表 -->
    <scroll-view v-if="screen === 'list'" scroll-y class="body">
      <view class="head-card sl-card">
        <text class="head-card__title">公告管理</text>
        <text class="head-card__desc">编辑富文本公告，指定一条对房东端弹窗显示；新版本号自动递增，房东端会重新弹出。</text>
        <wd-button block type="primary" size="large" @click="openCreate">
          新建公告
        </wd-button>
      </view>

      <view v-if="loading && !list.length" class="empty">
        <wd-loading color="#126b4f" />
      </view>
      <view v-else-if="!list.length" class="empty">
        <text>暂无公告，点击上方按钮新建</text>
      </view>

      <view v-for="item in list" :key="String(item.id)" class="ann-card sl-card">
        <view class="ann-card__head">
          <view class="ann-card__title-wrap">
            <text class="ann-card__title">{{ item.title || '（无标题）' }}</text>
            <view class="ann-card__tags">
              <text class="ann-card__version">v{{ item.version }}</text>
              <text v-if="item.isDisplayed" class="ann-card__displaying">显示中</text>
            </view>
          </view>
          <text class="ann-card__time">{{ item.updateTime ? item.updateTime.slice(0, 16).replace('T', ' ') : '' }}</text>
        </view>
        <view class="ann-card__actions">
          <wd-button size="small" plain @click="openEdit(item)">
            编辑
          </wd-button>
          <wd-button v-if="!item.isDisplayed" size="small" type="success" plain @click="markDisplayed(item)">
            设为显示
          </wd-button>
          <wd-button size="small" type="error" plain @click="confirmDelete(item)">
            删除
          </wd-button>
        </view>
      </view>
      <view class="bottom-space" />
    </scroll-view>

    <!-- 编辑器 -->
    <scroll-view v-else-if="screen === 'edit'" scroll-y class="body">
      <view class="form-card sl-card">
        <text class="form-label">标题（可选）</text>
        <input v-model="editTitle" class="title-input" placeholder="例如：租金结算方式调整通知" :maxlength="60">

        <text class="form-label">内容</text>
        <view v-for="(block, index) in blocks" :key="index" class="block-editor">
          <template v-if="block.type === 'text'">
            <view class="block-toolbar">
              <view class="tool-row">
                <view
                  v-for="(size, key) in FONT_SIZE_LABELS"
                  :key="key"
                  class="tool-chip"
                  :class="{ active: block.size === key }"
                  @tap="block.size = key as TextBlock['size']"
                >
                  {{ size }}
                </view>
                <view class="tool-chip" :class="{ active: block.bold }" @tap="block.bold = !block.bold">B</view>
                <view class="tool-chip" :class="{ active: block.italic }" @tap="block.italic = !block.italic">I</view>
              </view>
              <view class="tool-row">
                <view
                  v-for="color in COLOR_OPTIONS"
                  :key="color"
                  class="tool-color"
                  :class="{ active: block.color === color }"
                  :style="{ background: color }"
                  @tap="block.color = color"
                />
                <view
                  v-for="align in (['left', 'center', 'right'] as const)"
                  :key="align"
                  class="tool-chip"
                  :class="{ active: block.align === align }"
                  @tap="block.align = align"
                >
                  {{ align === 'left' ? '左' : align === 'center' ? '中' : '右' }}
                </view>
              </view>
            </view>
            <textarea
              v-model="block.text"
              class="block-textarea"
              placeholder="输入文字，支持换行与表情"
              :maxlength="2000"
              auto-height
             :cursor-spacing="24" :adjust-position="true"/>
            <view class="block-preview" :style="previewBlockStyle(block)">{{ block.text || '预览效果' }}</view>
          </template>
          <template v-else>
            <image :src="block.url" mode="widthFix" class="block-image" />
          </template>
          <view class="block-ops">
            <view class="block-op" @tap="moveBlock(index, -1)">
              <wd-icon name="arrow-up" size="16px" color="#72817b" />
            </view>
            <view class="block-op" @tap="moveBlock(index, 1)">
              <wd-icon name="arrow-down" size="16px" color="#72817b" />
            </view>
            <view class="block-op block-op--danger" @tap="removeBlock(index)">
              <wd-icon name="delete" size="16px" color="#c94832" />
            </view>
          </view>
        </view>

        <view class="add-row">
          <wd-button size="small" plain icon="add" @click="addTextBlock">
            文字段落
          </wd-button>
          <wd-button size="small" plain icon="picture" @click="addImageBlock">
            插入图片
          </wd-button>
        </view>

        <view class="preview-card">
          <text class="form-label">整体预览（房东端效果）</text>
          <rich-text :nodes="previewHtml" class="preview-rich" />
        </view>
      </view>

      <view class="save-row">
        <wd-button block size="large" plain @click="save(false)">
          仅保存
        </wd-button>
        <wd-button block size="large" type="primary" :loading="saving" @click="save(true)">
          保存并显示
        </wd-button>
      </view>
      <view class="bottom-space" />
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.page {
  display: flex;
  height: 100vh;
  box-sizing: border-box;
  flex-direction: column;
  background: #f4f7f2;
}

.nav-head {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
}

.nav-back {
  width: 64rpx;
  height: 64rpx;
}

.nav-title {
  flex: 1;
  color: #1e2f27;
  font-size: 34rpx;
  font-weight: 850;
  text-align: center;
}

.nav-spacer {
  width: 64rpx;
}

.body {
  min-height: 0;
  flex: 1;
  box-sizing: border-box;
  padding: 0 24rpx;
}

.head-card {
  padding: 30rpx 28rpx;
}

.head-card__title {
  display: block;
  color: #1e2f27;
  font-size: 30rpx;
  font-weight: 800;
}

.head-card__desc {
  display: block;
  margin: 12rpx 0 24rpx;
  color: #72817b;
  font-size: 23rpx;
  line-height: 1.6;
}

.empty {
  display: flex;
  min-height: 300rpx;
  align-items: center;
  justify-content: center;
  color: #72817b;
  font-size: 24rpx;
}

.ann-card {
  margin-top: 20rpx;
  padding: 26rpx 28rpx;
}

.ann-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.ann-card__title-wrap {
  min-width: 0;
  flex: 1;
}

.ann-card__title {
  color: #1e2f27;
  font-size: 28rpx;
  font-weight: 700;
}

.ann-card__tags {
  display: flex;
  gap: 12rpx;
  margin-top: 8rpx;
  align-items: center;
}

.ann-card__version {
  padding: 2rpx 14rpx;
  border-radius: 999rpx;
  background: #eef2ee;
  color: #72817b;
  font-size: 21rpx;
}

.ann-card__displaying {
  padding: 2rpx 14rpx;
  border-radius: 999rpx;
  background: #126b4f;
  color: #fff;
  font-size: 21rpx;
  font-weight: 700;
}

.ann-card__time {
  flex: 0 0 auto;
  color: #a3ab a4;
  color: #a3aba4;
  font-size: 21rpx;
}

.ann-card__actions {
  display: flex;
  gap: 14rpx;
  margin-top: 20rpx;
}

.form-card {
  padding: 28rpx;
}

.form-label {
  display: block;
  margin: 18rpx 0 12rpx;
  color: #1e2f27;
  font-size: 26rpx;
  font-weight: 700;
}

.title-input {
  box-sizing: border-box;
  width: 100%;
  padding: 20rpx 24rpx;
  border-radius: 14rpx;
  background: #f6f8f5;
  font-size: 28rpx;
}

.block-editor {
  margin-top: 20rpx;
  padding: 20rpx;
  border: 1rpx solid #e2e8e3;
  border-radius: 16rpx;
  background: #fbfdfa;
}

.block-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.tool-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  align-items: center;
}

.tool-chip {
  min-width: 60rpx;
  box-sizing: border-box;
  padding: 10rpx 18rpx;
  border-radius: 10rpx;
  background: #eef2ee;
  color: #4b5563;
  font-size: 23rpx;
  font-weight: 700;
  text-align: center;
}

.tool-chip.active {
  background: #126b4f;
  color: #fff;
}

.tool-color {
  width: 44rpx;
  height: 44rpx;
  border-radius: 999rpx;
  border: 3rpx solid #fff;
  box-shadow: 0 0 0 2rpx #dfe5e1;
}

.tool-color.active {
  box-shadow: 0 0 0 4rpx #126b4f;
}

.block-textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 120rpx;
  padding: 18rpx;
  border-radius: 12rpx;
  background: #fff;
  font-size: 27rpx;
}

.block-preview {
  margin-top: 14rpx;
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
  background: #fff;
  line-height: 1.6;
  word-break: break-all;
}

.block-image {
  width: 100%;
  border-radius: 12rpx;
}

.block-ops {
  display: flex;
  gap: 16rpx;
  justify-content: flex-end;
  margin-top: 14rpx;
}

.block-op {
  display: flex;
  width: 60rpx;
  height: 60rpx;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: #eef2ee;
}

.block-op--danger {
  background: #fbecea;
}

.add-row {
  display: flex;
  gap: 16rpx;
  margin-top: 22rpx;
}

.preview-card {
  margin-top: 24rpx;
  padding: 22rpx;
  border-radius: 16rpx;
  background: #fff;
}

.preview-rich {
  margin-top: 8rpx;
}

.save-row {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 20rpx;
  margin-top: 26rpx;
}

.bottom-space {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
