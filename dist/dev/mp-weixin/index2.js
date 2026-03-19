"use strict";
const common_vendor = require("./common/vendor.js");
const stores_app = require("./stores/app.js");
const api_community = require("./api/community.js");
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
    const mapLat = common_vendor.ref(22.5431);
    const mapLng = common_vendor.ref(114.0579);
    const mapScale = common_vendor.ref(14);
    function getLocation() {
      common_vendor.index.getLocation({
        type: "gcj02",
        success: (res) => {
          mapLat.value = res.latitude;
          mapLng.value = res.longitude;
        }
      });
    }
    const communities = common_vendor.ref([]);
    async function loadCommunities() {
      try {
        const res = await api_community.getCommunityPage({ page: 1, pageSize: 500, status: 0 });
        communities.value = res.items.filter((c) => c.lat && c.lng);
      } catch {
      }
    }
    const markers = common_vendor.computed(
      () => communities.value.map((c) => ({
        id: c.id,
        latitude: c.lat,
        longitude: c.lng,
        width: 24,
        height: 24,
        callout: {
          content: `${c.name}
${rentText(c)}`,
          display: "ALWAYS",
          fontSize: 11,
          borderRadius: 6,
          padding: 6,
          bgColor: "#2563EB",
          color: "#ffffff",
          textAlign: "center"
        }
      }))
    );
    const selected = common_vendor.ref(null);
    function onMarkerTap(e) {
      const id = e.detail.markerId;
      selected.value = communities.value.find((c) => c.id === id) ?? null;
    }
    function onCalloutTap(e) {
      const id = e.detail.markerId;
      const item = communities.value.find((c) => c.id === id);
      goProperties(item ?? null);
    }
    function onMapTap() {
      selected.value = null;
    }
    function goProperties(item) {
      if (!item) return;
      common_vendor.index.navigateTo({
        url: `/pages/common/community-properties/index?communityId=${item.id}&communityName=${encodeURIComponent(item.name)}`
      });
    }
    function rentText(item) {
      if (!item.minRentPrice && !item.maxRentPrice) return "暂无报价";
      if (item.minRentPrice === item.maxRentPrice) return `¥${item.minRentPrice}/月`;
      return `¥${item.minRentPrice}起/月`;
    }
    common_vendor.onMounted(() => {
      getLocation();
      loadCommunities();
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.unref(appStore).headerPaddingStyle(0),
        b: mapLat.value,
        c: mapLng.value,
        d: mapScale.value,
        e: markers.value,
        f: common_vendor.o(onMarkerTap),
        g: common_vendor.o(onCalloutTap),
        h: common_vendor.o(onMapTap),
        i: selected.value
      }, selected.value ? common_vendor.e({
        j: common_vendor.t(selected.value.name),
        k: selected.value.regionName
      }, selected.value.regionName ? {
        l: common_vendor.t(selected.value.regionName)
      } : {}, {
        m: selected.value.houseTypes
      }, selected.value.houseTypes ? {
        n: common_vendor.t(selected.value.houseTypes)
      } : {}, {
        o: common_vendor.t(rentText(selected.value)),
        p: common_vendor.t(selected.value.propertyCount),
        q: common_vendor.o(($event) => goProperties(selected.value))
      }) : {
        r: common_vendor.t(communities.value.length)
      }, {
        s: common_vendor.p({
          current: 1
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-75f2d38b"]]);
exports.MiniProgramPage = MiniProgramPage;
