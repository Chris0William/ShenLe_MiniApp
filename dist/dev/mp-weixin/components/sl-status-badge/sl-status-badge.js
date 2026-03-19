"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "sl-status-badge",
  props: {
    status: {}
  },
  setup(__props) {
    const props = __props;
    const statusMap = {
      0: { name: "空置", color: "#22C55E", bg: "#F0FDF4" },
      1: { name: "预定", color: "#F97316", bg: "#FFF7ED" },
      2: { name: "已租", color: "#9CA3AF", bg: "#F3F4F6" }
    };
    const info = common_vendor.computed(() => statusMap[props.status] || statusMap[0]);
    return (_ctx, _cache) => {
      return {
        a: common_vendor.t(info.value.name),
        b: info.value.color,
        c: info.value.bg
      };
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-ba66c924"]]);
wx.createComponent(Component);
