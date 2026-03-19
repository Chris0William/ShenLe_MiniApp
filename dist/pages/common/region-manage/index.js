"use strict";
const common_vendor = require("../../../common/vendor.js");
const stores_app = require("../../../stores/app.js");
const api_region = require("../../../api/region.js");
if (!Array) {
  const _easycom_sl_empty_state2 = common_vendor.resolveComponent("sl-empty-state");
  _easycom_sl_empty_state2();
}
const _easycom_sl_empty_state = () => "../../../components/sl-empty-state/sl-empty-state.js";
if (!Math) {
  _easycom_sl_empty_state();
}
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const appStore = stores_app.useAppStore();
    const tree = common_vendor.ref([]);
    const showForm = common_vendor.ref(false);
    const isEdit = common_vendor.ref(false);
    const form = common_vendor.ref({
      id: "",
      name: "",
      level: 1,
      parentId: "",
      orderNo: 0
    });
    async function loadData() {
      try {
        tree.value = await api_region.getRegionTree();
      } catch {
      }
    }
    function openAdd(parentId = "", level = 1) {
      isEdit.value = false;
      form.value = { id: "", name: "", level, parentId, orderNo: 0 };
      showForm.value = true;
    }
    function openEdit(node) {
      isEdit.value = true;
      form.value = {
        id: node.id,
        name: node.name,
        level: node.level,
        parentId: node.parentId || "",
        orderNo: 0
      };
      showForm.value = true;
    }
    async function onSubmit() {
      if (!form.value.name.trim()) {
        common_vendor.index.showToast({ title: "请输入区域名称", icon: "none" });
        return;
      }
      try {
        if (isEdit.value) {
          await api_region.updateRegion({
            id: form.value.id,
            name: form.value.name,
            level: form.value.level,
            parentId: form.value.parentId || void 0,
            orderNo: form.value.orderNo
          });
          common_vendor.index.showToast({ title: "更新成功", icon: "success" });
        } else {
          await api_region.addRegion({
            name: form.value.name,
            level: form.value.level,
            parentId: form.value.parentId || void 0,
            orderNo: form.value.orderNo
          });
          common_vendor.index.showToast({ title: "新增成功", icon: "success" });
        }
        showForm.value = false;
        loadData();
      } catch {
      }
    }
    function onDelete(node) {
      common_vendor.index.showModal({
        title: "确认删除",
        content: `确定删除区域「${node.name}」？`,
        success: async (res) => {
          if (!res.confirm) return;
          try {
            await api_region.deleteRegion({ id: node.id });
            common_vendor.index.showToast({ title: "删除成功", icon: "success" });
            loadData();
          } catch {
          }
        }
      });
    }
    common_vendor.onShow(() => loadData());
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.unref(appStore).headerPaddingStyle(12),
        b: tree.value.length === 0
      }, tree.value.length === 0 ? {
        c: common_vendor.p({
          text: "暂无区域数据"
        })
      } : {
        d: common_vendor.f(tree.value, (node, k0, i0) => {
          var _a, _b;
          return common_vendor.e({
            a: common_vendor.t(node.name),
            b: common_vendor.t(node.propertyCount || 0),
            c: common_vendor.o(($event) => openAdd(node.id, node.level + 1), node.id),
            d: common_vendor.o(($event) => openEdit(node), node.id),
            e: common_vendor.o(($event) => onDelete(node), node.id),
            f: (_a = node.children) == null ? void 0 : _a.length
          }, ((_b = node.children) == null ? void 0 : _b.length) ? {
            g: common_vendor.f(node.children, (child, k1, i1) => {
              return {
                a: common_vendor.t(child.name),
                b: common_vendor.t(child.propertyCount || 0),
                c: common_vendor.o(($event) => openEdit(child), child.id),
                d: common_vendor.o(($event) => onDelete(child), child.id),
                e: child.id
              };
            })
          } : {}, {
            h: node.id
          });
        })
      }, {
        e: common_vendor.o(($event) => openAdd()),
        f: showForm.value
      }, showForm.value ? {
        g: common_vendor.t(isEdit.value ? "编辑区域" : "新增区域"),
        h: form.value.name,
        i: common_vendor.o(($event) => form.value.name = $event.detail.value),
        j: form.value.orderNo,
        k: common_vendor.o(common_vendor.m(($event) => form.value.orderNo = $event.detail.value, {
          number: true
        })),
        l: common_vendor.o(($event) => showForm.value = false),
        m: common_vendor.o(onSubmit),
        n: common_vendor.o(() => {
        }),
        o: common_vendor.o(($event) => showForm.value = false)
      } : {});
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-defbd82e"]]);
wx.createPage(MiniProgramPage);
