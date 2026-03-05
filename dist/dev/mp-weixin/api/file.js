"use strict";
const common_vendor = require("../common/vendor.js");
const api_http = require("./http.js");
function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const token = common_vendor.index.getStorageSync("token") || "";
    common_vendor.index.uploadFile({
      url: `${api_http.BASE_URL}/api/sysFile/uploadFile`,
      filePath,
      name: "file",
      header: {
        Authorization: `Bearer ${token}`
      },
      success(res) {
        if (res.statusCode === 200) {
          const body = JSON.parse(res.data);
          if (body.code === 200) {
            resolve(body.result);
          } else {
            common_vendor.index.showToast({ title: body.message || "上传失败", icon: "none" });
            reject(new Error(body.message));
          }
        } else {
          reject(new Error(`上传失败: ${res.statusCode}`));
        }
      },
      fail(err) {
        common_vendor.index.showToast({ title: "上传失败", icon: "none" });
        reject(err);
      }
    });
  });
}
const fileCache = /* @__PURE__ */ new Map();
function downloadFile(fileId) {
  const cached = fileCache.get(fileId);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const token = common_vendor.index.getStorageSync("token") || "";
    common_vendor.index.downloadFile({
      url: `${api_http.BASE_URL}/api/sysFile/Preview/${fileId}`,
      header: {
        Authorization: `Bearer ${token}`
      },
      success(res) {
        if (res.statusCode === 200 && res.tempFilePath) {
          fileCache.set(fileId, res.tempFilePath);
          resolve(res.tempFilePath);
        } else {
          reject(new Error(`下载失败: ${res.statusCode}`));
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}
exports.downloadFile = downloadFile;
exports.uploadFile = uploadFile;
