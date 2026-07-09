<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { scanLoginConfirm, scanLoginReject } from '@/api/scan-login'
import { useShenleAuthStore } from '@/store/auth'
import { promptProtectedLogin } from '@/utils/login-flow'

definePage({ style: { navigationBarTitleText: '确认登录' } })

const auth = useShenleAuthStore()
const ticket = ref('')
const loading = ref(false)
const done = ref<'' | 'confirmed' | 'rejected'>('')

onLoad((query) => {
  // 扫 getUnlimited 码进入时，scene 即登录票据（uni-app 已解码）
  ticket.value = decodeURIComponent(String(query?.scene || query?.ticket || ''))
  if (!auth.isLogin)
    promptProtectedLogin('登录后才能确认电脑端后台登录')
})

async function onConfirm() {
  if (!ticket.value || loading.value)
    return
  loading.value = true
  try {
    // 关键：即使非管理员也提交——让后端做 ≥888 判定并置 ticket=denied，
    // 这样电脑端 poll 才会收到 denied 并显示“非管理员”；否则电脑端只会干等到过期。
    // 后端对 <888 会抛“该微信账号非后台管理员(需≥888)”，由 request.ts 统一 toast。
    await scanLoginConfirm(ticket.value)
    done.value = 'confirmed'
    uni.showToast({ title: '已确认，请回到电脑端', icon: 'success' })
  }
  catch { /* 非管理员/过期等错误由 request.ts toast；后端已置 denied，电脑端会收到 */ }
  finally { loading.value = false }
}

async function onReject() {
  if (!ticket.value || loading.value)
    return
  loading.value = true
  try {
    await scanLoginReject(ticket.value)
    done.value = 'rejected'
    uni.showToast({ title: '已取消', icon: 'none' })
  }
  catch {}
  finally { loading.value = false }
}
</script>

<template>
  <view class="sl-page">
    <view class="login-card sl-card">
      <wd-icon name="computer" size="42px" color="#126b4f" />
      <text class="card-title">深乐租后台 · 确认登录</text>
      <text class="card-desc">
        当前账号：{{ auth.displayName || auth.user?.account || '未登录' }}
        <text v-if="auth.isLogin">（{{ auth.isAdmin ? '管理员' : '非管理员' }}）</text>
      </text>
      <template v-if="!done">
        <wd-button block type="success" :loading="loading" :disabled="!auth.isLogin" @click="onConfirm">
          确认登录
        </wd-button>
        <wd-button plain block :loading="loading" @click="onReject">取消</wd-button>
      </template>
      <text v-else class="card-desc">{{ done === 'confirmed' ? '已确认，请回到电脑端后台' : '已取消' }}</text>
    </view>
  </view>
</template>
