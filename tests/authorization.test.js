const {test} = require("node:test");
const assert = require("node:assert/strict");
const {SystemManagement: Model,seed,migrate,current} = require("../system-model");
function setup() {
  const data = migrate(seed()), admin = new Model(data);
  const make = (name,permissions,store="edu",project="") => admin.saveRole({name,permissions,store,project});
  const user = (id,grants={},storeGrants={},platformRoles=[]) => {const u={id,name:id,login:id,grants,storeGrants,platformRoles}; data.users.push(u); return new Model(data,id);};
  return {data,admin,make,user};
}
test("whole-store and explicit project grants stay distinct, union without expanding legacy grants",()=>{
  const {data,admin,make,user} = setup();
  const role = make("view",{transactions:["view"]});
  const whole = user("whole",{}, {edu:role.id}), partial = user("explicit",{A:role.id});
  const p=admin.saveProject({name:"new",store:"edu"});
  assert.equal(whole.can(p.id,"transactions","view"),true);
  assert.equal(partial.can(p.id,"transactions","view"),false);
  admin.saveUser({mode:"edit",id:"explicit",storeGrants:{edu:role.id}});
  assert.equal(partial.can("B","transactions","view"),true);
  assert.equal(partial.can("C","transactions","view"),false);
  assert.deepEqual(data.users.find(u=>u.id==="big").grants,{A:"large",B:"large"});
  assert.equal(data.users.find(u=>u.id==="big").storeGrants,undefined);
});
test("grantability is checked on every target; built-in refund role has no exception",()=>{
  const {admin,make,user} = setup();
  const a=make("A manager",{users:["view","edit"],roles:["view","edit"],transactions:["view"]},"edu","A");
  const b=make("B refund",{transactions:["view","refund"]},"edu","B");
  const manager=user("manager",{A:a.id,B:b.id});
  assert.equal(manager.assignableRoles("A").some(r=>r.id==="refund"),false);
  assert.throws(()=>manager.saveUser({mode:"edit",id:"charlie",grants:{A:"refund"}}));
  assert.throws(()=>manager.saveUser({mode:"edit",id:"charlie",grants:{B:"refund"}}));
  assert.throws(()=>manager.saveUser({mode:"edit",id:"manager",grants:{A:"refund"}}));
  assert.throws(()=>manager.saveUser({mode:"edit",id:"admin",grants:{A:"viewer"}}));
  const own=manager.saveRole({name:"A independent",store:"edu",project:"A",permissions:{transactions:["view"]}});
  assert.throws(()=>admin.saveUser({mode:"edit",id:"david",grants:{B:own.id}}));
  assert.throws(()=>manager.saveRole({id:"viewer",name:"Changed",store:"",permissions:{}}),/獨立角色/);
  assert.throws(()=>manager.saveRole({name:"store common",store:"edu",permissions:{}}));
});
test("role edits check every assignment including disabled users; self authority cannot be escalated",()=>{
  const {data,admin,make,user} = setup();
  const r=make("shared",{transactions:["view"]});
  admin.saveUser({mode:"edit",id:"charlie",grants:{A:r.id}});
  admin.saveUser({mode:"edit",id:"david",grants:{B:r.id}});
  const mgr=make("whole manager",{roles:["view","edit"],transactions:["view"]});
  const m=user("role-owner",{}, {edu:mgr.id});
  m.saveRole({...r,note:"allowed"});
  const other=make("cross manager",{roles:["view","edit"],transactions:["view"]},"");
  const cross=admin.saveRole({name:"cross common",permissions:{transactions:["view"]}});
  admin.saveUser({mode:"edit",id:"cross",grants:{A:cross.id,C:cross.id}});
  const platform=user("platform-roles",{}, {},[other.id]);
  data.roles.find(x=>x.id===other.id).permissions.roles=[];
  assert.throws(()=>platform.saveRole({...cross,note:"no"}));
  assert.throws(()=>m.saveRole({...mgr,permissions:{...mgr.permissions,transactions:["view","refund"]}}));
});
test("explicit revocation survives reload and omitted grants survive migration",()=>{
  const {data,admin} = setup();
  admin.saveUser({mode:"edit",id:"cross",grants:{A:null}});
  const copy=migrate(JSON.parse(JSON.stringify(data))); migrate(copy);
  const u=copy.users.find(u=>u.id==="cross");
  assert.deepEqual(u.grants,{C:"viewer"});
  const m=new Model(copy,"cross");
  assert.equal(m.can("A","transactions","view"),false);
  assert.equal(m.can("C","transactions","view"),true);
});
test("disabled users/roles and invalid sessions fail closed at every entry",()=>{
  const {data,admin} = setup();
  admin.saveUser({mode:"edit",id:"charlie",enabled:false});
  const disabled=new Model(data,"charlie");
  assert.equal(disabled.can("A","home","view"),false);
  assert.deepEqual(disabled.stores(),[]);
  const unknown=new Model(data,"missing");
  assert.equal(unknown.identity,"missing"); assert.equal(unknown.isSystem,false);
  assert.throws(()=>unknown.saveStore({name:"no"}));
  data.roles.find(r=>r.id==="refund").enabled=false;
  const d=new Model(data,"david"); assert.deepEqual(d.projects(),[]); assert.deepEqual(d.stores(),[]);
  assert.equal(current({getItem:()=>"bad-json"}).active,false);
  assert.equal(current({getItem:()=>null}).isSystem,true);
  data.users.find(u=>u.id==="admin").enabled=false;
  assert.equal(new Model(data).isSystem,false);
});
test("ordinary functional permissions allow scoped mutations; platform actions need platform grants",()=>{
  const {data,make,user} = setup();
  const role=make("operator",{projects:["view","edit"],stores:["view","edit"],payments:["view","edit"],fees:["view","edit"]});
  const scoped=user("scoped",{A:role.id}), whole=user("whole",{}, {edu:role.id});
  scoped.saveProject({id:"A",store:"edu",name:"Renamed A"});
  assert.throws(()=>scoped.saveProject({store:"edu",name:"no"}));
  assert.throws(()=>scoped.saveProject({id:"B",store:"edu",name:"no"}));
  assert.throws(()=>scoped.saveStore({id:"edu",name:"no"}));
  assert.throws(()=>scoped.saveStore({name:"no"}));
  assert.equal(scoped.can("A","payments","edit"),false);
  whole.saveProject({store:"edu",name:"yes"}); whole.saveStore({id:"edu",name:"yes"});
  const platformRole=make("platform",{stores:["view","edit"],payments:["view","edit"],fees:["view","edit"]},"");
  const platform=user("platform",{},{},[platformRole.id]);
  platform.saveStore({name:"platform-created"}); platform.setFee("atm","8");
  assert.equal(data.fees.atm,"8");
});
test("fee scope boundaries and snapshots remain intact with live inheritance",()=>{
  const {data,admin,make,user} = setup();
  const role=make("fee",{fees:["view","edit"]});
  const m=user("fee-project",{A:role.id});
  const entries = custom => Object.fromEntries(data.paymentTools.map(t=>[t.id,t.id==="credit-card" && custom ? {mode:"custom",fee:custom} : {mode:"inherit"}]));
  const now=new Date("2026-11-01T00:00:00+08:00");
  assert.throws(()=>m.saveFeeVersion("store","edu",{entries:entries("4")},now));
  assert.throws(()=>m.saveFeeVersion("project","B",{entries:entries("4")},now));
  assert.throws(()=>m.setFee("atm","8"));
  admin.saveFeeVersion("store","edu",{entries:entries("4")},now);
  const snapshot=admin.recordTransactionFee({id:"locked",projectId:"A",toolId:"credit-card",paidAt:now,amount:"1000"});
  m.saveFeeVersion("project","A",{entries:entries("3")},new Date(now.getTime()+1000));
  m.saveFeeVersion("project","A",{entries:entries()},new Date(now.getTime()+2000));
  assert.equal(m.resolveFee("credit-card",{projectId:"A",at:new Date(now.getTime()+2000)}).fee,"4");
  assert.deepEqual(data.feeSnapshots.locked,snapshot);
});
test("transaction view, refund, report and export rights are independently scoped",()=>{
  const {make,user} = setup();
  const view=make("A view",{transactions:["view"],reports:["view"]},"edu","A");
  const refund=make("B refund",{transactions:["view","refund","export"]},"edu","B");
  const m=user("tx",{A:view.id,B:refund.id});
  assert.equal(m.transactionAllowed({projectId:"A"}),true);
  assert.throws(()=>m.assertTransaction({projectId:"A"},"transactions","refund"));
  assert.throws(()=>m.assertTransaction({projectId:"A"},"transactions","export"));
  m.assertTransaction({projectId:"B"},"transactions","refund");
  m.assertTransaction({projectId:"B"},"transactions","export");
  assert.equal(m.transactionAllowed({projectId:"B"},"reports"),false);
  assert.equal(m.transactionAllowed({}),false);
  assert.equal(m.transactionAllowed({projectId:"C"}),false);
});
test("legacy fee overrides migrate once without changing grants or locked snapshots",()=>{
  const data=seed(); data.fees={system:"2", "store:edu":"3", "project:A":"4", "project:missing":"5"};
  migrate(data);
  const app=new Model(data);
  assert.equal(app.resolveFee("credit-card",{projectId:"A"}).fee,"4");
  assert.equal(app.resolveFee("credit-card",{projectId:"B"}).fee,"3");
  assert.deepEqual(data.users.find(u=>u.id==="big").grants,{A:"large",B:"large"});
  const old=data.feeVersions.find(v=>v.scope==="project" && v.target==="A"); old.cancelledAt=new Date().toISOString();
  const count=data.feeVersions.length;
  migrate(data); assert.equal(data.feeVersions.length,count);
  assert.equal(app.resolveFee("credit-card",{projectId:"A"}).fee,"3");
  assert.equal(data.legacyFeeOverrides["project:missing"],"5");
});
test("account disable requires all scopes and undefined is not a revocation",()=>{
  const {data,admin}=setup();
  const partial=new Model(data,"partial");
  assert.throws(()=>partial.saveUser({mode:"edit",id:"cross",enabled:false}));
  assert.throws(()=>admin.saveUser({mode:"edit",id:"cross",grants:{A:undefined}}));
  assert.equal(data.users.find(u=>u.id==="cross").grants.A,"viewer");
});
test("legacy dormant fee/payment fields never become newly effective permissions",()=>{
  const data=seed(),role=data.roles.find(r=>r.id==="large");
  role.permissionVersion=2;
  role.permissions.payments=["view","edit"]; role.permissions.fees=["view","edit"];
  migrate(data);
  assert.equal(new Model(data,"partial").can("A","fees","edit"),false);
  assert.equal(role.permissions.payments,undefined);
  const admin=new Model(data);
  admin.saveRole({...role,permissions:{...role.permissions,fees:["view","edit"]}});
  migrate(data);
  assert.equal(new Model(data,"partial").can("A","fees","edit"),true);
});

