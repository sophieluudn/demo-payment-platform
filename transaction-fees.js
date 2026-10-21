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
        saved ? (saved.currentUserId ?? "invalid") : "admin", saved?.store,
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
        if (!PaymentAccess.allows(order)) return null;
        const rate = model.resolveFee(toolId, {at,projectId:order[14]});
        if (rate.fee === null) return null;
        return {...rate, feeAmount:SystemManagement.calculateEstimatedFee(order[7], rate.fee, rate.unit)};
      } catch {
        return null;
      }
    },
    // Called once with authoritative project/tool IDs and the successful payment timestamp.
    record(transaction) {
      const { saved, model } = load();
      model.assertTransaction(transaction);
      const snapshot = model.recordTransactionFee(transaction);
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ ...saved, data: model.data, currentUserId:model.identity, store:model.store }),
      );
      return snapshot;
    },
    read(id) {
      // Legacy fixture rows have no authoritative project ID. Do not invent one or reprice them.
      try {
        const app = load().model, snapshot = app.data.feeSnapshots[id];
        if (!snapshot || !app.transactionAllowed(snapshot)) return null;
        return structuredClone(snapshot);
      } catch {
        return null;
      }
    },
  };
})();
