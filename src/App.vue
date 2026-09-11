<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { navigateToInterceptor } from '@/router/interceptor'
import { useLandlordShareStore } from '@/store/landlord-share'
import { modeStore } from '@/store/mode'
import { tabbarStore } from '@/tabbar/store'
import { LANDLORD_ENROLLMENT_SCENE } from '@/utils/landlord-enrollment'

const landlordShare = useLandlordShareStore()

interface ShareLaunchOptions {
  query?: Record<string, unknown>
}

function captureLandlordShare(options?: ShareLaunchOptions) {
  if (options?.query?.scene === LANDLORD_ENROLLMENT_SCENE) {
    landlordShare.clear()
    return
  }
  if (!landlordShare.capture(options?.query?.scene as string | undefined))
    return
  modeStore.setMode('user')
  tabbarStore.setCurIdx(0)
}

onLaunch((options) => {
  console.log('App.vue onLaunch', options)
  captureLandlordShare(options)
})
onShow((options) => {
  console.log('App.vue onShow', options)
  captureLandlordShare(options)
  // 处理直接进入页面路由的情况：如h5直接输入路由、微信小程序分享后进入等
  // https://github.com/unibest-tech/unibest/issues/192
  if (options?.path) {
    navigateToInterceptor.invoke({ url: `/${options.path}`, query: options.query })
  }
  else {
    navigateToInterceptor.invoke({ url: '/' })
  }
})
onHide(() => {
  console.log('App Hide')
})
</script>

<style lang="scss">

</style>
