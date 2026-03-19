"use strict";
const common_vendor = require("./common/vendor.js");
const stores_user = require("./stores/user.js");
const stores_app = require("./stores/app.js");
if (!Array) {
  const _easycom_sl_custom_tabbar2 = common_vendor.resolveComponent("sl-custom-tabbar");
  _easycom_sl_custom_tabbar2();
}
const _easycom_sl_custom_tabbar = () => "./components/sl-custom-tabbar/sl-custom-tabbar.js";
if (!Math) {
  _easycom_sl_custom_tabbar();
}
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const appStore = stores_app.useAppStore();
    function onProfileTap() {
      if (!userStore.isLoggedIn) {
        userStore.popupStep = "login";
      }
    }
    function onSwitchAdmin() {
      appStore.switchMode("admin");
    }
    function onLogout() {
      common_vendor.index.showModal({
        title: "提示",
        content: "确定退出登录吗？",
        success(res) {
          if (res.confirm) userStore.logout();
        }
      });
    }
    return (_ctx, _cache) => {
      var _a;
      return common_vendor.e({
        a: common_vendor.unref(userStore).avatarUrl
      }, common_vendor.unref(userStore).avatarUrl ? {
        b: common_vendor.unref(userStore).avatarUrl
      } : {
        c: common_vendor.t(((_a = common_vendor.unref(userStore).nickName) == null ? void 0 : _a[0]) || "?")
      }, {
        d: common_vendor.t(common_vendor.unref(userStore).isLoggedIn ? common_vendor.unref(userStore).nickName : "点击登录"),
        e: common_vendor.t(common_vendor.unref(userStore).isLoggedIn ? "欢迎回来" : "登录后享受更多服务"),
        f: common_vendor.unref(appStore).headerPaddingStyle(24),
        g: common_vendor.o(onProfileTap),
        h: common_vendor.unref(userStore).isAdmin
      }, common_vendor.unref(userStore).isAdmin ? {
        i: common_vendor.o(onSwitchAdmin)
      } : {}, {
        j: common_vendor.unref(userStore).isLoggedIn
      }, common_vendor.unref(userStore).isLoggedIn ? {
        k: common_vendor.o(onLogout)
      } : {}, {
        l: common_vendor.p({
          current: 2
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-f94613f0"]]);
exports.MiniProgramPage = MiniProgramPage;
