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
    function onSwitchUser() {
      appStore.switchMode("user");
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
        c: common_vendor.t(((_a = common_vendor.unref(userStore).nickName) == null ? void 0 : _a[0]) || "A")
      }, {
        d: common_vendor.t(common_vendor.unref(userStore).nickName || "管理员"),
        e: common_vendor.unref(appStore).headerPaddingStyle(24),
        f: common_vendor.o(() => _ctx.uni.navigateTo({
          url: "/pages/common/region-manage/index"
        })),
        g: common_vendor.o(() => _ctx.uni.navigateTo({
          url: "/pages/common/community-manage/index"
        })),
        h: common_vendor.o(() => _ctx.uni.navigateTo({
          url: "/pages/common/building-manage/index"
        })),
        i: common_vendor.o(() => _ctx.uni.navigateTo({
          url: "/pages/common/tag-manage/index"
        })),
        j: common_vendor.o(onSwitchUser),
        k: common_vendor.unref(userStore).isLoggedIn
      }, common_vendor.unref(userStore).isLoggedIn ? {
        l: common_vendor.o(onLogout)
      } : {}, {
        m: common_vendor.p({
          current: 4
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-f2e59862"]]);
exports.MiniProgramPage = MiniProgramPage;
