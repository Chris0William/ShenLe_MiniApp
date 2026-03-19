"use strict";
const common_vendor = require("../../../common/vendor.js");
const stores_app = require("../../../stores/app.js");
const api_community = require("../../../api/community.js");
const api_region = require("../../../api/region.js");
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
    const appStore = stores_app.useAppStore();
    const list = common_vendor.ref([]);
    const pg = common_vendor.ref(1);
    const loadStatus = common_vendor.ref("more");
    const regionTree = common_vendor.ref([]);
    const filterRegionId = common_vendor.ref("");
    const showForm = common_vendor.ref(false);
    const isEdit = common_vendor.ref(false);
    const form = common_vendor.ref({
      id: "",
      name: "",
      regionId: "",
      address: "",
      lng: 0,
      lat: 0,
      orderNo: 0,
      imageIds: [],
      imageUrls: [],
      coverImageId: ""
    });
    function autoGetLocation() {
      common_vendor.index.chooseLocation({
        success: (res) => {
          form.value.lng = res.longitude;
          form.value.lat = res.latitude;
          form.value.address = res.name || res.address || "";
        }
      });
    }
    const showRegionPicker = common_vendor.ref(false);
    function flattenRegions(nodes) {
      var _a;
      const result = [];
      for (const n of nodes) {
        result.push({ id: n.id, name: n.name, level: n.level });
        if ((_a = n.children) == null ? void 0 : _a.length) result.push(...flattenRegions(n.children));
      }
      return result;
    }
    async function loadData(reset = false) {
      if (reset) {
        pg.value = 1;
        list.value = [];
      }
      if (loadStatus.value === "loading") return;
      loadStatus.value = "loading";
      try {
        const res = await api_community.getCommunityPage({
          page: pg.value,
          pageSize,
          regionId: filterRegionId.value || void 0
        });
        list.value = reset ? res.items : [...list.value, ...res.items];
        loadStatus.value = res.items.length < pageSize ? "noMore" : "more";
        pg.value++;
      } catch {
        loadStatus.value = "more";
      }
    }
    async function loadRegions() {
      try {
        regionTree.value = await api_region.getRegionTree();
      } catch {
      }
    }
    function openAdd() {
      isEdit.value = false;
      form.value = { id: "", name: "", regionId: "", address: "", lng: 0, lat: 0, orderNo: 0, imageIds: [], imageUrls: [], coverImageId: "" };
      showForm.value = true;
      autoGetLocation();
    }
    async function openEdit(item) {
      var _a;
      isEdit.value = true;
      form.value = {
        id: item.id,
        name: item.name,
        regionId: item.regionId,
        lng: item.lng || 0,
        lat: item.lat || 0,
        address: item.address || "",
        orderNo: item.orderNo || 0,
        imageIds: [],
        imageUrls: [],
        coverImageId: ""
      };
      try {
        const detail = await api_community.getCommunityDetail(String(item.id));
        if ((_a = detail.images) == null ? void 0 : _a.length) {
          const ids = detail.images.map((i) => String(i.id));
          const urls = [];
          for (const id of ids) {
            try {
              urls.push(await api_file.downloadFile(id));
            } catch {
              urls.push("");
            }
          }
          form.value.imageIds = ids;
          form.value.imageUrls = urls;
        }
        if (detail.coverImageId) form.value.coverImageId = String(detail.coverImageId);
      } catch {
      }
      showForm.value = true;
    }
    async function onChooseImage() {
      common_vendor.index.chooseImage({
        count: 9 - form.value.imageIds.length,
        success: async (res) => {
          for (const path of res.tempFilePaths) {
            try {
              const file = await api_file.uploadFile(path);
              form.value.imageIds.push(file.id);
              form.value.imageUrls.push(path);
              if (!form.value.coverImageId) form.value.coverImageId = file.id;
            } catch {
            }
          }
        }
      });
    }
    function removeImage(idx) {
      const removedId = form.value.imageIds[idx];
      form.value.imageIds.splice(idx, 1);
      form.value.imageUrls.splice(idx, 1);
      if (form.value.coverImageId === removedId) {
        form.value.coverImageId = form.value.imageIds[0] || "";
      }
    }
    function setCover(idx) {
      form.value.coverImageId = form.value.imageIds[idx];
    }
    async function onSubmit() {
      if (!form.value.name.trim()) {
        common_vendor.index.showToast({ title: "请输入楼盘名称", icon: "none" });
        return;
      }
      if (!form.value.regionId) {
        common_vendor.index.showToast({ title: "请选择所属区域", icon: "none" });
        return;
      }
      try {
        const imageData = {
          coverImageId: form.value.coverImageId ? Number(form.value.coverImageId) : void 0,
          imageIds: form.value.imageIds.map(Number)
        };
        if (isEdit.value) {
          await api_community.updateCommunity({
            id: form.value.id,
            name: form.value.name,
            regionId: form.value.regionId,
            address: form.value.address || void 0,
            lng: form.value.lng || void 0,
            lat: form.value.lat || void 0,
            orderNo: form.value.orderNo,
            ...imageData
          });
          common_vendor.index.showToast({ title: "更新成功", icon: "success" });
        } else {
          await api_community.addCommunity({
            name: form.value.name,
            regionId: form.value.regionId,
            address: form.value.address || void 0,
            lng: form.value.lng || void 0,
            lat: form.value.lat || void 0,
            orderNo: form.value.orderNo,
            ...imageData
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
        content: `确定删除楼盘「${item.name}」？`,
        success: async (res) => {
          if (!res.confirm) return;
          try {
            await api_community.deleteCommunity({ id: item.id });
            common_vendor.index.showToast({ title: "删除成功", icon: "success" });
            loadData(true);
          } catch {
          }
        }
      });
    }
    function pickRegion(id) {
      form.value.regionId = id;
      showRegionPicker.value = false;
    }
    function getRegionName(id) {
      var _a;
      const flat = flattenRegions(regionTree.value);
      return ((_a = flat.find((r) => r.id === id)) == null ? void 0 : _a.name) || "未选择";
    }
    function filterByRegion(id) {
      filterRegionId.value = id === filterRegionId.value ? "" : id;
      loadData(true);
    }
    function onLoadMore() {
      if (loadStatus.value === "more") loadData();
    }
    function goBuildingManage(communityId) {
      common_vendor.index.navigateTo({ url: `/pages/common/building-manage/index?communityId=${communityId}` });
    }
    common_vendor.onShow(() => {
      loadRegions();
      loadData(true);
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.unref(appStore).headerPaddingStyle(12),
        b: !filterRegionId.value ? 1 : "",
        c: common_vendor.o(($event) => filterByRegion("")),
        d: common_vendor.f(flattenRegions(regionTree.value), (r, k0, i0) => {
          return {
            a: common_vendor.t(r.name),
            b: r.id,
            c: filterRegionId.value === r.id ? 1 : "",
            d: common_vendor.o(($event) => filterByRegion(r.id), r.id)
          };
        }),
        e: list.value.length === 0 && loadStatus.value !== "loading"
      }, list.value.length === 0 && loadStatus.value !== "loading" ? {
        f: common_vendor.p({
          text: "暂无楼盘数据"
        })
      } : {}, {
        g: common_vendor.f(list.value, (item, k0, i0) => {
          return common_vendor.e({
            a: common_vendor.t(item.name),
            b: common_vendor.t(item.regionName),
            c: item.address
          }, item.address ? {
            d: common_vendor.t(item.address)
          } : {}, {
            e: common_vendor.t(item.buildingCount || 0),
            f: common_vendor.o(($event) => goBuildingManage(item.id), item.id),
            g: common_vendor.o(($event) => openEdit(item), item.id),
            h: common_vendor.o(($event) => onDelete(item), item.id),
            i: item.id
          });
        }),
        h: list.value.length > 0
      }, list.value.length > 0 ? {
        i: common_vendor.p({
          status: loadStatus.value
        })
      } : {}, {
        j: common_vendor.o(onLoadMore),
        k: common_vendor.o(openAdd),
        l: showForm.value
      }, showForm.value ? common_vendor.e({
        m: common_vendor.t(isEdit.value ? "编辑楼盘" : "新增楼盘"),
        n: form.value.name,
        o: common_vendor.o(($event) => form.value.name = $event.detail.value),
        p: common_vendor.t(form.value.regionId ? getRegionName(form.value.regionId) : "请选择区域"),
        q: !form.value.regionId ? 1 : "",
        r: common_vendor.o(($event) => showRegionPicker.value = true),
        s: form.value.lng
      }, form.value.lng ? {} : {}, {
        t: common_vendor.t(form.value.lng ? "重新选点" : "选择位置"),
        v: common_vendor.o(autoGetLocation),
        w: form.value.address,
        x: common_vendor.o(($event) => form.value.address = $event.detail.value),
        y: form.value.orderNo,
        z: common_vendor.o(common_vendor.m(($event) => form.value.orderNo = $event.detail.value, {
          number: true
        })),
        A: common_vendor.f(form.value.imageUrls, (url, idx, i0) => {
          return common_vendor.e({
            a: url,
            b: form.value.imageIds[idx] === form.value.coverImageId
          }, form.value.imageIds[idx] === form.value.coverImageId ? {} : {}, {
            c: common_vendor.o(($event) => removeImage(idx), idx),
            d: idx,
            e: common_vendor.o(($event) => setCover(idx), idx)
          });
        }),
        B: form.value.imageIds.length < 9
      }, form.value.imageIds.length < 9 ? {
        C: common_vendor.o(onChooseImage)
      } : {}, {
        D: common_vendor.o(($event) => showForm.value = false),
        E: common_vendor.o(onSubmit),
        F: common_vendor.o(() => {
        }),
        G: common_vendor.o(($event) => showForm.value = false)
      }) : {}, {
        H: showRegionPicker.value
      }, showRegionPicker.value ? {
        I: common_vendor.f(flattenRegions(regionTree.value), (r, k0, i0) => {
          return {
            a: common_vendor.t(r.name),
            b: r.id,
            c: form.value.regionId === r.id ? 1 : "",
            d: r.level * 20 + 16 + "rpx",
            e: common_vendor.o(($event) => pickRegion(r.id), r.id)
          };
        }),
        J: common_vendor.o(() => {
        }),
        K: common_vendor.o(($event) => showRegionPicker.value = false)
      } : {});
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-02cf252d"]]);
wx.createPage(MiniProgramPage);
