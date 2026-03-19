"use strict";
const common_vendor = require("./common/vendor.js");
const stores_app = require("./stores/app.js");
const api_region = require("./api/region.js");
const api_community = require("./api/community.js");
const api_building = require("./api/building.js");
const api_property = require("./api/property.js");
if (!Array) {
  const _easycom_sl_empty_state2 = common_vendor.resolveComponent("sl-empty-state");
  const _easycom_sl_custom_tabbar2 = common_vendor.resolveComponent("sl-custom-tabbar");
  (_easycom_sl_empty_state2 + _easycom_sl_custom_tabbar2)();
}
const _easycom_sl_empty_state = () => "./components/sl-empty-state/sl-empty-state.js";
const _easycom_sl_custom_tabbar = () => "./components/sl-custom-tabbar/sl-custom-tabbar.js";
if (!Math) {
  (_easycom_sl_empty_state + _easycom_sl_custom_tabbar)();
}
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const appStore = stores_app.useAppStore();
    const level = common_vendor.ref(1);
    const breadcrumbs = common_vendor.ref(["区域概览"]);
    const STATUS_BG = {
      0: "#e6f7e6",
      // vacant
      1: "#fff7e6",
      // reserved
      2: "#e6f0ff",
      // rented
      3: "#f0f0f0"
      // offline
    };
    const STATUS_COLOR = {
      0: "#52c41a",
      1: "#faad14",
      2: "#1890ff",
      3: "#999999"
    };
    const STATUS_NAME = {
      0: "空置",
      1: "预定",
      2: "已租",
      3: "下架"
    };
    const regionList = common_vendor.ref([]);
    function flattenLeaf(nodes) {
      var _a;
      const result = [];
      for (const n of nodes) {
        if ((_a = n.children) == null ? void 0 : _a.length) result.push(...flattenLeaf(n.children));
        else result.push(n);
      }
      return result;
    }
    async function loadRegions() {
      try {
        const tree = await api_region.getRegionTree();
        const leaves = flattenLeaf(tree);
        regionList.value = leaves.map((l) => ({ id: l.id, name: l.name, stats: null }));
        await Promise.all(
          regionList.value.map(async (r) => {
            try {
              r.stats = await api_region.getRegionStats(r.id);
            } catch {
            }
          })
        );
      } catch {
      }
    }
    const selectedRegion = common_vendor.ref({ id: 0, name: "" });
    const communityData = common_vendor.ref([]);
    async function drillRegion(r) {
      selectedRegion.value = { id: r.id, name: r.name };
      level.value = 2;
      breadcrumbs.value = ["区域概览", r.name];
      try {
        const comms = await api_community.getCommunityList({ regionId: r.id });
        communityData.value = await Promise.all(
          comms.map(async (c) => ({
            community: c,
            buildings: await api_building.getBuildingStats(c.id).catch(() => [])
          }))
        );
      } catch {
      }
    }
    const selectedBuilding = common_vendor.ref(null);
    const properties = common_vendor.ref([]);
    const floorGrid = common_vendor.computed(() => {
      if (!selectedBuilding.value) return [];
      const totalFloors = selectedBuilding.value.totalFloors || 1;
      const floors = [];
      for (let f = totalFloors; f >= 1; f--) {
        floors.push({
          floor: f,
          rooms: properties.value.filter((p) => p.floor === f).sort((a, b) => (a.roomNo || "").localeCompare(b.roomNo || ""))
        });
      }
      return floors;
    });
    async function drillBuilding(b, communityName = "") {
      selectedBuilding.value = b;
      level.value = 3;
      breadcrumbs.value = ["区域概览", selectedRegion.value.name, communityName ? communityName + " · " + b.name : b.name];
      try {
        properties.value = await api_property.getPropertyList({ buildingId: b.id });
      } catch {
      }
    }
    function goBack() {
      if (level.value === 3) {
        level.value = 2;
        breadcrumbs.value = ["区域概览", selectedRegion.value.name];
        selectedBuilding.value = null;
        properties.value = [];
      } else if (level.value === 2) {
        level.value = 1;
        breadcrumbs.value = ["区域概览"];
        communityData.value = [];
      }
    }
    const showModal = common_vendor.ref(false);
    const activeProperty = common_vendor.ref(null);
    function onRoomTap(p) {
      activeProperty.value = p;
      showModal.value = true;
    }
    async function changeStatus(s) {
      var _a;
      if (!activeProperty.value) return;
      try {
        await api_property.updatePropertyStatus({ id: activeProperty.value.id, status: s });
        common_vendor.index.showToast({ title: "状态已更新", icon: "success" });
        showModal.value = false;
        if (selectedBuilding.value) drillBuilding(selectedBuilding.value, ((_a = breadcrumbs.value[2]) == null ? void 0 : _a.split(" · ")[0]) || "");
      } catch {
      }
    }
    function goDetail() {
      if (!activeProperty.value) return;
      showModal.value = false;
      common_vendor.index.navigateTo({ url: `/pages/common/property-detail/index?id=${activeProperty.value.id}` });
    }
    function goEdit() {
      if (!activeProperty.value) return;
      showModal.value = false;
      common_vendor.index.navigateTo({ url: `/pages/common/property-form/index?id=${activeProperty.value.id}` });
    }
    function getRate(rented, total) {
      if (!total) return 0;
      return Math.round(rented / total * 100);
    }
    common_vendor.onMounted(() => {
      if (level.value === 1) loadRegions();
    });
    return (_ctx, _cache) => {
      var _a, _b, _c, _d;
      return common_vendor.e({
        a: level.value > 1
      }, level.value > 1 ? {
        b: common_vendor.o(goBack)
      } : {}, {
        c: common_vendor.f(breadcrumbs.value, (b, idx, i0) => {
          return common_vendor.e({
            a: idx > 0
          }, idx > 0 ? {} : {}, {
            b: common_vendor.t(b),
            c: idx,
            d: idx === breadcrumbs.value.length - 1 ? 1 : ""
          });
        }),
        d: common_vendor.unref(appStore).headerPaddingStyle(8),
        e: common_vendor.f(STATUS_NAME, (name, status, i0) => {
          return {
            a: STATUS_COLOR[Number(status)],
            b: common_vendor.t(name),
            c: status
          };
        }),
        f: level.value === 1
      }, level.value === 1 ? common_vendor.e({
        g: regionList.value.length === 0
      }, regionList.value.length === 0 ? {
        h: common_vendor.p({
          text: "暂无区域数据"
        })
      } : {
        i: common_vendor.f(regionList.value, (r, k0, i0) => {
          return common_vendor.e({
            a: common_vendor.t(r.name),
            b: r.stats
          }, r.stats ? {
            c: common_vendor.t(r.stats.availableCount),
            d: common_vendor.t(r.stats.rentedCount),
            e: common_vendor.t(r.stats.offlineCount),
            f: common_vendor.t(r.stats.propertyCount),
            g: getRate(r.stats.rentedCount, r.stats.propertyCount) + "%",
            h: common_vendor.t(getRate(r.stats.rentedCount, r.stats.propertyCount))
          } : {}, {
            i: r.id,
            j: common_vendor.o(($event) => drillRegion(r), r.id)
          });
        })
      }) : {}, {
        j: level.value === 2
      }, level.value === 2 ? common_vendor.e({
        k: communityData.value.length === 0
      }, communityData.value.length === 0 ? {
        l: common_vendor.p({
          text: "该区域暂无楼盘"
        })
      } : {
        m: common_vendor.f(communityData.value, (cd, k0, i0) => {
          return common_vendor.e({
            a: common_vendor.t(cd.community.name),
            b: cd.buildings.length === 0
          }, cd.buildings.length === 0 ? {} : {
            c: common_vendor.f(cd.buildings, (b, k1, i1) => {
              return {
                a: common_vendor.t(b.name),
                b: common_vendor.t(b.availableCount),
                c: common_vendor.t(b.rentedCount),
                d: common_vendor.t(b.offlineCount),
                e: common_vendor.t(b.propertyCount),
                f: common_vendor.t(b.totalFloors ?? "-"),
                g: b.id,
                h: common_vendor.o(($event) => drillBuilding(b, cd.community.name), b.id)
              };
            })
          }, {
            d: cd.community.id
          });
        })
      }) : {}, {
        n: level.value === 3
      }, level.value === 3 ? common_vendor.e({
        o: floorGrid.value.length === 0
      }, floorGrid.value.length === 0 ? {
        p: common_vendor.p({
          text: "该楼栋暂无房源"
        })
      } : {
        q: common_vendor.f(floorGrid.value, (row, k0, i0) => {
          return common_vendor.e({
            a: common_vendor.t(row.floor),
            b: common_vendor.f(row.rooms, (p, k1, i1) => {
              return {
                a: common_vendor.t(p.roomNo || "-"),
                b: common_vendor.t(STATUS_NAME[p.status]),
                c: STATUS_COLOR[p.status],
                d: common_vendor.t(p.rentPrice ?? "-"),
                e: p.id,
                f: STATUS_BG[p.status] || "#f5f5f5",
                g: STATUS_COLOR[p.status] || "#ddd",
                h: common_vendor.o(($event) => onRoomTap(p), p.id)
              };
            }),
            c: row.rooms.length === 0
          }, row.rooms.length === 0 ? {} : {}, {
            d: row.floor
          });
        })
      }) : {}, {
        r: showModal.value
      }, showModal.value ? {
        s: common_vendor.t(((_a = activeProperty.value) == null ? void 0 : _a.roomNo) || "房间"),
        t: common_vendor.t(STATUS_NAME[((_b = activeProperty.value) == null ? void 0 : _b.status) ?? 0]),
        v: common_vendor.o(($event) => showModal.value = false),
        w: common_vendor.t((_c = activeProperty.value) == null ? void 0 : _c.title),
        x: common_vendor.t(((_d = activeProperty.value) == null ? void 0 : _d.rentPrice) ?? "-"),
        y: common_vendor.f(STATUS_NAME, (name, s, i0) => {
          var _a2, _b2, _c2;
          return {
            a: common_vendor.t(name),
            b: s,
            c: Number(s) === ((_a2 = activeProperty.value) == null ? void 0 : _a2.status) ? 1 : "",
            d: Number(s) === ((_b2 = activeProperty.value) == null ? void 0 : _b2.status) ? STATUS_COLOR[Number(s)] : STATUS_BG[Number(s)],
            e: Number(s) === ((_c2 = activeProperty.value) == null ? void 0 : _c2.status) ? "#fff" : STATUS_COLOR[Number(s)],
            f: common_vendor.o(($event) => changeStatus(Number(s)), s)
          };
        }),
        z: common_vendor.o(goDetail),
        A: common_vendor.o(goEdit),
        B: common_vendor.o(() => {
        }),
        C: common_vendor.o(($event) => showModal.value = false)
      } : {}, {
        D: common_vendor.p({
          current: 2
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-aadae075"]]);
exports.MiniProgramPage = MiniProgramPage;
