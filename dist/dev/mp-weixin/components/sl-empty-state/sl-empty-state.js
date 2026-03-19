"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "sl-empty-state",
  props: {
    text: {}
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return {
        a: common_vendor.t(_ctx.text || "暂无数据")
      };
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-fa4b3cb5"]]);
wx.createComponent(Component);
