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
export {
  SequenceStatus,
  StepPriority,
  StepStatus,
  StepType,
  TimingType
};
//# sourceMappingURL=index.mjs.map