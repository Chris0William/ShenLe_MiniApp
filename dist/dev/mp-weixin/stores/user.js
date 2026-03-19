"use strict";
const common_vendor = require("../common/vendor.js");
const api_auth = require("../api/auth.js");
const api_http = require("../api/http.js");
const useUserStore = common_vendor.defineStore("user", () => {
  const token = common_vendor.ref("");
  const openId = common_vendor.ref("");
  const nickName = common_vendor.ref("");
  const avatar = common_vendor.ref("");
  const isAdmin = common_vendor.ref(false);
  const popupStep = common_vendor.ref("");
  const showLoginPopup = common_vendor.computed(() => popupStep.value !== "");
  const isLoggedIn = common_vendor.computed(() => !!token.value);
  const avatarUrl = common_vendor.computed(() => {
    if (!avatar.value) return "";
    if (avatar.value.startsWith("http")) return avatar.value;
    return `${api_http.BASE_URL}/${avatar.value}`;
  });
  let _loginResolve = null;
  function loadFromStorage() {
    token.value = common_vendor.index.getStorageSync("token") || "";
    openId.value = common_vendor.index.getStorageSync("openId") || "";
    nickName.value = common_vendor.index.getStorageSync("nickName") || "";
    avatar.value = common_vendor.index.getStorageSync("avatar") || "";
    isAdmin.value = common_vendor.index.getStorageSync("isAdmin") === "true";
  }
  function saveToStorage() {
    common_vendor.index.setStorageSync("token", token.value);
    common_vendor.index.setStorageSync("openId", openId.value);
    common_vendor.index.setStorageSync("nickName", nickName.value);
    common_vendor.index.setStorageSync("avatar", avatar.value);
    common_vendor.index.setStorageSync("isAdmin", isAdmin.value ? "true" : "false");
  }
  function setUser(data) {
    token.value = data.token;
    if (data.openId !== void 0) openId.value = data.openId;
    if (data.nickName !== void 0) nickName.value = data.nickName;
    if (data.avatar !== void 0) avatar.value = data.avatar;
    if (data.isAdmin !== void 0) isAdmin.value = data.isAdmin;
    saveToStorage();
  }
  async function login(input) {
    const res = await api_auth.login(input);
    token.value = res.accessToken;
    common_vendor.index.setStorageSync("token", res.accessToken);
    const user = await api_auth.getUserInfo();
    nickName.value = user.realName || user.account;
    avatar.value = user.avatar || "";
    isAdmin.value = user.accountType >= 888;
    saveToStorage();
  }
  async function wxLoginStep1() {
    const { code } = await new Promise((resolve, reject) => {
      common_vendor.index.login({ provider: "weixin", success: resolve, fail: reject });
    });
    const wxRes = await api_auth.getWxOpenId(code);
    openId.value = wxRes.openId;
    common_vendor.index.setStorageSync("openId", wxRes.openId);
    const loginRes = await api_auth.wxOpenIdLogin(wxRes.openId);
    if (loginRes.needProfile) {
      return "needProfile";
    }
    token.value = loginRes.accessToken;
    nickName.value = loginRes.nickName || "微信用户";
    avatar.value = loginRes.avatar || "";
    isAdmin.value = loginRes.accountType >= 888;
    saveToStorage();
    return "done";
  }
  async function wxLoginStep2(profileNickName, avatarTempPath) {
    const fileRes = await api_auth.uploadAvatar(openId.value, avatarTempPath);
    const avatarUrl2 = fileRes.url;
    const profileRes = await api_auth.completeProfile({
      openId: openId.value,
      nickName: profileNickName,
      avatar: avatarUrl2
    });
    token.value = profileRes.accessToken;
    nickName.value = profileRes.nickName || profileNickName;
    avatar.value = avatarUrl2;
    isAdmin.value = false;
    saveToStorage();
  }
  async function autoLogin() {
    if (!openId.value) return false;
    token.value = "";
    common_vendor.index.removeStorageSync("token");
    try {
      const loginRes = await api_auth.wxOpenIdLogin(openId.value);
      if (loginRes.needProfile) {
        return false;
      }
      token.value = loginRes.accessToken;
      nickName.value = loginRes.nickName || "微信用户";
      avatar.value = loginRes.avatar || "";
      isAdmin.value = loginRes.accountType >= 888;
      saveToStorage();
      return true;
    } catch {
      openId.value = "";
      common_vendor.index.removeStorageSync("openId");
      return false;
    }
  }
  async function handleUnauthorized() {
    token.value = "";
    common_vendor.index.removeStorageSync("token");
    if (openId.value) {
      const ok = await autoLogin();
      if (ok) return true;
    }
    return new Promise((resolve) => {
      _loginResolve = resolve;
      popupStep.value = "login";
    });
  }
  function onPopupLoginDone(success) {
    popupStep.value = "";
    if (_loginResolve) {
      _loginResolve(success);
      _loginResolve = null;
    }
  }
  function logout() {
    token.value = "";
    openId.value = "";
    nickName.value = "";
    avatar.value = "";
    isAdmin.value = false;
    common_vendor.index.removeStorageSync("token");
    common_vendor.index.removeStorageSync("openId");
    common_vendor.index.removeStorageSync("nickName");
    common_vendor.index.removeStorageSync("avatar");
    common_vendor.index.removeStorageSync("isAdmin");
    popupStep.value = "login";
  }
  return {
    token,
    openId,
    nickName,
    avatar,
    avatarUrl,
    isAdmin,
    isLoggedIn,
    showLoginPopup,
    popupStep,
    loadFromStorage,
    saveToStorage,
    setUser,
    login,
    wxLoginStep1,
    wxLoginStep2,
    autoLogin,
    handleUnauthorized,
    onPopupLoginDone,
    logout
  };
});
exports.useUserStore = useUserStore;
