"use strict";
const common_vendor = require("./common/vendor.js");
const stores_app = require("./stores/app.js");
const api_community = require("./api/community.js");
const api_region = require("./api/region.js");
const utils_constants = require("./utils/constants.js");
const api_http = require("./api/http.js");
if (!Array) {
  const _easycom_sl_empty_state2 = common_vendor.resolveComponent("sl-empty-state");
  const _easycom_sl_load_more2 = common_vendor.resolveComponent("sl-load-more");
  const _easycom_sl_custom_tabbar2 = common_vendor.resolveComponent("sl-custom-tabbar");
  (_easycom_sl_empty_state2 + _easycom_sl_load_more2 + _easycom_sl_custom_tabbar2)();
}
const _easycom_sl_empty_state = () => "./components/sl-empty-state/sl-empty-state.js";
const _easycom_sl_load_more = () => "./components/sl-load-more/sl-load-more.js";
const _easycom_sl_custom_tabbar = () => "./components/sl-custom-tabbar/sl-custom-tabbar.js";
if (!Math) {
  (_easycom_sl_empty_state + _easycom_sl_load_more + _easycom_sl_custom_tabbar)();
}
const pageSize = 10;
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const appStore = stores_app.useAppStore();
    const list = common_vendor.ref([]);
    const pg = common_vendor.ref(1);
    const loadStatus = common_vendor.ref("more");
    const refreshing = common_vendor.ref(false);
    const keyword = common_vendor.ref("");
    const activePanel = common_vendor.ref("");
    const regionTree = common_vendor.ref([]);
    const activeL1 = common_vendor.ref("");
    const selRegionId = common_vendor.ref(void 0);
    const selRegionName = common_vendor.ref("");
    const l2List = common_vendor.computed(() => {
      var _a;
      if (!activeL1.value) return [];
      return ((_a = regionTree.value.find((r) => String(r.id) === activeL1.value)) == null ? void 0 : _a.children) || [];
    });
    const selPriceIdx = common_vendor.ref(0);
    const regionLabel = common_vendor.computed(() => selRegionName.value || "区域");
    const priceLabel = common_vendor.computed(
      () => selPriceIdx.value > 0 ? utils_constants.PRICE_RANGES[selPriceIdx.value].label : "租金"
    );
    function isFilterActive(name) {
      if (name === "region") return !!selRegionId.value;
      if (name === "price") return selPriceIdx.value > 0;
      return false;
    }
    async function loadData(reset = false) {
      if (reset) {
        pg.value = 1;
        list.value = [];
      }
      if (loadStatus.value === "loading") return;
      loadStatus.value = "loading";
      try {
        const priceRange = utils_constants.PRICE_RANGES[selPriceIdx.value];
        const res = await api_community.getCommunityPage({
          page: pg.value,
          pageSize,
          name: keyword.value || void 0,
          regionId: selRegionId.value,
          status: 0,
          minPrice: priceRange == null ? void 0 : priceRange.min,
          maxPrice: priceRange == null ? void 0 : priceRange.max
        });
        list.value = reset ? res.items : [...list.value, ...res.items];
        loadStatus.value = res.items.length < pageSize ? "noMore" : "more";
        pg.value++;
      } catch {
        loadStatus.value = "more";
      }
    }
    function coverSrc(url) {
      if (!url) return "/static/images/placeholder.png";
      if (url.startsWith("http")) return url;
      return `${api_http.BASE_URL}/${url}`;
    }
    function isVideo(url) {
      var _a;
      if (!url) return false;
      const ext = ((_a = url.split(".").pop()) == null ? void 0 : _a.toLowerCase()) || "";
      return ["mp4", "mov", "avi", "webm", "3gp"].includes(ext);
    }
    function formatRentRange(min, max) {
      if (!min && !max) return "价格面议";
      if (min && max && min === max) return `¥${min.toLocaleString()}/月`;
      if (min && max) return `¥${min.toLocaleString()}~${max.toLocaleString()}/月`;
      if (min) return `¥${min.toLocaleString()}起/月`;
      return `最高¥${max.toLocaleString()}/月`;
    }
    function togglePanel(name) {
      if (activePanel.value === name) {
        activePanel.value = "";
        return;
      }
      activePanel.value = name;
      if (name === "region" && !activeL1.value && regionTree.value.length) {
        activeL1.value = String(regionTree.value[0].id);
      }
    }
    function closePanel() {
      activePanel.value = "";
    }
    function pickL1(id) {
      activeL1.value = id;
    }
    function pickRegion(id, name) {
      selRegionId.value = id;
      selRegionName.value = name;
      closePanel();
      loadData(true);
    }
    function clearRegion() {
      selRegionId.value = void 0;
      selRegionName.value = "";
      activeL1.value = "";
      closePanel();
      loadData(true);
    }
    function pickPrice(idx) {
      selPriceIdx.value = idx;
      closePanel();
      loadData(true);
    }
    function onSearch() {
      loadData(true);
    }
    async function onRefresh() {
      refreshing.value = true;
      await loadData(true);
      refreshing.value = false;
    }
    function onLoadMore() {
      if (loadStatus.value === "more") loadData();
    }
    function goCommunity(id) {
      common_vendor.index.showToast({ title: "楼盘详情开发中", icon: "none" });
    }
    common_vendor.onMounted(async () => {
      try {
        regionTree.value = await api_region.getRegionTree();
      } catch {
      }
      loadData(true);
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.o(onSearch),
        b: keyword.value,
        c: common_vendor.o(($event) => keyword.value = $event.detail.value),
        d: common_vendor.unref(appStore).headerPaddingStyle(10),
        e: common_vendor.t(regionLabel.value),
        f: activePanel.value === "region" ? 1 : "",
        g: activePanel.value === "region" || isFilterActive("region") ? 1 : "",
        h: common_vendor.o(($event) => togglePanel("region")),
        i: common_vendor.t(priceLabel.value),
        j: activePanel.value === "price" ? 1 : "",
        k: activePanel.value === "price" || isFilterActive("price") ? 1 : "",
        l: common_vendor.o(($event) => togglePanel("price")),
        m: activePanel.value
      }, activePanel.value ? common_vendor.e({
        n: activePanel.value === "region"
      }, activePanel.value === "region" ? {
        o: !selRegionId.value ? 1 : "",
        p: common_vendor.o(clearRegion),
        q: common_vendor.f(regionTree.value, (r, k0, i0) => {
          return {
            a: common_vendor.t(r.name),
            b: r.id,
            c: activeL1.value === String(r.id) ? 1 : "",
            d: common_vendor.o(($event) => pickL1(String(r.id)), r.id)
          };
        }),
        r: selRegionId.value === Number(activeL1.value) ? 1 : "",
        s: common_vendor.o(($event) => {
          var _a;
          return pickRegion(Number(activeL1.value), ((_a = regionTree.value.find((r) => String(r.id) === activeL1.value)) == null ? void 0 : _a.name) || "");
        }),
        t: common_vendor.f(l2List.value, (r, k0, i0) => {
          return {
            a: common_vendor.t(r.name),
            b: r.id,
            c: selRegionId.value === r.id ? 1 : "",
            d: common_vendor.o(($event) => pickRegion(r.id, r.name), r.id)
          };
        }),
        v: common_vendor.o(() => {
        })
      } : {}, {
        w: activePanel.value === "price"
      }, activePanel.value === "price" ? {
        x: common_vendor.f(common_vendor.unref(utils_constants.PRICE_RANGES), (p, idx, i0) => {
          return {
            a: common_vendor.t(p.label),
            b: idx,
            c: selPriceIdx.value === idx ? 1 : "",
            d: common_vendor.o(($event) => pickPrice(idx), idx)
          };
        }),
        y: common_vendor.o(() => {
        })
      } : {}, {
        z: common_vendor.o(closePanel)
      }) : {}, {
        A: list.value.length > 0
      }, list.value.length > 0 ? {
        B: common_vendor.f(list.value, (item, k0, i0) => {
          return common_vendor.e({
            a: isVideo(item.coverImage) ? "/static/images/placeholder.png" : coverSrc(item.coverImage),
            b: isVideo(item.coverImage)
          }, isVideo(item.coverImage) ? {} : {}, {
            c: common_vendor.t(item.name),
            d: item.regionName
          }, item.regionName ? {
            e: common_vendor.t(item.regionName)
          } : {}, {
            f: common_vendor.t(formatRentRange(item.minRentPrice, item.maxRentPrice)),
            g: item.houseTypes
          }, item.houseTypes ? {
            h: common_vendor.t(item.houseTypes)
          } : {}, {
            i: common_vendor.t(item.propertyCount),
            j: item.address
          }, item.address ? {
            k: common_vendor.t(item.address)
          } : {}, {
            l: item.id,
            m: common_vendor.o(($event) => goCommunity(item.id), item.id)
          });
        })
      } : {}, {
        C: list.value.length === 0 && loadStatus.value !== "loading"
      }, list.value.length === 0 && loadStatus.value !== "loading" ? {
        D: common_vendor.p({
          text: "暂无符合条件的楼盘"
        })
      } : {}, {
        E: list.value.length > 0
      }, list.value.length > 0 ? {
        F: common_vendor.p({
          status: loadStatus.value
        })
      } : {}, {
        G: refreshing.value,
        H: common_vendor.o(onRefresh),
        I: common_vendor.o(onLoadMore),
        J: common_vendor.p({
          current: 0
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-b7f8a8ad"]]);
exports.MiniProgramPage = MiniProgramPage;
