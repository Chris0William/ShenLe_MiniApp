<script setup lang="ts">
import type { ShenLeId, SlAccessMaterialOutput, SlUserApplicationDetailOutput } from '@/types/shenle'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { approveUser, downloadAccessApplicationMaterial, getUserApplicationDetail, rejectUser } from '@/api/user-manage'
import { useShenleAuthStore } from '@/store/auth'
import { useSafeTopStyle } from '@/utils/safe-area'
import { resolveAssetUrl } from '@/utils/shenle'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '申请详情',
  },
})

const safeTop = useSafeTopStyle()
const auth = useShenleAuthStore()
const applicationId = ref<ShenLeId>('')
const detail = ref<SlUserApplicationDetailOutput | null>(null)
const loading = ref(false)
const acting = ref(false)
const materialPaths = ref<Record<string, string>>({})
const rejectVisible = ref(false)
const rejectReason = ref('')

function goBack() {
  uni.navigateBack()
}

async function load() {
  if (!applicationId.value || loading.value)
    return
  loading.value = true
  try {
    detail.value = await getUserApplicationDetail(applicationId.value)
  }
  finally {
    loading.value = false
  }
}

async function previewMaterial(material: SlAccessMaterialOutput) {
  const key = String(material.fileId)
  let path = materialPaths.value[key]
  if (!path) {
    try {
      path = await downloadAccessApplicationMaterial(material.fileId)
      materialPaths.value[key] = path
    }
    catch {
      return
    }
  }
  const urls = detail.value?.materials.map(item => materialPaths.value[String(item.fileId)]).filter(Boolean) || []
  uni.previewImage({ current: path, urls: urls.length ? urls : [path] })
}

async function approve() {
  if (!detail.value || acting.value)
    return
  uni.showModal({
    title: '通过申请',
    content: `通过「${detail.value.nickName || '该用户'}」的申请？对方将升级为普通用户。`,
    success: async (result) => {
      if (!result.confirm)
        return
      acting.value = true
      try {
        await approveUser({ applicationId: detail.value!.applicationId })
        uni.showToast({ title: '已通过', icon: 'success' })
        setTimeout(goBack, 500)
      }
      finally {
        acting.value = false
      }
    },
  })
}

function openReject() {
  if (!detail.value || acting.value)
    return
  rejectReason.value = ''
  rejectVisible.value = true
}

async function submitReject() {
  if (!detail.value || acting.value)
    return
  const reason = rejectReason.value.trim()
  if (reason.length > 500) {
    uni.showToast({ title: '拒绝原因不能超过500个字符', icon: 'none' })
    return
  }
  acting.value = true
  try {
    await rejectUser({ applicationId: detail.value.applicationId, rejectReason: reason || undefined })
    rejectVisible.value = false
    uni.showToast({ title: '已拒绝', icon: 'none' })
    setTimeout(goBack, 500)
  }
  finally {
    acting.value = false
  }
}

onLoad((query) => {
  applicationId.value = String(query?.applicationId || '')
  if (!auth.isSuperAdmin) {
    uni.showToast({ title: '无权限', icon: 'none' })
    setTimeout(goBack, 500)
    return
  }
  void load()
})
</script>

