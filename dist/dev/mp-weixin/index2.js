"use strict";
const common_vendor = require("./common/vendor.js");
const stores_app = require("./stores/app.js");
if (!Array) {
  const _easycom_sl_empty_state2 = common_vendor.resolveComponent("sl-empty-state");
  const _easycom_sl_custom_tabbar2 = common_vendor.resolveComponent("sl-custom-tabbar");
  (_easycom_sl_empty_state2 + _easycom_sl_custom_tabbar2)();
}
const _easycom_sl_empty_state = () => "./components/sl-empty-state/sl-empty-state.js";
const _easycom_sl_custom_tabbar = () => "./components/sl-custom-tabbar/sl-custom-tabbar.js";
if (!Math) {
  (_easycom_sl_empty_state + _easycom_sl_custom_tabbar)();
}
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const appStore = stores_app.useAppStore();
    return (_ctx, _cache) => {
      return {
        a: common_vendor.unref(appStore).headerPaddingStyle(0),
        b: common_vendor.p({
          text: "在地图上选择区域查看房源"
        }),
        c: common_vendor.p({
          current: 1
        })
      };
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-75f2d38b"]]);
exports.MiniProgramPage = MiniProgramPage;
