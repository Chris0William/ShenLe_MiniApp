"use strict";
const common_vendor = require("../../../common/vendor.js");
const stores_app = require("../../../stores/app.js");
const api_region = require("../../../api/region.js");
const LABEL_ID_BASE = 1e3;
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const appStore = stores_app.useAppStore();
    const tree = common_vendor.ref([]);
    const showForm = common_vendor.ref(false);
    const isEdit = common_vendor.ref(false);
    const form = common_vendor.ref({ id: "", name: "", level: 1, parentId: "", orderNo: 0 });
    const mapCenter = common_vendor.ref({ lng: 113.93, lat: 22.75 });
    const mapScale = common_vendor.ref(12);
    const expandedIds = common_vendor.ref(/* @__PURE__ */ new Set());
    function toggleExpand(nodeId) {
      if (expandedIds.value.has(nodeId)) {
        expandedIds.value.delete(nodeId);
      } else {
        expandedIds.value.add(nodeId);
      }
      expandedIds.value = new Set(expandedIds.value);
    }
    function isExpanded(nodeId) {
      return expandedIds.value.has(nodeId);
    }
    const editingRegion = common_vendor.ref(null);
    const editPoints = common_vendor.ref([]);
    const locatedId = common_vendor.ref(null);
    const listCollapsed = common_vendor.ref(false);
    function parseBoundary(boundary) {
      try {
        const arr = JSON.parse(boundary);
        return arr.map(([lng, lat]) => ({ longitude: lng, latitude: lat }));
      } catch {
        return [];
      }
    }
    function hasBoundary(node) {
      if (!node.boundary) return false;
      return parseBoundary(node.boundary).length >= 3;
    }
    function calcCenter(points) {
      if (!points.length) return { lng: 113.93, lat: 22.75 };
      const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
      const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
      return { lng, lat };
    }
    function getNodeCenter(node) {
      if (node.centerLng && node.centerLat) return { lng: node.centerLng, lat: node.centerLat };
      if (node.boundary) {
        const pts = parseBoundary(node.boundary);
        if (pts.length >= 3) return calcCenter(pts);
      }
      return null;
    }
    function locateRegion(node) {
      const center = getNodeCenter(node);
      if (!center) {
        common_vendor.index.showToast({ title: "该区域暂无边界数据", icon: "none" });
        return;
      }
      mapCenter.value = center;
      mapScale.value = node.level <= 1 ? 13 : 15;
      locatedId.value = node.id;
    }
    const L1_COLORS = { fill: "#3B82F620", stroke: "#3B82F6" };
    const L2_COLORS = { fill: "#10B98120", stroke: "#10B981" };
    const EDIT_COLORS = { fill: "#EF444440", stroke: "#EF4444" };
    const LOCATED_COLORS = { fill: "#F59E0B40", stroke: "#F59E0B" };
    const polygons = common_vendor.computed(() => {
      const result = [];
      function walk(nodes, level) {
        var _a, _b;
        for (const node of nodes) {
          if (node.boundary) {
            const points = parseBoundary(node.boundary);
            if (points.length >= 3) {
              const isEditing = ((_a = editingRegion.value) == null ? void 0 : _a.id) === node.id;
              const isLocated = locatedId.value === node.id && !isEditing;
              const colors = isEditing ? EDIT_COLORS : isLocated ? LOCATED_COLORS : level <= 1 ? L1_COLORS : L2_COLORS;
              result.push({
                points,
                fillColor: colors.fill,
                strokeColor: colors.stroke,
                strokeWidth: isEditing || isLocated ? 3 : 2,
                zIndex: isEditing ? 10 : isLocated ? 5 : level
              });
            }
          }
          if ((_b = node.children) == null ? void 0 : _b.length) walk(node.children, level + 1);
        }
      }
      walk(tree.value, 1);
      if (editPoints.value.length >= 3) {
        result.push({
          points: editPoints.value,
          fillColor: EDIT_COLORS.fill,
          strokeColor: EDIT_COLORS.stroke,
          strokeWidth: 3,
          zIndex: 100
        });
      }
      return result;
    });
    const flatRegionNodes = common_vendor.computed(() => {
      const result = [];
      function walk(nodes, level) {
        var _a;
        for (const node of nodes) {
          const center = getNodeCenter(node);
          if (center) result.push({ node, level, center });
          if ((_a = node.children) == null ? void 0 : _a.length) walk(node.children, level + 1);
        }
      }
      walk(tree.value, 1);
      return result;
    });
    const markers = common_vendor.computed(() => {
      const result = [];
      flatRegionNodes.value.forEach(({ node, level, center }, idx) => {
        const isLocated = locatedId.value === node.id;
        result.push({
          id: LABEL_ID_BASE + idx,
          latitude: center.lat,
          longitude: center.lng,
          width: 1,
          height: 1,
          iconPath: "/static/images/dot-red.png",
          anchor: { x: 0.5, y: 0.5 },
          callout: {
            content: node.name,
            display: "ALWAYS",
            fontSize: isLocated ? 13 : 11,
            borderRadius: 4,
            padding: 6,
            bgColor: isLocated ? "#F59E0B" : level <= 1 ? "#3B82F6" : "#10B981",
            color: "#fff",
            anchorY: 0
          }
        });
      });
      if (editingRegion.value) {
        editPoints.value.forEach((p, i) => {
          result.push({
            id: i + 1,
            latitude: p.latitude,
            longitude: p.longitude,
            width: 12,
            height: 12,
            anchor: { x: 0.5, y: 0.5 },
            iconPath: "/static/images/dot-red.png",
            callout: i === 0 ? { content: "起点", display: "ALWAYS", fontSize: 10, borderRadius: 4, padding: 4, bgColor: "#EF4444", color: "#fff" } : void 0
          });
        });
      }
      return result;
    });
    function onMarkerTap(e) {
      var _a;
      const markerId = ((_a = e.detail) == null ? void 0 : _a.markerId) ?? e.markerId;
      if (markerId == null) return;
      const idx = markerId - LABEL_ID_BASE;
      const entry = flatRegionNodes.value[idx];
      if (!entry) return;
      locateFromMap(entry.node);
    }
    function locateFromMap(node) {
      locatedId.value = node.id;
      if (node.pid) expandedIds.value.add(node.pid);
      expandedIds.value = new Set(expandedIds.value);
      if (listCollapsed.value) listCollapsed.value = false;
    }
    async function loadData() {
      try {
        tree.value = await api_region.getRegionTree();
        const ids = /* @__PURE__ */ new Set();
        tree.value.forEach((n) => {
          var _a;
          if ((_a = n.children) == null ? void 0 : _a.length) ids.add(n.id);
        });
        expandedIds.value = ids;
      } catch {
      }
    }
    function onMapTap(e) {
      if (!editingRegion.value) return;
      const { longitude, latitude } = e.detail || e;
      if (!longitude || !latitude) return;
      editPoints.value.push({ longitude, latitude });
    }
    function startEditBoundary(node) {
      editingRegion.value = node;
      if (node.boundary) {
        editPoints.value = parseBoundary(node.boundary);
      } else {
        editPoints.value = [];
      }
      if (node.centerLng && node.centerLat) {
        mapCenter.value = { lng: node.centerLng, lat: node.centerLat };
        mapScale.value = 14;
      }
    }
    function clearEditPoints() {
      editPoints.value = [];
    }
    function undoLastPoint() {
      editPoints.value.pop();
    }
    function cancelEdit() {
      editingRegion.value = null;
      editPoints.value = [];
    }
    async function saveEditBoundary() {
      if (!editingRegion.value) return;
      if (editPoints.value.length < 3) {
        common_vendor.index.showToast({ title: "至少需要3个点", icon: "none" });
        return;
      }
      const boundary = JSON.stringify(editPoints.value.map((p) => [p.longitude, p.latitude]));
      const center = calcCenter(editPoints.value);
      try {
        await api_region.saveBoundary({
          id: editingRegion.value.id,
          boundary,
          centerLng: center.lng,
          centerLat: center.lat
        });
        common_vendor.index.showToast({ title: "边界保存成功", icon: "success" });
        editingRegion.value = null;
        editPoints.value = [];
        loadData();
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
        id: String(node.id),
        name: node.name,
        level: node.level,
        parentId: String(node.pid || ""),
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
            id: Number(form.value.id),
            name: form.value.name,
            level: form.value.level,
            pid: form.value.parentId ? Number(form.value.parentId) : void 0,
            orderNo: form.value.orderNo
          });
          common_vendor.index.showToast({ title: "更新成功", icon: "success" });
        } else {
          await api_region.addRegion({
            name: form.value.name,
            level: form.value.level,
            pid: form.value.parentId ? Number(form.value.parentId) : void 0,
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
        b: editingRegion.value
      }, editingRegion.value ? {
        c: common_vendor.t(editingRegion.value.name),
        d: common_vendor.t(editPoints.value.length),
        e: common_vendor.o(undoLastPoint),
        f: common_vendor.o(clearEditPoints),
        g: common_vendor.o(cancelEdit),
        h: common_vendor.o(saveEditBoundary)
      } : {}, {
        i: mapCenter.value.lng,
        j: mapCenter.value.lat,
        k: mapScale.value,
        l: polygons.value,
        m: markers.value,
        n: listCollapsed.value ? 1 : "",
        o: common_vendor.o(onMapTap),
        p: common_vendor.o(onMarkerTap),
        q: common_vendor.o(onMarkerTap),
        r: common_vendor.t(listCollapsed.value ? "▲" : "▼"),
        s: common_vendor.t(listCollapsed.value ? "展开列表" : "收起列表"),
        t: common_vendor.o(($event) => listCollapsed.value = !listCollapsed.value),
        v: tree.value.length === 0
      }, tree.value.length === 0 ? {} : {
        w: common_vendor.f(tree.value, (node, k0, i0) => {
          var _a, _b, _c, _d;
          return common_vendor.e({
            a: (_a = node.children) == null ? void 0 : _a.length
          }, ((_b = node.children) == null ? void 0 : _b.length) ? {
            b: isExpanded(node.id) ? 1 : "",
            c: common_vendor.o(($event) => toggleExpand(node.id), node.id)
          } : {}, {
            d: common_vendor.t(node.name),
            e: hasBoundary(node)
          }, hasBoundary(node) ? {} : {}, {
            f: common_vendor.o(($event) => locateRegion(node), node.id),
            g: common_vendor.o(($event) => openAdd(String(node.id), node.level + 1), node.id),
            h: hasBoundary(node) ? 1 : "",
            i: common_vendor.o(($event) => startEditBoundary(node), node.id),
            j: common_vendor.o(($event) => openEdit(node), node.id),
            k: common_vendor.o(($event) => onDelete(node), node.id),
            l: locatedId.value === node.id ? 1 : "",
            m: ((_c = node.children) == null ? void 0 : _c.length) && isExpanded(node.id)
          }, ((_d = node.children) == null ? void 0 : _d.length) && isExpanded(node.id) ? {
            n: common_vendor.f(node.children, (child, k1, i1) => {
              return common_vendor.e({
                a: common_vendor.t(child.name),
                b: hasBoundary(child)
              }, hasBoundary(child) ? {} : {}, {
                c: common_vendor.o(($event) => locateRegion(child), child.id),
                d: hasBoundary(child) ? 1 : "",
                e: common_vendor.o(($event) => startEditBoundary(child), child.id),
                f: common_vendor.o(($event) => openEdit(child), child.id),
                g: common_vendor.o(($event) => onDelete(child), child.id),
                h: child.id,
                i: locatedId.value === child.id ? 1 : ""
              });
            })
          } : {}, {
            o: node.id
          });
        })
      }, {
        x: !listCollapsed.value,
        y: common_vendor.o(($event) => openAdd()),
        z: showForm.value
      }, showForm.value ? {
        A: common_vendor.t(isEdit.value ? "编辑区域" : "新增区域"),
        B: form.value.name,
        C: common_vendor.o(($event) => form.value.name = $event.detail.value),
        D: form.value.orderNo,
        E: common_vendor.o(common_vendor.m(($event) => form.value.orderNo = $event.detail.value, {
          number: true
        })),
        F: common_vendor.o(($event) => showForm.value = false),
        G: common_vendor.o(onSubmit),
        H: common_vendor.o(() => {
        }),
        I: common_vendor.o(($event) => showForm.value = false)
      } : {});
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-defbd82e"]]);
wx.createPage(MiniProgramPage);
