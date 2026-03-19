"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_app = require("../../stores/app.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "sl-custom-tabbar",
  props: {
    current: {},
    visible: { type: Boolean }
  },
  emits: ["change"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const appStore = stores_app.useAppStore();
    const hideTabbar = common_vendor.inject("sl-hide-tabbar", false);
    const shouldShow = common_vendor.computed(() => props.visible ?? !hideTabbar);
    const userTabs = [
      { text: "找房", icon: "🏠", iconActive: "🏠" },
      { text: "地图", icon: "🗺", iconActive: "🗺" },
      { text: "我的", icon: "👤", iconActive: "👤" }
    ];
    const adminTabs = [
      { text: "地图", icon: "🗺", iconActive: "🗺" },
      { text: "房源", icon: "🏘", iconActive: "🏘" },
      { text: "工作台", icon: "📊", iconActive: "📊" },
      { text: "销控", icon: "📋", iconActive: "📋" },
      { text: "我的", icon: "👤", iconActive: "👤" }
    ];
    const tabs = common_vendor.computed(() => appStore.mode === "admin" ? adminTabs : userTabs);
    function onTabTap(index) {
      if (index === props.current) return;
      emit("change", index);
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: shouldShow.value
      }, shouldShow.value ? {
        b: common_vendor.f(tabs.value, (tab, index, i0) => {
          return {
            a: common_vendor.t(index === _ctx.current ? tab.iconActive : tab.icon),
            b: common_vendor.t(tab.text),
            c: tab.text,
            d: index === _ctx.current ? 1 : "",
            e: common_vendor.o(($event) => onTabTap(index), tab.text)
          };
        })
      } : {});
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-4d325551"]]);
wx.createComponent(Component);
