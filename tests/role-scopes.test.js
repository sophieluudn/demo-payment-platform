const test = require("node:test");
const assert = require("node:assert/strict");
const { SystemManagement, seed } = require("../system-model");
const { actions, migrate } = require("../system-model");

test("menu permissions survive migration and revoked permissions are not restored", () => {
  const data = seed();
  const legacy = data.roles.find(r => r.id === "large");
  delete legacy.permissionVersion;
  delete legacy.permissions.tags;
  delete legacy.permissions.statements;
  delete legacy.permissions.roles;
  migrate(data);
  assert.deepEqual(legacy.permissions.tags, ["view", "create", "edit"]);
  assert.ok(legacy.permissions.statements.includes("archive"));
  assert.ok(legacy.permissions.roles.includes("create"));
  legacy.permissions.tags = [];
  legacy.permissions.roles = [];
  migrate(data);
  assert.deepEqual(legacy.permissions.tags, []);
  assert.deepEqual(legacy.permissions.roles, []);
  assert.deepEqual(Object.keys(actions), ["transactions", "products", "tags", "reports", "statements", "users", "roles", "projects", "stores"]);
  assert.equal(new SystemManagement(data, "charlie").can("A", "home", "view"), true);
  assert.equal(legacy.permissions.home, undefined);
});

test("create and edit share permission while unrelated actions remain isolated", () => {
  const data = seed();
  const admin = new SystemManagement(data);
  const role = admin.saveRole({name:"角色新增人員", store:"edu", permissions:{
    roles:["view", "create"], tags:["view", "edit"], statements:["view", "archive"],
  }});
  data.users.push({id:"role-author", name:"新增人員", login:"role-author", grants:{A:role.id}});
  const author = new SystemManagement(data, "role-author", "edu");
  assert.equal(author.canManageRoles("edu", "create"), true);
  assert.equal(author.canManageRoles("edu", "edit"), true);
  const child = author.saveRole({name:"標籤檢視", store:"edu", permissions:{tags:["view"]}});
  author.saveRole({id:child.id, name:child.name, store:"edu", permissions:{}});
  assert.deepEqual(role.permissions.tags, ["view", "create", "edit"]);
  assert.throws(() => author.saveRole({name:"越權", store:"edu", permissions:{tags:["delete"]}}));
  migrate(data);
  assert.deepEqual(role.permissions.statements, ["view", "archive"]);
  assert.deepEqual(role.permissions.products, []);
});
test("store roles allow distinct names and same name in different stores", () => {
  const data = seed();
  const admin = new SystemManagement(data);
  const a = admin.saveRole({
    name: "專案管理員",
    store: "edu",
    permissions: { transactions: ["view"] },
    note: "A 商店",
  });
  const b = admin.saveRole({
    name: "子商店管理員",
    store: "u",
    permissions: { transactions: ["view"] },
  });
  assert.deepEqual(a.permissions, b.permissions);
  admin.saveRole({
    name: "專案管理員",
    store: "u",
    permissions: { transactions: ["view"] },
  });
  assert.throws(() =>
    admin.saveRole({ name: "專案管理員", store: "edu", permissions: {} }),
  );
  const manager = new SystemManagement(data, "big", "edu");
  manager.saveRole({
    name: "教育自訂角色",
    store: "edu",
    permissions: { transactions: ["view"] },
  });
  assert.throws(() =>
    manager.saveRole({
      name: "不可建立",
      store: "u",
      permissions: { transactions: ["view"] },
    }),
  );
  assert.throws(() =>
    manager.saveRole({
      id: b.id,
      name: "不可修改",
      store: "edu",
      permissions: {},
    }),
  );
});