<template>
  <view class="page" :style="safeTop">
    <view class="head">
      <view class="head__back" role="button" aria-label="返回" @tap="goBack">
        <wd-icon name="arrow-left" size="20px" color="#126b4f" />
      </view>
      <view class="head__main">
        <text class="head__title">申请详情</text>
        <text class="head__desc">查看申请资料后进行审核</text>
      </view>
    </view>

    <view v-if="loading && !detail" class="empty sl-card">
      <wd-loading color="#126b4f" />
      <text>正在加载申请资料</text>
    </view>

    <template v-else-if="detail">
      <view class="identity sl-card">
        <image class="avatar" :src="resolveAssetUrl(detail.avatar) || '/static/images/default-avatar.png'" mode="aspectFill" />
        <view class="identity__main">
          <text class="identity__name">{{ detail.nickName || '微信用户' }}</text>
          <text class="identity__meta">{{ detail.phone || '未绑定手机号' }}</text>
        </view>
        <view class="status">
          {{ detail.applyStatus === 1 ? '待审核' : detail.applyStatus === 2 ? '已通过' : '已拒绝' }}
        </view>
      </view>

      <view class="info sl-card">
        <view class="info-row">
          <text class="info-row__label">企业名称</text>
          <text class="info-row__value">{{ detail.enterpriseName || '未填写' }}</text>
        </view>
        <view class="info-row">
          <text class="info-row__label">真实姓名</text>
          <text class="info-row__value">{{ detail.realName || '未填写' }}</text>
        </view>
        <view class="info-row">
          <text class="info-row__label">申请时间</text>
          <text class="info-row__value">{{ detail.applyTime || '未知' }}</text>
        </view>
        <view v-if="detail.rejectReason" class="info-row info-row--reason">
          <text class="info-row__label">审核备注</text>
          <text class="info-row__value">{{ detail.rejectReason }}</text>
        </view>
      </view>

      <view class="materials sl-card">
        <view class="section-head">
          <text class="section-title">证明材料</text>
          <text class="section-count">{{ detail.materials.length }} 张</text>
        </view>
        <view v-if="detail.materials.length" class="material-grid">
          <view v-for="item in detail.materials" :key="String(item.fileId)" class="material" @tap="previewMaterial(item)">
            <image v-if="materialPaths[String(item.fileId)]" class="material__image" :src="materialPaths[String(item.fileId)]" mode="aspectFill" />
            <view v-else class="material__placeholder">
              <wd-icon name="image" size="28px" color="#839088" />
              <text>点击查看</text>
            </view>
            <text class="material__name">{{ item.fileName || '证明材料' }}</text>
          </view>
        </view>
        <view v-else class="materials-empty">
          该申请没有上传证明材料
        </view>
      </view>

      <view v-if="detail.applyStatus === 1" class="actions">
        <wd-button plain type="error" :disabled="acting" @click="openReject">
          拒绝
        </wd-button>
        <wd-button type="success" :loading="acting" @click="approve">
          通过
        </wd-button>
      </view>
    </template>

    <wd-popup v-model="rejectVisible" position="bottom" :z-index="2200" custom-style="border-radius: 24rpx 24rpx 0 0; overflow: hidden;" safe-area-inset-bottom @touchmove.stop.prevent>
      <view class="reject-sheet" @tap.stop @touchmove.stop.prevent>
        <view class="reject-sheet__head">
          <text class="reject-sheet__title">拒绝申请</text>
          <view class="reject-sheet__close" role="button" aria-label="关闭" @tap="rejectVisible = false">
            <wd-icon name="close" size="20px" color="#72817b" />
          </view>
        </view>
        <text class="reject-sheet__hint">拒绝原因可选，用户可重新提交申请。</text>
        <textarea v-model="rejectReason" class="reject-sheet__input" :maxlength="500" placeholder="填写拒绝原因（可选）" auto-height />
        <view class="reject-sheet__actions">
          <wd-button plain :disabled="acting" @click="rejectVisible = false">
            取消
          </wd-button>
          <wd-button type="error" :loading="acting" @click="submitReject">
            确认拒绝
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 14rpx 24rpx calc(150rpx + env(safe-area-inset-bottom));
  background: #f4f7f2;
}
.head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 4rpx 2rpx 18rpx;
}
.head__back {
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
.head__title {
  display: block;
  font-size: 34rpx;
  font-weight: 850;
}
.head__desc {
  display: block;
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}
.identity {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx;
}
.avatar {
  width: 84rpx;
  height: 84rpx;
  flex: none;
  border-radius: 999rpx;
  background: #edf2eb;
}
.identity__main {
  min-width: 0;
  flex: 1;
}
.identity__name,
.identity__meta {
  display: block;
}
.identity__name {
  font-size: 29rpx;
  font-weight: 850;
}
.identity__meta {
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}
.status {
  flex: none;
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  background: #fff1d7;
  color: #a8680a;
  font-size: 21rpx;
  font-weight: 800;
}
.info,
.materials {
  margin-top: 16rpx;
  padding: 22rpx 24rpx;
}
.info-row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #edf1ee;
}
.info-row:last-child {
  border-bottom: 0;
}
.info-row__label {
  width: 150rpx;
  flex: none;
  color: var(--sl-muted);
  font-size: 23rpx;
}
.info-row__value {
  min-width: 0;
  flex: 1;
  color: var(--sl-ink);
  font-size: 24rpx;
  text-align: right;
  overflow-wrap: anywhere;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-title {
  font-size: 28rpx;
  font-weight: 850;
}
.section-count {
  color: var(--sl-brand);
  font-size: 23rpx;
  font-weight: 800;
}
.material-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 18rpx;
}
.material {
  position: relative;
  height: 190rpx;
  overflow: hidden;
  border-radius: 10rpx;
  background: #edf3ef;
}
.material__image,
.material__placeholder {
  width: 100%;
  height: 150rpx;
}
.material__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6rpx;
  color: #839088;
  font-size: 19rpx;
}
.material__name {
  display: block;
  padding: 8rpx 10rpx 0;
  overflow: hidden;
  color: #53635c;
  font-size: 18rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.materials-empty,
.empty {
  color: var(--sl-muted);
  font-size: 24rpx;
}
.materials-empty {
  padding: 32rpx 0 14rpx;
  text-align: center;
}
.empty {
  display: flex;
  min-height: 300rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14rpx;
}
.actions {
  position: fixed;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  left: 24rpx;
  z-index: 20;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  padding: 16rpx;
  border: 1rpx solid #e3ebe5;
  border-radius: 14rpx;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 10rpx 32rpx rgb(31 60 45 / 14%);
}
.reject-sheet {
  padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  background: #fff;
}
.reject-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.reject-sheet__title {
  color: var(--sl-ink);
  font-size: 31rpx;
  font-weight: 850;
}
.reject-sheet__close {
  display: flex;
  width: 52rpx;
  height: 52rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #f2f6f3;
}
.reject-sheet__hint {
  display: block;
  margin-top: 12rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}
.reject-sheet__input {
  width: 100%;
  min-height: 180rpx;
  box-sizing: border-box;
  margin-top: 20rpx;
  padding: 18rpx;
  border: 1rpx solid #dfe8e1;
  border-radius: 10rpx;
  background: #f7faf8;
  color: var(--sl-ink);
  font-size: 24rpx;
  line-height: 1.55;
}
.reject-sheet__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-top: 22rpx;
}
</style>
