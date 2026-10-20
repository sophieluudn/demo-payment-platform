(() => {
  "use strict";
  const STORAGE = "payment-system-management-v2";
  function load() {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (saved && !SystemManagement.isSavedData(saved.data))
      throw Error("無法讀取費率設定");
    return {
      saved: saved || {},
      model: new SystemManagement.SystemManagement(
        SystemManagement.migrate(saved?.data || SystemManagement.seed()),
      ),
    };
  }
  window.TransactionFees = {
    estimate(order) {
      try {
        const { model } = load();
        const toolId = order[6] === "信用卡一次付清"
          ? (order[5] === "國內卡" ? "credit-card" : "foreign-credit-card")
          : model.data.paymentTools.find(tool => tool.name === order[6])?.id;
        if (!toolId) return null;
        const at = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(order[9] || "") ? order[9] : new Date();
        const rate = model.resolveFee(toolId, {at});
        if (rate.fee === null) return null;
        return {...rate, feeAmount:SystemManagement.calculateEstimatedFee(order[7], rate.fee, rate.unit)};
      } catch {
        return null;
      }
    },
    // Called once with authoritative project/tool IDs and the successful payment timestamp.
    record(transaction) {
      const { saved, model } = load();
      const snapshot = model.recordTransactionFee(transaction);
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ ...saved, data: model.data }),
      );
      return snapshot;
    },
    read(id) {
      // Legacy fixture rows have no authoritative project ID. Do not invent one or reprice them.
      try {
        return structuredClone(load().model.data.feeSnapshots[id] || null);
      } catch {
        return null;
      }
    },
  };
})();
