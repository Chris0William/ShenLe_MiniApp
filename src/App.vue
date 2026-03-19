<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import { setUnauthorizedHandler } from '@/api/http'

onLaunch(() => {
  const userStore = useUserStore()
  const appStore = useAppStore()
  userStore.loadFromStorage()
  appStore.loadMode()

  // 注册 401 处理器：静默登录或弹窗
  setUnauthorizedHandler(() => userStore.handleUnauthorized())

  // 有 openId 则自动续期 token（不阻塞启动）
  if (userStore.openId) {
    userStore.autoLogin()
  }
})
</script>

<style lang="scss">
page {
  background-color: $sl-bg-page;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  box-sizing: border-box;
}

view, text {
  box-sizing: border-box;
}
</style>
