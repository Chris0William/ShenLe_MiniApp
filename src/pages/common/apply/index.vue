<script setup lang="ts">
import type { MyAccessApplicationOutput, ShenLeId, SlAccessMaterialOutput } from '@/types/shenle'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { applyAccess, deleteAccessApplicationMaterial, downloadAccessApplicationMaterial, getMyAccess, saveAccessApplicationDraft, uploadAccessApplicationMaterial } from '@/api/user-manage'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { tabbarStore } from '@/tabbar/store'

definePage({
  style: {
    navigationBarTitleText: '申请使用',
  },
})

const auth = useShenleAuthStore()
const applyStatus = ref(0)
const applicationId = ref<ShenLeId | null>(null)
const application = ref<MyAccessApplicationOutput | null>(null)
const enterpriseName = ref('')
const realName = ref('')
const materials = ref<SlAccessMaterialOutput[]>([])
const materialPaths = ref<Record<string, string>>({})
const loading = ref(false)
const submitting = ref(false)
const uploading = ref(false)

const canEdit = computed(() => applyStatus.value !== 1 && applyStatus.value !== 2)
const materialCountText = computed(() => `${materials.value.length}/9`)

function enterApp() {
  modeStore.setMode('user')
  tabbarStore.setCurIdx(0)
  uni.reLaunch({ url: '/pages/user/map/index' })
}

function applySnapshot(next?: MyAccessApplicationOutput | null) {
  application.value = next || null
  applicationId.value = next?.applicationId || null
  enterpriseName.value = next?.enterpriseName || ''
  realName.value = next?.realName || ''
  materials.value = [...(next?.materials || [])].sort((a, b) => a.sortNo - b.sortNo)
  materialPaths.value = {}
}

async function refresh() {
  if (loading.value)
    return
  loading.value = true
  try {
    const res = await getMyAccess()
    applyStatus.value = res.applyStatus
    applySnapshot(res.application)
    if (res.accountType >= 777) {
      await auth.refreshUser(true).catch(() => {})
      enterApp()
    }
  }
  finally {
    loading.value = false
  }
}

async function ensureDraft() {
  if (applicationId.value)
    return applicationId.value
  const id = await saveAccessApplicationDraft({
    enterpriseName: enterpriseName.value.trim(),
    realName: realName.value.trim(),
  })
  applicationId.value = id
  return id
}

function chooseImage() {
  return new Promise<string[]>((resolve, reject) => {
    uni.chooseImage({
      count: Math.max(1, 9 - materials.value.length),
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: result => resolve(Array.isArray(result.tempFilePaths) ? result.tempFilePaths : [result.tempFilePaths].filter(Boolean)),
      fail: reject,
    })
  })
}

function getLocalFileSize(filePath: string) {
  return new Promise<number>((resolve, reject) => {
    uni.getFileInfo({ filePath, success: result => resolve(result.size), fail: reject })
  })
}

async function addMaterials() {
  if (!canEdit.value || uploading.value || materials.value.length >= 9)
    return
  if (!enterpriseName.value.trim() || !realName.value.trim()) {
    uni.showToast({ title: '请先填写企业名称和真实姓名', icon: 'none' })
    return
  }
  uploading.value = true
  try {
    const paths = await chooseImage()
    const id = await ensureDraft()
    for (const path of paths) {
      const size = await getLocalFileSize(path)
      if (size > 10 * 1024 * 1024) {
        uni.showToast({ title: '单张证明材料不能超过10MB', icon: 'none' })
        continue
      }
      const material = await uploadAccessApplicationMaterial(id, path)
      materials.value.push(material)
      materialPaths.value[String(material.fileId)] = path
    }
  }
  catch {}
  finally {
    uploading.value = false
  }
}

async function removeMaterial(material: SlAccessMaterialOutput) {
  if (!canEdit.value || uploading.value || !applicationId.value)
    return
  try {
    await deleteAccessApplicationMaterial(applicationId.value, material.fileId)
    materials.value = materials.value.filter(item => String(item.fileId) !== String(material.fileId))
    delete materialPaths.value[String(material.fileId)]
  }
  catch {}
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
  const urls = materials.value.map(item => materialPaths.value[String(item.fileId)]).filter(Boolean)
  uni.previewImage({ current: path, urls: urls.length ? urls : [path] })
}

