"use strict";
const common_vendor = require("../../../common/vendor.js");
const api_property = require("../../../api/property.js");
const api_file = require("../../../api/file.js");
if (!Array) {
  const _easycom_sl_empty_state2 = common_vendor.resolveComponent("sl-empty-state");
  const _easycom_sl_load_more2 = common_vendor.resolveComponent("sl-load-more");
  (_easycom_sl_empty_state2 + _easycom_sl_load_more2)();
}
const _easycom_sl_empty_state = () => "../../../components/sl-empty-state/sl-empty-state.js";
const _easycom_sl_load_more = () => "../../../components/sl-load-more/sl-load-more.js";
if (!Math) {
  (_easycom_sl_empty_state + _easycom_sl_load_more)();
}
const pageSize = 10;
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const communityId = common_vendor.ref(0);
    const communityName = common_vendor.ref("");
    common_vendor.onMounted(() => {
      var _a;
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const opts = ((_a = current == null ? void 0 : current.$page) == null ? void 0 : _a.options) || (current == null ? void 0 : current.options) || {};
      communityId.value = Number(opts.communityId) || 0;
      communityName.value = decodeURIComponent(opts.communityName || "");
      common_vendor.index.setNavigationBarTitle({ title: communityName.value || "房源列表" });
      loadData(true);
    });
    const statusTabs = [
      { label: "全部", value: void 0 },
      { label: "空置", value: 0 },
      { label: "预定", value: 1 },
      { label: "已租", value: 2 }
    ];
    const activeStatus = common_vendor.ref(void 0);
    const keyword = common_vendor.ref("");
    function onTabChange(value) {
      activeStatus.value = value;
      loadData(true);
    }
    function onSearch() {
      loadData(true);
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
          communityId: communityId.value,
          status: activeStatus.value,
          title: keyword.value || void 0
        });
        const newItems = res.items;
        list.value = reset ? newItems : [...list.value, ...newItems];
        loadStatus.value = newItems.length < pageSize ? "noMore" : "more";
        page.value++;
        loadCovers(newItems);
      } catch {
        loadStatus.value = "more";
      }
    }
    function onLoadMore() {
      if (loadStatus.value === "more") loadData();
    }
    function onRefresh() {
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
    function onCardTap(id) {
      common_vendor.index.navigateTo({ url: `/pages/common/property-detail/index?id=${id}` });
    }
    function onEdit(id) {
      common_vendor.index.navigateTo({ url: `/pages/common/property-form/index?id=${id}` });
    }
    const showManageModal = common_vendor.ref(false);
    const manageTargetId = common_vendor.ref(0);
    const statusOptions = [
      { label: "空置", value: 0, color: "#22C55E" },
      { label: "预定", value: 1, color: "#F97316" },
      { label: "已租", value: 2, color: "#94A3B8" }
    ];
    function onManage(id) {
      manageTargetId.value = id;
      showManageModal.value = true;
    }
    async function confirmStatusChange(status) {
      showManageModal.value = false;
      try {
        await api_property.updatePropertyStatus({ id: manageTargetId.value, status });
        common_vendor.index.showToast({ title: "状态已更新", icon: "success" });
        loadData(true);
      } catch {
      }
    }
    function onDeleteFromModal() {
      showManageModal.value = false;
      common_vendor.index.showModal({
        title: "确认删除",
        content: "删除后不可恢复，确定删除？",
        success: async (res) => {
          if (res.confirm) {
            try {
              await api_property.deleteProperty({ id: String(manageTargetId.value) });
              common_vendor.index.showToast({ title: "删除成功", icon: "success" });
              loadData(true);
            } catch {
            }
          }
        }
      });
    }
    function goAddProperty() {
      common_vendor.index.navigateTo({
        url: `/pages/common/property-form/index?communityId=${communityId.value}`
      });
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.o(onSearch),
        b: keyword.value,
        c: common_vendor.o(($event) => keyword.value = $event.detail.value),
        d: common_vendor.f(statusTabs, (tab, k0, i0) => {
          return common_vendor.e({
            a: common_vendor.t(tab.label),
            b: activeStatus.value === tab.value
          }, activeStatus.value === tab.value ? {} : {}, {
            c: tab.label,
            d: activeStatus.value === tab.value ? 1 : "",
            e: common_vendor.o(($event) => onTabChange(tab.value), tab.label)
          });
        }),
        e: list.value.length === 0 && loadStatus.value !== "loading"
      }, list.value.length === 0 && loadStatus.value !== "loading" ? {
        f: common_vendor.p({
          text: "暂无房源数据"
        })
      } : {
        g: common_vendor.f(list.value, (item, k0, i0) => {
          return common_vendor.e({
            a: coverSrc(item)
          }, coverSrc(item) ? {
            b: coverSrc(item)
          } : {}, {
            c: common_vendor.t(item.title),
            d: common_vendor.t(item.statusName),
            e: common_vendor.n("s" + item.status),
            f: common_vendor.t(item.houseType),
            g: common_vendor.t(item.area ?? "-"),
            h: common_vendor.t(item.rentPrice),
            i: common_vendor.o(($event) => onEdit(item.id), item.id),
            j: common_vendor.o(($event) => onManage(item.id), item.id),
            k: item.id,
            l: common_vendor.o(($event) => onCardTap(item.id), item.id)
          });
        }),
        h: common_vendor.p({
          status: loadStatus.value
        })
      }, {
        i: common_vendor.o(onRefresh),
        j: common_vendor.o(onLoadMore),
        k: common_vendor.o(goAddProperty),
        l: showManageModal.value
      }, showManageModal.value ? {
        m: common_vendor.f(statusOptions, (opt, k0, i0) => {
          return {
            a: opt.color,
            b: common_vendor.t(opt.label),
            c: opt.value,
            d: common_vendor.o(($event) => confirmStatusChange(opt.value), opt.value)
          };
        }),
        n: common_vendor.o(onDeleteFromModal),
        o: common_vendor.o(($event) => showManageModal.value = false),
        p: common_vendor.o(() => {
        }),
        q: common_vendor.o(($event) => showManageModal.value = false)
      } : {});
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-955e6800"]]);
wx.createPage(MiniProgramPage);
