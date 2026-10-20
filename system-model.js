(function (root) {
  "use strict";
  const actions = {
    transactions: ["view", "refund"],
    products: ["view", "create", "edit", "delete"],
    tags: ["view", "create", "edit"],
    reports: ["view", "export"],
    statements: ["view", "create", "edit", "archive", "export"],
    users: ["view", "create", "edit"],
    roles: ["view", "create", "edit"],
    projects: ["view"],
    stores: ["view"],
  };
  const labels = {
    home: "首頁", transactions: "所有交易紀錄", products: "商品管理",
    tags: "標籤管理", reports: "商品交易統計", statements: "對帳單",
    users: "使用者管理", roles: "角色管理", projects: "專案管理", stores: "商店管理",
    payments: "支付工具設定", view: "檢視", create: "新增", edit: "編輯", createEdit: "新增 / 編輯",
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
          name: "商店管理員（大）",
          store: "",
          manager: true,
          permissions: all(),
        },
        {
          id: "small",
          name: "商店管理員（小）",
          store: "edu",
          manager: true,
          permissions: { ...all(), users: ["view", "edit"] },
        },
        {
          id: "viewer",
          name: "交易檢視角色",
          store: "",
          manager: false,
          permissions: { transactions: ["view"] },
        },
        {
          id: "refund",
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
      return (
        this.data.users.find((u) => u.id === this.identity) ||
        this.data.users.find((u) => u.system)
      );
    }
    role(id) {
      return this.data.roles.find((r) => r.id === id);
    }
    can(projectId, feature, action) {
      if (feature === "home" && action === "view") return true;
      const p = this.data.projects.find((p) => p.id === projectId);
      if (!p) return false;
      if (this.user.system) return true;
      if (feature === "fees" || feature === "payments") return false;
      const r = this.role(this.user.grants[p.id]);
      return (
        !!r &&
        r.enabled !== false &&
        (!r.store || r.store === p.store) &&
        (action === "create" || action === "edit"
          ? !!r.permissions[feature]?.some(a => a === "create" || a === "edit")
          : !!r.permissions[feature]?.includes(action))
      );
    }
    projects(feature, action = "view") {
      return this.data.projects.filter(
        (p) =>
          p.store === this.store &&
          (feature
            ? this.can(p.id, feature, action)
            : this.user.system ||
              (!!this.role(this.user.grants[p.id]) &&
                (!this.role(this.user.grants[p.id]).store ||
                  this.role(this.user.grants[p.id]).store === p.store))),
      );
    }
    stores() {
      return this.data.stores.filter(
        (s) =>
          this.user.system ||
          this.data.projects.some(
            (p) =>
              p.store === s.id &&
              this.role(this.user.grants[p.id]) &&
              (!this.role(this.user.grants[p.id]).store ||
                this.role(this.user.grants[p.id]).store === s.id),
          ),
      );
    }
    normalize() {
      if (!this.data.users.some((u) => u.id === this.identity))
        this.identity = "admin";
      const stores = this.stores();
      if (!stores.some((s) => s.id === this.store))
        this.store = stores[0]?.id || "";
    }
    switchStore(id) {
      if (!this.stores().some((s) => s.id === id)) throw Error("此商店未授權");
      this.store = id;
    }
    manageable(action) {
      return this.projects("users", action);
    }
    visibleUsers() {
      const ids = this.projects("users").map((p) => p.id);
      return this.data.users.filter(
        (u) => !u.system && ids.some((p) => u.grants[p]),
      );
    }
    availableExisting() {
      // Only the system administrator can search the platform account directory.
      // Other managers use a known login rather than enumerating unrelated accounts.
      if (!this.manageable("create").length) return [];
      return this.user.system
        ? this.data.users.filter(
            (u) => !u.system && !this.projects().some((p) => u.grants[p.id]),
          )
        : [];
    }
    canManageRoles(store = this.store, action = "edit") {
      return (
        this.user.system ||
        this.data.projects.some(
          (project) =>
            project.store === store &&
            this.can(project.id, "roles", action),
        )
      );
    }
    roleActionAllowed(store, feature, action) {
      return (
        actions[feature]?.includes(action) &&
        (this.user.system ||
          this.data.projects.some(
            (project) => project.store === store && this.can(project.id, feature, action),
          ))
      );
    }
    assignableRoles() {
      return this.data.roles.filter(
        (r) =>
          r.enabled !== false &&
          (!r.store || r.store === this.store) &&
          (this.user.system ||
            ["viewer", "refund"].includes(r.id) ||
            (r.store === this.store &&
              !r.manager &&
              Object.entries(r.permissions).every(([feature, valid]) =>
                valid.every((action) =>
                  this.roleActionAllowed(this.store, feature, action),
                ),
              ))),
      );
    }
    canEditUser(id) {
      const u = this.data.users.find((u) => u.id === id);
      if (!u || u.system) return false;
      if (this.user.system) return this.projects().some((p) => u.grants[p.id]);
      if (u.id === this.user.id) return false;
      const relevant = this.data.projects.filter(
        (p) => p.store === this.store && u.grants[p.id],
      );
      // Partial-manager editing of a user with other project grants is explicitly unresolved.
      return (
        relevant.length > 0 &&
        relevant.every((p) => this.can(p.id, "users", "edit")) &&
        relevant.some((p) => !this.role(u.grants[p.id])?.manager)
      );
    }
    saveRole(input) {
      if (!this.user.system && !this.data.projects.some(p => p.store === input.store && this.can(p.id, "roles", input.id ? "edit" : "create")))
        throw Error("沒有此商店的角色管理權限");
      if (!String(input.name || "").trim()) throw Error("請填寫角色名稱");
      if (input.store && !this.data.stores.some((s) => s.id === input.store))
        throw Error("適用商店不存在");
      const old = this.role(input.id);
      if (
        !this.user.system &&
        (!input.store ||
          input.store !== this.store ||
          (old && (old.store !== this.store || old.manager)))
      )
        throw Error("只能設定目前商店的自訂角色");
      if (
        !this.user.system &&
        Object.entries(input.permissions || {}).some(([feature, valid]) =>
          valid.some(
            (action) => !this.roleActionAllowed(input.store, feature, action),
          ),
        )
      )
        throw Error("不能授予超出自身權限的功能");
      if (
        this.data.roles.some(
          (role) =>
            role.id !== input.id &&
            role.store === (input.store || "") &&
            role.name === input.name.trim(),
        )
      )
        throw Error("此商店已有相同角色名稱");
      if (input.id && !old) throw Error("角色不存在");
      if (
        old &&
        input.store &&
        this.data.users.some((u) =>
          Object.entries(u.grants).some(
            ([p, r]) =>
              r === old.id &&
              this.data.projects.find((x) => x.id === p)?.store !== input.store,
          ),
        )
      )
        throw Error("此角色已有其他商店的授權；變更適用範圍的處理規則待確認");
      const role = {
        id: old?.id || uid("role"),
        permissionVersion: 2,
        name: input.name.trim(),
        store: input.store || "",
        manager: old?.manager || false,
        note: String(input.note || ""),
        enabled: input.enabled !== false,
        permissions: Object.fromEntries(
          Object.entries(actions).map(([feature, valid]) => [
            feature,
            valid.filter((a) => a === "create" || a === "edit"
              ? input.permissions?.[feature]?.some(value => value === "create" || value === "edit")
              : input.permissions?.[feature]?.includes(a)),
          ]),
        ),
      };
      if (old) Object.assign(old, role);
      else this.data.roles.push(role);
      return role;
    }
    saveUser({ mode, id, existingLogin, name = "", login = "", grants = {} }) {
      if (!["new", "existing", "edit"].includes(mode))
        throw Error("不支援的操作");
      const edit = mode === "edit",
        allowed = this.manageable(edit ? "edit" : "create").map((p) => p.id);
      if (!allowed.length)
        throw Error(edit ? "未授予使用者編輯權限" : "未授予使用者新增權限");
      let target =
        mode === "existing" && existingLogin
          ? this.data.users.find((u) => u.login === existingLogin.trim())
          : this.data.users.find((u) => u.id === id);
      if (edit && !this.canEditUser(id))
        throw Error(
          "無可編輯授權，或此操作涉及自己、管理員身分／未授權專案，規則待確認",
        );
      if (target?.system) throw Error("此流程不能指派系統管理員帳號");
      if (mode === "existing") {
        if (!target) throw Error("找不到此登入帳號，請確認輸入內容");
        if (
          this.data.projects.some(
            (p) => p.store === this.store && target.grants[p.id],
          )
        )
          throw Error(
            "帳號已加入目前商店，請使用編輯授權；不能透過新增流程更改既有管理員身分",
          );
      }
      if (mode === "new") {
        if (!name.trim() || !login.trim()) throw Error("請填寫姓名與登入帳號");
        if (this.data.users.some((u) => u.login === login.trim()))
          throw Error("登入帳號已存在，請改用加入既有帳號");
      }
      const entries = Object.entries(grants);
      if (!entries.length)
        throw Error("請勾選至少一個專案；撤銷／移除流程待確認");
      for (const [p, roleId] of entries) {
        const r = this.role(roleId);
        if (!allowed.includes(p) || !r || (r.store && r.store !== this.store))
          throw Error("專案或角色超出目前可設定範圍");
        if (
          !this.user.system &&
          !this.assignableRoles().some((x) => x.id === roleId)
        )
          throw Error("無權指派此角色");
        if (!this.user.system && this.role(target?.grants[p])?.manager)
          throw Error("商店管理員身分僅系統管理員可授予或變更");
      }
      const user =
        mode === "new"
          ? {
              id: uid("user"),
              name: name.trim(),
              login: login.trim(),
              grants: {},
            }
          : target;
      // Omitted projects are deliberately preserved; removal has not been specified.
      Object.assign(user.grants, grants);
      if (mode === "new") this.data.users.push(user);
      return user;
    }
    saveProject(input) {
      if (!this.user.system) throw Error("僅系統管理員可設定專案");
      const old = this.data.projects.find(p => p.id === input.id);
      if (input.id && !old) throw Error("專案不存在");
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
      if (!this.user.system) throw Error("僅系統管理員可設定支付工具");
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
        !!this.user.system &&
        Object.hasOwn(this.data.fees, key) &&
        this.data.paymentTools.some((t) => t.id === key) &&
        ["view", "edit"].includes(action)
      );
    }
    setFee(key, value) {
      if (!this.feeCan(key, "edit"))
        throw Error("僅系統管理員可設定支付工具與手續費");
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
      if (!this.user.system) throw Error("僅系統管理員可設定手續費");
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
    data.users = data.users.filter((u) => !["fee-only", "none"].includes(u.id));
    data.users.forEach((user) => {
      if (!user.system && !user.email)
        user.email = user.login.includes("@")
          ? user.login
          : user.login + "@gmail.com";
    });
    data.roles = data.roles.filter((r) => r.id !== "fee-reader");
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
      delete r.permissions.fees;
      delete r.permissions.home;
      if ((r.permissionVersion || 0) < 2) {
        for (const [feature, valid] of Object.entries(actions)) {
          if (valid.includes("create") && r.permissions[feature]?.some(a => a === "create" || a === "edit")) {
            r.permissions[feature] = valid.filter(a => a === "create" || a === "edit" || r.permissions[feature].includes(a));
          }
        }
        r.permissionVersion = 2;
      }
      delete r.permissions.payments;
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
  const api = { SystemManagement, seed, actions, labels, isSavedData, migrate, installFeeDemo, calculateEstimatedFee };
  if (typeof module !== "undefined") module.exports = api;
  else root.SystemManagement = api;
})(typeof window !== "undefined" ? window : globalThis);