async function submitApply() {
  if (submitting.value)
    return
  const company = enterpriseName.value.trim()
  const name = realName.value.trim()
  if (!company || !name) {
    uni.showToast({ title: '请填写企业名称和真实姓名', icon: 'none' })
    return
  }
  if (!materials.value.length) {
    uni.showToast({ title: '请至少上传1张证明材料', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const id = await ensureDraft()
    await applyAccess({
      applyType: 0,
      applicationId: id,
      enterpriseName: company,
      realName: name,
      proofFileIds: materials.value.map(item => item.fileId),
    })
    applyStatus.value = 1
    uni.showToast({ title: '已提交申请', icon: 'success' })
  }
  catch {}
  finally {
    submitting.value = false
  }
}

async function signOut() {
  await auth.signOut()
  uni.reLaunch({ url: '/pages/user/map/index' })
}

onShow(() => {
  if (auth.canUseApp) {
    enterApp()
    return
  }
  if (auth.isLogin)
    void refresh()
})
</script>

<template>
  <view class="sl-page apply-page">
    <view class="hero">
      <view class="hero__icon">
        <wd-icon name="lock-on" size="46px" color="#126b4f" />
      </view>
      <text class="hero__title">深租宝典</text>
      <text class="hero__sub">提交资料后等待管理员审核</text>
    </view>

    <view class="card sl-card">
      <view class="profile">
        <image class="avatar" :src="auth.user?.avatar || '/static/images/default-avatar.png'" mode="aspectFill" />
        <view class="profile__main">
          <text class="name">{{ auth.displayName }}</text>
          <text class="meta">游客 · {{ applyStatus === 1 ? '待审核' : applyStatus === 3 ? '可重新申请' : '待提交' }}</text>
        </view>
      </view>

      <view v-if="applyStatus !== 1 && applyStatus !== 2" class="form">
        <wd-input v-model="enterpriseName" label="企业名称" placeholder="请输入企业名称" clearable :disabled="!canEdit" />
        <wd-input v-model="realName" label="真实姓名" placeholder="请输入真实姓名" clearable :disabled="!canEdit" />

        <view class="material-head">
          <view>
            <text class="section-title">证明材料</text>
            <text class="section-desc">营业执照等图片，最多9张</text>
          </view>
          <text class="material-count">{{ materialCountText }}</text>
        </view>
        <view class="materials">
          <view v-for="item in materials" :key="String(item.fileId)" class="material" @tap="previewMaterial(item)">
            <image v-if="materialPaths[String(item.fileId)]" class="material__image" :src="materialPaths[String(item.fileId)]" mode="aspectFill" />
            <view v-else class="material__loading">
              <wd-icon name="image" size="24px" color="#839088" />
            </view>
            <view class="material__remove" @tap.stop="removeMaterial(item)">
              <wd-icon name="close" size="13px" color="#fff" />
            </view>
          </view>
          <view v-if="materials.length < 9" class="material material--add" @tap="addMaterials">
            <wd-loading v-if="uploading" color="#126b4f" />
            <wd-icon v-else name="add" size="28px" color="#126b4f" />
            <text>{{ uploading ? '上传中' : '上传' }}</text>
          </view>
        </view>

        <wd-button block type="success" :loading="submitting" @click="submitApply">
          {{ applyStatus === 3 ? '重新提交申请' : '提交申请' }}
        </wd-button>
      </view>

      <view v-else-if="applyStatus === 1" class="state state--pending">
        <wd-icon name="time" size="40px" color="#b46d08" />
        <text class="state__title">申请已提交</text>
        <text class="state__desc">管理员审核通过后即可使用完整功能</text>
        <view class="submitted-summary">
          <text>企业名称：{{ application?.enterpriseName || '已提交' }}</text>
          <text>真实姓名：{{ application?.realName || '已提交' }}</text>
          <text>证明材料：{{ application?.materials.length || 0 }} 张</text>
        </view>
        <wd-button plain block type="success" :loading="loading" @click="refresh">
          刷新审核状态
        </wd-button>
      </view>

      <view v-else class="state state--pending">
        <wd-icon name="check-circle" size="40px" color="#126b4f" />
        <text class="state__title">申请已通过</text>
        <wd-button block type="success" @click="enterApp">
          进入业务员端
        </wd-button>
      </view>
    </view>

    <view class="foot" @tap="signOut">
      <text>退出登录</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.apply-page {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  padding-top: 60rpx;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 34rpx;
}
.hero__icon {
  display: flex;
  width: 132rpx;
  height: 132rpx;
  align-items: center;
  justify-content: center;
  border-radius: 38rpx;
  background: rgb(18 107 79 / 10%);
}
.hero__title {
  font-size: 40rpx;
  font-weight: 900;
}
.hero__sub {
  color: var(--sl-muted);
  font-size: 25rpx;
}
.card {
  padding: 30rpx 28rpx;
}
.profile {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid var(--sl-line);
}
.profile__main {
  min-width: 0;
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 999rpx;
  background: #edf2eb;
}
.name,
.meta,
.section-title,
.section-desc,
.state__title,
.state__desc,
.submitted-summary text {
  display: block;
}
.name {
  font-size: 30rpx;
  font-weight: 850;
}
.meta,
.section-desc,
.state__desc,
.submitted-summary text {
  color: var(--sl-muted);
  font-size: 23rpx;
}
.meta {
  margin-top: 6rpx;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding-top: 22rpx;
}
.material-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 8rpx;
}
.section-title {
  color: var(--sl-ink);
  font-size: 28rpx;
  font-weight: 850;
}
.section-desc {
  margin-top: 5rpx;
}
.material-count {
  color: var(--sl-brand);
  font-size: 24rpx;
  font-weight: 800;
}
.materials {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}
.material {
  position: relative;
  height: 178rpx;
  overflow: hidden;
  border-radius: 10rpx;
  background: #edf3ef;
}
.material__image,
.material__loading {
  width: 100%;
  height: 100%;
}
.material__loading,
.material--add {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8rpx;
  color: #839088;
  font-size: 21rpx;
}
.material--add {
  border: 1rpx dashed #b8c8bd;
  background: #f6faf7;
  color: var(--sl-brand);
}
.material__remove {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  display: flex;
  width: 38rpx;
  height: 38rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgb(28 40 34 / 72%);
}
.state {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 18rpx;
  padding-top: 34rpx;
  text-align: center;
}
.state__title {
  color: var(--sl-ink);
  font-size: 30rpx;
  font-weight: 850;
}
.submitted-summary {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  padding: 18rpx;
  align-items: flex-start;
  gap: 8rpx;
  border-radius: 8rpx;
  background: #f4f8f4;
  flex-direction: column;
  text-align: left;
}
.foot {
  margin-top: auto;
  padding: 40rpx;
  color: var(--sl-muted);
  font-size: 25rpx;
  text-align: center;
}
</style>
