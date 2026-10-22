const { test } = require("node:test");
const assert = require("node:assert/strict");
const { SystemManagement, migrate, seed } = require("../system-model");
test("estimated fees have a one-dollar minimum and five decimal places with decimal rounding", () => {
  const {calculateEstimatedFee:fee} = require("../system-model");
  assert.equal(fee("9", "1.995", "%"), 1);
  assert.equal(fee("0", "0", "%"), 1);
  assert.equal(fee("1008", "2", "%"), 20.16);
  assert.equal(fee("123.45", "1.234567", "%"), 1.52407);
  assert.equal(fee("100", "1.234565", "元"), 1.23457);
  assert.equal(fee("100", "0.5", "元"), 1);
});
const now = new Date("2026-10-15T12:00:00+08:00");
const start = "2026-11-01T00:00";
const before = "2026-10-31T23:59:59+08:00";
const after = "2026-11-01T00:00:00+08:00";
test("started payment versions lock rate unit and start time without partial writes", () => {
  const app = new SystemManagement(migrate(seed()));
  const tool = app.data.paymentTools.find(t => t.id === "credit-card");
  const version = app.activeFeeVersion("global", tool.id);
  version.effectiveAt = "2000-01-01T00:00:00Z";
  const input = {...tool, fee:version.entries[tool.id].fee, sourceVersionId:version.id,effectiveAt:version.effectiveAt};
  for (const change of [{fee:"99"}, {unit:"元"}, {currency:"USD"}, {effectiveAt:"2099-01-01T00:00"}, {fee:"99",effectiveAt:"2099-01-01T00:00"}]) {
    const before = JSON.stringify(app.data);
    assert.throws(() => app.savePaymentTool({...input,...change}), /不可變更/);
    assert.equal(JSON.stringify(app.data), before);
  }
  const count = app.data.feeVersions.length;
  app.savePaymentTool({...input,note:"保留費率，只改備註"});
  assert.equal(tool.note, "保留費率，只改備註");
  assert.equal(app.data.feeVersions.length, count);
  assert.throws(() => app.savePaymentTool({...input,metadataOnly:true,effectiveAt:"2099-01-01T00:00"}), /不可變更/);
});

test("adding the same payment tool creates a fee version and preserves history", () => {
  const app = new SystemManagement(migrate(seed()));
  const tool = app.data.paymentTools.find(t => t.id === "credit-card");
  const history = structuredClone(app.data.feeVersions);
  const count = app.data.paymentTools.length;
  const {id,...values} = tool;
  for (const effectiveAt of [undefined,"","2000-01-01T00:00:00Z"]) {
    const before = JSON.stringify(app.data);
    assert.throws(() => app.savePaymentTool({...values,fee:"3.5",effectiveAt}), /晚於現在/);
    assert.throws(() => app.savePaymentTool({...values,name:"新支付工具",fee:"3.5",effectiveAt}), /晚於現在/);
    assert.equal(JSON.stringify(app.data),before);
  }
  const result = app.savePaymentTool({...values,fee:"3.5",effectiveAt:"2099-11-01T00:00:00+08:00"});
  assert.equal(result.id,id);
  assert.equal(app.data.paymentTools.length,count);
  assert.deepEqual(app.data.feeVersions.slice(0,-1),history);
  assert.equal(app.data.feeVersions.at(-1).entries[id].fee,"3.5");
  assert.equal(app.data.feeVersions.at(-1).effectiveAt,"2099-10-31T16:00:00.000Z");
});

