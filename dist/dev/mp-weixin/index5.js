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
const QQMAP_KEY = "YOUR_KEY_HERE";
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
    const locationLoading = common_vendor.ref(false);
    const locationAddress = common_vendor.ref("");
    const DISTANCE_OPTIONS = [
      { label: "不限", value: void 0 },
      { label: "500m", value: 0.5 },
      { label: "1km", value: 1 },
      { label: "3km", value: 3 },
      { label: "5km", value: 5 }
    ];
    const selDistanceIdx = common_vendor.ref(0);
    async function reverseGeocode(lat, lng) {
      return new Promise((resolve) => {
        common_vendor.index.request({
          url: `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${QQMAP_KEY}&get_poi=1`,
          success: (res) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const data = res.data;
            if ((data == null ? void 0 : data.status) === 0) {
              const poi = (_c = (_b = (_a = data.result) == null ? void 0 : _a.pois) == null ? void 0 : _b[0]) == null ? void 0 : _c.title;
              const district = (_e = (_d = data.result) == null ? void 0 : _d.address_component) == null ? void 0 : _e.district;
              const street = (_g = (_f = data.result) == null ? void 0 : _f.address_component) == null ? void 0 : _g.street;
              resolve(poi || (district && street ? district + street : district) || "已定位");
            } else {
              resolve("已定位");
            }
          },
          fail: () => resolve("已定位")
        });
      });
    }
    function autoLocate() {
      locationLoading.value = true;
      common_vendor.index.getLocation({
        type: "gcj02",
        success: async (res) => {
          userLng.value = res.longitude;
          userLat.value = res.latitude;
          locationReady.value = true;
          locationAddress.value = await reverseGeocode(res.latitude, res.longitude);
          locationLoading.value = false;
          loadData(true);
        },
        fail: () => {
          locationLoading.value = false;
        }
      });
    }
    function getLocation() {
      locationLoading.value = true;
      common_vendor.index.chooseLocation({
        success: (res) => {
          userLng.value = res.longitude;
          userLat.value = res.latitude;
          locationAddress.value = res.name || res.address || "已定位";
          locationReady.value = true;
          locationLoading.value = false;
          loadData(true);
        },
        fail: () => {
          locationLoading.value = false;
        }
      });
    }
    function distanceText(item) {
      if (!item.distance && item.distance !== 0) return "";
      if (item.distance < 1) return `${Math.round(item.distance * 1e3)}m`;
      return `${item.distance}km`;
    }
    const regionTree = common_vendor.ref([]);
    const selL1 = common_vendor.ref(void 0);
    const selL2 = common_vendor.ref(void 0);
    const l2List = common_vendor.computed(() => {
      if (!selL1.value) return [];
      const node = regionTree.value.find((r) => r.id === selL1.value);
      return (node == null ? void 0 : node.children) ?? [];
    });
    const selRegionId = common_vendor.computed(() => selL2.value ?? selL1.value);
    const refLng = common_vendor.computed(() => {
      var _a;
      if (selL2.value) {
        const l1 = regionTree.value.find((r) => r.id === selL1.value);
        const l2 = (_a = l1 == null ? void 0 : l1.children) == null ? void 0 : _a.find((r) => r.id === selL2.value);
        if (l2 == null ? void 0 : l2.centerLng) return l2.centerLng;
      }
      if (selL1.value) {
        const l1 = regionTree.value.find((r) => r.id === selL1.value);
        if (l1 == null ? void 0 : l1.centerLng) return l1.centerLng;
      }
      return userLng.value;
    });
    const refLat = common_vendor.computed(() => {
      var _a;
      if (selL2.value) {
        const l1 = regionTree.value.find((r) => r.id === selL1.value);
        const l2 = (_a = l1 == null ? void 0 : l1.children) == null ? void 0 : _a.find((r) => r.id === selL2.value);
        if (l2 == null ? void 0 : l2.centerLat) return l2.centerLat;
      }
      if (selL1.value) {
        const l1 = regionTree.value.find((r) => r.id === selL1.value);
        if (l1 == null ? void 0 : l1.centerLat) return l1.centerLat;
      }
      return userLat.value;
    });
    async function loadRegionTree() {
      try {
        regionTree.value = await api_region.getRegionTree();
      } catch {
      }
    }
    const activeDropdown = common_vendor.ref(null);
    const filterBarBottom = common_vendor.ref(0);
    function measureFilterBar() {
      const query = common_vendor.index.createSelectorQuery().in(instance);
      query.select(".filter-bar").boundingClientRect((rect) => {
        if (rect) filterBarBottom.value = rect.bottom;
      }).exec();
    }
    function toggleDropdown(name) {
      if (activeDropdown.value === name) {
        activeDropdown.value = null;
        return;
      }
      activeDropdown.value = name;
      showSearch.value = false;
      common_vendor.nextTick$1(() => measureFilterBar());
    }
    function closeDropdown() {
      activeDropdown.value = null;
    }
    function resetCurrentFilter() {
      switch (activeDropdown.value) {
        case "location":
          selL1.value = void 0;
          selL2.value = void 0;
          selDistanceIdx.value = 0;
          break;
        case "bedroom":
          selBedroom.value = void 0;
          break;
        case "price":
          priceMin.value = 0;
          priceMax.value = PRICE_MAX;
          break;
      }
      activeDropdown.value = null;
      loadData(true);
    }
    function confirmDropdown() {
      activeDropdown.value = null;
      loadData(true);
    }
    const locationLabel = common_vendor.computed(() => {
      var _a;
      const parts = [];
      if (selL2.value) {
        const l1 = regionTree.value.find((r) => r.id === selL1.value);
        const l2 = (_a = l1 == null ? void 0 : l1.children) == null ? void 0 : _a.find((r) => r.id === selL2.value);
        if (l2) parts.push(l2.name);
      } else if (selL1.value) {
        const l1 = regionTree.value.find((r) => r.id === selL1.value);
        if (l1) parts.push(l1.name);
      }
      if (selDistanceIdx.value > 0) parts.push(DISTANCE_OPTIONS[selDistanceIdx.value].label);
      return parts.length ? parts.join(" ") : "位置";
    });
    const bedroomLabel = common_vendor.computed(() => {
      if (!selBedroom.value) return "户型";
      const opt = utils_constants.BEDROOM_OPTIONS.find((o) => o.value === selBedroom.value);
      return (opt == null ? void 0 : opt.label) ?? "户型";
    });
    const priceLabel = common_vendor.computed(() => {
      if (priceMin.value === 0 && priceMax.value >= PRICE_MAX) return "租金";
      if (priceMin.value > 0 && priceMax.value >= PRICE_MAX) return `≥¥${priceMin.value}`;
      if (priceMin.value === 0) return `≤¥${priceMax.value}`;
      return `¥${priceMin.value}-${priceMax.value}`;
    });
    const showSearch = common_vendor.ref(false);
    const keyword = common_vendor.ref("");
    function toggleSearch() {
      showSearch.value = !showSearch.value;
      if (showSearch.value) activeDropdown.value = null;
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
        status: 0,
        bedrooms: selBedroom.value,
        minPrice: priceMin.value > 0 ? priceMin.value : void 0,
        maxPrice: priceMax.value < PRICE_MAX ? priceMax.value : void 0,
        userLng: refLng.value,
        userLat: refLat.value,
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
    function openNavigation(item) {
      if (!item.lat || !item.lng) {
        common_vendor.index.showToast({ title: "暂无位置信息", icon: "none" });
        return;
      }
      common_vendor.index.openLocation({
        latitude: item.lat,
        longitude: item.lng,
        name: item.name,
        address: item.address ?? item.name
      });
    }
    function rentRangeText(item) {
      if (!item.minRentPrice && !item.maxRentPrice) return "暂无报价";
      if (item.minRentPrice === item.maxRentPrice) return `¥${item.minRentPrice}/月`;
      return `¥${item.minRentPrice ?? 0}~${item.maxRentPrice ?? 0}/月`;
    }
    common_vendor.onMounted(() => {
      autoLocate();
      loadRegionTree();
      loadData(true);
      common_vendor.nextTick$1(() => measureFilterBar());
    });
    return (_ctx, _cache) => {
      var _a;
      return common_vendor.e({
        a: common_vendor.t(locationLoading.value ? "定位中..." : locationAddress.value || "点击选择位置"),
        b: common_vendor.o(getLocation),
        c: common_vendor.unref(appStore).headerPaddingStyle(12),
        d: common_vendor.t(locationLabel.value),
        e: activeDropdown.value === "location" ? 1 : "",
        f: !!selRegionId.value || selDistanceIdx.value > 0 ? 1 : "",
        g: activeDropdown.value === "location" ? 1 : "",
        h: common_vendor.o(($event) => toggleDropdown("location")),
        i: common_vendor.t(bedroomLabel.value),
        j: activeDropdown.value === "bedroom" ? 1 : "",
        k: !!selBedroom.value ? 1 : "",
        l: activeDropdown.value === "bedroom" ? 1 : "",
        m: common_vendor.o(($event) => toggleDropdown("bedroom")),
        n: common_vendor.t(priceLabel.value),
        o: activeDropdown.value === "price" ? 1 : "",
        p: priceMin.value > 0 || priceMax.value < PRICE_MAX ? 1 : "",
        q: activeDropdown.value === "price" ? 1 : "",
        r: common_vendor.o(($event) => toggleDropdown("price")),
        s: showSearch.value || keyword.value ? 1 : "",
        t: common_vendor.o(toggleSearch),
        v: showSearch.value
      }, showSearch.value ? common_vendor.e({
        w: showSearch.value,
        x: common_vendor.o(onSearch),
        y: keyword.value,
        z: common_vendor.o(($event) => keyword.value = $event.detail.value),
        A: keyword.value
      }, keyword.value ? {
        B: common_vendor.o(clearSearch)
      } : {}, {
        C: common_vendor.o(onSearch)
      }) : {}, {
        D: list.value.length === 0 && loadStatus.value !== "loading"
      }, list.value.length === 0 && loadStatus.value !== "loading" ? {
        E: common_vendor.p({
          text: "暂无楼盘数据"
        })
      } : {
        F: common_vendor.f(list.value, (item, k0, i0) => {
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
            f: item.houseTypes
          }, item.houseTypes ? {
            g: common_vendor.t(item.houseTypes)
          } : {}, {
            h: common_vendor.t(rentRangeText(item)),
            i: distanceText(item)
          }, distanceText(item) ? {
            j: common_vendor.t(distanceText(item))
          } : {}, {
            k: common_vendor.t(item.propertyCount),
            l: common_vendor.o(($event) => openNavigation(item), item.id),
            m: item.id,
            n: common_vendor.o(($event) => onCommunityTap(item), item.id)
          });
        }),
        G: common_vendor.p({
          status: loadStatus.value
        })
      }, {
        H: refreshing.value,
        I: common_vendor.o(onRefresh),
        J: common_vendor.o(onLoadMore),
        K: activeDropdown.value
      }, activeDropdown.value ? {
        L: common_vendor.o(closeDropdown)
      } : {}, {
        M: activeDropdown.value
      }, activeDropdown.value ? common_vendor.e({
        N: activeDropdown.value === "location"
      }, activeDropdown.value === "location" ? common_vendor.e({
        O: common_vendor.f(DISTANCE_OPTIONS, (opt, idx, i0) => {
          return {
            a: common_vendor.t(opt.label),
            b: idx,
            c: selDistanceIdx.value === idx ? 1 : "",
            d: common_vendor.o(($event) => selDistanceIdx.value = idx, idx)
          };
        }),
        P: !selL1.value ? 1 : "",
        Q: common_vendor.o(($event) => {
          selL1.value = void 0;
          selL2.value = void 0;
        }),
        R: common_vendor.f(regionTree.value, (r1, k0, i0) => {
          return {
            a: common_vendor.t(r1.name),
            b: r1.id,
            c: selL1.value === r1.id ? 1 : "",
            d: common_vendor.o(($event) => {
              selL1.value = r1.id;
              selL2.value = void 0;
            }, r1.id)
          };
        }),
        S: !selL1.value
      }, !selL1.value ? {} : {}, {
        T: selL1.value && l2List.value.length === 0
      }, selL1.value && l2List.value.length === 0 ? {
        U: common_vendor.t(((_a = regionTree.value.find((r) => r.id === selL1.value)) == null ? void 0 : _a.name) ?? "")
      } : {}, {
        V: common_vendor.f(l2List.value, (r2, k0, i0) => {
          return {
            a: common_vendor.t(r2.name),
            b: r2.id,
            c: selL2.value === r2.id ? 1 : "",
            d: common_vendor.o(($event) => selL2.value = r2.id, r2.id)
          };
        })
      }) : {}, {
        W: activeDropdown.value === "bedroom"
      }, activeDropdown.value === "bedroom" ? {
        X: common_vendor.f(common_vendor.unref(utils_constants.BEDROOM_OPTIONS), (opt, k0, i0) => {
          return {
            a: common_vendor.t(opt.label),
            b: String(opt.value),
            c: selBedroom.value === opt.value ? 1 : "",
            d: common_vendor.o(($event) => selBedroom.value = opt.value, String(opt.value))
          };
        })
      } : {}, {
        Y: activeDropdown.value === "price"
      }, activeDropdown.value === "price" ? {
        Z: common_vendor.t(priceMinLabel.value),
        aa: common_vendor.t(priceMaxLabel.value),
        ab: minPct.value + "%",
        ac: maxPct.value - minPct.value + "%",
        ad: common_vendor.t(priceMinLabel.value),
        ae: minPct.value + "%",
        af: common_vendor.o(($event) => onThumbTouchStart("min")),
        ag: common_vendor.o(onThumbTouchMove),
        ah: common_vendor.o(onThumbTouchEnd),
        ai: common_vendor.t(priceMaxLabel.value),
        aj: maxPct.value + "%",
        ak: common_vendor.o(($event) => onThumbTouchStart("max")),
        al: common_vendor.o(onThumbTouchMove),
        am: common_vendor.o(onThumbTouchEnd),
        an: common_vendor.o(onTrackTouchStart)
      } : {}, {
        ao: common_vendor.o(resetCurrentFilter),
        ap: common_vendor.o(confirmDropdown),
        aq: filterBarBottom.value + "px"
      }) : {}, {
        ar: !activeDropdown.value,
        as: common_vendor.o(goAddProperty),
        at: common_vendor.p({
          current: 1
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-d0bd3009"]]);
exports.MiniProgramPage = MiniProgramPage;
