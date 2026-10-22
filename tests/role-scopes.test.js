const test = require("node:test");
const assert = require("node:assert/strict");
const { SystemManagement, seed } = require("../system-model");
const { actions, migrate } = require("../system-model");

test('project and store fee editing permissions remain separate from each other and profile editing', () => {
  const data=seed(), admin=new SystemManagement(data);
  const role=admin.saveRole({name:'Project fees',store:'edu',permissions:{projects:['view','feeEdit'],stores:['view']}});
  data.users.push({id:'fee-editor',name:'Fee editor',login:'fee-editor',grants:{},storeGrants:{edu:role.id}});
  const editor=new SystemManagement(data,'fee-editor');
  assert.equal(editor.can('A','fees','edit'),true);
  assert.equal(editor.canStore('edu','fees','edit'),false);
  assert.equal(editor.can('A','projects','edit'),false);
  assert.equal(editor.can('C','fees','edit'),false);
  assert.equal(editor.canPlatform('fees','edit'),false);
  admin.saveRole({...role,permissions:{projects:['view'],stores:['view','feeEdit']}});
  assert.equal(editor.can('A','fees','edit'),false);
  assert.equal(editor.canStore('edu','fees','edit'),true);
  migrate(data);
  assert.equal(editor.can('A','fees','edit'),false);
});

test('legacy fee editing migrates once and a later revocation is never restored', () => {
  const data=seed();
  const role=data.roles.find(role=>role.id==='viewer');
  role.permissions.fees=['view','edit'];
  delete role.feePermissionVersion;
  migrate(data);
  assert.equal(role.permissions.projects.includes('feeEdit'),true);
  assert.equal(role.permissions.stores.includes('feeEdit'),true);
  role.permissions.projects=role.permissions.projects.filter(action=>action!=='feeEdit');
  migrate(data);
  assert.equal(role.permissions.projects.includes('feeEdit'),false);
  const user=new SystemManagement(data,'charlie');
  assert.equal(user.can('A','fees','edit'),false);
});

test('stores own independent roles and editing one store never changes another', () => {
  const data = seed(), admin = new SystemManagement(data);
  const education = data.roles.find(role => role.id === 'viewer');
  const learning = data.roles.find(role => role.id === 'viewer--store-u');
  assert.equal(education.store, 'edu');
  assert.equal(learning.store, 'u');
  assert.equal(data.roles.some(role => role.store === 'u' && role.id.startsWith('refund')), false);
  const created = admin.saveRole({name:'專案管理員',store:'edu',permissions:{projects:['view','edit']}});
  assert.equal(data.roles.some(role => role.store === 'u' && role.name === created.name), false);
  admin.saveRole({...education, name:'教育檢視', permissions:{transactions:[]}});
  assert.equal(learning.name, '交易檢視角色');
  assert.deepEqual(learning.permissions.transactions, ['view']);
  const cross = new SystemManagement(data, 'cross');
  assert.equal(cross.can('A','transactions','view'), false);
  assert.equal(cross.can('C','transactions','view'), true);
  assert.throws(() => admin.saveUser({mode:'edit',id:'charlie',grants:{A:learning.id}}));
  assert.throws(() => admin.saveRole({name:'No store',permissions:{}}), /個別商店/);
  assert.equal(admin.canPlatform('payments','edit'), true);
});

test('shared-role migration follows actual grants, is repeatable and never grants an unused store', () => {
  const data = seed();
  data.stores.push({id:'unused',name:'未授權商店'});
  data.roles = [{id:'old',name:'舊角色',store:'',enabled:false,permissionVersion:3,permissions:{transactions:['view']}}];
  data.users = [{id:'person',name:'Person',login:'person',grants:{A:'old',C:'old'},grantBatches:[{id:'batch',store:'*',projects:['A','C'],role:'old'}]}];
  migrate(data);
  assert.equal(data.roles.length, 2);
  assert.equal(data.roles.some(role => role.store === 'unused'), false);
  assert.deepEqual(data.users[0].grants, {A:'old',C:'old--store-u'});
  assert.deepEqual(data.users[0].grantBatches.map(batch => [batch.store,batch.role,batch.projects]), [['edu','old',['A']],['u','old--store-u',['C']]]);
  assert.equal(data.roles.every(role => role.enabled === false), true);
  const once = JSON.stringify({roles:data.roles,users:data.users});
  migrate(data); new SystemManagement(data, 'person');
  assert.equal(JSON.stringify({roles:data.roles,users:data.users}), once);
});

test('legacy platform business grants split by existing store without retaining platform authority', () => {
  const data = seed();
  data.roles = [{id:'old-global',name:'Global old',store:'',permissionVersion:3,permissions:{transactions:['view'],payments:['view','edit']}}];
  data.users = [{id:'legacy',name:'Legacy',login:'legacy',grants:{},platformRoles:['old-global']}];
  migrate(data);
  const user = new SystemManagement(data,'legacy');
  assert.equal(user.can('A','transactions','view'), true);
  assert.equal(user.can('C','transactions','view'), true);
  assert.equal(user.canPlatform('payments','edit'), false);
  assert.deepEqual(data.users[0].legacyPlatformRoles, ['old-global']);
  assert.deepEqual(data.users[0].platformRoles, []);
  data.stores.push({id:'future',name:'Future'});
  data.projects.push({id:'future-project',store:'future',name:'Future project'});
  assert.equal(user.can('future-project','transactions','view'), false);
});

test("unsupported transaction export is retired without changing grants", () => {
  const data = seed();
  const grants = structuredClone(data.users);
  const role = data.roles.find(role => role.id === 'viewer');
  role.permissions.transactions = ['view', 'export'];
  migrate(data);
  assert.deepEqual(role.permissions.transactions, ['view']);
  assert.deepEqual(data.users.map(user => user.grants), grants.map(user => user.grants));
  assert.deepEqual(actions.transactions, ['view', 'refund']);
});

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
  assert.deepEqual(Object.keys(actions), ["transactions", "products", "tags", "reports", "statements", "users", "roles", "projects", "stores", "payments", "fees"]);
  assert.equal(new SystemManagement(data, "charlie").can("A", "home", "view"), true);
  assert.equal(legacy.permissions.home, undefined);
});

test("create and edit share permission while unrelated actions remain isolated", () => {
  const data = seed();
  const admin = new SystemManagement(data);
  const role = admin.saveRole({name:"角色新增人員", store:"edu", permissions:{
    roles:["view", "create"], tags:["view", "edit"], statements:["view", "archive"],
  }});
  data.users.push({id:"role-author", name:"新增人員", login:"role-author", grants:{}, storeGrants:{edu:role.id}});
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
  admin.saveUser({mode:"edit",id:"big",storeGrants:{edu:"large"}});
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