test("a scheduled payment that starts while editing is locked on submission", () => {
  const app = new SystemManagement(migrate(seed()));
  const tool = app.data.paymentTools.find(t => t.id === "credit-card");
  const version = app.saveFeeVersion("global",tool.id,{effectiveAt:"2099-01-01T00:00",entries:{[tool.id]:{mode:"custom",fee:"2.8"}}});
  app.data.feeVersions.find(v => v.id === version.id).effectiveAt = "2000-01-01T00:00:00Z";
  assert.throws(() => app.savePaymentTool({...tool,versionId:version.id,fee:"3",effectiveAt:"2099-01-01T00:00"}), /不可變更/);
});
function entries(app, custom = {}) {
  return Object.fromEntries(
    app.data.paymentTools.map((t) => [
      t.id,
      Object.hasOwn(custom, t.id)
        ? { mode: "custom", fee: custom[t.id] }
        : { mode: "inherit" },
    ]),
  );
}
function global(app, fee, effectiveAt = start) {
  return app.saveFeeVersion(
    "global",
    "credit-card",
    { effectiveAt, entries: { "credit-card": { mode: "custom", fee } } },
    now,
  );
}
test("project versions inherit live store fees and share store expiry and status rules", () => {
  const app = new SystemManagement();
  const store = app.saveFeeVersion("store","edu",{effectiveAt:start,entries:entries(app,{"credit-card":"1.5"})},now);
  const inherited = entries(app);
  const project = app.saveFeeVersion("project","A",{effectiveAt:start,endsAt:"2026-11-10T00:00",entries:inherited},now);
  assert.equal(app.resolveFee("credit-card",{projectId:"A",at:after}).fee,"1.5");
  app.saveFeeVersion("store","edu",{effectiveAt:"2026-11-02T00:00",entries:entries(app,{"credit-card":"1.8"})},now);
  assert.equal(app.resolveFee("credit-card",{projectId:"A",at:"2026-11-03T00:00+08:00"}).fee,"1.8");
  assert.equal(app.storeFeeState("A",project,new Date(after)),"生效中");
  app.updateStoreFeeControls("A",project.id,{enabled:false},new Date(after),"project");
  assert.equal(app.activeFeeVersion("project","A",new Date(after)),null);
  assert.equal(app.resolveFee("credit-card",{projectId:"A",at:after}).source,"store");
  assert.equal(app.storeFeeState("A",project,new Date("2026-11-11T00:00+08:00")),"已結束");
  assert.throws(()=>app.updateStoreFeeControls("A",project.id,{enabled:true},new Date("2026-11-11T00:00+08:00"),"project"),/已結束/);
  assert.equal(store.scope,"store");
});

