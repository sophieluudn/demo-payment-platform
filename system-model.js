(function (root) {
  "use strict";
  const actions = {
    transactions: ["view", "refund", "export"],
    products: ["view", "create", "edit", "delete"],
    tags: ["view", "create", "edit"],
    reports: ["view", "export"],
    statements: ["view", "create", "edit", "archive", "export"],
    users: ["view", "create", "edit"],
    roles: ["view", "create", "edit"],
    projects: ["view", "create", "edit"],
    stores: ["view", "create", "edit"],
    payments: ["view", "create", "edit"],
    fees: ["view", "create", "edit"],
  };
  const labels = {
    home: "首頁", transactions: "所有交易紀錄", products: "商品管理",
    tags: "標籤管理", reports: "商品交易統計", statements: "對帳單",
    users: "使用者管理", roles: "角色管理", projects: "專案管理", stores: "商店管理",
    fees: "費率管理", payments: "支付工具設定", view: "檢視", create: "新增", edit: "編輯", createEdit: "新增 / 編輯",
    delete: "刪除", refund: "退款", archive: "封存", export: "匯出",
  };
  const uid = (prefix) =>
    prefix +
    "-" +
    (globalThis.crypto?.randomUUID?.() ||
      Date.now() + "-" + Math.random().toString(36).slice(2));
  function paymentDefaults() {
    return [
      ["apple-pay", "藍新金流", "Apple Pay", "1.68", "%"],
      ["google-pay", "藍新金流", "Google Pay", "1.68", "%"],
      ["line-pay", "Line Pay", "Line Pay", "1.995", "%"],
      ["atm", "藍新金流", "ATM轉帳", "5", "元"],
      ["cvs", "藍新金流", "超商代碼繳費", "23", "元"],
      ["credit-card", "藍新金流", "國內信用卡一次付清", "2", "%"],
      ["foreign-credit-card", "藍新金流", "信用卡一次付清(國外卡)", "2.5", "%"],
      ["tool-8", "汪新金流", "汪星人信用卡", "3.8", "%"],
      ["tool-9", "村上春樹", "村上春樹", "100", "%"],
      ["tool-10", "常常吃", "fsadf", "0", "%"],
      ["tool-11", "31231rewr", "1發生", "0.123", "%"],
    ].map(([id, platform, name, fee, unit]) => ({
      id,
      platform,
      name,
      fee,
      unit,
      currency: "新台幣",
    }));
  }
  function seed() {
    const all = () =>
      Object.fromEntries(
        Object.entries(actions).map(([feature, list]) => [feature, [...list]]),
      );
    return {
      stores: [
        { id: "edu", name: "教育事業部" },
        { id: "u", name: "U 好學" },
      ],
      projects: [
        { id: "A", store: "edu", name: "線上商城專案 A" },
        { id: "B", store: "edu", name: "實體活動專案 B" },
        { id: "C", store: "u", name: "線上課程專案 C" },
      ],
      roles: [
        {
          id: "large",
          permissionVersion: 3,
          name: "商店管理員（大）",
          store: "",
          manager: true,
          permissions: all(),
        },
        {
          id: "small",
          permissionVersion: 3,
          name: "商店管理員（小）",
          store: "edu",
          manager: true,
          permissions: { ...all(), users: ["view", "edit"] },
        },
        {
          id: "viewer",
          permissionVersion: 3,
          name: "交易檢視角色",
          store: "",
          manager: false,
          permissions: { transactions: ["view"] },
        },
        {
          id: "refund",
          permissionVersion: 3,
          name: "交易退款角色",
          store: "",
          manager: false,
          permissions: { transactions: ["view", "refund"] },
        },
      ],
      users: [
        {
          id: "admin",
          name: "系統管理員",
          login: "admin",
          system: true,
          grants: {},
        },
        {
          id: "charlie",
          name: "陳查理",
          login: "charlie-a",
          grants: { A: "viewer" },
        },
        {
          id: "multi",
          name: "林冠宇",
          login: "charlie-ab",
          grants: { A: "refund", B: "viewer" },
        },
        {
          id: "david",
          name: "王大衛",
          login: "david-b",
          grants: { B: "refund" },
        },
        {
          id: "cross",
          name: "李佳穎",
          login: "cross-store",
          grants: { A: "viewer", C: "viewer" },
        },
        {
          id: "big",
          name: "林志明",
          login: "manager-large",
          grants: { A: "large", B: "large" },
        },
        {
          id: "little",
          name: "吳雅婷",
          login: "manager-small",
          grants: { A: "small", B: "small" },
        },
        {
          id: "partial",
          name: "張怡君",
          login: "manager-a",
          grants: { A: "large" },
        },
      ],
      paymentTools: paymentDefaults().map(({ fee, ...tool }) => tool),
      fees: Object.fromEntries(paymentDefaults().map((t) => [t.id, t.fee])),
    };
  }
  class SystemManagement {
    constructor(data = seed(), identity = "admin", store = "edu") {
      this.data = data;
      this.identity = identity;
      this.store = store;
      initializeFeeVersions(this.data);
      this.normalize();
    }
    get user() {
      return this.data.users.find(u => u.id === this.identity) || {id:null, name:"無效身分", grants:{}, enabled:false};
    }
    get active() { return !!this.user.id && this.user.enabled !== false; }
    get isSystem() { return this.active && this.user.system === true; }
    role(id) { return this.data.roles.find(r => r.id === id); }
    roleApplies(role, scope, target) {
      if (!role || role.enabled === false) return false;
      if (scope === "platform") return !role.store && !role.project;
      const p = scope === "project" && this.data.projects.find(p => p.id === target);
      const store = p ? p.store : target;
      return (!role.store || role.store === store) && (!role.project || (scope === "project" && role.project === target));
    }
    roleIds(value) { return Array.isArray(value) ? value : value ? [value] : []; }
    rolesAt(user, scope, target) {
      const p = scope === "project" && this.data.projects.find(p => p.id === target);
      const ids = [...this.roleIds(user.platformRoles),
        ...(scope !== "platform" ? this.roleIds(user.storeGrants?.[p ? p.store : target]) : []),
        ...(p ? this.roleIds(user.grants?.[target]) : [])];
      return ids.map(id => this.role(id)).filter(r => this.roleApplies(r, scope, target));
    }
    hasAction(role, feature, action) {
      if (!Array.isArray(role.permissions?.[feature])) return false;
      return !!actions[feature]?.includes(action) && (action === "create" || action === "edit"
        ? !!role.permissions[feature]?.some(a => a === "create" || a === "edit")
        : !!role.permissions[feature]?.includes(action));
    }
    allowed(scope, target, feature, action = "view") {
      if (!this.active || !actions[feature]?.includes(action)) return false;
      if (scope === "store" && !this.data.stores.some(s => s.id === target)) return false;
      if (scope === "project" && !this.data.projects.some(p => p.id === target)) return false;
      if (!["platform", "store", "project"].includes(scope)) return false;
      if (this.isSystem) return true;
      // Platform operations must never be inferred from a store/project grant.
      if (feature === "payments" || (feature === "stores" && action === "create")) scope = "platform";
      return this.rolesAt(this.user, scope, target).some(r => this.hasAction(r, feature, action));
    }
    can(projectId, feature, action) {
      if (feature === "home") return this.active && action === "view";
      return this.allowed("project", projectId, feature, action);
    }
    canStore(store, feature, action = "view") { return this.allowed("store", store, feature, action); }
    canPlatform(feature, action = "view") { return this.allowed("platform", "", feature, action); }
    projects(feature, action = "view") {
      return this.data.projects.filter(p => p.store === this.store && (feature ? this.can(p.id, feature, action)
        : Object.entries(actions).some(([f,aa]) => aa.some(a => this.can(p.id,f,a)))));
    }
    stores(feature, action = "view") {
      return this.data.stores.filter(s => feature
        ? this.canStore(s.id,feature,action) || this.data.projects.some(p => p.store === s.id && this.can(p.id,feature,action))
        : Object.entries(actions).some(([f,aa]) => aa.some(a => this.canStore(s.id,f,a) || this.data.projects.some(p => p.store === s.id && this.can(p.id,f,a)))));
    }
    normalize() {
      const stores = this.stores();
      if (!stores.some(s => s.id === this.store)) this.store = stores[0]?.id || "";
    }
    switchStore(id) {
      if (!this.stores().some(s => s.id === id)) throw Error("此商店未授權");
      this.store = id;
    }
    manageable(action) { return this.projects("users", action); }
    visibleUsers() {
      return this.data.users.filter(u => !u.system && this.projects("users").some(p => u.grants[p.id] || u.storeGrants?.[p.store] || u.platformRoles?.length));
    }
    availableExisting() {
      return this.isSystem ? this.data.users.filter(u => !u.system && !this.projects().some(p => u.grants[p.id])) : [];
    }
    canManageRoles(store = this.store, action = "edit", project) {
      return project ? this.can(project,"roles",action) : store ? this.canStore(store,"roles",action) : this.canPlatform("roles",action);
    }
    roleActionAllowed(store, feature, action, project) {
      return project ? this.can(project,feature,action) : store ? this.canStore(store,feature,action) : this.canPlatform(feature,action);
    }
    canGrant(role, scope, target) {
      return this.roleApplies(role,scope,target) && !!role.permissions && Object.entries(role.permissions).every(([f,aa]) => Array.isArray(aa) && aa.every(a => this.allowed(scope,target,f,a)));
    }
    assignableRoles(projectId, store = this.store) {
      const targets = projectId ? (this.can(projectId,"users","edit") ? [projectId] : []) : this.data.projects.filter(p => p.store === store && this.can(p.id,"users","edit")).map(p => p.id);
      return this.data.roles.filter(r => targets.length && targets.every(p => this.canGrant(r,"project",p)));
    }
    canEditUser(id) {
      const u = this.data.users.find(u => u.id === id);
      if (!u || u.system || (!this.isSystem && id === this.identity)) return false;
      return this.active && (this.isSystem || this.data.projects.some(p => p.store === this.store && (u.grants[p.id] || u.storeGrants?.[p.store]) && this.can(p.id,"users","edit")) || Object.keys(u.storeGrants || {}).some(s => this.canStore(s,"users","edit")) || (!!u.platformRoles?.length && this.canPlatform("users","edit")));
    }
    canChangeUserState(id) {
      const u = this.data.users.find(u => u.id === id);
      if (!u || !this.canEditUser(id)) return false;
      const ranges = [...Object.keys(u.grants || {}).map(t => ["project",t]),
        ...Object.keys(u.storeGrants || {}).map(t => ["store",t]),
        ...(this.roleIds(u.platformRoles).length ? [["platform",""]] : [])];
      return ranges.every(([s,t]) => this.allowed(s,t,"users","edit"));
    }
    roleTargets(role) {
      const targets = [];
      for (const u of this.data.users) {
        for (const [id, value] of Object.entries(u.grants || {})) if (this.roleIds(value).includes(role.id)) targets.push(["project",id]);
        for (const [id, value] of Object.entries(u.storeGrants || {})) if (this.roleIds(value).includes(role.id)) targets.push(["store",id]);
        if (this.roleIds(u.platformRoles).includes(role.id)) targets.push(["platform",""]);
      }
      return targets;
    }
    assertRoleEditable(role, action = "edit") {
      const scope = role.project ? "project" : role.store ? "store" : "platform";
      const target = role.project || role.store || "";
      if (!this.allowed(scope,target,"roles",action)) throw Error("沒有此範圍的角色管理權限；可建立獨立角色");
      for (const [s,t] of this.roleTargets(role)) {
        const ownAssignment = s === "platform" ? this.user.platformRoles : s === "store" ? this.user.storeGrants?.[t] : this.user.grants?.[t];
        if (!this.allowed(s,t,"roles","edit") || (!this.isSystem && this.roleIds(ownAssignment).includes(role.id)))
          throw Error("角色影響未授權範圍或自身授權；請建立獨立角色");
      }
    }
    saveRole(input) {
      const old = this.role(input.id);
      if (input.id && !old) throw Error("角色不存在");
      const role = {id:old?.id || uid("role"), name:String(input.name || "").trim(), store:input.store || "", project:input.project || "", note:String(input.note || ""), enabled:input.enabled !== false, manager:old?.manager || false, permissionVersion:3,
        permissions:Object.fromEntries(Object.entries(actions).map(([f,aa]) => [f,aa.filter(a => a === "create" || a === "edit" ? input.permissions?.[f]?.some(x => x === "create" || x === "edit") : input.permissions?.[f]?.includes(a))]))};
      if (!role.name) throw Error("請填寫角色名稱");
      if (role.store && !this.data.stores.some(s => s.id === role.store)) throw Error("適用商店不存在");
      if (role.project && !this.data.projects.some(p => p.id === role.project && p.store === role.store)) throw Error("適用專案不存在");
      if (this.data.roles.some(r => r.id !== role.id && r.store === role.store && (r.project || "") === role.project && r.name === role.name)) throw Error("此範圍已有相同角色名稱");
      if (old) this.assertRoleEditable(old);
      this.assertRoleEditable(role,old ? "edit" : "create");
      const scope = role.project ? "project" : role.store ? "store" : "platform", target = role.project || role.store || "";
      if (!this.isSystem && Object.entries(input.permissions || {}).some(([f,aa]) => !Array.isArray(aa) || aa.some(a => !this.allowed(scope,target,f,a)))) throw Error("不能授予超出自身權限的功能");
      const targets = [[scope,target],...(old ? this.roleTargets(old) : [])];
      for (const [s,t] of targets) {
        if (!this.roleApplies({...role,enabled:true},s,t)) throw Error("變更適用範圍會影響既有授權");
        if (!this.isSystem && !this.canGrant({...role,enabled:true},s,t)) throw Error("不能授予超出自身在目標範圍的功能");
      }
      if (old) Object.assign(old,role); else this.data.roles.push(role);
      return role;
    }
    saveUser({mode,id,existingLogin,name="",login="",grants={},storeGrants={},platformRoles,enabled}) {
      if (!["new","existing","edit"].includes(mode)) throw Error("不支援的操作");
      const edit = mode === "edit", action = edit ? "edit" : "create";
      let target = existingLogin ? this.data.users.find(u => u.login === existingLogin.trim()) : this.data.users.find(u => u.id === id);
      if ((edit || mode === "existing") && !target) throw Error("使用者不存在");
      if (target?.system || (!this.isSystem && target?.id === this.identity)) throw Error("不能變更系統管理員身分或自身授權");
      if (mode === "new" && (!name.trim() || !login.trim() || this.data.users.some(u => u.login === login.trim()))) throw Error("請填寫姓名與唯一登入帳號");
      if (platformRoles !== undefined && platformRoles !== null && !Array.isArray(platformRoles)) throw Error("全域授權須提交角色陣列");
      const changes = [...Object.entries(grants).map(([t,r]) => ["project",t,r]),...Object.entries(storeGrants).map(([t,r]) => ["store",t,r]),...(platformRoles !== undefined ? [["platform","",platformRoles]] : [])];
      if (!changes.length && !edit) throw Error("請提交至少一項授權");
      for (const [scope,t,value] of changes) {
        if (value !== null && !(typeof value === "string" && value.length) && !(Array.isArray(value) && value.every(id => typeof id === "string" && id.length))) throw Error("撤銷須明確提交 null 或空陣列，角色 ID 不可空白");
        if (!this.allowed(scope,t,"users",action)) throw Error("未授予目標範圍的使用者新增 / 編輯權限");
        const prior = scope === "project" ? target?.grants[t] : scope === "store" ? target?.storeGrants?.[t] : target?.platformRoles;
        // Removing/replacing a grant is also an authority-sensitive operation.
        for (const roleId of [...this.roleIds(prior),...this.roleIds(value)]) {
          const r = this.role(roleId);
          if (!r || (!this.isSystem && !this.canGrant({...r,enabled:true},scope,t))) throw Error("無權指派或撤銷此範圍的角色");
          if (this.roleIds(value).includes(roleId) && !this.roleApplies(r,scope,t)) throw Error("角色已停用或不適用目標範圍");
        }
      }
      if (edit && !changes.length && !this.canEditUser(id)) throw Error("沒有使用者編輯權限");
      // Account state affects all assignments, so it needs authority over every assignment.
      if (enabled !== undefined && target && enabled !== (target.enabled !== false)) {
        if (!this.canChangeUserState(target.id)) throw Error("不能變更涉及其他範圍的使用者狀態");
      }
      const user = mode === "new" ? {id:uid("user"),name:name.trim(),login:login.trim(),grants:{},storeGrants:{}} : target;
      user.storeGrants ||= {};
      for (const [scope,t,value] of changes) {
        if (scope === "platform") user.platformRoles = [...(value || [])];
        else { const map = scope === "project" ? user.grants : user.storeGrants; if (value === null || (Array.isArray(value) && !value.length)) delete map[t]; else map[t] = value; }
      }
      if (enabled !== undefined) user.enabled = enabled;
      if (mode === "new") this.data.users.push(user);
      return user;
    }
    saveStore(input) {
      const old = this.data.stores.find(s => s.id === input.id);
      if (input.id && !old) throw Error("商店不存在");
      if (!(old ? this.canStore(old.id,"stores","edit") : this.canPlatform("stores","create"))) throw Error("沒有商店新增 / 編輯權限");
      const name = String(input.name || "").trim();
      if (!name) throw Error("請輸入商店名稱");
      if (input.storeId && this.data.stores.some(s => s.id !== input.id && (s.storeId ?? s.id) === input.storeId)) throw Error("此商店 ID 已存在");
      const values = {name,storeId:String(input.storeId || ""),token:String(input.token || ""),enabled:input.enabled !== false};
      if (old) Object.assign(old,values); else this.data.stores.push({id:uid("store"),...values});
      return old || this.data.stores.at(-1);
    }
    transactionAllowed(record, feature = "transactions", action = "view") {
      return !!record?.projectId && this.can(record.projectId,feature,"view") && this.can(record.projectId,feature,action);
    }
    assertTransaction(record, feature = "transactions", action = "view") {
      if (!this.transactionAllowed(record,feature,action)) throw Error("此交易不在授權範圍或缺少功能權限");
    }
    saveProject(input) {
      const old = this.data.projects.find(p => p.id === input.id);
      if (input.id && !old) throw Error("專案不存在");
      if (!(old ? this.can(old.id,"projects","edit") : this.canStore(input.store,"projects","create"))) throw Error("沒有目標範圍的專案新增 / 編輯權限");
      const name = String(input.name || "").trim();
      const projectId = String(input.projectId || "").trim();
      if (!name) throw Error("請輸入專案名稱");
      if (!this.data.stores.some(s => s.id === input.store)) throw Error("請選擇所屬商店");
      if (old && old.store !== input.store) throw Error("已建立的專案不可變更所屬商店");
      if (projectId && this.data.projects.some(p => p.id !== input.id && (p.projectId ?? p.id) === projectId)) throw Error("此專案 ID 已存在");
      const values = { name, projectId, store:input.store, token:String(input.token || "").trim(), enabled:input.enabled !== false };
      if (old) Object.assign(old,values);
      else this.data.projects.push({id:uid("project"),...values});
      return old || this.data.projects.at(-1);
    }
    savePaymentTool(input) {
      if (!this.canPlatform("payments",input.id ? "edit" : "create")) throw Error("沒有平台支付工具設定權限");
      if ((!input.id || !input.metadataOnly) && !this.canPlatform("fees","edit")) throw Error("設定預設費率需平台費率管理權限");
      const old = this.data.paymentTools.find((t) => t.id === input.id);
      if (input.id && !old) throw Error("支付工具不存在");
      const values = Object.fromEntries(
        ["platform", "name", "code", "currency", "note"].map((k) => [
          k,
          String(input[k] || "").trim(),
        ]),
      );
      if (!values.platform || !values.name || !values.code || !values.currency)
        throw Error("請填寫有效的必填欄位");
      if (!["%", "元"].includes(input.unit))
        throw Error("請選擇有效的計價單位");
      if (
        !String(input.fee ?? "").trim() ||
        !Number.isFinite(Number(input.fee)) ||
        Number(input.fee) < 0 ||
        !/^\d+(\.\d{1,6})?$/.test(String(input.fee).trim()) ||
        (input.unit === "%" && Number(input.fee) > 100)
      )
        throw Error("請填寫有效的必填欄位");
      const tool = {
        id: old?.id || uid("payment"),
        ...values,
        unit: input.unit,
      };
      if (old && old.unit !== tool.unit)
        throw Error("已建立的支付工具不可變更計價單位，請新增支付工具");
      if (
        this.data.paymentTools.some(
          (t) =>
            t.id !== tool.id &&
            t.platform === tool.platform &&
            t.name === tool.name,
        )
      )
        throw Error("此平台已有相同支付工具名稱");
      if (old) {
        if (!input.metadataOnly)
          this.saveFeeVersion("global", old.id, {
            id: input.versionId,
            effectiveAt: input.effectiveAt,
            entries: { [old.id]: { mode: "custom", fee: input.fee } },
          });
        Object.assign(old, tool);
      } else {
        this.data.paymentTools.push(tool);
        this.data.fees[tool.id] = String(input.fee).trim();
        this.data.feeVersions.push({
          id: uid("fee"),
          scope: "global",
          target: tool.id,
          effectiveAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          createdBy: this.user.name,
          entries: {
            [tool.id]: { mode: "custom", fee: String(input.fee).trim() },
          },
        });
      }
      return tool;
    }
    feeCan(key, action) {
      return (
        this.canPlatform("fees",action) &&
        Object.hasOwn(this.data.fees, key) &&
        this.data.paymentTools.some((t) => t.id === key) &&
        ["view", "edit"].includes(action)
      );
    }
    setFee(key, value) {
      if (!this.feeCan(key, "edit"))
        throw Error("沒有平台費率新增 / 編輯權限");
      if (!String(value).trim() || !Number.isFinite(Number(value)))
        throw Error("請填寫有效的費率數值");
      this.saveFeeVersion("global", key, {
        entries: { [key]: { mode: "custom", fee: value } },
      });
    }
    paymentSettingsForStore(storeId, at = new Date()) {
      if (!this.data.stores.some((s) => s.id === storeId))
        throw Error("商店不存在");
      return this.data.paymentTools.map((t) => ({
        ...t,
        ...this.resolveFee(t.id, { storeId, at }),
      }));
    }
    paymentSettingsForProject(projectId, at = new Date()) {
      const project = this.data.projects.find((p) => p.id === projectId);
      if (!project) throw Error("專案不存在");
      return this.data.paymentTools.map((t) => ({
        ...t,
        ...this.resolveFee(t.id, { projectId, at }),
      }));
    }
  }
  // All instants are stored in UTC; datetime-local values are explicitly Taipei time.
  function feeInstant(value) {
    if (value instanceof Date || typeof value === "number") {
      const time = value instanceof Date ? value.getTime() : value;
      if (!Number.isFinite(time))
        throw Error("請填寫有效的生效時間（台北時間）");
      return time;
    }
    let text = String(value || "").replace(" ", "T");
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.test(
        text,
      )
    )
      throw Error("請填寫完整日期與時間");
    const [year, month, day] = text.slice(0, 10).split("-").map(Number);
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > new Date(Date.UTC(year, month, 0)).getUTCDate()
    )
      throw Error("生效日期無效");
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text)) text += "+08:00";
    const time = Date.parse(text);
    if (!Number.isFinite(time)) throw Error("請填寫有效的生效時間（台北時間）");
    return time;
  }
  function initializeFeeVersions(data) {
    data.feeVersions ||= [];
    data.feeSnapshots ||= {};
    for (const tool of data.paymentTools || []) {
      if (
        !data.feeVersions.some(
          (v) => v.scope === "global" && v.target === tool.id,
        )
      ) {
        data.feeVersions.push({
          id: uid("fee"),
          scope: "global",
          target: tool.id,
          effectiveAt: "1970-01-01T00:00:00.000Z",
          createdAt: new Date().toISOString(),
          createdBy: "既有設定匯入",
          entries: {
            [tool.id]: {
              mode: "custom",
              fee: String(data.fees[tool.id] ?? "0"),
            },
          },
        });
      }
    }
  }
  Object.assign(SystemManagement.prototype, {
    feeVersions(scope, target) {
      if (!(scope === "global" ? this.canPlatform("fees","view") : this.allowed(scope,target,"fees","view"))) throw Error("沒有目標範圍的費率檢視權限");
      return this.data.feeVersions
        .filter((v) => v.scope === scope && v.target === target)
        .map((v) => structuredClone(v))
        .sort((a, b) => feeInstant(b.effectiveAt) - feeInstant(a.effectiveAt));
    },
    activeFeeVersion(scope, target, at = new Date()) {
      const time = feeInstant(at);
      return this.data.feeVersions.reduce((latest, version) => {
        if (version.scope !== scope || version.target !== target || version.cancelledAt || feeInstant(version.effectiveAt) > time || (version.endsAt && feeInstant(version.endsAt) <= time)) return latest;
        const status = (version.statusChanges || []).filter(change => feeInstant(change.at) <= time).at(-1);
        const enabled = status ? status.enabled : version.initialEnabled ?? version.enabled ?? true;
        if (!enabled) return latest;
        return !latest || feeInstant(version.effectiveAt) >= feeInstant(latest.effectiveAt) ? version : latest;
      }, null);
    },
    assertFeeScope(scope, target) {
      const collection = {
        global: "paymentTools",
        store: "stores",
        project: "projects",
      }[scope];
      if (
        !collection ||
        !this.data[collection].some((item) => item.id === target)
      )
        throw Error("費率設定對象不存在");
      if (!(scope === "global" ? this.canPlatform("fees","edit") : this.allowed(scope,target,"fees","edit"))) throw Error("沒有目標範圍的費率管理權限");
    },
    saveFeeVersion(scope, target, input, now = new Date()) {
      this.assertFeeScope(scope, target);
      const time = feeInstant(now);
      const effective = input.effectiveAt
        ? feeInstant(input.effectiveAt)
        : time;
      if (effective < time)
        throw Error("生效時間不可早於現在，歷史費率不可回溯修改");
      const endsAt = scope !== "global" && input.endsAt ? feeInstant(input.endsAt) : null;
      if (endsAt !== null && (!Number.isFinite(endsAt) || endsAt <= effective)) throw Error("手續費率結束時間須晚於開始時間");
      const old =
        input.id &&
        this.data.feeVersions.find(
          (v) => v.id === input.id && v.scope === scope && v.target === target,
        );
      if (
        input.id &&
        (!old || old.cancelledAt || feeInstant(old.effectiveAt) <= time)
      )
        throw Error("僅可修改待生效版本");
      if (old && scope !== "global" && this.storeFeeState(target,old,now) !== "待生效") throw Error("僅待生效版本可修改起訖時間及費率");
      if (
        input.effectiveAt &&
        this.data.feeVersions.some(
          (v) =>
            v.scope === scope &&
            v.target === target &&
            v.id !== input.id &&
            !v.cancelledAt &&
            feeInstant(v.effectiveAt) === effective,
        )
      )
        throw Error("此生效時間已有設定版本");
      const tools =
        scope === "global"
          ? this.data.paymentTools.filter((t) => t.id === target)
          : this.data.paymentTools;
      const entries = {};
      if (
        Object.keys(input.entries || {}).some(
          (id) => !tools.some((t) => t.id === id),
        )
      )
        throw Error("包含不存在的支付工具");
      for (const tool of tools) {
        const entry = input.entries?.[tool.id];
        if (!entry || !["inherit", "custom"].includes(entry.mode))
          throw Error("請設定每個支付工具的繼承或自訂方式");
        if (scope === "global" && entry.mode !== "custom")
          throw Error("全站費率不可繼承");
        if (entry.mode === "inherit") entries[tool.id] = { mode: "inherit" };
        else {
          const fee = String(entry.fee ?? "").trim();
          if (
            !/^\d+(\.\d{1,6})?$/.test(fee) ||
            !Number.isFinite(Number(fee)) ||
            Number(fee) < 0 ||
            (tool.unit === "%" && Number(fee) > 100)
          )
            throw Error("費率須為非負數，最多六位小數，百分比不可超過 100");
          entries[tool.id] = { mode: "custom", fee };
        }
      }
      if (scope !== "global") for (const tool of tools) {
        if (scope === "store" || entries[tool.id].mode === "custom") entries[tool.id].enabled = input.entries[tool.id].enabled !== false;
      }
      const version = {
        id: uid("fee"),
        scope,
        target,
        entries,
        effectiveAt: new Date(effective).toISOString(),
        ...(endsAt !== null ? {endsAt:new Date(endsAt).toISOString()} : {}),
        ...(scope !== "global" ? {enabled:input.enabled !== false, initialEnabled:input.enabled !== false, statusChanges:[]} : {}),
        createdAt: new Date(time).toISOString(),
        createdBy: this.user.name,
      };
      // Revisions keep the superseded draft for audit rather than overwriting it.
      if (old) {
        old.cancelledAt = new Date(time).toISOString();
        old.cancelledBy = this.user.name;
        old.replacedBy = version.id;
      }
      this.data.feeVersions.push(version);
      if (scope === "global" && effective <= time)
        this.data.fees[target] = entries[target].fee;
      return structuredClone(version);
    },
    storeFeeState(target, version, at = new Date()) {
      const time = feeInstant(at);
      if (version.endsAt && feeInstant(version.endsAt) <= time) return "已結束";
      if (version.cancelledAt || version.enabled === false) return "—";
      if (feeInstant(version.effectiveAt) > time) return "待生效";
      return this.activeFeeVersion(version.scope, target, at)?.id === version.id ? "生效中" : "未套用";
    },
    updateStoreFeeControls(target, id, input, now = new Date(), scope = "store") {
      this.assertFeeScope(scope,target);
      const version = this.data.feeVersions.find(v=>v.scope === scope && v.target === target && v.id === id);
      if (!version || version.cancelledAt) throw Error("此版本不可編輯");
      const state = this.storeFeeState(target,version,now);
      if (state === "已結束") throw Error("已結束版本不可編輯");
      if (typeof input.enabled !== "boolean") throw Error("狀態格式不正確");
      const hasEnd = Object.hasOwn(input,"endsAt");
      const end = hasEnd && input.endsAt ? feeInstant(input.endsAt) : null;
      if (hasEnd && state !== "生效中") throw Error("僅生效中版本可單獨修改結束時間");
      if (end !== null && (end <= feeInstant(now) || end <= feeInstant(version.effectiveAt))) throw Error("手續費率結束時間須晚於現在及開始時間");
      if (version.statusChanges?.length && feeInstant(version.statusChanges.at(-1).at) > feeInstant(now)) throw Error("狀態異動不可回溯");
      if (hasEnd && (version.endsAt || null) !== (end === null ? null : new Date(end).toISOString())) {
        version.endChanges ||= [];
        const next = end === null ? null : new Date(end).toISOString();
        version.endChanges.push({at:new Date(feeInstant(now)).toISOString(),by:this.user.name,from:version.endsAt || null,to:next});
        if (next) version.endsAt = next; else delete version.endsAt;
      }
      return this.setStoreFeeStatus(target,id,input.enabled,now,scope);
    },
    setStoreFeeStatus(target, id, enabled, now = new Date(), scope = "store") {
      this.assertFeeScope(scope, target);
      if (typeof enabled !== "boolean") throw Error("狀態格式不正確");
      const version = this.data.feeVersions.find(v => v.scope === scope && v.target === target && v.id === id);
      if (!version || version.cancelledAt) throw Error("此版本不可修改狀態");
      if (this.storeFeeState(target,version,now) === "已結束") throw Error("已結束版本不可修改狀態");
      if ((version.enabled !== false) === enabled) return structuredClone(version);
      const at = new Date(feeInstant(now)).toISOString();
      version.initialEnabled ??= version.enabled !== false;
      version.statusChanges ||= [];
      if (version.statusChanges.length && feeInstant(version.statusChanges.at(-1).at) > feeInstant(at)) throw Error("狀態異動不可回溯");
      version.enabled = enabled;
      version.statusChanges.push({enabled, at, by:this.user.name});
      return structuredClone(version);
    },
    cancelFeeVersion(scope, target, id, now = new Date()) {
      this.assertFeeScope(scope, target);
      const version = this.data.feeVersions.find(
        (v) => v.id === id && v.scope === scope && v.target === target,
      );
      if (
        !version ||
        version.cancelledAt ||
        feeInstant(version.effectiveAt) <= feeInstant(now)
      )
        throw Error("僅可取消待生效版本");
      version.cancelledAt = new Date(feeInstant(now)).toISOString();
      version.cancelledBy = this.user.name;
    },
    resolveFee(toolId, { projectId, storeId, at = new Date() } = {}) {
      const tool = this.data.paymentTools.find((t) => t.id === toolId);
      if (!tool) throw Error("支付工具不存在");
      const project =
        projectId && this.data.projects.find((p) => p.id === projectId);
      if (projectId && !project) throw Error("專案不存在");
      if (project) storeId = project.store;
      if (storeId && !this.data.stores.some((s) => s.id === storeId))
        throw Error("商店不存在");
      const levels = [
        ...(project ? [["project", project.id]] : []),
        ...(storeId ? [["store", storeId]] : []),
        ["global", toolId],
      ];
      let enabled;
      for (const [scope, target] of levels) {
        const version = this.activeFeeVersion(scope, target, at);
        const entry = version?.entries[toolId];
        if (enabled === undefined && typeof entry?.enabled === "boolean") enabled = entry.enabled;
        if (entry?.mode === "custom")
          return {
            fee: entry.fee,
            unit: tool.unit,
            source: scope,
            sourceId: target,
            versionId: version.id,
            effectiveAt: version.effectiveAt,
            enabled: enabled ?? true,
          };
      }
      return {
        fee: null,
        unit: tool.unit,
        source: "unavailable",
        versionId: null,
      };
    },
    recordTransactionFee({ id, toolId, projectId, paidAt, amount }) {
      this.assertTransaction({projectId});
      if (!id || !projectId || !paidAt)
        throw Error("交易需包含編號、專案與付款成功時間");
      const existing = this.data.feeSnapshots[id];
      if (existing) {
        if (
          existing.toolId !== toolId ||
          existing.projectId !== projectId ||
          existing.paidAt !== new Date(feeInstant(paidAt)).toISOString() ||
          existing.amount !== Number(amount)
        )
          throw Error("交易計費資料已鎖定，不可變更");
        return structuredClone(existing);
      }
      if (
        !/^\d+(\.\d{1,2})?$/.test(String(amount)) ||
        !Number.isSafeInteger(Math.round(Number(amount) * 100))
      )
        throw Error("交易金額無效");
      const rate = this.resolveFee(toolId, { projectId, at: paidAt });
      if (rate.fee === null) throw Error("付款時間尚無有效費率");
      // TWD demo settlement uses whole-dollar rounding, including a fixed-dollar fee.
      const decimal = (value, digits) => {
        const [whole, fraction = ""] = String(value).split(".");
        return (
          BigInt(whole) * 10n ** BigInt(digits) +
          BigInt(fraction.padEnd(digits, "0"))
        );
      };
      const numerator =
        rate.unit === "%"
          ? decimal(amount, 2) * decimal(rate.fee, 6)
          : decimal(rate.fee, 6);
      const denominator = rate.unit === "%" ? 10000000000n : 1000000n;
      const feeAmount = Number((numerator + denominator / 2n) / denominator);
      const snapshot = {
        id,
        toolId,
        projectId,
        paidAt: new Date(feeInstant(paidAt)).toISOString(),
        amount: Number(amount),
        ...rate,
        feeAmount,
      };
      this.data.feeSnapshots[id] = snapshot;
      return structuredClone(snapshot);
    },
  });
  function isSavedData(data) {
    if (
      !data ||
      !["stores", "projects", "users", "roles"].every((k) =>
        Array.isArray(data[k]),
      ) ||
      !data.fees ||
      typeof data.fees !== "object"
    )
      return false;
    return (
      data.users.some((u) => u.id === "admin" && u.system) &&
      data.users.every(
        (u) =>
          typeof u.name === "string" &&
          typeof u.login === "string" &&
          u.grants &&
          typeof u.grants === "object",
      ) &&
      data.roles.every(
        (r) =>
          typeof r.name === "string" &&
          r.permissions &&
          typeof r.permissions === "object",
      )
    );
  }
  function migrate(data) {
    // Keep the platform setting; retire per-store/project copies rather than selecting an override.
    const defaults = paymentDefaults();
    if (!Array.isArray(data.paymentTools))
      data.paymentTools = defaults.map(({ fee, ...tool }) => tool);
    const codes = {
      "apple-pay": "APPLEPAY",
      "google-pay": "GOOGLEPAY",
      "line-pay": "LINEPAY",
      atm: "VACC",
      cvs: "CVS",
      "credit-card": "CREDIT",
      "foreign-credit-card": "CREDIT",
    };
    data.paymentTools.forEach((t) => {
      t.code ??= codes[t.id] || "";
      t.note ??= "";
    });
    const previous = data.fees;
    if (!data.legacyFeeMigrationVersion) {
      data.legacyFeeOverrides = {...(data.legacyFeeOverrides || {}),...Object.fromEntries(Object.entries(previous).filter(([key]) => /^(store|project):/.test(key)))};
      data.feeVersions ||= [];
      for (const [key,value] of Object.entries(data.legacyFeeOverrides)) {
        const [scope,target] = key.split(":");
        const collection = scope === "store" ? data.stores : data.projects;
        if (!collection.some(item => item.id === target) || !/^\d+(\.\d{1,6})?$/.test(String(value)) || Number(value) > 100 || data.feeVersions.some(v => v.scope === scope && v.target === target)) continue;
        data.feeVersions.push({id:uid("fee-legacy"),scope,target,effectiveAt:"1970-01-01T00:00:00.000Z",createdAt:new Date().toISOString(),createdBy:"既有費率匯入",entries:Object.fromEntries(data.paymentTools.map(t => [t.id,t.id === "credit-card" ? {mode:"custom",fee:String(value)} : {mode:"inherit"}]))});
      }
      data.legacyFeeMigrationVersion = 1;
    }
    data.fees = Object.fromEntries(
      data.paymentTools.map((t) => [
        t.id,
        previous[t.id] ??
          (t.id === "credit-card" ? previous.system : undefined) ??
          defaults.find((d) => d.id === t.id)?.fee ??
          "0",
      ]),
    );
    const names = {
      charlie: ["陳查理：原始範例", "陳查理"],
      multi: ["陳查理：多專案情境", "林冠宇"],
      cross: ["跨商店展示帳號", "李佳穎"],
      big: ["管理員展示：可新增／編輯", "林志明"],
      little: ["管理員展示：僅可編輯", "吳雅婷"],
      partial: ["管理員展示：僅專案 A", "張怡君"],
    };
    data.users.forEach((u) => {
      const rename = names[u.id];
      if (rename && u.name === rename[0]) u.name = rename[1];
      if (u.id === "admin" && u.login === "demo-admin") u.login = "admin";
    });
    data.users.forEach((user) => {
      if (!user.system && !user.email)
        user.email = user.login.includes("@")
          ? user.login
          : user.login + "@gmail.com";
    });
    data.roles.forEach((r) => {
      // Upgrade once: preserve old access without re-granting permissions on reload.
      if (!r.permissionVersion) {
        r.permissions.home = ["view"];
        r.permissions.tags = [...(r.permissions.products || [])].filter(a => actions.tags.includes(a));
        r.permissions.statements = r.permissions.reports?.includes("view")
          ? ["view", "create", "edit", "archive", ...(r.permissions.reports.includes("export") ? ["export"] : [])] : [];
        r.permissions.roles = r.manager && r.permissions.users?.includes("edit") ? ["view", "create", "edit"] : [];
        r.permissions.projects = ["view"];
        r.permissions.stores = ["view"];
        r.permissionVersion = 1;
      }

      delete r.permissions.home;
      if ((r.permissionVersion || 0) < 2) {
        for (const [feature, valid] of Object.entries(actions)) {
          if (valid.includes("create") && r.permissions[feature]?.some(a => a === "create" || a === "edit")) {
            r.permissions[feature] = valid.filter(a => a === "create" || a === "edit" || r.permissions[feature].includes(a));
          }
        }
        r.permissionVersion = 2;
      }
      if (r.permissionVersion < 3) {
        // These legacy fields were nonfunctional in v2. Do not activate latent access.
        delete r.permissions.payments;
        delete r.permissions.fees;
        r.permissionVersion = 3;
      }

      if (r.id === "refund" && r.name === "退款展示角色")
        r.name = "交易退款角色";
    });
    data.projects.forEach((p) => {
      if (p.id === "C" && p.name === "示意專案 C") p.name = "線上課程專案 C";
    });
    return data;
  }
  function installFeeDemo(data, now = new Date()) {
    const target = "fee-demo";
    const existing = data.stores.find(s=>s.id === target);
    if (existing) {
      if (existing.name === "手續費率示範商店") existing.name = "行動發展部";
      return false;
    }
    data.stores.push({id:target,name:"行動發展部",storeId:"DEMO-FEE",enabled:true});
    initializeFeeVersions(data);
    const base = feeInstant(now);
    const day = 86400000;
    const cases = [
      {key:"ended",start:-30,end:-15,enabled:true,note:"已結束：僅可檢視，所有設定鎖定。"},
      {key:"overlap",start:-14,end:30,enabled:true,note:"未套用：期間重疊，較新的版本優先；僅可切換狀態。"},
      {key:"active",start:-7,end:30,enabled:true,note:"生效中：可改結束時間及狀態；停用後由上一版接手。"},
      {key:"disabled",start:-3,end:30,enabled:false,note:"手動停用：費率生效狀態顯示 —；僅可切換狀態，啟用後可接手生效。"},
      {key:"pending",start:7,end:60,enabled:true,note:"待生效：可編輯起訖時間、各工具費率與狀態。"},
    ];
    cases.forEach((item,index)=>data.feeVersions.push({
      id:`demo-fee-${item.key}-${base}`,scope:"store",target,
      effectiveAt:new Date(base+item.start*day).toISOString(),endsAt:new Date(base+item.end*day).toISOString(),
      createdAt:new Date(base+Math.min(item.start-2,-(cases.length-index))*day).toISOString(),createdBy:"Demo 示範資料",
      enabled:item.enabled,initialEnabled:item.enabled,statusChanges:[],demoNote:item.note,
      entries:Object.fromEntries(data.paymentTools.map((tool,i)=>[tool.id,{mode:"custom",fee:String(tool.unit === "%" ? (1.5+index*0.1).toFixed(2) : 5+index),enabled:i<6}])),
    }));
    return true;
  }
  function calculateEstimatedFee(amount, fee, unit) {
    if (!/^\d+(\.\d{1,2})?$/.test(String(amount)) || !/^\d+(\.\d{1,6})?$/.test(String(fee)) || !["%", "元"].includes(unit))
      throw Error("交易金額或手續費率無效");
    const decimal = (value, digits) => {
      const [whole, fraction = ""] = String(value).split(".");
      return BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, "0"));
    };
    const numerator = unit === "%" ? decimal(amount, 2) * decimal(fee, 6) : decimal(fee, 6);
    const denominator = unit === "%" ? 10000000000n : 1000000n;
    const rounded = (numerator * 100000n + denominator / 2n) / denominator;
    return Number(rounded < 100000n ? 100000n : rounded) / 100000;
  }
  function current(storage = root.localStorage) {
    const raw = storage?.getItem("payment-system-management-v2") ?? storage?.getItem("payment-system-demo-v1");
    if (raw == null) return new SystemManagement(migrate(seed()), "admin"); // Explicit first-run demo identity.
    try {
      const saved = JSON.parse(raw);
      if (!isSavedData(saved?.data)) throw Error("無效資料");
      return new SystemManagement(migrate(saved.data), saved.currentUserId ?? "invalid", saved.store);
    } catch { return new SystemManagement(seed(), "invalid"); }
  }
  const api = { SystemManagement, seed, actions, labels, isSavedData, migrate, installFeeDemo, calculateEstimatedFee, current };
  if (typeof module !== "undefined") module.exports = api;
  else root.SystemManagement = api;
})(typeof window !== "undefined" ? window : globalThis);
