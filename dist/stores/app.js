"use strict";
const common_vendor = require("../common/vendor.js");
const DEFAULT_TABS = {
  user: "user-home",
  admin: "admin-dashboard"
};
const useAppStore = common_vendor.defineStore("app", () => {
  const mode = common_vendor.ref("user");
  const currentTab = common_vendor.ref("user-home");
  const statusBarHeight = common_vendor.ref(44);
  try {
    const info = common_vendor.index.getSystemInfoSync();
    statusBarHeight.value = info.statusBarHeight || 44;
  } catch {
  }
  const headerPaddingStyle = (extraPx = 10) => `${statusBarHeight.value + extraPx}px`;
  function loadMode() {
    const saved = common_vendor.index.getStorageSync("appMode");
    if (saved === "admin" || saved === "user") {
      mode.value = saved;
    }
    currentTab.value = DEFAULT_TABS[mode.value];
  }
  function switchMode(target) {
    mode.value = target;
    common_vendor.index.setStorageSync("appMode", target);
    currentTab.value = DEFAULT_TABS[target];
  }
  function switchTab(tab) {
    currentTab.value = tab;
  }
  return { mode, currentTab, statusBarHeight, headerPaddingStyle, loadMode, switchMode, switchTab };
});
exports.useAppStore = useAppStore;