test("new projects inherit store tool availability and validate profile changes", () => {
  const app = new SystemManagement();
  const settings = entries(app,{"credit-card":"1.25"});
  settings["credit-card"].enabled = false;
  app.saveFeeVersion("store","edu",{effectiveAt:start,entries:settings},now);
  const project = app.saveProject({name:"新專案",store:"edu",projectId:"NEW",token:"token"});
  assert.equal(app.resolveFee("credit-card",{projectId:project.id,at:after}).fee,"1.25");
  assert.equal(app.resolveFee("credit-card",{projectId:project.id,at:after}).enabled,false);
  assert.throws(()=>app.saveProject({name:"重複",store:"edu",projectId:"NEW"}),/已存在/);
  assert.throws(()=>app.saveProject({id:project.id,name:project.name,store:"u"}),/不可變更/);
  app.identity = "big";
  assert.throws(()=>app.saveProject({name:"未授權",store:"edu"}),/權限/);
});
test("exact Taipei midnight selects the new rate and leaves earlier transactions unchanged", () => {
  const app = new SystemManagement();
  global(app, "1.68", "2026-10-16T00:00");
  global(app, "2");
  assert.equal(app.resolveFee("credit-card", { at: before }).fee, "1.68");
  assert.equal(app.resolveFee("credit-card", { at: after }).fee, "2");
  const old = app.recordTransactionFee({
    id: "before",
    toolId: "credit-card",
    projectId: "A",
    paidAt: before,
    amount: "10000",
  });
  const next = app.recordTransactionFee({
    id: "after",
    toolId: "credit-card",
    projectId: "A",
    paidAt: after,
    amount: "10000",
  });
  assert.equal(old.feeAmount, 168);
  assert.equal(next.feeAmount, 200);
  assert.equal(next.paidAt, "2026-10-31T16:00:00.000Z");
  global(app, "8", "2026-12-01T00:00");
  assert.deepEqual(
    app.recordTransactionFee({
      id: "before",
      toolId: "credit-card",
      projectId: "A",
      paidAt: before,
      amount: "10000",
    }),
    old,
  );
  assert.throws(
    () =>
      app.recordTransactionFee({
        id: "before",
        toolId: "credit-card",
        projectId: "A",
        paidAt: before,
        amount: "20000",
      }),
    /鎖定/,
  );
  old.feeAmount = 999;
  assert.equal(app.data.feeSnapshots.before.feeAmount, 168);
});
test("store and project batches switch atomically while inherited values remain live", () => {
  const app = new SystemManagement();
  global(app, "1.68", "2026-10-16T00:00");
  app.saveFeeVersion(
    "store",
    "edu",
    {
      effectiveAt: start,
      entries: entries(app, { "credit-card": "2", atm: "8" }),
    },
    now,
  );
  const pre = app.paymentSettingsForProject("A", before);
  assert.equal(pre.find((t) => t.id === "credit-card").fee, "1.68");
  assert.equal(pre.find((t) => t.id === "atm").fee, "5");
  const post = app.paymentSettingsForProject("A", after);
  assert.equal(post.find((t) => t.id === "credit-card").fee, "2");
  assert.equal(post.find((t) => t.id === "atm").fee, "8");
  assert.equal(post.find((t) => t.id === "credit-card").source, "store");
  app.saveFeeVersion(
    "project",
    "A",
    {
      effectiveAt: "2026-11-02T00:00",
      entries: entries(app, { "credit-card": "2.5" }),
    },
    now,
  );
  app.saveFeeVersion(
    "store",
    "edu",
    {
      effectiveAt: "2026-11-03T00:00",
      entries: entries(app, { "credit-card": "3", atm: "9" }),
    },
    now,
  );
  assert.equal(
    app.resolveFee("credit-card", { projectId: "A", at: "2026-11-04T00:00" })
      .fee,
    "2.5",
  );
  assert.equal(
    app.resolveFee("atm", { projectId: "A", at: "2026-11-04T00:00" }).fee,
    "9",
  );
  assert.equal(
    app.resolveFee("credit-card", { projectId: "B", at: "2026-11-04T00:00" })
      .fee,
    "3",
  );
  assert.equal(
    app.resolveFee("credit-card", { projectId: "C", at: "2026-11-04T00:00" })
      .fee,
    "1.68",
  );
});
test("tools added after a batch was scheduled inherit through both levels", () => {
  const app = new SystemManagement();
  for (const [scope, id] of [
    ["store", "edu"],
    ["project", "A"],
  ])
    app.saveFeeVersion(scope, id, {
      effectiveAt: "2099-01-01T00:00",
      entries: entries(app),
    });
  const tool = app.savePaymentTool({
    platform: "街口",
    name: "街口支付",
    effectiveAt: "2099-01-01T00:00",
    code: "JKOPAY",
    fee: "2.2",
    unit: "%",
    currency: "新台幣",
  });
  assert.equal(
    app.paymentSettingsForProject("A").find((t) => t.id === tool.id).fee,
    null,
  );
  assert.equal(
    app.resolveFee(tool.id, { projectId: "A", at: "2099-02-01T00:00" }).fee,
    "2.2",
  );
  app.saveFeeVersion("store", "edu", {
    effectiveAt: "2099-01-02T00:00",
    entries: entries(app, { [tool.id]: "2.8" }),
  });
  assert.equal(
    app.resolveFee(tool.id, { projectId: "A", at: "2099-02-01T00:00" }).fee,
    "2.8",
  );
  assert.equal(app.resolveFee(tool.id, { at: "2000-01-01T00:00" }).fee, null);
});
test("pending revisions and cancellation retain audit history and protect active versions", () => {
  const app = new SystemManagement();
  const initial = global(app, "3");
  const revised = app.saveFeeVersion(
    "global",
    "credit-card",
    {
      id: initial.id,
      effectiveAt: start,
      entries: { "credit-card": { mode: "custom", fee: "4" } },
    },
    now,
  );
  assert.equal(app.resolveFee("credit-card", { at: after }).fee, "4");
  assert.equal(
    app.feeVersions("global", "credit-card").find((v) => v.id === initial.id)
      .replacedBy,
    revised.id,
  );
  assert.throws(() => global(app, "6"), /已有/);
  app.cancelFeeVersion("global", "credit-card", revised.id, now);
  assert.equal(app.resolveFee("credit-card", { at: after }).fee, "2");
  const baseline = app.activeFeeVersion("global", "credit-card", now);
  assert.throws(
    () => app.cancelFeeVersion("global", "credit-card", baseline.id, now),
    /待生效/,
  );
  assert.throws(
    () =>
      app.saveFeeVersion(
        "global",
        "credit-card",
        { id: baseline.id, effectiveAt: start, entries: {} },
        now,
      ),
    /待生效/,
  );
  const copy = app.feeVersions("global", "credit-card");
  copy[0].entries["credit-card"].fee = "99";
  assert.equal(app.resolveFee("credit-card", { at: after }).fee, "2");
});
test("invalid and partial batches cannot write any settings or bypass permissions", () => {
  const app = new SystemManagement();
  const count = app.data.feeVersions.length;
  for (const value of ["", "-1", "101", "NaN", "1.1234567"])
    assert.throws(() => global(app, value));
  assert.throws(() => global(app, "3", "2020-01-01T00:00"), /早於/);
  assert.throws(
    () =>
      app.saveFeeVersion(
        "store",
        "edu",
        { effectiveAt: start, entries: {} },
        now,
      ),
    /每個/,
  );
  assert.throws(
    () =>
      app.saveFeeVersion(
        "store",
        "missing",
        { effectiveAt: start, entries: entries(app) },
        now,
      ),
    /不存在/,
  );
  assert.equal(app.data.feeVersions.length, count);
  app.identity = "big";
  assert.throws(() => global(app, "3"), /權限/);
  assert.throws(
    () => app.saveFeeVersion("store", "edu", { entries: entries(app) }),
    /權限/,
  );
});
test("migration is idempotent and retains scheduled overrides and locked fee snapshots", () => {
  const app = new SystemManagement(migrate(seed()));
  const version = app.saveFeeVersion(
    "store",
    "edu",
    { effectiveAt: start, entries: entries(app, { "credit-card": "4" }) },
    now,
  );
  app.recordTransactionFee({
    id: "legacy",
    toolId: "atm",
    projectId: "A",
    amount: "100",
    paidAt: before,
  });
  const data = JSON.parse(JSON.stringify(app.data));
  const next = new SystemManagement(migrate(data));
  assert.equal(next.data.feeVersions.length, app.data.feeVersions.length);
  assert.equal(next.data.feeSnapshots.legacy.feeAmount, 5);
  assert.equal(
    next.resolveFee("credit-card", { projectId: "A", at: after }).versionId,
    version.id,
  );
});
test("fees use decimal arithmetic, zero is valid and fixed-dollar tools are supported", () => {
  const app = new SystemManagement();
  global(app, "1.005");
  assert.equal(
    app.recordTransactionFee({
      id: "round",
      projectId: "A",
      toolId: "credit-card",
      paidAt: after,
      amount: "10000",
    }).feeAmount,
    101,
  );
  app.saveFeeVersion(
    "store",
    "edu",
    { effectiveAt: start, entries: entries(app, { atm: "0" }) },
    now,
  );
  assert.equal(
    app.recordTransactionFee({
      id: "zero",
      projectId: "A",
      toolId: "atm",
      paidAt: after,
      amount: "100",
    }).feeAmount,
    0,
  );
});

