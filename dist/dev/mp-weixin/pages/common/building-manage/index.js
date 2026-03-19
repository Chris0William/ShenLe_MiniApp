"use strict";
const common_vendor = require("../../../common/vendor.js");
const stores_app = require("../../../stores/app.js");
const api_building = require("../../../api/building.js");
const api_community = require("../../../api/community.js");
const api_file = require("../../../api/file.js");
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
    const communityId = common_vendor.ref("");
    const communityName = common_vendor.ref("");
    const list = common_vendor.ref([]);
    const communities = common_vendor.ref([]);
    const showForm = common_vendor.ref(false);
    const isEdit = common_vendor.ref(false);
    const form = common_vendor.ref({
      id: "",
      name: "",
      communityId: "",
      totalFloors: 1,
      unitsPerFloor: 1,
      orderNo: 0,
      imageIds: [],
      imageUrls: [],
      coverImageId: ""
    });
    async function loadData() {
      try {
        list.value = await api_building.getBuildingList({
          communityId: communityId.value || void 0
        });
      } catch {
      }
    }
    async function loadCommunities() {
      try {
        communities.value = await api_community.getCommunityList({});
        if (communityId.value) {
          const c = communities.value.find((c2) => c2.id === communityId.value);
          if (c) communityName.value = c.name;
        }
      } catch {
      }
    }
    function openAdd() {
      isEdit.value = false;
      form.value = {
        id: "",
        name: "",
        communityId: communityId.value,
        totalFloors: 1,
        unitsPerFloor: 1,
        orderNo: 0,
        imageIds: [],
        imageUrls: [],
        coverImageId: ""
      };
      showForm.value = true;
    }
    async function openEdit(item) {
      var _a;
      isEdit.value = true;
      form.value = {
        id: item.id,
        name: item.name,
        communityId: item.communityId,
        totalFloors: item.totalFloors || 1,
        unitsPerFloor: item.unitsPerFloor || 1,
        orderNo: item.orderNo || 0,
        imageIds: [],
        imageUrls: [],
        coverImageId: ""
      };
      try {
        const detail = await api_building.getBuildingDetail(String(item.id));
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
        common_vendor.index.showToast({ title: "请输入楼栋名称", icon: "none" });
        return;
      }
      if (!form.value.communityId) {
        common_vendor.index.showToast({ title: "请选择所属楼盘", icon: "none" });
        return;
      }
      try {
        const imageData = {
          coverImageId: form.value.coverImageId ? Number(form.value.coverImageId) : void 0,
          imageIds: form.value.imageIds.map(Number)
        };
        if (isEdit.value) {
          await api_building.updateBuilding({
            id: form.value.id,
            name: form.value.name,
            communityId: form.value.communityId,
            totalFloors: form.value.totalFloors,
            orderNo: form.value.orderNo,
            ...imageData
          });
          common_vendor.index.showToast({ title: "更新成功", icon: "success" });
        } else {
          await api_building.addBuilding({
            name: form.value.name,
            communityId: form.value.communityId,
            totalFloors: form.value.totalFloors,
            orderNo: form.value.orderNo,
            ...imageData
          });
          common_vendor.index.showToast({ title: "新增成功", icon: "success" });
        }
        showForm.value = false;
        loadData();
      } catch {
      }
    }
    function onDelete(item) {
      common_vendor.index.showModal({
        title: "确认删除",
        content: `确定删除楼栋「${item.name}」？`,
        success: async (res) => {
          if (!res.confirm) return;
          try {
            await api_building.deleteBuilding({ id: item.id });
            common_vendor.index.showToast({ title: "删除成功", icon: "success" });
            loadData();
          } catch {
          }
        }
      });
    }
    const showPicker = common_vendor.ref(false);
    function pickCommunity(id) {
      form.value.communityId = id;
      showPicker.value = false;
    }
    function getCommunityName(id) {
      var _a;
      return ((_a = communities.value.find((c) => c.id === id)) == null ? void 0 : _a.name) || "未选择";
    }
    common_vendor.onLoad((options) => {
      if (options == null ? void 0 : options.communityId) communityId.value = options.communityId;
    });
    common_vendor.onShow(() => {
      loadCommunities();
      loadData();
    });
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: communityName.value
      }, communityName.value ? {
        b: common_vendor.t(communityName.value)
      } : {}, {
        c: common_vendor.unref(appStore).headerPaddingStyle(12),
        d: list.value.length === 0
      }, list.value.length === 0 ? {
        e: common_vendor.p({
          text: "暂无楼栋数据"
        })
      } : {}, {
        f: common_vendor.f(list.value, (item, k0, i0) => {
          return {
            a: common_vendor.t(item.name),
            b: common_vendor.t(item.communityName),
            c: common_vendor.t(item.totalFloors),
            d: common_vendor.t(item.unitsPerFloor),
            e: common_vendor.t(item.propertyCount || 0),
            f: common_vendor.o(($event) => openEdit(item), item.id),
            g: common_vendor.o(($event) => onDelete(item), item.id),
            h: item.id
          };
        }),
        g: common_vendor.o(openAdd),
        h: showForm.value
      }, showForm.value ? common_vendor.e({
        i: common_vendor.t(isEdit.value ? "编辑楼栋" : "新增楼栋"),
        j: form.value.name,
        k: common_vendor.o(($event) => form.value.name = $event.detail.value),
        l: !communityId.value
      }, !communityId.value ? {
        m: common_vendor.t(form.value.communityId ? getCommunityName(form.value.communityId) : "请选择楼盘"),
        n: !form.value.communityId ? 1 : "",
        o: common_vendor.o(($event) => showPicker.value = true)
      } : {}, {
        p: form.value.totalFloors,
        q: common_vendor.o(common_vendor.m(($event) => form.value.totalFloors = $event.detail.value, {
          number: true
        })),
        r: form.value.unitsPerFloor,
        s: common_vendor.o(common_vendor.m(($event) => form.value.unitsPerFloor = $event.detail.value, {
          number: true
        })),
        t: form.value.orderNo,
        v: common_vendor.o(common_vendor.m(($event) => form.value.orderNo = $event.detail.value, {
          number: true
        })),
        w: common_vendor.f(form.value.imageUrls, (url, idx, i0) => {
          return common_vendor.e({
            a: url,
            b: form.value.imageIds[idx] === form.value.coverImageId
          }, form.value.imageIds[idx] === form.value.coverImageId ? {} : {}, {
            c: common_vendor.o(($event) => removeImage(idx), idx),
            d: idx,
            e: common_vendor.o(($event) => setCover(idx), idx)
          });
        }),
        x: form.value.imageIds.length < 9
      }, form.value.imageIds.length < 9 ? {
        y: common_vendor.o(onChooseImage)
      } : {}, {
        z: common_vendor.o(($event) => showForm.value = false),
        A: common_vendor.o(onSubmit),
        B: common_vendor.o(() => {
        }),
        C: common_vendor.o(($event) => showForm.value = false)
      }) : {}, {
        D: showPicker.value
      }, showPicker.value ? {
        E: common_vendor.f(communities.value, (c, k0, i0) => {
          return {
            a: common_vendor.t(c.name),
            b: c.id,
            c: form.value.communityId === c.id ? 1 : "",
            d: common_vendor.o(($event) => pickCommunity(c.id), c.id)
          };
        }),
        F: common_vendor.o(() => {
        }),
        G: common_vendor.o(($event) => showPicker.value = false)
      } : {});
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-07c4131a"]]);
wx.createPage(MiniProgramPage);
