const {test,expect} = require("@playwright/test");
const {seed,migrate,SystemManagement:Model} = require("../system-model");
const STORAGE="payment-system-management-v2";
const app=page=>page.locator("#element-app");
async function choose(page,target,label) { await target.click(); await page.getByRole("option",{name:label,exact:true}).click(); }
async function session(page,data,identity,store="edu") {
  await page.goto("/login.html");
  await page.evaluate(({data,identity,store,key})=>localStorage.setItem(key,JSON.stringify({data,currentUserId:identity,store})),{data,identity,store,key:STORAGE});
}
test("admin management defaults/reset to entered store and query never changes session scope",async({page})=>{
  await session(page,migrate(seed()),"admin");
  for (const route of ["users","roles","projects","stores"]) {
    await page.goto(`/${route}.html`);
    const filter=app(page).locator('[data-source-id="'+({roles:"sys-role-store",projects:"sys-project-store"}[route] || "sys-store")+'"]');
    await expect(filter).toContainText("教育事業部");
    await choose(page,filter,"U 好學");
    expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).store,STORAGE)).toBe("edu");
    await choose(page,filter,route === "roles" ? "全部商店（授權範圍）" : route === "users" ? "全部" : "全部商店");
    await expect(filter).not.toContainText("教育事業部");
    expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).store,STORAGE)).toBe("edu");
    await app(page).getByRole("button",{name:"清除",exact:true}).click();
    await expect(filter).toContainText("教育事業部");
  }
  await page.goto("/roles.html");
  await expect(app(page).getByRole("row").filter({hasText:"交易檢視角色"})).toContainText("平台共用");
});
test("whole-store grant creation and explicit revocation persist after reload",async({page})=>{
  await page.goto("/users.html");
  await app(page).getByRole("button",{name:"新增",exact:true}).click();
  let dialog=page.getByRole("dialog",{name:"新增使用者",exact:true});
  await dialog.getByRole("textbox",{name:"姓名",exact:true}).fill("整店測試");
  await dialog.getByRole("textbox",{name:"Email 帳號",exact:true}).fill("whole@example.com");
  await choose(page,dialog.locator(".el-select").filter({has:page.getByRole("combobox",{name:"專案",exact:true})}),"整店授權（含未來新增專案）");
  await choose(page,dialog.locator(".el-select").filter({has:page.getByRole("combobox",{name:"角色",exact:true})}),"交易檢視角色");
  await dialog.getByRole("button",{name:"加入授權",exact:true}).click();
  await dialog.getByRole("button",{name:"確定",exact:true}).click();
  await expect(dialog).toBeHidden(); await page.reload();
  let user=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).data.users.find(u=>u.login==="whole@example.com"),STORAGE);
  expect(user.storeGrants).toEqual({edu:"viewer"}); expect(user.grants).toEqual({});
  await app(page).getByRole("link",{name:"整店測試",exact:true}).click();
  dialog=page.getByRole("dialog",{name:"編輯使用者",exact:true});
  await dialog.getByRole("button",{name:"移除授權",exact:true}).click();
  await dialog.getByRole("button",{name:"確定",exact:true}).click();
  await expect(dialog).toBeHidden(); await page.reload();
  user=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).data.users.find(u=>u.login==="whole@example.com"),STORAGE);
  expect(user.storeGrants).toEqual({});
});
test("project manager edits A without seeing B transactions or editing a common role",async({page})=>{
  const data=migrate(seed()),admin=new Model(data);
  const role=admin.saveRole({name:"A operator",store:"edu",project:"A",permissions:{projects:["view","edit"],roles:["view","edit"],users:["view","edit"],transactions:["view"]}});
  data.users.push({id:"operator",name:"operator",login:"operator",grants:{A:role.id}});
  await session(page,data,"operator");
  await page.goto("/projects.html");
  await expect(app(page).locator(".el-table__body tr")).toHaveCount(1);
  await app(page).getByRole("button",{name:"編輯專案",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"編輯專案",exact:true});
  await dialog.getByRole("textbox",{name:"專案名稱",exact:true}).fill("A 已編輯");
  await dialog.getByRole("button",{name:"確定",exact:true}).click();
  await expect(dialog).toBeHidden();
  await page.goto("/roles.html");
  const shared=app(page).getByRole("row").filter({hasText:"交易檢視角色"});
  await expect(shared.getByRole("button",{name:"編輯",exact:true})).toHaveCount(0);
  await page.goto("/transactions.html");
  await expect(app(page)).not.toContainText("實體活動專案 B");
  await expect(app(page).getByRole("button",{name:"匯出交易 CSV",exact:true})).toHaveCount(0);
  await page.goto("/transaction-detail.html?order=202610080050006");
  await expect(app(page)).not.toContainText("payer@example.com");
  await expect(app(page).getByRole("button",{name:"退款",exact:true})).toHaveCount(0);
});
test("inactive and invalid identities cannot enter management or select stores",async({page})=>{
  for (const identity of ["missing","charlie"]) {
    const data=migrate(seed()); data.users.find(u=>u.id==="charlie").enabled=false;
    await session(page,data,identity);
    await page.goto("/users.html");
    await expect(app(page)).toContainText("無存取權限");
    await page.goto("/select-store.html");
    await expect(page.getByRole("button",{name:"教育事業部",exact:true})).toHaveCount(0);
  }
});
test("platform metadata and fee permissions have separate editing paths",async({page})=>{
  const data=migrate(seed()),admin=new Model(data);
  const metadata=admin.saveRole({name:"metadata",permissions:{payments:["view","edit"]}});
  data.users.push({id:"metadata",name:"metadata",login:"metadata",grants:{},platformRoles:[metadata.id]});
  await session(page,data,"metadata"); await page.goto("/payments.html");
  await expect(app(page)).not.toContainText("手續費（含稅）");
  await app(page).getByRole("button",{name:"編輯工具資料",exact:true}).first().click();
  const dialog=page.getByRole("dialog",{name:"編輯支付工具",exact:true});
  await expect(dialog.getByRole("spinbutton")).toHaveCount(0);
  await dialog.getByRole("textbox",{name:"* 支付工具名稱",exact:true}).fill("新工具名稱");
  await dialog.getByRole("button",{name:"確定",exact:true}).click();
  await expect(dialog).toBeHidden();
  await expect(app(page)).toContainText("新工具名稱");
});
test("transaction CSV button is absent even with export permission",async({page})=>{
  const data=migrate(seed()),admin=new Model(data);
  const r=admin.saveRole({name:"A export",store:"edu",project:"A",permissions:{transactions:["view","export"]}});
  data.users.push({id:"export",name:"export",login:"export",grants:{A:r.id,B:"viewer"}});
  await session(page,data,"export"); await page.goto("/transactions.html");
  await expect(app(page).getByRole("button",{name:"匯出交易 CSV",exact:true})).toHaveCount(0);
});
test("global authorization is explicit and does not turn a user into system administrator",async({page})=>{
  await page.goto("/users.html");
  await app(page).getByRole("button",{name:"新增",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"新增使用者",exact:true});
  await dialog.getByRole("textbox",{name:"姓名",exact:true}).fill("全域檢視");
  await dialog.getByRole("textbox",{name:"Email 帳號",exact:true}).fill("global@example.com");
  const select=name=>dialog.locator(".el-select").filter({has:page.getByRole("combobox",{name,exact:true})});
  await choose(page,select("商店"),"全域授權（平台）");
  await choose(page,select("專案"),"全域授權（含全部商店及專案）");
  await choose(page,select("角色"),"交易檢視角色");
  await dialog.getByRole("button",{name:"加入授權",exact:true}).click();
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await page.screenshot({path:test.info().outputPath(`authorization-${width}.png`),fullPage:true,animations:"disabled"});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await dialog.getByRole("button",{name:"確定",exact:true}).click();
  await expect(dialog).toBeHidden();
  const user=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).data.users.find(u=>u.login==="global@example.com"),STORAGE);
  expect(user.platformRoles).toEqual(["viewer"]); expect(user.system).toBeUndefined(); expect(user.grants).toEqual({});
  await expect(app(page).getByRole("row").filter({hasText:"全域檢視"})).toContainText("全域授權");
  await page.goto("/roles.html");
  await app(page).getByRole("button",{name:"新增",exact:true}).click();
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await page.screenshot({path:test.info().outputPath(`roles-${width}.png`),fullPage:true,animations:"disabled"});
    if (width === 390) expect((await page.locator('.el-dialog .ep-role-permission-grid').boundingBox()).width).toBeGreaterThan(280);
  }
});
test("project fee viewer sees versions and cannot edit fees",async({page})=>{
  const data=migrate(seed()),admin=new Model(data);
  const r=admin.saveRole({name:"A fee reader",store:"edu",project:"A",permissions:{projects:["view"],fees:["view"]}});
  data.users.push({id:"fee-reader",name:"reader",login:"reader",grants:{A:r.id}});
  const entries=Object.fromEntries(data.paymentTools.map(t=>[t.id,{mode:"inherit"}]));
  admin.saveFeeVersion("project","A",{entries,effectiveAt:"2026-12-01T00:00"},new Date("2026-10-01T00:00+08:00"));
  await session(page,data,"fee-reader"); await page.goto("/projects.html");
  await app(page).getByRole("button",{name:"管理手續費",exact:true}).click();
  await expect(app(page).getByRole("columnheader",{name:"費率生效狀態",exact:true})).toBeVisible();
  await expect(app(page).getByRole("columnheader",{name:"設定方式",exact:true})).toHaveCount(0);
  await expect(app(page).getByRole("button",{name:"新增手續費率",exact:true})).toHaveCount(0);
  await expect(app(page).getByRole("button",{name:"編輯",exact:true})).toHaveCount(0);
  await app(page).getByRole("button",{name:"檢視",exact:true}).first().click();
  const dialog=page.getByRole("dialog",{name:"檢視手續費率",exact:true});
  await expect(dialog).toBeVisible();
  for (const input of await dialog.getByRole("spinbutton").all()) await expect(input).toBeDisabled();
});

test("partial user managers can revoke A while cross-store account state remains locked",async({page})=>{
  await session(page,migrate(seed()),"partial");
  await page.goto("/users.html");
  await app(page).getByRole("link",{name:"李佳穎",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"編輯使用者",exact:true});
  await expect(dialog.getByRole("switch")).toBeDisabled();
  await expect(dialog).toContainText("帳號狀態影響全部授權");
  await dialog.getByRole("button",{name:"移除授權",exact:true}).first().click();
  await dialog.getByRole("button",{name:"確定",exact:true}).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  const user=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).data.users.find(u=>u.id==="cross"),STORAGE);
  expect(user.grants).toEqual({C:"viewer"});
  expect(user.enabled).not.toBe(false);
});

test("blank saved session displays access denial instead of an administrator page",async({page})=>{
  await page.goto("/login.html");
  await page.evaluate(key=>localStorage.setItem(key,""),STORAGE);
  await page.goto("/users.html");
  await expect(app(page)).toContainText("無存取權限");
  await expect(app(page).getByRole("button",{name:"新增",exact:true})).toHaveCount(0);
});
