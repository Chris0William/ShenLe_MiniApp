"use strict";
const common_vendor = require("../../../common/vendor.js");
const stores_app = require("../../../stores/app.js");
const api_tag = require("../../../api/tag.js");
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
const pageSize = 20;
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const appStore = stores_app.useAppStore();
    const categories = common_vendor.ref([]);
    const activeCategory = common_vendor.ref("");
    const list = common_vendor.ref([]);
    const pg = common_vendor.ref(1);
    const loadStatus = common_vendor.ref("more");
    const filteredList = common_vendor.computed(() => {
      if (!activeCategory.value) return list.value;
      return list.value.filter((t) => t.category === activeCategory.value);
    });
    const showForm = common_vendor.ref(false);
    const isEdit = common_vendor.ref(false);
    const form = common_vendor.ref({
      id: "",
      name: "",
      category: "",
      color: "#1890ff",
      icon: "",
      orderNo: 0,
      remark: ""
    });
    const TAG_COLORS = [
      "#1890ff",
      "#52c41a",
      "#faad14",
      "#ff4d4f",
      "#722ed1",
      "#13c2c2",
      "#eb2f96",
      "#fa8c16",
      "#a0d911",
      "#2f54eb"
    ];
    async function loadCategories() {
      try {
        categories.value = await api_tag.getTagCategoryList();
      } catch {
      }
    }
    async function loadData(reset = false) {
      if (reset) {
        pg.value = 1;
        list.value = [];
      }
      if (loadStatus.value === "loading") return;
      loadStatus.value = "loading";
      try {
        const res = await api_tag.getTagPage({
          page: pg.value,
          pageSize
        });
        list.value = reset ? res.items : [...list.value, ...res.items];
        loadStatus.value = res.items.length < pageSize ? "noMore" : "more";
        pg.value++;
      } catch {
        loadStatus.value = "more";
      }
    }
    function switchCategory(cat) {
      activeCategory.value = cat === activeCategory.value ? "" : cat;
    }
    function openAdd() {
      var _a;
      isEdit.value = false;
      form.value = {
        id: "",
        name: "",
        category: activeCategory.value || (((_a = categories.value[0]) == null ? void 0 : _a.category) ?? ""),
        color: "#1890ff",
        icon: "",
        orderNo: 0,
        remark: ""
      };
      showForm.value = true;
    }
    function openEdit(item) {
      isEdit.value = true;
      form.value = {
        id: item.id,
        name: item.name,
        category: item.category,
        color: item.color || "#1890ff",
        icon: item.icon || "",
        orderNo: item.orderNo || 0,
        remark: item.remark || ""
      };
      showForm.value = true;
    }
    async function onSubmit() {
      if (!form.value.name.trim()) {
        common_vendor.index.showToast({ title: "请输入标签名称", icon: "none" });
        return;
      }
      if (!form.value.category) {
        common_vendor.index.showToast({ title: "请选择分类", icon: "none" });
        return;
      }
      try {
        if (isEdit.value) {
          await api_tag.updateTag({
            id: form.value.id,
            name: form.value.name,
            category: form.value.category,
            color: form.value.color || void 0,
            icon: form.value.icon || void 0,
            orderNo: form.value.orderNo,
            remark: form.value.remark || void 0
          });
          common_vendor.index.showToast({ title: "更新成功", icon: "success" });
        } else {
          await api_tag.addTag({
            name: form.value.name,
            category: form.value.category,
            color: form.value.color || void 0,
            icon: form.value.icon || void 0,
            orderNo: form.value.orderNo,
            remark: form.value.remark || void 0
          });
          common_vendor.index.showToast({ title: "新增成功", icon: "success" });
        }
        showForm.value = false;
        loadData(true);
      } catch {
      }
    }
    function onDelete(item) {
      common_vendor.index.showModal({
        title: "确认删除",
        content: `确定删除标签「${item.name}」？`,
        success: async (res) => {
          if (!res.confirm) return;
          try {
            await api_tag.deleteTag({ id: item.id });
            common_vendor.index.showToast({ title: "删除成功", icon: "success" });
            loadData(true);
          } catch {
          }
        }
      });
    }
    function getCategoryName(cat) {
      var _a;
      return ((_a = categories.value.find((c) => c.category === cat)) == null ? void 0 : _a.categoryName) || cat;
    }
    function onLoadMore() {
      if (loadStatus.value === "more") loadData();
    }
    common_vendor.onShow(() => {
      loadCategories();
      loadData(true);
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.unref(appStore).headerPaddingStyle(12),
        b: !activeCategory.value ? 1 : "",
        c: common_vendor.o(($event) => switchCategory("")),
        d: common_vendor.f(categories.value, (c, k0, i0) => {
          return {
            a: common_vendor.t(c.categoryName),
            b: c.category,
            c: activeCategory.value === c.category ? 1 : "",
            d: common_vendor.o(($event) => switchCategory(c.category), c.category)
          };
        }),
        e: filteredList.value.length === 0 && loadStatus.value !== "loading"
      }, filteredList.value.length === 0 && loadStatus.value !== "loading" ? {
        f: common_vendor.p({
          text: "暂无标签数据"
        })
      } : {}, {
        g: common_vendor.f(filteredList.value, (item, k0, i0) => {
          return {
            a: item.color || "#1890ff",
            b: common_vendor.t(item.name),
            c: common_vendor.t(getCategoryName(item.category)),
            d: common_vendor.o(($event) => openEdit(item), item.id),
            e: common_vendor.o(($event) => onDelete(item), item.id),
            f: item.id
          };
        }),
        h: filteredList.value.length > 0
      }, filteredList.value.length > 0 ? {
        i: common_vendor.p({
          status: loadStatus.value
        })
      } : {}, {
        j: common_vendor.o(onLoadMore),
        k: common_vendor.o(openAdd),
        l: showForm.value
      }, showForm.value ? {
        m: common_vendor.t(isEdit.value ? "编辑标签" : "新增标签"),
        n: form.value.name,
        o: common_vendor.o(($event) => form.value.name = $event.detail.value),
        p: common_vendor.f(categories.value, (c, k0, i0) => {
          return {
            a: common_vendor.t(c.categoryName),
            b: c.category,
            c: form.value.category === c.category ? 1 : "",
            d: common_vendor.o(($event) => form.value.category = c.category, c.category)
          };
        }),
        q: common_vendor.f(TAG_COLORS, (c, k0, i0) => {
          return {
            a: c,
            b: form.value.color === c ? 1 : "",
            c,
            d: common_vendor.o(($event) => form.value.color = c, c)
          };
        }),
        r: form.value.orderNo,
        s: common_vendor.o(common_vendor.m(($event) => form.value.orderNo = $event.detail.value, {
          number: true
        })),
        t: form.value.remark,
        v: common_vendor.o(($event) => form.value.remark = $event.detail.value),
        w: common_vendor.o(($event) => showForm.value = false),
        x: common_vendor.o(onSubmit),
        y: common_vendor.o(() => {
        }),
        z: common_vendor.o(($event) => showForm.value = false)
      } : {});
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-f298d82f"]]);
wx.createPage(MiniProgramPage);
