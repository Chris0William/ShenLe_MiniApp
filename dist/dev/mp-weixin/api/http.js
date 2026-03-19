"use strict";
const common_vendor = require("../common/vendor.js");
const BASE_URL = "https://fmcs.deerservice.com/api/sl";
function getToken() {
  return common_vendor.index.getStorageSync("token") || "";
}
let onUnauthorized = null;
let loginPromise = null;
function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}
function doRequest(method, url, data, canRetry = true) {
  return new Promise((resolve, reject) => {
    common_vendor.index.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        ...getToken() ? { Authorization: `Bearer ${getToken()}` } : {}
      },
      success(res) {
        const body = res.data;
        const is401 = body.code === 401;
        if (is401 && canRetry && onUnauthorized) {
          if (!loginPromise) {
            loginPromise = onUnauthorized().finally(() => {
              loginPromise = null;
            });
          }
          loginPromise.then((ok) => {
            if (ok) {
              doRequest(method, url, data, false).then(resolve).catch(reject);
            } else {
              reject(new Error("未授权，请重新登录"));
            }
          }).catch(() => reject(new Error("未授权，请重新登录")));
          return;
        }
        if (is401) {
          common_vendor.index.removeStorageSync("token");
          reject(new Error("未授权，请重新登录"));
          return;
        }
        if (body.code === 200) {
          resolve(body.result);
        } else {
          common_vendor.index.showToast({ title: body.message || "请求失败", icon: "none" });
          reject(new Error(body.message));
        }
      },
      fail(err) {
        common_vendor.index.showToast({ title: "网络异常", icon: "none" });
        reject(err);
      }
    });
  });
}
function get(url, data, canRetry = true) {
  const params = data ? Object.fromEntries(Object.entries(data).filter(([, v]) => v !== void 0)) : void 0;
  return doRequest("GET", url, params, canRetry);
}
function post(url, data, canRetry = true) {
  return doRequest("POST", url, data, canRetry);
}
exports.BASE_URL = BASE_URL;
exports.get = get;
exports.post = post;
exports.setUnauthorizedHandler = setUnauthorizedHandler;
