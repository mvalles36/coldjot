"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  SequenceStatus: () => SequenceStatus,
  StepPriority: () => StepPriority,
  StepStatus: () => StepStatus,
  StepType: () => StepType,
  TimingType: () => TimingType
});
module.exports = __toCommonJS(src_exports);

// src/sequences.ts
var StepType = /* @__PURE__ */ ((StepType2) => {
  StepType2["MANUAL_EMAIL"] = "manual_email";
  StepType2["AUTOMATED_EMAIL"] = "automated_email";
  StepType2["WAIT"] = "wait";
  StepType2["CONDITION"] = "condition";
  StepType2["ACTION"] = "action";
  return StepType2;
})(StepType || {});
var TimingType = /* @__PURE__ */ ((TimingType2) => {
  TimingType2["IMMEDIATE"] = "immediate";
  TimingType2["DELAY"] = "delay";
  TimingType2["SCHEDULED"] = "scheduled";
  return TimingType2;
})(TimingType || {});
var StepPriority = /* @__PURE__ */ ((StepPriority2) => {
  StepPriority2["HIGH"] = "high";
  StepPriority2["NORMAL"] = "normal";
  StepPriority2["LOW"] = "low";
  return StepPriority2;
})(StepPriority || {});
var StepStatus = /* @__PURE__ */ ((StepStatus2) => {
  StepStatus2["NOT_SENT"] = "not_sent";
  StepStatus2["DRAFT"] = "draft";
  StepStatus2["ACTIVE"] = "active";
  StepStatus2["PAUSED"] = "paused";
  StepStatus2["COMPLETED"] = "completed";
  StepStatus2["ERROR"] = "error";
  return StepStatus2;
})(StepStatus || {});
var SequenceStatus = /* @__PURE__ */ ((SequenceStatus2) => {
  SequenceStatus2["DRAFT"] = "draft";
  SequenceStatus2["ACTIVE"] = "active";
  SequenceStatus2["PAUSED"] = "paused";
  SequenceStatus2["COMPLETED"] = "completed";
  SequenceStatus2["ERROR"] = "error";
  return SequenceStatus2;
})(SequenceStatus || {});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SequenceStatus,
  StepPriority,
  StepStatus,
  StepType,
  TimingType
});
//# sourceMappingURL=index.js.map