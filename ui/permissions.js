import management from "../system-model.js";

const routes = {
  index: "home", transactions: "transactions", "transaction-detail": "transactions",
  products: "products", tags: "tags", statistics: "reports", statements: "statements",
  users: "users", roles: "roles", projects: "projects", stores: "stores", payments: "payments",
};
let cached, serialized;
function model() {
  const saved = localStorage.getItem("payment-system-management-v2");
  if (!cached || saved !== serialized) {
    serialized = saved;
    let state;
    try { state = JSON.parse(saved); } catch { /* Use the existing default identity. */ }
    cached = new management.SystemManagement(
      management.migrate(management.isSavedData(state?.data) ? structuredClone(state.data) : management.seed()),
      state?.currentUserId || "admin", state?.store,
    );
  }
  return cached;
}
export function pageFeature(href = location.pathname) {
  return routes[href.split("/").pop().split(/[?#]/)[0].replace(/\.html$/, "")];
}
export function permitted(feature, action = "view") {
  if (!feature || feature === "home") return true;
  const app = model();
  if (app.user.system) return true;
  if (feature === "payments") return false;
  return app.projects(feature, action).length > 0;
}
export function controlPermitted(node) {
  const feature = pageFeature();
  if (!permitted(feature)) return false;
  // Form confirmation follows an operation already checked at its entry point.
  const text = node.textContent.trim();
  const action = node.getAttribute("href") === "#statement-edit" ? "edit"
    : /^(新增|建立)/.test(text) ? "create"
    : /^編輯/.test(text) ? "edit"
    : /^刪除/.test(text) ? "delete"
    : /^(退款|確認退款)/.test(text) ? "refund"
    : /^封存/.test(text) ? "archive"
    : /^匯出/.test(text) ? "export" : null;
  return !action || permitted(feature, action);
}
