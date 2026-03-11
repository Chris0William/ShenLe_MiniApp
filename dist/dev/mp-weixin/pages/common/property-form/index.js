"use strict";
const common_vendor = require("../../../common/vendor.js");
const api_community = require("../../../api/community.js");
const api_building = require("../../../api/building.js");
const api_tag = require("../../../api/tag.js");
const api_property = require("../../../api/property.js");
const api_file = require("../../../api/file.js");
const utils_constants = require("../../../utils/constants.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const currentStep = common_vendor.ref(0);
    const steps = ["选择位置", "填写信息", "上传图片"];
    const isEdit = common_vendor.ref(false);
    const editId = common_vendor.ref("");
    const submitting = common_vendor.ref(false);
    const communities = common_vendor.ref([]);
    const buildings = common_vendor.ref([]);
    const form = common_vendor.reactive({
      communityId: "",
      buildingId: "",
      floor: "",
      roomNumber: "",
      totalFloor: "",
      // 步骤2：基本信息
      title: "",
      bedrooms: 1,
      livingRooms: 1,
      bathrooms: 1,
      area: "",
      orientationIdx: -1,
      decorationIdx: -1,
      rentalTypeIdx: -1,
      monthlyRent: "",
      deposit: "",
      depositRuleIdx: -1,
      description: "",
      contactName: "",
      contactPhone: "",
      // 标签
      selectedTagIds: [],
      selectedFacilityIds: [],
      // 步骤3：图片
      imageIds: [],
      imageUrls: [],
      coverImageId: ""
    });
    const houseTags = common_vendor.ref([]);
    const facilityTags = common_vendor.ref([]);
    async function loadCommunities() {
      try {
        communities.value = await api_community.getCommunityList({});
      } catch {
      }
    }
    async function loadBuildings(communityId) {
      if (!communityId) {
        buildings.value = [];
        return;
      }
      try {
        buildings.value = await api_building.getBuildingList({ communityId });
      } catch {
      }
    }
    async function loadTags() {
      try {
        houseTags.value = await api_tag.getTagList({ category: "house" });
        facilityTags.value = await api_tag.getTagList({ category: "facility" });
      } catch {
      }
    }
    common_vendor.watch(() => form.communityId, (val) => {
      form.buildingId = "";
      loadBuildings(val);
    });
    const communityPickerIdx = common_vendor.ref(0);
    function onCommunityChange(e) {
      var _a;
      const idx = Number(e.detail.value);
      communityPickerIdx.value = idx;
      form.communityId = ((_a = communities.value[idx]) == null ? void 0 : _a.id) || "";
    }
    const buildingPickerIdx = common_vendor.ref(0);
    function onBuildingChange(e) {
      var _a, _b;
      const idx = Number(e.detail.value);
      buildingPickerIdx.value = idx;
      form.buildingId = ((_a = buildings.value[idx]) == null ? void 0 : _a.id) || "";
      if ((_b = buildings.value[idx]) == null ? void 0 : _b.totalFloors) {
        form.totalFloor = String(buildings.value[idx].totalFloors);
      }
    }
    function toggleTag(id, list) {
      const idx = list.indexOf(id);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(id);
    }
    async function onChooseImage() {
      common_vendor.index.chooseImage({
        count: 9 - form.imageIds.length,
        success: async (res) => {
          for (const path of res.tempFilePaths) {
            try {
              const file = await api_file.uploadFile(path);
              form.imageIds.push(file.id);
              form.imageUrls.push(path);
              if (!form.coverImageId) form.coverImageId = file.id;
            } catch {
            }
          }
        }
      });
    }
    function removeImage(idx) {
      const removedId = form.imageIds[idx];
      form.imageIds.splice(idx, 1);
      form.imageUrls.splice(idx, 1);
      if (form.coverImageId === removedId) {
        form.coverImageId = form.imageIds[0] || "";
      }
    }
    function setCover(idx) {
      form.coverImageId = form.imageIds[idx];
    }
    function validateStep() {
      if (currentStep.value === 0) {
        if (!form.communityId) {
          common_vendor.index.showToast({ title: "请选择楼盘", icon: "none" });
          return false;
        }
        if (!form.buildingId) {
          common_vendor.index.showToast({ title: "请选择楼栋", icon: "none" });
          return false;
        }
        if (!form.floor) {
          common_vendor.index.showToast({ title: "请填写楼层", icon: "none" });
          return false;
        }
        return true;
      }
      if (currentStep.value === 1) {
        if (!form.title.trim()) {
          common_vendor.index.showToast({ title: "请填写标题", icon: "none" });
          return false;
        }
        if (!form.monthlyRent) {
          common_vendor.index.showToast({ title: "请填写月租金", icon: "none" });
          return false;
        }
        return true;
      }
      return true;
    }
    function onNext() {
      if (!validateStep()) return;
      currentStep.value++;
    }
    async function onSubmit() {
      if (submitting.value) return;
      submitting.value = true;
      try {
        const data = {
          title: form.title,
          communityId: Number(form.communityId),
          buildingId: Number(form.buildingId),
          floor: Number(form.floor) || 0,
          totalFloors: Number(form.totalFloor) || 0,
          roomNo: form.roomNumber || void 0,
          area: Number(form.area) || 0,
          bedrooms: form.bedrooms,
          livingRooms: form.livingRooms,
          bathrooms: form.bathrooms,
          orientation: form.orientationIdx >= 0 ? utils_constants.ORIENTATIONS[form.orientationIdx] : void 0,
          decoration: form.decorationIdx >= 0 ? utils_constants.DECORATIONS[form.decorationIdx] : void 0,
          rentalType: form.rentalTypeIdx >= 0 ? utils_constants.RENTAL_TYPES[form.rentalTypeIdx] : void 0,
          rentPrice: Number(form.monthlyRent) || 0,
          deposit: Number(form.deposit) || 0,
          depositRule: form.depositRuleIdx >= 0 ? utils_constants.DEPOSIT_RULES[form.depositRuleIdx].label : void 0,
          description: form.description || void 0,
          landlordName: form.contactName || void 0,
          landlordPhone: form.contactPhone || void 0,
          status: 0,
          coverImageId: form.coverImageId ? Number(form.coverImageId) : void 0,
          tagIds: form.selectedTagIds.map(Number),
          facilityIds: form.selectedFacilityIds.map(Number),
          images: form.imageIds.map((id) => ({ fileId: Number(id) }))
        };
        if (isEdit.value) {
          await api_property.updateProperty({ ...data, id: Number(editId.value) });
          common_vendor.index.showToast({ title: "更新成功", icon: "success" });
        } else {
          await api_property.addProperty(data);
          common_vendor.index.showToast({ title: "发布成功", icon: "success" });
        }
        setTimeout(() => common_vendor.index.navigateBack(), 500);
      } catch {
      } finally {
        submitting.value = false;
      }
    }
    common_vendor.onLoad(async (options) => {
      var _a, _b, _c;
      await Promise.all([loadCommunities(), loadTags()]);
      if (options == null ? void 0 : options.id) {
        isEdit.value = true;
        editId.value = options.id;
        try {
          const detail = await api_property.getPropertyDetail(options.id);
          form.communityId = detail.communityId;
          await loadBuildings(detail.communityId);
          form.buildingId = detail.buildingId;
          form.floor = String(detail.floor ?? "");
          form.totalFloor = String(detail.totalFloors ?? "");
          form.roomNumber = detail.roomNo ?? "";
          form.title = detail.title;
          form.bedrooms = detail.bedrooms;
          form.livingRooms = detail.livingRooms;
          form.bathrooms = detail.bathrooms;
          form.area = String(detail.area);
          form.orientationIdx = utils_constants.ORIENTATIONS.indexOf(detail.orientation);
          form.decorationIdx = utils_constants.DECORATIONS.indexOf(detail.decoration);
          form.rentalTypeIdx = utils_constants.RENTAL_TYPES.indexOf(detail.rentalType);
          form.monthlyRent = String(detail.rentPrice ?? "");
          form.deposit = String(detail.deposit || "");
          form.description = detail.description || "";
          form.contactName = detail.landlordName || "";
          form.contactPhone = detail.landlordPhone || "";
          form.selectedTagIds = ((_a = detail.tags) == null ? void 0 : _a.map((t) => t.id)) || [];
          form.selectedFacilityIds = ((_b = detail.facilities) == null ? void 0 : _b.map((f) => f.id)) || [];
          form.imageIds = ((_c = detail.images) == null ? void 0 : _c.map((i) => i.id)) || [];
          const urls = [];
          for (const img of detail.images || []) {
            try {
              urls.push(await api_file.downloadFile(String(img.id)));
            } catch {
              urls.push("");
            }
          }
          form.imageUrls = urls;
          form.coverImageId = detail.coverImageId || "";
          communityPickerIdx.value = communities.value.findIndex((c) => c.id === detail.communityId);
          buildingPickerIdx.value = buildings.value.findIndex((b) => b.id === detail.buildingId);
        } catch {
        }
      }
    });
    return (_ctx, _cache) => {
      var _a, _b;
      return common_vendor.e({
        a: common_vendor.f(steps, (step, i, i0) => {
          return {
            a: common_vendor.t(i < currentStep.value ? "✓" : i + 1),
            b: common_vendor.t(step),
            c: i,
            d: i === currentStep.value ? 1 : "",
            e: i < currentStep.value ? 1 : ""
          };
        }),
        b: currentStep.value === 0
      }, currentStep.value === 0 ? {
        c: common_vendor.t(form.communityId ? (_a = communities.value[communityPickerIdx.value]) == null ? void 0 : _a.name : "请选择楼盘"),
        d: communities.value.map((c) => c.name),
        e: communityPickerIdx.value,
        f: common_vendor.o(onCommunityChange),
        g: common_vendor.t(form.buildingId ? (_b = buildings.value[buildingPickerIdx.value]) == null ? void 0 : _b.name : form.communityId ? "请选择楼栋" : "请先选择楼盘"),
        h: !form.communityId ? 1 : "",
        i: buildings.value.map((b) => b.name),
        j: buildingPickerIdx.value,
        k: common_vendor.o(onBuildingChange),
        l: !form.communityId,
        m: form.floor,
        n: common_vendor.o(($event) => form.floor = $event.detail.value),
        o: form.roomNumber,
        p: common_vendor.o(($event) => form.roomNumber = $event.detail.value),
        q: form.totalFloor,
        r: common_vendor.o(($event) => form.totalFloor = $event.detail.value)
      } : {}, {
        s: currentStep.value === 1
      }, currentStep.value === 1 ? common_vendor.e({
        t: form.title,
        v: common_vendor.o(($event) => form.title = $event.detail.value),
        w: common_vendor.o(($event) => form.bedrooms = Math.max(0, form.bedrooms - 1)),
        x: common_vendor.t(form.bedrooms),
        y: common_vendor.o(($event) => form.bedrooms++),
        z: common_vendor.o(($event) => form.livingRooms = Math.max(0, form.livingRooms - 1)),
        A: common_vendor.t(form.livingRooms),
        B: common_vendor.o(($event) => form.livingRooms++),
        C: common_vendor.o(($event) => form.bathrooms = Math.max(0, form.bathrooms - 1)),
        D: common_vendor.t(form.bathrooms),
        E: common_vendor.o(($event) => form.bathrooms++),
        F: form.area,
        G: common_vendor.o(($event) => form.area = $event.detail.value),
        H: common_vendor.t(form.orientationIdx >= 0 ? common_vendor.unref(utils_constants.ORIENTATIONS)[form.orientationIdx] : "请选择"),
        I: common_vendor.unref(utils_constants.ORIENTATIONS),
        J: form.orientationIdx,
        K: common_vendor.o((e) => form.orientationIdx = Number(e.detail.value)),
        L: common_vendor.t(form.decorationIdx >= 0 ? common_vendor.unref(utils_constants.DECORATIONS)[form.decorationIdx] : "请选择"),
        M: common_vendor.unref(utils_constants.DECORATIONS),
        N: form.decorationIdx,
        O: common_vendor.o((e) => form.decorationIdx = Number(e.detail.value)),
        P: common_vendor.t(form.rentalTypeIdx >= 0 ? common_vendor.unref(utils_constants.RENTAL_TYPES)[form.rentalTypeIdx] : "请选择"),
        Q: common_vendor.unref(utils_constants.RENTAL_TYPES),
        R: form.rentalTypeIdx,
        S: common_vendor.o((e) => form.rentalTypeIdx = Number(e.detail.value)),
        T: form.monthlyRent,
        U: common_vendor.o(($event) => form.monthlyRent = $event.detail.value),
        V: form.deposit,
        W: common_vendor.o(($event) => form.deposit = $event.detail.value),
        X: common_vendor.t(form.depositRuleIdx >= 0 ? common_vendor.unref(utils_constants.DEPOSIT_RULES)[form.depositRuleIdx].label : "请选择"),
        Y: common_vendor.unref(utils_constants.DEPOSIT_RULES).map((r) => r.label),
        Z: form.depositRuleIdx,
        aa: common_vendor.o((e) => form.depositRuleIdx = Number(e.detail.value)),
        ab: houseTags.value.length > 0
      }, houseTags.value.length > 0 ? {
        ac: common_vendor.f(houseTags.value, (tag, k0, i0) => {
          return {
            a: common_vendor.t(tag.name),
            b: tag.id,
            c: form.selectedTagIds.includes(tag.id) ? 1 : "",
            d: common_vendor.o(($event) => toggleTag(tag.id, form.selectedTagIds), tag.id)
          };
        })
      } : {}, {
        ad: facilityTags.value.length > 0
      }, facilityTags.value.length > 0 ? {
        ae: common_vendor.f(facilityTags.value, (tag, k0, i0) => {
          return {
            a: common_vendor.t(tag.name),
            b: tag.id,
            c: form.selectedFacilityIds.includes(tag.id) ? 1 : "",
            d: common_vendor.o(($event) => toggleTag(tag.id, form.selectedFacilityIds), tag.id)
          };
        })
      } : {}, {
        af: form.description,
        ag: common_vendor.o(($event) => form.description = $event.detail.value),
        ah: form.contactName,
        ai: common_vendor.o(($event) => form.contactName = $event.detail.value),
        aj: form.contactPhone,
        ak: common_vendor.o(($event) => form.contactPhone = $event.detail.value)
      }) : {}, {
        al: currentStep.value === 2
      }, currentStep.value === 2 ? common_vendor.e({
        am: common_vendor.f(form.imageUrls, (url, idx, i0) => {
          return common_vendor.e({
            a: url,
            b: form.imageIds[idx] === form.coverImageId
          }, form.imageIds[idx] === form.coverImageId ? {} : {}, {
            c: common_vendor.o(($event) => removeImage(idx), idx),
            d: idx,
            e: common_vendor.o(($event) => setCover(idx), idx)
          });
        }),
        an: form.imageIds.length < 9
      }, form.imageIds.length < 9 ? {
        ao: common_vendor.o(onChooseImage)
      } : {}) : {}, {
        ap: currentStep.value > 0
      }, currentStep.value > 0 ? {
        aq: common_vendor.o(($event) => currentStep.value--)
      } : {}, {
        ar: common_vendor.t(currentStep.value < 2 ? "下一步" : submitting.value ? "提交中..." : isEdit.value ? "更新" : "发布"),
        as: submitting.value ? 1 : "",
        at: common_vendor.o(($event) => currentStep.value < 2 ? onNext() : onSubmit())
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-a2df6da4"]]);
wx.createPage(MiniProgramPage);
