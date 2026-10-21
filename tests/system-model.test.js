const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  SystemManagement,
  seed,
  isSavedData,
  migrate,
} = require("../system-model");
test("every route loads the shared Element Plus application while retaining its controllers", () => {
  for (const file of fs
    .readdirSync(".")
    .filter((file) => file.endsWith(".html"))) {
    const html = fs.readFileSync(file, "utf8");
    const entry = ["login.html", "select-store.html"].includes(file)
      ? "access-app"
      : "element-app";
    assert.ok(html.includes(`ui/dist/${entry}.js`), file + " application");
    assert.ok(html.includes(`ui/dist/${entry}.css`), file + " styles");
    if (
      [
        "users.html",
        "roles.html",
        "projects.html",
        "stores.html",
        "payments.html",
      ].includes(file)
    )
      assert.ok(html.includes("system-admin.js"), file + " controller");
  }
});
test("explicit per-project roles isolate stores and do not infer authority from names", () => {
  const d = new SystemManagement(undefined, "charlie");
  assert.deepEqual(
    d.projects().map((p) => p.id),
    ["A"],
  );
  assert.deepEqual(
    d.stores().map((s) => s.id),
    ["edu"],
  );
  assert.throws(() => d.switchStore("u"));
  assert.equal(d.can("B", "transactions", "view"), false);
  d.role("viewer").name = "系統管理員";
  assert.equal(d.can("A", "users", "create"), false);
  assert.throws(() => d.saveRole({ name: "no" }));
  d.identity = "cross";
  d.normalize();
  d.switchStore("u");
  assert.deepEqual(
    d.projects().map((p) => p.id),
    ["C"],
  );
  d.data.users.push({ id: "empty", name: "Empty", login: "empty", grants: {} });
  d.identity = "empty";
  d.normalize();
  assert.equal(d.stores().length, 0);
});
test("role matrix keeps only real actions and scope changes cannot invalidate grants", () => {
  const d = new SystemManagement();
  const role = d.saveRole({
    name: "普通新角色",
    store: "u",
    permissions: { users: ["edit", "refund"], transactions: ["view"] },
  });
  assert.deepEqual(role.permissions.users, ["create", "edit"]);
  assert.equal(role.manager, false);
  assert.throws(() =>
    d.saveRole({
      id: "viewer",
      name: "限定角色",
      store: "edu",
      permissions: {},
    }),
  );
  d.saveUser({ mode: "edit", id: "cross", grants: { A: "refund" } });
  assert.equal(d.data.users.find((u) => u.id === "cross").grants.C, "viewer");
  assert.throws(() =>
    d.saveUser({ mode: "edit", id: "cross", grants: { A: role.id } }),
  );
});
test("legacy edit permission also allows creation while invalid user identities remain rejected", () => {
  const d = new SystemManagement(undefined, "little");
  assert.equal(d.manageable("create").length, d.manageable("edit").length);
  assert.equal(d.canEditUser("charlie"), true);
  const created = d.saveUser({
      mode: "new",
      name: "new",
      login: "new",
      grants: { A: "viewer" },
    });
  assert.equal(created.login, "new");
  assert.throws(() =>
    d.saveUser({ mode: "existing", id: "missing", grants: { A: "viewer" } }),
  );
  assert.throws(() =>
    d.saveUser({ mode: "edit", id: "missing", grants: { A: "viewer" } }),
  );
  d.saveUser({ mode: "edit", id: "charlie", grants: { A: "refund" } });
  assert.equal(d.data.users.find((u) => u.id === "charlie").grants.A, "refund");
});
test("new/existing accounts preserve other stores; no platform directory for ordinary managers", () => {
  const d = new SystemManagement(undefined, "big");
  assert.deepEqual(d.availableExisting(), []);
  const user = d.saveUser({
    mode: "new",
    name: "示意新人",
    login: "not-an-email",
    grants: { A: "viewer", B: "refund" },
  });
  assert.equal(user.grants.B, "refund");
  assert.throws(() =>
    d.saveUser({
      mode: "new",
      name: "repeat",
      login: "not-an-email",
      grants: { A: "viewer" },
    }),
  );
  d.identity = "admin";
  d.normalize();
  d.switchStore("u");
  d.saveUser({ mode: "existing", id: "david", grants: { C: "viewer" } });
  const david = d.data.users.find((u) => u.id === "david");
  assert.deepEqual(david.grants, { B: "refund", C: "viewer" });
});
test("manager-only identity, partial manager editing, and own-grant changes are guarded", () => {
  const d = new SystemManagement(undefined, "big");
  assert.throws(() =>
    d.saveUser({
      mode: "new",
      name: "test",
      login: "test",
      grants: { A: "large" },
    }),
  );
  assert.throws(() =>
    d.saveUser({ mode: "edit", id: "little", grants: { A: "viewer" } }),
  );
  assert.throws(() =>
    d.saveUser({ mode: "existing", id: "little", grants: { A: "viewer" } }),
  );
  assert.throws(() =>
    d.saveUser({ mode: "edit", id: "big", grants: { A: "viewer" } }),
  );
  d.identity = "partial";
  d.normalize();
  assert.equal(d.canEditUser("multi"), true);
  assert.equal(d.canEditUser("charlie"), true);
  d.saveUser({ mode: "edit", id: "multi", grants: { A: "viewer" } });
  assert.equal(d.data.users.find(u => u.id === "multi").grants.B,"viewer");
  assert.throws(() =>
    d.saveUser({
      mode: "new",
      name: "test",
      login: "test",
      grants: { B: "viewer" },
    }),
  );
});
test("platform payment configuration requires platform scope, while project fees use project scope", () => {
  const d = new SystemManagement();
  d.setFee("credit-card", "3.5");
  assert.equal(d.data.fees["credit-card"], "3.5");
  d.role("large").permissions.fees = ["view", "edit"];
  d.role("large").permissions.payments = ["view", "edit"];
  d.identity = "big";
  d.normalize();
  for (const key of ["credit-card", "apple-pay", "atm"]) {
    assert.equal(d.feeCan(key, "view"), false);
    assert.equal(d.feeCan(key, "edit"), false);
    assert.throws(() => d.setFee(key, "4"));
  }
  assert.equal(d.can("A", "fees", "edit"), true);
  assert.equal(d.can("A", "payments", "edit"), false);
  d.identity = "admin";
  d.normalize();
  const r = d.saveRole({
    name: "Settings",
    permissions: { fees: ["edit"], users: ["view"] },
  });
  assert.deepEqual(r.permissions.fees, ["create","edit"]);
  d.setFee("credit-card", "2.5");
  d.setFee("atm", "7");
  assert.throws(() => d.setFee("credit-card", "abc"));
  assert.throws(() => d.setFee("store:edu", "2.75"));
  assert.throws(() => d.setFee("project:A", "2.75"));
});
test("one shared payment setting applies to all existing and newly added stores and projects", () => {
  const d = new SystemManagement();
  d.setFee("credit-card", "3.5");
  d.setFee("atm", "7");
  const check = (tools) => {
    assert.equal(tools.find((t) => t.id === "credit-card").fee, "3.5");
    assert.equal(tools.find((t) => t.id === "atm").fee, "7");
  };
  for (const s of d.data.stores) check(d.paymentSettingsForStore(s.id));
  for (const p of d.data.projects) check(d.paymentSettingsForProject(p.id));
  d.data.stores.push({ id: "new-store", name: "New Store" });
  d.data.projects.push({
    id: "new-project",
    store: "new-store",
    name: "New Project",
  });
  check(d.paymentSettingsForStore("new-store"));
  check(d.paymentSettingsForProject("new-project"));
  assert.equal(Object.keys(d.data.fees).length, d.data.paymentTools.length);
  assert.throws(() => d.paymentSettingsForStore("missing"));
});
test("migration preserves platform values and removes store/project overrides", () => {
  const data = seed();
  delete data.paymentTools;
  data.fees = { system: "3.9", "store:edu": "4.5", "project:A": "5.5" };
  migrate(data);
  assert.equal(data.fees["credit-card"], "3.9");
  assert.equal(data.fees["store:edu"], undefined);
  assert.equal(data.fees["project:A"], undefined);
  data.fees.atm = "8";
  migrate(data);
  assert.equal(data.fees.atm, "8");
});
test("read-validity guard distinguishes original demo data from malformed persisted data", () => {
  assert.equal(isSavedData(seed()), true);
  assert.equal(isSavedData({}), false);
  assert.equal(isSavedData({ ...seed(), roles: [{ name: "broken" }] }), false);
});
