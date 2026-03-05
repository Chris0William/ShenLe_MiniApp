"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_app = require("../../stores/app.js");
const stores_user = require("../../stores/user.js");
if (!Array) {
  const _easycom_sl_custom_tabbar2 = common_vendor.resolveComponent("sl-custom-tabbar");
  _easycom_sl_custom_tabbar2();
}
const _easycom_sl_custom_tabbar = () => "../../components/sl-custom-tabbar/sl-custom-tabbar.js";
if (!Math) {
  (UserHome + UserMap + UserMine + AdminDashboard + AdminPropertyList + AdminSalesControl + AdminMine + _easycom_sl_custom_tabbar)();
}
const UserHome = () => "../user/home/index2.js";
const UserMap = () => "../user/map/index2.js";
const UserMine = () => "../user/mine/index2.js";
const AdminDashboard = () => "../admin/dashboard/index2.js";
const AdminPropertyList = () => "../admin/property-list/index2.js";
const AdminSalesControl = () => "../admin/sales-control/index2.js";
const AdminMine = () => "../admin/mine/index2.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    common_vendor.provide("sl-hide-tabbar", true);
    const appStore = stores_app.useAppStore();
    const userStore = stores_user.useUserStore();
    const userTabKeys = ["user-home", "user-map", "user-mine"];
    const adminTabKeys = ["admin-dashboard", "admin-property-list", "admin-sales-control", "admin-mine"];
    const currentTabKeys = common_vendor.computed(
      () => appStore.mode === "admin" ? adminTabKeys : userTabKeys
    );
    const tabIndex = common_vendor.computed(() => {
      const idx = currentTabKeys.value.indexOf(appStore.currentTab);
      return idx >= 0 ? idx : 0;
    });
    const visited = common_vendor.reactive(/* @__PURE__ */ new Set([appStore.currentTab]));
    common_vendor.watch(() => appStore.currentTab, (tab) => {
      visited.add(tab);
    });
    function onTabChange(index) {
      appStore.switchTab(currentTabKeys.value[index]);
    }
    const popupLoading = common_vendor.ref(false);
    const profileNickName = common_vendor.ref("");
    const profileAvatarTemp = common_vendor.ref("");
    async function onPopupWxLogin() {
      if (popupLoading.value) return;
      popupLoading.value = true;
      try {
        const result = await userStore.wxLoginStep1();
        if (result === "done") {
          common_vendor.index.showToast({ title: "登录成功", icon: "success" });
          appStore.loadMode();
          userStore.onPopupLoginDone(true);
        } else {
          userStore.popupStep = "profile";
        }
      } catch (e) {
        console.error("微信登录失败", e);
        common_vendor.index.showToast({ title: "登录失败，请重试", icon: "none" });
      } finally {
        popupLoading.value = false;
      }
    }
    function onChooseAvatar(e) {
      profileAvatarTemp.value = e.detail.avatarUrl;
    }
    async function onProfileSubmit() {
      if (!profileNickName.value.trim()) {
        common_vendor.index.showToast({ title: "请输入昵称", icon: "none" });
        return;
      }
      if (!profileAvatarTemp.value) {
        common_vendor.index.showToast({ title: "请选择头像", icon: "none" });
        return;
      }
      if (popupLoading.value) return;
      popupLoading.value = true;
      try {
        await userStore.wxLoginStep2(profileNickName.value.trim(), profileAvatarTemp.value);
        common_vendor.index.showToast({ title: "注册成功", icon: "success" });
        appStore.loadMode();
        userStore.onPopupLoginDone(true);
      } catch (e) {
        console.error("完善资料失败", e);
        common_vendor.index.showToast({ title: "注册失败，请重试", icon: "none" });
      } finally {
        popupLoading.value = false;
      }
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: visited.has("user-home")
      }, visited.has("user-home") ? {
        b: common_vendor.unref(appStore).currentTab === "user-home"
      } : {}, {
        c: visited.has("user-map")
      }, visited.has("user-map") ? {
        d: common_vendor.unref(appStore).currentTab === "user-map"
      } : {}, {
        e: visited.has("user-mine")
      }, visited.has("user-mine") ? {
        f: common_vendor.unref(appStore).currentTab === "user-mine"
      } : {}, {
        g: visited.has("admin-dashboard")
      }, visited.has("admin-dashboard") ? {
        h: common_vendor.unref(appStore).currentTab === "admin-dashboard"
      } : {}, {
        i: visited.has("admin-property-list")
      }, visited.has("admin-property-list") ? {
        j: common_vendor.unref(appStore).currentTab === "admin-property-list"
      } : {}, {
        k: visited.has("admin-sales-control")
      }, visited.has("admin-sales-control") ? {
        l: common_vendor.unref(appStore).currentTab === "admin-sales-control"
      } : {}, {
        m: visited.has("admin-mine")
      }, visited.has("admin-mine") ? {
        n: common_vendor.unref(appStore).currentTab === "admin-mine"
      } : {}, {
        o: common_vendor.o(onTabChange),
        p: common_vendor.p({
          current: tabIndex.value,
          visible: true
        }),
        q: common_vendor.unref(userStore).showLoginPopup
      }, common_vendor.unref(userStore).showLoginPopup ? common_vendor.e({
        r: common_vendor.unref(userStore).popupStep === "login"
      }, common_vendor.unref(userStore).popupStep === "login" ? {
        s: common_vendor.t(popupLoading.value ? "登录中..." : "微信一键登录"),
        t: popupLoading.value,
        v: common_vendor.o(onPopupWxLogin)
      } : {}, {
        w: common_vendor.unref(userStore).popupStep === "profile"
      }, common_vendor.unref(userStore).popupStep === "profile" ? common_vendor.e({
        x: profileAvatarTemp.value
      }, profileAvatarTemp.value ? {
        y: profileAvatarTemp.value
      } : {}, {
        z: common_vendor.o(onChooseAvatar),
        A: profileNickName.value,
        B: common_vendor.o(($event) => profileNickName.value = $event.detail.value),
        C: common_vendor.t(popupLoading.value ? "提交中..." : "完成注册"),
        D: popupLoading.value,
        E: common_vendor.o(onProfileSubmit)
      }) : {}) : {});
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-ad88add4"]]);
wx.createPage(MiniProgramPage);
