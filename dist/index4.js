"use strict";
const common_vendor = require("./common/vendor.js");
const stores_app = require("./stores/app.js");
const stores_user = require("./stores/user.js");
const api_property = require("./api/property.js");
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
    const appStore = stores_app.useAppStore();
    const userStore = stores_user.useUserStore();
    const stats = common_vendor.ref({
      totalCount: 0,
      vacantCount: 0,
      reservedCount: 0,
      rentedCount: 0,
      offlineCount: 0,
      monthlyIncome: 0
    });
    const occupancyPercent = common_vendor.computed(() => {
      if (stats.value.totalCount === 0) return 0;
      return Math.round(stats.value.rentedCount / stats.value.totalCount * 100);
    });
    const todayStr = common_vendor.computed(() => {
      const d = /* @__PURE__ */ new Date();
      const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
    });
    async function loadStats() {
      try {
        stats.value = await api_property.getPropertyGlobalStats();
      } catch {
      }
    }
    function goTo(url) {
      common_vendor.index.navigateTo({ url });
    }
    common_vendor.onMounted(() => {
      loadStats();
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.t(common_vendor.unref(userStore).nickName || "管理员"),
        b: common_vendor.t(todayStr.value),
        c: common_vendor.unref(appStore).headerPaddingStyle(16),
        d: common_vendor.t(stats.value.totalCount),
        e: common_vendor.t(stats.value.vacantCount),
        f: common_vendor.t(stats.value.rentedCount),
        g: common_vendor.t(occupancyPercent.value),
        h: common_vendor.o(($event) => goTo("/pages/common/property-form/index")),
        i: common_vendor.o(($event) => goTo("/pages/common/community-manage/index")),
        j: common_vendor.o(($event) => goTo("/pages/common/region-manage/index")),
        k: common_vendor.o(($event) => goTo("/pages/common/tag-manage/index")),
        l: stats.value.monthlyIncome > 0
      }, stats.value.monthlyIncome > 0 ? {
        m: common_vendor.t(stats.value.monthlyIncome.toLocaleString()),
        n: common_vendor.t(stats.value.rentedCount),
        o: common_vendor.t(stats.value.vacantCount),
        p: common_vendor.t(stats.value.reservedCount)
      } : {}, {
        q: stats.value.rentedCount
      }, stats.value.rentedCount ? {
        r: stats.value.rentedCount
      } : {}, {
        s: stats.value.vacantCount
      }, stats.value.vacantCount ? {
        t: stats.value.vacantCount
      } : {}, {
        v: stats.value.reservedCount
      }, stats.value.reservedCount ? {
        w: stats.value.reservedCount
      } : {}, {
        x: stats.value.offlineCount
      }, stats.value.offlineCount ? {
        y: stats.value.offlineCount
      } : {}, {
        z: common_vendor.t(stats.value.rentedCount),
        A: common_vendor.t(stats.value.vacantCount),
        B: common_vendor.t(stats.value.reservedCount),
        C: common_vendor.t(stats.value.offlineCount),
        D: common_vendor.p({
          current: 0
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-23ab96ab"]]);
exports.MiniProgramPage = MiniProgramPage;