test("tool metadata edits preserve fee history and charging units can be changed", () => {
  const app = new SystemManagement(migrate(seed()));
  global(app, "2.8");
  const tool = app.data.paymentTools.find((t) => t.id === "credit-card");
  const count = app.data.feeVersions.length;
  app.savePaymentTool({
    ...tool,
    fee: "2",
    note: "工具說明更新",
    metadataOnly: true,
  });
  assert.equal(app.data.feeVersions.length, count);
  assert.equal(app.resolveFee(tool.id, { at: after }).fee, "2.8");
  const pending = app.saveFeeVersion("global", tool.id, {effectiveAt:"2099-11-01T00:00:00+08:00",entries:{[tool.id]:{mode:"custom",fee:"2.8"}}});
  app.savePaymentTool({
        ...tool,
        versionId:pending.id,
        unit: "元",
        fee: "150",
        effectiveAt: "2099-11-01T00:00:00+08:00",
      });
  assert.equal(tool.unit, "元");
  assert.equal(app.data.feeVersions.length, count + 2);
});

test("store versions retain enabled tools independently across complete batches", () => {
  const app = new SystemManagement();
  const first = entries(app);
  first["apple-pay"].enabled = false;
  app.saveFeeVersion("store", "edu", {entries:first, effectiveAt:start}, now);
  const second = entries(app);
  app.saveFeeVersion("store", "edu", {entries:second, effectiveAt:"2026-12-01T00:00"}, now);
  assert.equal(app.activeFeeVersion("store", "edu", after).entries["apple-pay"].enabled, false);
  assert.equal(app.activeFeeVersion("store", "edu", "2026-12-02T00:00:00+08:00").entries["apple-pay"].enabled, true);
  assert.equal(app.feeVersions("store", "edu")[1].entries["apple-pay"].enabled, false);
});

