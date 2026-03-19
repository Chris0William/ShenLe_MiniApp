"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "sl-load-more",
  props: {
    status: {}
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: _ctx.status === "loading"
      }, _ctx.status === "loading" ? {} : _ctx.status === "noMore" ? {} : {}, {
        b: _ctx.status === "noMore"
      });
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-b4bb1da7"]]);
wx.createComponent(Component);
