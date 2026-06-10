import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages'
import { tabBar } from './src/tabbar/config'

export default defineUniPages({
  globalStyle: {
    navigationStyle: 'default',
    navigationBarTitleText: '深乐租',
    navigationBarBackgroundColor: '#f7faf8',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f4f7f2',
  },
  permission: {
    'scope.userLocation': {
      desc: '\u7528\u4e8e\u5c06\u5730\u56fe\u5b9a\u4f4d\u5230\u4f60\u5f53\u524d\u6240\u5728\u4f4d\u7f6e',
    },
  },
  requiredPrivateInfos: ['getLocation', 'chooseLocation'],
  easycom: {
    autoscan: true,
    custom: {
      '^sl-(.*)': '@/components/sl-$1/sl-$1.vue',
      '^fg-(.*)': '@/components/fg-$1/fg-$1.vue',
      '^wd-(.*)': 'wot-design-uni/components/wd-$1/wd-$1.vue',
      '^(?!z-paging-refresh|z-paging-load-more)z-paging(.*)':
        'z-paging/components/z-paging$1/z-paging$1.vue',
    },
  },
  tabBar: tabBar as any,
})
