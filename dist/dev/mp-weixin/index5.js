"use strict";
const common_vendor = require("./common/vendor.js");
const stores_app = require("./stores/app.js");
const api_community = require("./api/community.js");
const api_region = require("./api/region.js");
const api_file = require("./api/file.js");
const utils_constants = require("./utils/constants.js");
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
const PRICE_MAX = 1e4;
const PRICE_STEP = 100;
const pageSize = 10;
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const appStore = stores_app.useAppStore();
    const userLng = common_vendor.ref(void 0);
    const userLat = common_vendor.ref(void 0);
    const locationReady = common_vendor.ref(false);
    const DISTANCE_OPTIONS = [
      { label: "不限", value: void 0 },
      { label: "1km", value: 1 },
      { label: "3km", value: 3 },
      { label: "5km", value: 5 },
      { label: "10km", value: 10 }
    ];
    const selDistanceIdx = common_vendor.ref(0);
    function getLocation() {
      common_vendor.index.getLocation({
        type: "gcj02",
        success: (res) => {
          userLng.value = res.longitude;
          userLat.value = res.latitude;
          locationReady.value = true;
        },
        fail: () => {
          locationReady.value = false;
        }
      });
    }
    function distanceText(item) {
      if (!item.distance && item.distance !== 0) return "";
      if (item.distance < 1) return `${Math.round(item.distance * 1e3)}m`;
      return `${item.distance}km`;
    }
    const regionOpen = common_vendor.ref(false);
    const regionTree = common_vendor.ref([]);
    const selL1 = common_vendor.ref(void 0);
    const selL2 = common_vendor.ref(void 0);
    const l2List = common_vendor.computed(() => {
      if (!selL1.value) return [];
      const node = regionTree.value.find((r) => r.id === selL1.value);
      return (node == null ? void 0 : node.children) ?? [];
    });
    const selRegionId = common_vendor.computed(() => selL2.value ?? selL1.value);
    async function loadRegionTree() {
      try {
        regionTree.value = await api_region.getRegionTree();
      } catch {
      }
    }
    function onSelectL1(id) {
      selL1.value = selL1.value === id ? void 0 : id;
      selL2.value = void 0;
      loadData(true);
    }
    function onSelectL2(id) {
      selL2.value = selL2.value === id ? void 0 : id;
      loadData(true);
    }
    function toggleRegion() {
      regionOpen.value = !regionOpen.value;
    }
    const showSearch = common_vendor.ref(false);
    const keyword = common_vendor.ref("");
    function toggleSearch() {
      showSearch.value = !showSearch.value;
    }
    function onSearch() {
      showSearch.value = false;
      loadData(true);
    }
    function clearSearch() {
      keyword.value = "";
      showSearch.value = false;
      loadData(true);
    }
    const showFilter = common_vendor.ref(false);
    const selBedroom = common_vendor.ref(void 0);
    const priceMin = common_vendor.ref(0);
    const priceMax = common_vendor.ref(PRICE_MAX);
    const priceMinLabel = common_vendor.computed(() => priceMin.value === 0 ? "不限" : `¥${priceMin.value}`);
    const priceMaxLabel = common_vendor.computed(() => priceMax.value >= PRICE_MAX ? "不限" : `¥${priceMax.value}`);
    const minPct = common_vendor.computed(() => priceMin.value / PRICE_MAX * 100);
    const maxPct = common_vendor.computed(() => priceMax.value / PRICE_MAX * 100);
    let dragging = null;
    let trackLeft = 0;
    let trackWidth = 0;
    const instance = common_vendor.getCurrentInstance();
    function measureTrack() {
      const query = common_vendor.index.createSelectorQuery().in(instance);
      query.select(".range-track").boundingClientRect((rect) => {
        if (!rect) return;
        trackLeft = rect.left;
        trackWidth = rect.width;
      }).exec();
    }
    function onTrackTouchStart() {
      measureTrack();
    }
    function valueFromX(x) {
      let pct = (x - trackLeft) / trackWidth;
      pct = Math.max(0, Math.min(1, pct));
      const raw = pct * PRICE_MAX;
      return Math.round(raw / PRICE_STEP) * PRICE_STEP;
    }
    function onThumbTouchStart(which) {
      dragging = which;
      measureTrack();
    }
    function onThumbTouchMove(e) {
      if (!dragging || !trackWidth) return;
      const x = e.touches[0].clientX;
      const val = valueFromX(x);
      if (dragging === "min") {
        priceMin.value = Math.min(val, priceMax.value);
      } else {
        priceMax.value = Math.max(val, priceMin.value);
      }
    }
    function onThumbTouchEnd() {
      dragging = null;
    }
    function toggleFilter() {
      showFilter.value = !showFilter.value;
    }
    function resetFilter() {
      selBedroom.value = void 0;
      priceMin.value = 0;
      priceMax.value = PRICE_MAX;
      selDistanceIdx.value = 0;
      showFilter.value = false;
      loadData(true);
    }
    function confirmFilter() {
      showFilter.value = false;
      loadData(true);
    }
    const filterCount = common_vendor.computed(() => {
      let n = 0;
      if (selBedroom.value) n++;
      if (priceMin.value > 0 || priceMax.value < PRICE_MAX) n++;
      if (selDistanceIdx.value > 0) n++;
      return n;
    });
    const page = common_vendor.ref(1);
    const list = common_vendor.ref([]);
    const loadStatus = common_vendor.ref("more");
    const refreshing = common_vendor.ref(false);
    async function loadData(reset = false) {
      if (reset) {
        page.value = 1;
        list.value = [];
      }
      if (loadStatus.value === "loading") return;
      loadStatus.value = "loading";
      const distOpt = DISTANCE_OPTIONS[selDistanceIdx.value];
      const input = {
        page: page.value,
        pageSize,
        name: keyword.value || void 0,
        regionId: selRegionId.value,
        status: 0,
        bedrooms: selBedroom.value,
        minPrice: priceMin.value > 0 ? priceMin.value : void 0,
        maxPrice: priceMax.value < PRICE_MAX ? priceMax.value : void 0,
        userLng: userLng.value,
        userLat: userLat.value,
        distanceKm: distOpt == null ? void 0 : distOpt.value
      };
      try {
        const res = await api_community.getCommunityPage(input);
        const newItems = res.items;
        list.value = reset ? newItems : [...list.value, ...newItems];
        loadStatus.value = "noMore";
        page.value++;
        loadCovers(newItems);
      } catch {
        loadStatus.value = "more";
      } finally {
        refreshing.value = false;
      }
    }
    function onLoadMore() {
      if (loadStatus.value === "more") loadData();
    }
    function onRefresh() {
      refreshing.value = true;
      loadData(true);
    }
    const coverCache = common_vendor.ref({});
    function coverSrc(item) {
      if (!item.coverImageId) return "";
      return coverCache.value[String(item.coverImageId)] || "";
    }
    async function loadCovers(items) {
      for (const item of items) {
        const id = item.coverImageId;
        if (!id || coverCache.value[String(id)]) continue;
        try {
          const path = await api_file.downloadFile(String(id));
          coverCache.value[String(id)] = path;
        } catch {
        }
      }
    }
    function onCommunityTap(item) {
      common_vendor.index.navigateTo({
        url: `/pages/common/community-properties/index?communityId=${item.id}&communityName=${encodeURIComponent(item.name)}`
      });
    }
    function goAddProperty() {
      common_vendor.index.navigateTo({ url: "/pages/common/property-form/index" });
    }
    function rentRangeText(item) {
      if (!item.minRentPrice && !item.maxRentPrice) return "暂无报价";
      if (item.minRentPrice === item.maxRentPrice) return `¥${item.minRentPrice}/月`;
      return `¥${item.minRentPrice ?? 0}~${item.maxRentPrice ?? 0}/月`;
    }
    common_vendor.onMounted(() => {
      getLocation();
      loadRegionTree();
      loadData(true);
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.unref(appStore).headerPaddingStyle(12),
        b: common_vendor.t(regionOpen.value ? "◀" : "▶"),
        c: common_vendor.o(toggleRegion),
        d: regionOpen.value
      }, regionOpen.value ? {
        e: !selL1.value ? 1 : "",
        f: common_vendor.o(($event) => onSelectL1(void 0)),
        g: common_vendor.f(regionTree.value, (r1, k0, i0) => {
          return common_vendor.e({
            a: common_vendor.t(r1.name),
            b: selL1.value === r1.id
          }, selL1.value === r1.id ? {} : {}, {
            c: selL1.value === r1.id && !selL2.value ? 1 : "",
            d: common_vendor.o(($event) => onSelectL1(r1.id), r1.id),
            e: selL1.value === r1.id && l2List.value.length
          }, selL1.value === r1.id && l2List.value.length ? {
            f: common_vendor.f(l2List.value, (r2, k1, i1) => {
              return {
                a: common_vendor.t(r2.name),
                b: r2.id,
                c: selL2.value === r2.id ? 1 : "",
                d: common_vendor.o(($event) => onSelectL2(r2.id), r2.id)
              };
            })
          } : {}, {
            g: r1.id
          });
        })
      } : {}, {
        h: showSearch.value || keyword.value ? 1 : "",
        i: common_vendor.o(toggleSearch),
        j: filterCount.value > 0 && !showFilter.value
      }, filterCount.value > 0 && !showFilter.value ? {
        k: common_vendor.t(filterCount.value)
      } : {}, {
        l: showFilter.value || filterCount.value > 0 ? 1 : "",
        m: common_vendor.o(toggleFilter),
        n: showSearch.value
      }, showSearch.value ? common_vendor.e({
        o: showSearch.value,
        p: common_vendor.o(onSearch),
        q: keyword.value,
        r: common_vendor.o(($event) => keyword.value = $event.detail.value),
        s: keyword.value
      }, keyword.value ? {
        t: common_vendor.o(clearSearch)
      } : {}, {
        v: common_vendor.o(onSearch)
      }) : {}, {
        w: showFilter.value
      }, showFilter.value ? common_vendor.e({
        x: common_vendor.f(common_vendor.unref(utils_constants.BEDROOM_OPTIONS), (opt, k0, i0) => {
          return {
            a: common_vendor.t(opt.label),
            b: String(opt.value),
            c: selBedroom.value === opt.value ? 1 : "",
            d: common_vendor.o(($event) => selBedroom.value = opt.value, String(opt.value))
          };
        }),
        y: common_vendor.t(priceMinLabel.value),
        z: common_vendor.t(priceMaxLabel.value),
        A: minPct.value + "%",
        B: maxPct.value - minPct.value + "%",
        C: common_vendor.t(priceMinLabel.value),
        D: minPct.value + "%",
        E: common_vendor.o(($event) => onThumbTouchStart("min")),
        F: common_vendor.o(onThumbTouchMove),
        G: common_vendor.o(onThumbTouchEnd),
        H: common_vendor.t(priceMaxLabel.value),
        I: maxPct.value + "%",
        J: common_vendor.o(($event) => onThumbTouchStart("max")),
        K: common_vendor.o(onThumbTouchMove),
        L: common_vendor.o(onThumbTouchEnd),
        M: common_vendor.o(onTrackTouchStart),
        N: locationReady.value
      }, locationReady.value ? {
        O: common_vendor.f(DISTANCE_OPTIONS, (opt, idx, i0) => {
          return {
            a: common_vendor.t(opt.label),
            b: idx,
            c: selDistanceIdx.value === idx ? 1 : "",
            d: common_vendor.o(($event) => selDistanceIdx.value = idx, idx)
          };
        })
      } : {}, {
        P: common_vendor.o(resetFilter),
        Q: common_vendor.o(confirmFilter)
      }) : {}, {
        R: list.value.length === 0 && loadStatus.value !== "loading"
      }, list.value.length === 0 && loadStatus.value !== "loading" ? {
        S: common_vendor.p({
          text: "暂无楼盘数据"
        })
      } : {
        T: common_vendor.f(list.value, (item, k0, i0) => {
          return common_vendor.e({
            a: coverSrc(item)
          }, coverSrc(item) ? {
            b: coverSrc(item)
          } : {}, {
            c: common_vendor.t(item.name),
            d: item.regionName
          }, item.regionName ? {
            e: common_vendor.t(item.regionName)
          } : {}, {
            f: common_vendor.t(rentRangeText(item)),
            g: distanceText(item)
          }, distanceText(item) ? {
            h: common_vendor.t(distanceText(item))
          } : {}, {
            i: item.houseTypes
          }, item.houseTypes ? {
            j: common_vendor.t(item.houseTypes)
          } : {}, {
            k: common_vendor.t(item.propertyCount),
            l: item.id,
            m: common_vendor.o(($event) => onCommunityTap(item), item.id)
          });
        }),
        U: common_vendor.p({
          status: loadStatus.value
        })
      }, {
        V: refreshing.value,
        W: common_vendor.o(onRefresh),
        X: common_vendor.o(onLoadMore),
        Y: !showFilter.value,
        Z: common_vendor.o(goAddProperty),
        aa: common_vendor.p({
          current: 1
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-d0bd3009"]]);
exports.MiniProgramPage = MiniProgramPage;
