"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const common_vendor = require("./common/vendor.js");
const stores_user = require("./stores/user.js");
const stores_app = require("./stores/app.js");
const api_http = require("./api/http.js");
if (!Math) {
  "./pages/index/index.js";
  "./pages/shell/index.js";
  "./pages/user/home/index.js";
  "./pages/user/map/index.js";
  "./pages/user/mine/index.js";
  "./pages/admin/dashboard/index.js";
  "./pages/admin/property-list/index.js";
  "./pages/admin/sales-control/index.js";
  "./pages/admin/mine/index.js";
  "./pages/common/property-detail/index.js";
  "./pages/common/property-form/index.js";
  "./pages/common/login/index.js";
  "./pages/common/region-manage/index.js";
  "./pages/common/community-manage/index.js";
  "./pages/common/building-manage/index.js";
  "./pages/common/community-properties/index.js";
  "./pages/common/tag-manage/index.js";
}
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "App",
  setup(__props) {
    common_vendor.onLaunch(() => {
      const userStore = stores_user.useUserStore();
      const appStore = stores_app.useAppStore();
      userStore.loadFromStorage();
      appStore.loadMode();
      api_http.setUnauthorizedHandler(() => userStore.handleUnauthorized());
      if (userStore.openId) {
        userStore.autoLogin();
      }
    });
    return () => {
    };
  }
});
function createApp() {
  const app = common_vendor.createSSRApp(_sfc_main);
  const pinia = common_vendor.createPinia();
  app.use(pinia);
  return { app };
}
createApp().app.mount("#app");
exports.createApp = createApp;