test("store fee expiry falls back to another version within its own period", () => {
  const app = new SystemManagement();
  app.saveFeeVersion("store", "edu", {entries:entries(app, {"credit-card":"4"}),effectiveAt:start}, now);
  app.saveFeeVersion("store", "edu", {entries:entries(app, {"credit-card":"3"}),effectiveAt:"2026-12-01T00:00",endsAt:"2026-12-02T00:00"}, now);
  assert.equal(app.resolveFee("credit-card", {storeId:"edu",at:"2026-12-01T23:59:59+08:00"}).fee,"3");
  assert.equal(app.activeFeeVersion("store","edu","2026-12-02T00:00:00+08:00").entries["credit-card"].fee,"4");
  assert.equal(app.resolveFee("credit-card", {storeId:"edu",at:"2026-12-02T00:00:00+08:00"}).fee,"4");
  assert.throws(()=>app.saveFeeVersion("store","edu",{entries:entries(app),effectiveAt:start,endsAt:"2026-10-31T00:00"},now));
});

test("disabling active store fees falls back to eligible older version and retains historical rates and audit", () => {
  const app = new SystemManagement();
  app.saveFeeVersion("store","edu",{entries:entries(app,{"credit-card":"4"}),effectiveAt:start},now);
  const current = app.saveFeeVersion("store","edu",{entries:entries(app,{"credit-card":"3"}),effectiveAt:"2026-12-01T00:00"},now);
  const original = structuredClone(current.entries);
  app.setStoreFeeStatus("edu",current.id,false,new Date("2026-12-02T12:00:00+08:00"));
  assert.equal(app.resolveFee("credit-card",{storeId:"edu",at:"2026-12-02T11:59:59+08:00"}).fee,"3");
  assert.equal(app.resolveFee("credit-card",{storeId:"edu",at:"2026-12-02T12:00:00+08:00"}).fee,"4");
  assert.equal(app.activeFeeVersion("store","edu","2026-12-02T13:00:00+08:00").entries["credit-card"].fee,"4");
  const disabled = app.feeVersions("store","edu").find(v=>v.id===current.id);
  assert.deepEqual(disabled.entries,original);
  assert.equal(disabled.statusChanges[0].by,app.user.name);
  assert.equal(disabled.statusChanges[0].at,"2026-12-02T04:00:00.000Z");
  app.setStoreFeeStatus("edu",current.id,true,new Date("2026-12-03T12:00:00+08:00"));
  assert.equal(app.resolveFee("credit-card",{storeId:"edu",at:"2026-12-02T13:00:00+08:00"}).fee,"4");
  assert.equal(app.resolveFee("credit-card",{storeId:"edu",at:"2026-12-03T12:00:00+08:00"}).fee,"3");
});
test("new fee versions default enabled and can be created disabled", () => {
  const app = new SystemManagement();
  const v = app.saveFeeVersion("store","edu",{entries:entries(app),effectiveAt:start},now);
  assert.equal(v.enabled,true);
  const off = app.saveFeeVersion("store","edu",{entries:entries(app),effectiveAt:"2026-12-01T00:00",enabled:false},now);
  assert.equal(off.enabled,false);
  assert.equal(app.activeFeeVersion("store","edu","2026-12-02T00:00:00+08:00").id,v.id);
  app.identity = "partial";
  assert.throws(()=>app.setStoreFeeStatus("edu",v.id,false));
});

