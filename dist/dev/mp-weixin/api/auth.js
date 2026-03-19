"use strict";
const common_vendor = require("../common/vendor.js");
const api_http = require("./http.js");
function login(data) {
  return api_http.post("/api/sysAuth/login", data, false);
}
function getUserInfo() {
  return api_http.get("/api/sysAuth/getUserInfo");
}
function getWxOpenId(jsCode) {
  return api_http.get(`/api/sysWxOpen/wxOpenId?JsCode=${encodeURIComponent(jsCode)}`, void 0, false);
}
function wxOpenIdLogin(openId) {
  return api_http.post("/api/sysWxOpen/wxOpenIdLogin", { openId }, false);
}
function completeProfile(data) {
  return api_http.post("/api/sysWxOpen/completeProfile", data, false);
}
function uploadAvatar(openId, tempFilePath) {
  return new Promise((resolve, reject) => {
    common_vendor.index.uploadFile({
      url: `${api_http.BASE_URL}/api/sysWxOpen/uploadAvatar`,
      filePath: tempFilePath,
      name: "file",
      formData: { openId },
      success(res) {
        const body = JSON.parse(res.data);
        if (body.code === 200) {
          resolve(body.result);
        } else {
          reject(new Error(body.message || "头像上传失败"));
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}
exports.completeProfile = completeProfile;
exports.getUserInfo = getUserInfo;
exports.getWxOpenId = getWxOpenId;
exports.login = login;
exports.uploadAvatar = uploadAvatar;
exports.wxOpenIdLogin = wxOpenIdLogin;