test("blank persisted sessions fail closed and never use a legacy administrator fallback",()=>{
  const legacy=JSON.stringify({data:migrate(seed()),currentUserId:"admin",store:"edu"});
  for (const blank of ["", " ", "null", "{}"]) {
    const storage={getItem:key=>key==="payment-system-management-v2" ? blank : legacy};
    assert.equal(current(storage).active,false);
  }
  assert.equal(current({getItem:()=>null}).isSystem,true);
});

test("disabled roles assigned to the operator remain protected from self modification",()=>{
  const {data,admin,make,user}=setup();
  const manager=make("role manager",{roles:["view","edit"],transactions:["view"]});
  const dormant=make("own dormant",{transactions:["view"]},"edu","A");
  const m=user("owner",{A:dormant.id},{edu:manager.id});
  admin.saveRole({...dormant,enabled:false});
  assert.throws(()=>m.saveRole({...dormant,enabled:true}),/自身授權/);
  assert.equal(data.roles.find(r=>r.id===dormant.id).enabled,false);
});

test("account state controls require every scope while scoped grant revocation remains available",()=>{
  const {data,admin}=setup();
  const partial=new Model(data,"partial");
  assert.equal(partial.canEditUser("cross"),true);
  assert.equal(partial.canChangeUserState("cross"),false);
  assert.equal(admin.canChangeUserState("cross"),true);
  partial.saveUser({mode:"edit",id:"cross",grants:{A:null}});
  assert.deepEqual(data.users.find(u=>u.id==="cross").grants,{C:"viewer"});
});

test("platform assignments validate their representation and do not retain caller references",()=>{
  const {data,admin}=setup();
  assert.throws(()=>admin.saveUser({mode:"edit",id:"charlie",platformRoles:"viewer"}),/角色陣列/);
  const submitted=["viewer"];
  admin.saveUser({mode:"edit",id:"charlie",platformRoles:submitted});
  submitted.push("large");
  assert.deepEqual(data.users.find(u=>u.id==="charlie").platformRoles,["viewer"]);
});