test("no eligible store version falls back to system rates across gaps and disabled periods", () => {
  const app = new SystemManagement();
  const first = app.saveFeeVersion("store","edu",{entries:entries(app,{"credit-card":"4"}),effectiveAt:start,endsAt:"2026-11-02T00:00"},now);
  const second = app.saveFeeVersion("store","edu",{entries:entries(app,{"credit-card":"3"}),effectiveAt:"2026-12-01T00:00",endsAt:"2026-12-02T00:00"},now);
  assert.equal(app.activeFeeVersion("store","edu","2026-11-01T00:00:00+08:00").id,first.id);
  for (const at of ["2026-10-31T23:59:59+08:00","2026-11-02T00:00:00+08:00","2026-12-02T00:00:00+08:00"]) assert.equal(app.resolveFee("credit-card",{storeId:"edu",at}).source,"global");
  app.setStoreFeeStatus("edu",second.id,false,new Date("2026-12-01T12:00:00+08:00"));
  assert.equal(app.resolveFee("credit-card",{storeId:"edu",at:"2026-12-01T12:00:00+08:00"}).source,"global");
});

test("store fee periods retain seconds and apply exact inclusive start and exclusive end", () => {
  const app = new SystemManagement();
  const v = app.saveFeeVersion("store","edu",{entries:entries(app,{"credit-card":"3"}),effectiveAt:"2026-12-01T00:00:17",endsAt:"2026-12-01T00:00:43"},now);
  assert.equal(v.effectiveAt,"2026-11-30T16:00:17.000Z");
  assert.equal(v.endsAt,"2026-11-30T16:00:43.000Z");
  assert.equal(app.resolveFee("credit-card",{storeId:"edu",at:"2026-12-01T00:00:16+08:00"}).source,"global");
  assert.equal(app.resolveFee("credit-card",{storeId:"edu",at:"2026-12-01T00:00:17+08:00"}).fee,"3");
  assert.equal(app.resolveFee("credit-card",{storeId:"edu",at:"2026-12-01T00:00:42+08:00"}).fee,"3");
  assert.equal(app.resolveFee("credit-card",{storeId:"edu",at:"2026-12-01T00:00:43+08:00"}).source,"global");
});

test("demo fee scenarios are idempotent and enforce status-based editing rules", () => {
  const {installFeeDemo} = require("../system-model");
  const app = new SystemManagement();
  const time = new Date("2026-10-16T12:00:00+08:00");
  assert.equal(installFeeDemo(app.data,time),true);
  const count = app.data.feeVersions.length;
  assert.equal(installFeeDemo(app.data,time),false);
  assert.equal(app.data.feeVersions.length,count);
  const versions = app.feeVersions("store","fee-demo");
  assert.deepEqual(versions.map(v=>app.storeFeeState("fee-demo",v,time)),["待生效","—","生效中","未套用","已結束"]);
  const active = versions.find(v=>app.storeFeeState("fee-demo",v,time)==="生效中");
  const previousEnd = active.endsAt;
  const end = "2026-11-20T23:59:59";
  app.updateStoreFeeControls("fee-demo",active.id,{enabled:true,endsAt:end},time);
  const changed = app.feeVersions("store","fee-demo").find(v=>v.id===active.id);
  assert.equal(changed.endChanges[0].from,previousEnd);
  assert.equal(changed.endChanges[0].to,"2026-11-20T15:59:59.000Z");
  assert.equal(changed.endChanges[0].by,app.user.name);
  assert.deepEqual(changed.entries,active.entries);
  assert.equal(changed.createdAt,active.createdAt);
  assert.throws(()=>app.updateStoreFeeControls("fee-demo",active.id,{enabled:true,endsAt:"2026-10-16T11:59:59"},time));
  const inactive = versions.find(v=>v.enabled===false);
  assert.throws(()=>app.updateStoreFeeControls("fee-demo",inactive.id,{enabled:true,endsAt:end},time));
  app.updateStoreFeeControls("fee-demo",inactive.id,{enabled:true},time);
  assert.equal(app.activeFeeVersion("store","fee-demo",time).id,inactive.id);
  const ended = versions.find(v=>app.storeFeeState("fee-demo",v,time)==="已結束");
  assert.throws(()=>app.setStoreFeeStatus("fee-demo",ended.id,false,time));
  const pending = versions[0];
  const revised = app.saveFeeVersion("store","fee-demo",{id:pending.id,entries:pending.entries,effectiveAt:"2026-11-01T00:00:17",endsAt:"2026-12-01T00:00:43"},time);
  assert.equal(revised.effectiveAt,"2026-10-31T16:00:17.000Z");
});
