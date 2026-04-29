<script setup lang="ts">
import { customTabbarEnable, needHideNativeTabbar, tabbarCacheEnable } from './config'
import { tabbarList, tabbarStore } from './store'
import TabbarItem from './TabbarItem.vue'

// #ifdef MP-WEIXIN
// 将自定义节点设置成虚拟的（去掉自定义组件包裹层），更加接近Vue组件的表现，能更好的使用flex属性
defineOptions({
  virtualHost: true,
})
// #endif

function handleClick(index: number) {
  // 点击原来的不做操作
  if (index === tabbarStore.curIdx) {
    return
  }
  const list = tabbarList.value
  if (!list[index]) {
    return
  }
  const url = list[index].pagePath
  tabbarStore.setCurIdx(index)
  if (tabbarCacheEnable) {
    uni.switchTab({ url })
  }
  else {
    uni.navigateTo({ url })
  }
}
// #ifndef MP-WEIXIN || MP-ALIPAY
// 因为有了 custom:true， 微信里面不需要多余的hide操作
onLoad(() => {
  // 解决原生 tabBar 未隐藏导致有2个 tabBar 的问题
  needHideNativeTabbar
  && uni.hideTabBar({
    fail() {},
  })
})
// #endif

// #ifdef MP-ALIPAY
onMounted(() => {
  // 解决支付宝自定义tabbar 未隐藏导致有2个 tabBar 的问题; 注意支付宝很特别，需要在 onMounted 钩子调用
  customTabbarEnable // 另外，支付宝里面，只要是 customTabbar 都需要隐藏
  && uni.hideTabBar({
    fail() {},
  })
})
// #endif
const activeColor = '#126b4f'
const inactiveColor = '#7a8780'
function getColorByIndex(index: number) {
  return tabbarStore.curIdx === index ? activeColor : inactiveColor
}
</script>

<template>
  <view v-if="customTabbarEnable" class="tabbar-placeholder">
    <view class="tabbar-shell" @touchmove.stop.prevent>
      <view class="tabbar-inner">
        <view
          v-for="(item, index) in tabbarList" :key="index"
          class="tabbar-cell"
          :class="{ 'tabbar-cell--active': tabbarStore.curIdx === index }"
          :style="{ color: getColorByIndex(index) }"
          @click="handleClick(index)"
        >
          <view v-if="item.isBulge" class="relative">
            <!-- 中间一个鼓包tabbarItem的处理 -->
            <view class="bulge">
              <TabbarItem :item="item" :index="index" class="text-center" is-bulge />
            </view>
          </view>
          <TabbarItem v-else :item="item" :index="index" />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tabbar-placeholder {
  height: calc(112rpx + env(safe-area-inset-bottom));
}

.tabbar-shell {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  box-sizing: border-box;
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1rpx solid rgb(18 107 79 / 10%);
  background: radial-gradient(circle at 50% 0, rgb(228 161 27 / 10%), transparent 220rpx), rgb(251 252 247 / 96%);
  box-shadow: 0 -14rpx 36rpx rgb(30 47 39 / 8%);
}

.tabbar-inner {
  display: flex;
  height: 112rpx;
  align-items: center;
  padding: 10rpx 18rpx 12rpx;
  box-sizing: border-box;
}

.tabbar-cell {
  position: relative;
  display: flex;
  height: 86rpx;
  flex: 1;
  align-items: center;
  justify-content: center;
  border-radius: 26rpx;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.tabbar-cell--active {
  background: linear-gradient(180deg, rgb(18 107 79 / 12%), rgb(18 107 79 / 4%));
  transform: translateY(-2rpx);
}

.tabbar-cell--active::after {
  position: absolute;
  bottom: 6rpx;
  left: 50%;
  width: 26rpx;
  height: 5rpx;
  border-radius: 999rpx;
  background: var(--sl-brand-2, #e4a11b);
  content: '';
  transform: translateX(-50%);
}

// 中间鼓包的样式
.bulge {
  position: absolute;
  top: -20px;
  left: 50%;
  transform-origin: top center;
  transform: translateX(-50%) scale(0.5) translateY(-33%);
  display: flex;
  justify-content: center;
  align-items: center;
  width: 250rpx;
  height: 250rpx;
  border-radius: 50%;
  background-color: #fff;
  box-shadow: inset 0 0 0 1px #fefefe;

  &:active {
    // opacity: 0.8;
  }
}
</style>
