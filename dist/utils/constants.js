"use strict";
const PRICE_RANGES = [
  { label: "不限", min: void 0, max: void 0 },
  { label: "1000以下", min: 0, max: 1e3 },
  { label: "1000-1500", min: 1e3, max: 1500 },
  { label: "1500-2000", min: 1500, max: 2e3 },
  { label: "2000-3000", min: 2e3, max: 3e3 },
  { label: "3000以上", min: 3e3, max: void 0 }
];
const ORIENTATIONS = ["南", "北", "东", "西", "南北", "东南", "东北", "西南", "西北"];
const DECORATIONS = ["毛坯", "简装", "精装", "豪装"];
const RENTAL_TYPES = ["整租", "合租"];
const DEPOSIT_RULES = [
  { label: "押一付一", deposit: 1, payment: 1 },
  { label: "押一付三", deposit: 1, payment: 3 },
  { label: "押二付一", deposit: 2, payment: 1 },
  { label: "半年付", deposit: 1, payment: 6 },
  { label: "年付", deposit: 1, payment: 12 }
];
exports.DECORATIONS = DECORATIONS;
exports.DEPOSIT_RULES = DEPOSIT_RULES;
exports.ORIENTATIONS = ORIENTATIONS;
exports.PRICE_RANGES = PRICE_RANGES;
exports.RENTAL_TYPES = RENTAL_TYPES;
