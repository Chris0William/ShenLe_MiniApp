"use strict";
const common_vendor = require("../../../common/vendor.js");
const api_property = require("../../../api/property.js");
const api_file = require("../../../api/file.js");
if (!Array) {
  const _easycom_sl_status_badge2 = common_vendor.resolveComponent("sl-status-badge");
  _easycom_sl_status_badge2();
}
const _easycom_sl_status_badge = () => "../../../components/sl-status-badge/sl-status-badge.js";
if (!Math) {
  _easycom_sl_status_badge();
}
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const id = common_vendor.ref("");
    const detail = common_vendor.ref(null);
    const currentSwiper = common_vendor.ref(0);
    const imageUrls = common_vendor.ref([]);
    async function loadImages() {
      if (!detail.value) return;
      const imgs = detail.value.images;
      if (imgs == null ? void 0 : imgs.length) {
        const urls = [];
        for (const img of imgs) {
          try {
            urls.push(await api_file.downloadFile(String(img.id)));
          } catch {
            urls.push("");
          }
        }
        imageUrls.value = urls.filter(Boolean);
      } else if (detail.value.coverImageId) {
        try {
          imageUrls.value = [await api_file.downloadFile(String(detail.value.coverImageId))];
        } catch {
        }
      }
    }
    const locationText = common_vendor.computed(() => {
      if (!detail.value) return "";
      const d = detail.value;
      const parts = [d.communityName, d.buildingName];
      if (d.floor && d.totalFloors) parts.push(`${d.floor}/${d.totalFloors}层`);
      if (d.roomNo) parts.push(d.roomNo);
      return parts.filter(Boolean).join(" · ");
    });
    async function loadDetail() {
      if (!id.value) return;
      try {
        detail.value = await api_property.getPropertyDetail(id.value);
        loadImages();
      } catch {
      }
    }
    function callPhone() {
      var _a;
      if (!((_a = detail.value) == null ? void 0 : _a.landlordPhone)) {
        common_vendor.index.showToast({ title: "暂无联系电话", icon: "none" });
        return;
      }
      common_vendor.index.makePhoneCall({ phoneNumber: detail.value.landlordPhone });
    }
    function onSwiperChange(e) {
      currentSwiper.value = e.detail.current;
    }
    common_vendor.onLoad((options) => {
      if (options == null ? void 0 : options.id) {
        id.value = options.id;
        loadDetail();
      }
    });
    return (_ctx, _cache) => {
      var _a, _b, _c, _d;
      return common_vendor.e({
        a: imageUrls.value.length
      }, imageUrls.value.length ? {
        b: common_vendor.f(imageUrls.value, (url, idx, i0) => {
          return {
            a: url,
            b: idx
          };
        }),
        c: currentSwiper.value,
        d: common_vendor.o(onSwiperChange)
      } : {}, {
        e: imageUrls.value.length > 1
      }, imageUrls.value.length > 1 ? {
        f: common_vendor.t(currentSwiper.value + 1),
        g: common_vendor.t(imageUrls.value.length)
      } : {}, {
        h: detail.value
      }, detail.value ? common_vendor.e({
        i: common_vendor.t((detail.value.rentPrice ?? 0).toLocaleString()),
        j: common_vendor.p({
          status: detail.value.status
        }),
        k: common_vendor.t(detail.value.title),
        l: common_vendor.t(detail.value.area ?? "-"),
        m: common_vendor.t(detail.value.houseType),
        n: detail.value.floor || detail.value.totalFloors
      }, detail.value.floor || detail.value.totalFloors ? {
        o: common_vendor.t(detail.value.floor ?? "-"),
        p: common_vendor.t(detail.value.totalFloors ?? "-")
      } : {}, {
        q: common_vendor.t(locationText.value),
        r: common_vendor.t(detail.value.orientation || "-"),
        s: common_vendor.t(detail.value.decoration || "-"),
        t: common_vendor.t(detail.value.rentalType || "-"),
        v: common_vendor.t(detail.value.depositRule || "-"),
        w: detail.value.deposit
      }, detail.value.deposit ? {
        x: common_vendor.t(detail.value.deposit.toLocaleString())
      } : {}, {
        y: common_vendor.t(detail.value.area ?? "-"),
        z: (_a = detail.value.tags) == null ? void 0 : _a.length
      }, ((_b = detail.value.tags) == null ? void 0 : _b.length) ? {
        A: common_vendor.f(detail.value.tags, (tag, k0, i0) => {
          return {
            a: common_vendor.t(tag.name),
            b: tag.id,
            c: common_vendor.s(tag.color ? {
              color: tag.color,
              borderColor: tag.color
            } : {})
          };
        })
      } : {}, {
        B: (_c = detail.value.facilities) == null ? void 0 : _c.length
      }, ((_d = detail.value.facilities) == null ? void 0 : _d.length) ? {
        C: common_vendor.f(detail.value.facilities, (f, k0, i0) => {
          return common_vendor.e({
            a: f.icon
          }, f.icon ? {
            b: common_vendor.t(f.icon)
          } : {}, {
            c: common_vendor.t(f.name),
            d: f.id
          });
        })
      } : {}, {
        D: detail.value.description
      }, detail.value.description ? {
        E: common_vendor.t(detail.value.description)
      } : {}, {
        F: detail.value.landlordName
      }, detail.value.landlordName ? common_vendor.e({
        G: common_vendor.t(detail.value.landlordName),
        H: detail.value.landlordPhone
      }, detail.value.landlordPhone ? {
        I: common_vendor.t(detail.value.landlordPhone),
        J: common_vendor.o(callPhone)
      } : {}) : {}) : {}, {
        K: common_vendor.o(callPhone),
        L: common_vendor.o(callPhone)
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-893a65a6"]]);
wx.createPage(MiniProgramPage);
