"use strict";
const common_vendor = require("./common/vendor.js");
const stores_app = require("./stores/app.js");
const api_property = require("./api/property.js");
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
    const globalStats = common_vendor.ref(null);
    async function loadStats() {
      try {
        globalStats.value = await api_property.getPropertyGlobalStats();
      } catch {
      }
    }
    function getTabCount(value) {
      if (!globalStats.value) return "";
      if (value === void 0) return `${globalStats.value.totalCount}`;
      const map = {
        0: globalStats.value.vacantCount,
        1: globalStats.value.reservedCount,
        2: globalStats.value.rentedCount,
        3: globalStats.value.offlineCount
      };
      return `${map[value] ?? 0}`;
    }
    const statusTabs = [
      { label: "全部", value: void 0 },
      { label: "空置", value: 0 },
      { label: "预定", value: 1 },
      { label: "已租", value: 2 },
      { label: "下架", value: 3 }
    ];
    const activeStatus = common_vendor.ref(void 0);
    const keyword = common_vendor.ref("");
    const showFilter = common_vendor.ref(false);
    function toggleFilter() {
      showFilter.value = !showFilter.value;
    }
    const page = common_vendor.ref(1);
    const list = common_vendor.ref([]);
    const loadStatus = common_vendor.ref("more");
    async function loadData(reset = false) {
      if (reset) {
        page.value = 1;
        list.value = [];
      }
      if (loadStatus.value === "loading") return;
      loadStatus.value = "loading";
      try {
        const res = await api_property.getPropertyPage({
          page: page.value,
          pageSize,
          status: activeStatus.value,
          title: keyword.value || void 0
        });
        list.value = reset ? res.items : [...list.value, ...res.items];
        loadStatus.value = res.items.length < pageSize ? "noMore" : "more";
        page.value++;
      } catch {
        loadStatus.value = "more";
      }
    }
    function onTabChange(value) {
      activeStatus.value = value;
      loadData(true);
    }
    function onSearch() {
      loadData(true);
    }
    function onLoadMore() {
      if (loadStatus.value === "more") loadData();
    }
    function onRefresh() {
      loadStats();
      loadData(true);
    }
    function onCardTap(id) {
      common_vendor.index.navigateTo({ url: `/pages/common/property-detail/index?id=${id}` });
    }
    function onEdit(id) {
      common_vendor.index.navigateTo({ url: `/pages/common/property-form/index?id=${id}` });
    }
    function onDelete(id) {
      common_vendor.index.showModal({
        title: "确认删除",
        content: "删除后不可恢复，确定删除？",
        success: async (res) => {
          if (res.confirm) {
            try {
              await api_property.deleteProperty({ id: String(id) });
              common_vendor.index.showToast({ title: "删除成功", icon: "success" });
              loadStats();
              loadData(true);
            } catch {
            }
          }
        }
      });
    }
    const showStatusModal = common_vendor.ref(false);
    const statusTargetId = common_vendor.ref(0);
    const statusOptions = [
      { label: "空置", value: 0, color: "#22C55E" },
      { label: "预定", value: 1, color: "#F97316" },
      { label: "已租", value: 2, color: "#9CA3AF" },
      { label: "下架", value: 3, color: "#EF4444" }
    ];
    function onChangeStatus(id) {
      statusTargetId.value = id;
      showStatusModal.value = true;
    }
    async function confirmStatusChange(status) {
      showStatusModal.value = false;
      try {
        await api_property.updatePropertyStatus({ id: statusTargetId.value, status });
        common_vendor.index.showToast({ title: "状态已更新", icon: "success" });
        loadStats();
        loadData(true);
      } catch {
      }
    }
    function goAddProperty() {
      common_vendor.index.navigateTo({ url: "/pages/common/property-form/index" });
    }
    common_vendor.onMounted(() => {
      loadStats();
      loadData(true);
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.unref(appStore).headerPaddingStyle(12),
        b: common_vendor.o(onSearch),
        c: keyword.value,
        d: common_vendor.o(($event) => keyword.value = $event.detail.value),
        e: showFilter.value ? 1 : "",
        f: common_vendor.o(toggleFilter),
        g: common_vendor.f(statusTabs, (tab, k0, i0) => {
          return common_vendor.e({
            a: common_vendor.t(tab.label)
          }, globalStats.value ? {
            b: common_vendor.t(getTabCount(tab.value))
          } : {}, {
            c: tab.label,
            d: activeStatus.value === tab.value ? 1 : "",
            e: common_vendor.o(($event) => onTabChange(tab.value), tab.label)
          });
        }),
        h: globalStats.value,
        i: list.value.length === 0 && loadStatus.value !== "loading"
      }, list.value.length === 0 && loadStatus.value !== "loading" ? {
        j: common_vendor.p({
          text: "暂无房源数据"
        })
      } : {
        k: common_vendor.f(list.value, (item, k0, i0) => {
          return {
            a: item.coverImage || "/static/images/placeholder.png",
            b: common_vendor.t(item.statusName),
            c: common_vendor.n("s" + item.status),
            d: common_vendor.t(item.title),
            e: common_vendor.t(item.houseType),
            f: common_vendor.t(item.area ?? "-"),
            g: common_vendor.t(item.communityName),
            h: common_vendor.t(item.floorInfo ? " · " + item.floorInfo : ""),
            i: common_vendor.t(item.rentPrice),
            j: common_vendor.o(($event) => onEdit(item.id), item.id),
            k: common_vendor.o(($event) => onChangeStatus(item.id), item.id),
            l: common_vendor.o(($event) => onDelete(item.id), item.id),
            m: item.id,
            n: common_vendor.o(($event) => onCardTap(item.id), item.id)
          };
        }),
        l: common_vendor.p({
          status: loadStatus.value
        })
      }, {
        m: common_vendor.o(onRefresh),
        n: common_vendor.o(onLoadMore),
        o: common_vendor.o(goAddProperty),
        p: showStatusModal.value
      }, showStatusModal.value ? {
        q: common_vendor.f(statusOptions, (opt, k0, i0) => {
          return {
            a: opt.color,
            b: common_vendor.t(opt.label),
            c: opt.value,
            d: common_vendor.o(($event) => confirmStatusChange(opt.value), opt.value)
          };
        }),
        r: common_vendor.o(($event) => showStatusModal.value = false),
        s: common_vendor.o(() => {
        }),
        t: common_vendor.o(($event) => showStatusModal.value = false)
      } : {}, {
        v: common_vendor.p({
          current: 1
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-d0bd3009"]]);
exports.MiniProgramPage = MiniProgramPage;
