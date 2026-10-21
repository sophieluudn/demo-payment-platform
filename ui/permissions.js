import management from "../system-model.js";

const routes = {
  index: "home",
  transactions: "transactions",
  "transaction-detail": "transactions",
  products: "products",
  tags: "tags",
  statistics: "reports",
  statements: "statements",
  users: "users",
  roles: "roles",
  projects: "projects",
  stores: "stores",
  payments: "payments",
};

let cached, serialized;
export function model() {
  const saved = localStorage.getItem("payment-system-management-v2");
  if (!cached || saved !== serialized) {
    serialized = saved;
    cached = management.current(localStorage);
  }
  return cached;
}

export function pageFeature(href = location.pathname) {
  return routes[
    href
      .split("/")
      .pop()
      .split(/[?#]/)[0]
      .replace(/\.html$/, "")
  ];
}

export function permitted(feature, action = "view") {
  const app = model();
  if (!app.active) return false;
  if (!feature || feature === "home") return true;
  if (feature === "payments")
    return app.canPlatform(feature, action) || app.canPlatform("fees", action);
  if (["users", "roles", "projects", "stores"].includes(feature))
    return (
      app.stores(feature, action).length > 0 || app.canPlatform(feature, action)
    );
  return (
    app.canPlatform(feature, action) ||
    app.canStore(app.store, feature, action) ||
    app.projects(feature, action).length > 0
  );
}

export function controlPermitted(node) {
  const feature = pageFeature();
  if (!permitted(feature)) return false;
  const action = node.dataset.permissionAction;
  const targetFeature = node.dataset.permissionFeature || feature;
  if (node.dataset.permissionScope)
    return model().allowed(
      node.dataset.permissionScope,
      node.dataset.permissionTarget || "",
      targetFeature,
      action || "view",
    );
  if (node.dataset.projectId)
    return model().can(node.dataset.projectId, targetFeature, action || "view");
  return !action || permitted(targetFeature, action);
}
