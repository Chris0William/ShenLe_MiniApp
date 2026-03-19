"use strict";
const common_vendor = require("../../../common/vendor.js");
const stores_user = require("../../../stores/user.js");
const stores_app = require("../../../stores/app.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const appStore = stores_app.useAppStore();
    const loading = common_vendor.ref(false);
    const showAccountForm = common_vendor.ref(false);
    const account = common_vendor.ref("");
    const password = common_vendor.ref("");
    const step = common_vendor.ref("login");
    const profileNickName = common_vendor.ref("");
    const profileAvatarTemp = common_vendor.ref("");
    async function onWxLogin() {
      if (loading.value) return;
      loading.value = true;
      try {
        const result = await userStore.wxLoginStep1();
        if (result === "done") {
          common_vendor.index.showToast({ title: "登录成功", icon: "success" });
          appStore.loadMode();
          setTimeout(() => common_vendor.index.reLaunch({ url: "/pages/shell/index" }), 500);
        } else {
          step.value = "profile";
        }
      } catch (e) {
        console.error("微信登录失败", e);
        common_vendor.index.showToast({ title: "登录失败，请重试", icon: "none" });
      } finally {
        loading.value = false;
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
      if (loading.value) return;
      loading.value = true;
      try {
        await userStore.wxLoginStep2(profileNickName.value.trim(), profileAvatarTemp.value);
        common_vendor.index.showToast({ title: "注册成功", icon: "success" });
        appStore.loadMode();
        setTimeout(() => common_vendor.index.reLaunch({ url: "/pages/shell/index" }), 500);
      } catch (e) {
        console.error("完善资料失败", e);
        common_vendor.index.showToast({ title: "注册失败，请重试", icon: "none" });
      } finally {
        loading.value = false;
      }
    }
    async function onAccountLogin() {
      if (!account.value.trim()) {
        common_vendor.index.showToast({ title: "请输入账号", icon: "none" });
        return;
      }
      if (!password.value.trim()) {
        common_vendor.index.showToast({ title: "请输入密码", icon: "none" });
        return;
      }
      loading.value = true;
      try {
        await userStore.login({ account: account.value.trim(), password: password.value });
        common_vendor.index.showToast({ title: "登录成功", icon: "success" });
        appStore.loadMode();
        setTimeout(() => {
          common_vendor.index.reLaunch({ url: "/pages/shell/index" });
        }, 500);
      } catch {
      } finally {
        loading.value = false;
      }
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: !showAccountForm.value && step.value === "login"
      }, !showAccountForm.value && step.value === "login" ? {
        b: common_vendor.t(loading.value ? "登录中..." : "微信一键登录"),
        c: loading.value,
        d: common_vendor.o(onWxLogin),
        e: common_vendor.o(($event) => showAccountForm.value = true)
      } : {}, {
        f: step.value === "profile"
      }, step.value === "profile" ? common_vendor.e({
        g: profileAvatarTemp.value
      }, profileAvatarTemp.value ? {
        h: profileAvatarTemp.value
      } : {}, {
        i: common_vendor.o(onChooseAvatar),
        j: profileNickName.value,
        k: common_vendor.o(($event) => profileNickName.value = $event.detail.value),
        l: common_vendor.t(loading.value ? "提交中..." : "完成注册"),
        m: loading.value,
        n: common_vendor.o(onProfileSubmit)
      }) : {
        o: account.value,
        p: common_vendor.o(($event) => account.value = $event.detail.value),
        q: password.value,
        r: common_vendor.o(($event) => password.value = $event.detail.value),
        s: common_vendor.t(loading.value ? "登录中..." : "登录"),
        t: loading.value,
        v: common_vendor.o(onAccountLogin),
        w: common_vendor.o(($event) => showAccountForm.value = false)
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-a0b890bd"]]);
wx.createPage(MiniProgramPage);
