(() => {
  "use strict";

  /* ==========================================================================
   * 0. 頁面判斷
   * ======================================================================== */
  const route = location.pathname.split("/").pop().replace(".html", "");
  if (!["users", "roles", "projects", "stores", "payments"].includes(route))
    return;

  const {
    SystemManagement: Management,
    seed,
    actions,
    isSavedData,
    migrate,
  } = SystemManagement;

  /* ==========================================================================
   * 1. 常數
   * ======================================================================== */
  const STORAGE = "payment-system-management-v2";
  const LEGACY_STORAGE = "payment-system-demo-v1";
  const PLATFORMS = ["藍新金流", "Line Pay", "街口支付", "台灣行動支付"];
  const UNAVAILABLE = 'disabled title="尚未開放"';
  // 非系統管理員的商店列表不顯示費率：9 個支付工具欄 + 2 個固定欄
  const HIDDEN_FEE_CELLS = "<td>—</td>".repeat(11);

  const TITLES = {
    users: "使用者管理",
    roles: "角色管理",
    stores: "商店管理",
    projects: "專案管理",
    payments: "支付工具設定",
  };
  const title = TITLES[route];

  const labels = { ...SystemManagement.labels,
    transactions: "所有交易紀錄",
    products: "商品管理",
    reports: "商品交易統計",
    users: "使用者管理",
    fees: "手續費設定",
    view: "檢視",
    create: "新增",
    edit: "編輯",
    refund: "退款",
    export: "匯出",
  };

  /* ==========================================================================
   * 2. 載入資料與初始狀態
   * ======================================================================== */
  let saved;
  let storageIssue = false;
  try {
    const raw = localStorage.getItem(STORAGE) ?? localStorage.getItem(LEGACY_STORAGE);
    saved = raw == null ? null : JSON.parse(raw);
    if (raw != null && !isSavedData(saved?.data)) {
      saved = null;
      storageIssue = true;
    }
  } catch {
    storageIssue = true;
  }

  const app = new Management(
    migrate(saved?.data || seed()),
    storageIssue ? "invalid" : saved ? (saved.currentUserId ?? "invalid") : "admin",
    saved?.store,
  );
  if (route === "stores" && app.isSystem) SystemManagement.installFeeDemo(app.data);
  let persistedData = structuredClone(app.data);
  const main = document.querySelector("main");
  const originalMain = main.innerHTML;

  // 進入時商店是所有身分的查詢預設，查詢不改變工作階段。
  const enteredStore = app.store;
  const defaultFilter = (storeId) => storeId;

  let search = "";
  let paymentPlatform = "";
  let page = 1;
  let size = 50;
  let toastTimer;
  let userStore = defaultFilter(app.store);
  let userProject = "";
  let roleStore = defaultFilter(app.store);
  let projectStore = defaultFilter(enteredStore);
  let storeFilter = defaultFilter(enteredStore);

  /* ==========================================================================
   * 3. 通用小工具
   * ======================================================================== */
  const HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

  const options = (items, selected) =>
    items
      .map(
        ([value, label]) =>
          `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`,
      )
      .join("");

  const OPERATION_PERMISSIONS = {
    "new-role":["roles","create"], "edit-role":["roles","edit"],
    "new-user":["users","create"], "edit-user":["users","edit"],
    "new-project":["projects","create"], "edit-project":["projects","edit","project"],
    "new-store":["stores","create","platform"], "edit-store":["stores","edit","store"],
    "new-payment":["payments","create","platform"], "tool-metadata":["payments","edit","platform"],
    "fee-store":["fees","view","store"], "fee-project":["fees","view","project"],
    "store-fee-new":["fees","edit"], "store-fee-revise":["fees","edit"],
  };
  const button = (text, action, extra = "", cls = "plain") => {
    const permission = OPERATION_PERMISSIONS[action];
    const attrs = permission ? `data-permission-feature="${permission[0]}" data-permission-action="${permission[1]}"` + (permission[2] ? ` data-permission-scope="${permission[2]}" data-permission-target="${extra.match(/data-id="([^"]+)"/)?.[1] || ""}"` : "") : "";
    return `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs} ${extra}>${text}</button>`;
  };

  const table = (head, rows, cls = "") => {
    const headHtml = head.map((x) => `<th scope="col">${x}</th>`).join("");
    const body =
      rows ||
      `<tr><td class="empty" colspan="${head.length}">無符合條件或權限的資料</td></tr>`;
    return `<div class="table-wrap ${cls}"><table><thead><tr>${headHtml}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  const feeDate = (value) =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(value));

  const feeText = (rate) =>
    rate.fee === null ? "尚未生效" : esc(rate.fee + rate.unit);

  const FEE_SOURCES = {
    global: "全站預設",
    store: "商店自訂",
    project: "專案自訂",
    unavailable: "尚未生效",
  };
  const feeSource = (rate) => FEE_SOURCES[rate.source];

  const storeName = (id) =>
    app.data.stores.find((s) => s.id === id)?.name || id;
  const projectById = (id) => app.data.projects.find((p) => p.id === id);
  const storeOptions = () => app.stores(route).map((s) => [s.id, s.name]);

  // 以指定商店（與資料副本）建立權限範圍
  const scoped = (storeId, data = app.data) =>
    new Management(data, app.identity, storeId);
  const cloneData = () => JSON.parse(JSON.stringify(app.data));

  // [{store, project, role}] → Map(store → { [project]: role })
  const grantsByStore = (grants) => {
    const map = new Map();
    for (const { store, project, role } of grants) {
      if (map.get(store)?.[project] && map.get(store)[project] !== role)
        throw Error("同一商店的同一專案只能設定一個角色權限");
      map.set(store, { ...map.get(store), [project]: role });
    }
    return map;
  };

  const accessibleProjects = () =>
    app.stores().flatMap((store) => scoped(store.id).projects());

  const userProjects = () =>
    app.data.projects.filter(
      (project) =>
        (!userStore || project.store === userStore) &&
        app.can(project.id, "users", "view"),
    );

  const userEditable = (user) =>
    userProjects().some(
      (project) =>
        (user.grants[project.id] || user.storeGrants?.[project.store] || user.platformRoles?.length) && scoped(project.store).canEditUser(user.id),
    );

  // 指定操作下，可管理的商店與專案
  function manageableScope(action) {
    const stores = app
      .stores("users",action);
    const projects = stores.flatMap((store) =>
      scoped(store.id).manageable(action),
    );
    return { stores, projects };
  }

  /* ==========================================================================
   * 4. 提示訊息與儲存
   * ======================================================================== */
  document.body.classList.add("system-admin");
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div id="sys-feedback" role="status" hidden></div>',
  );

  function toast(message) {
    const el = document.querySelector("#sys-feedback");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 6500);
  }

  function persist(strict = false) {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({
          data: app.data,
          currentUserId: app.identity,
          store: app.store,
        }),
      );
      persistedData = structuredClone(app.data);
    } catch {
      if (strict) { app.data = structuredClone(persistedData); throw Error("無法保存資料，請確認瀏覽器儲存空間後重試"); }
      toast("無法保存資料，請確認瀏覽器儲存空間");
    }
  }

  // 儲存 → 重新渲染 → 提示
  function saveAndRender(message) {
    persist(true);
    render();
    toast(message);
  }

  /* ==========================================================================
   * 5. 版面渲染（搜尋列、分頁、列表容器）
   * ======================================================================== */
  function render() {
    storePageId = "";
    const breadcrumb = document.querySelector(".breadcrumb");
    if (breadcrumb) delete breadcrumb.dataset.storeName;
    app.normalize();
    main.innerHTML = `<section id="sys-content" aria-label="${title}"></section>`;
    const el = main.querySelector("#sys-content");
    document.querySelector('aside a[href="payments.html"]').hidden =
      !app.canPlatform("payments") && !app.canPlatform("fees");

    if (route === "payments" && !app.canPlatform("payments") && !app.canPlatform("fees")) {
      el.innerHTML =
        '<div class="sys-empty"><h2>無存取權限</h2><p>需要平台支付工具或費率檢視權限。</p></div>';
      return;
    }
    if (!app.stores().length) {
      el.innerHTML =
        '<div class="sys-empty"><h2>尚無商店授權</h2><p>目前帳號沒有可存取的商店與專案。</p></div>';
      return;
    }

    LIST_RENDERERS[route](el);
    // 把分頁器移到列表工具列最前面
    el.querySelector(`.sys-${route}-list-toolbar`).prepend(
      el.querySelector(".sys-pager"),
    );
  }

  // --- 搜尋列 ---
  const searchField = (id, label, control) =>
    `<div class="sys-users-search-field"><label for="${id}">${label}</label>${control}</div>`;

  const keywordField = (id, placeholder, ariaLabel = "") =>
    searchField(
      id,
      "關鍵字",
      `<input id="${id}"${ariaLabel ? ` aria-label="${ariaLabel}"` : ""} name="search" placeholder="${placeholder}" value="${esc(search)}">`,
    );

  const searchForm = (name, fields, resetAction, create) =>
    `<form id="sys-search" class="filter sys-${name}-search">${fields}<div class="sys-users-search-actions"><button type="submit" class="btn primary">搜尋</button>${button("清除", resetAction)}</div></form><div class="sys-${name}-list-toolbar">${create}</div>`;

  const TOOLBARS = {
    stores: (create) =>
      searchForm(
        "stores",
        searchField(
          "sys-store",
          "商店",
          `<select id="sys-store">${options([["", "全部商店"], ...storeOptions()], storeFilter)}</select>`,
        ) + keywordField("sys-stores-search", "請輸入商店名稱"),
        "reset-stores-search",
        create,
      ),

    payments: (create) =>
      searchForm(
        "payments",
        searchField(
          "sys-payment-platform",
          "第三方金流平台",
          `<select id="sys-payment-platform" name="platform">${options(
            [["", "全部"], ...PLATFORMS.map((name) => [name, name])],
            paymentPlatform,
          )}</select>`,
        ) + keywordField("sys-payments-search", "請輸入支付工具"),
        "reset-payments-search",
        create,
      ),

    projects: (create) =>
      searchForm(
        "projects",
        searchField(
          "sys-project-store",
          "商店",
          `<select id="sys-project-store">${options([["", "全部商店"], ...storeOptions()], projectStore)}</select>`,
        ) + keywordField("sys-project-search", "請輸入專案或商店名稱"),
        "reset-project-search",
        create,
      ),

    roles: (create) => {
      const storeItems = [["", "全部商店（授權範圍）"], ...storeOptions()];
      return searchForm(
        "roles",
        searchField(
          "sys-role-store",
          "商店",
          `<select id="sys-role-store">${options(storeItems, roleStore)}</select>`,
        ) + keywordField("sys-role-name", "請輸入角色名稱", "角色名稱搜尋"),
        "reset-role-search",
        create,
      );
    },

    users: (create) =>
      searchForm(
        "users",
        searchField(
          "sys-store",
          "商店",
          `<select id="sys-store">${options([["", "全部"], ...storeOptions()], userStore)}</select>`,
        ) +
          searchField(
            "sys-user-project",
            "專案",
            `<select id="sys-user-project" aria-label="專案搜尋">${options(
              [
                ["", "全部"],
                ...userProjects().map((project) => [project.id, project.name]),
              ],
              userProject,
            )}</select>`,
          ) +
          keywordField(
            "sys-user-search",
            "請輸入姓名或 Email 帳號",
            "姓名或登入帳號",
          ),
        "reset-user-search",
        create,
      ),
  };
  const toolbar = (create = "") => TOOLBARS[route](create);

  // --- 搜尋與分頁 ---
  function matches(text) {
    return String(text).toLowerCase().includes(search.trim().toLowerCase());
  }

  function paged(rows) {
    page = Math.min(page, Math.max(1, Math.ceil(rows.length / size)));
    return rows.slice((page - 1) * size, page * size);
  }

  function pager(count) {
    const pages = Math.max(1, Math.ceil(count / size));
    const sizeOptions = options(
      [
        ["2", "2項/頁"],
        ["10", "10項/頁"],
        ["50", "50項/頁"],
      ],
      String(size),
    );
    return `<div class="pager sys-pager"><span>共 ${count} 項</span><select id="sys-size" aria-label="每頁筆數">${sizeOptions}</select>${button("上一頁", "prev", page === 1 ? "disabled" : "")}<span>第 ${page} / ${pages} 頁</span>${button("下一頁", "next", page === pages ? "disabled" : "")}</div>`;
  }

  // 搜尋列 + 分頁器 + 表格
  function renderList(el, { create, list, head, row, cls }) {
    const rows = paged(list);
    el.innerHTML =
      toolbar(create) +
      pager(list.length) +
      table(head, rows.map(row).join(""), cls);
  }

  const unavailableCreate = () =>
    button("新增", "unavailable", UNAVAILABLE, "success");

  /* ==========================================================================
   * 6. 角色管理
   * ======================================================================== */
  function roles(el) {
    const list = app.data.roles.filter(
      (role) =>
        (!roleStore || role.store === roleStore) &&
        (app.isSystem || app.stores("roles").some(s => role.store === s.id)) &&
        (!role.project || app.can(role.project,"roles","view")) && matches(role.name),
    );
    const canCreate = app.isSystem || app.stores("roles","create").length > 0;

    renderList(el, {
      create: canCreate
        ? button("新增", "new-role", "", "success")
        : "<span>無角色新增權限</span>",
      list,
      head: ["編號", "角色名稱", "商店", "狀態", "功能"],
      row: (role, index) => {
        let canEdit = false;
        try { app.assertRoleEditable(role); canEdit = true; } catch { /* show read-only */ }
        const scopeLabel = role.project ? `${storeName(role.store)}／指定專案：${projectById(role.project)?.name}` : role.store ? storeName(role.store) : "舊角色未指定商店，請編輯修正";
        return `<tr><td>${(page - 1) * size + index + 1}</td><td>${esc(role.name)}</td><td>${esc(scopeLabel)}</td><td>${role.enabled === false ? "不啟用" : "啟用"}</td><td>${canEdit ? button("編輯", "edit-role", `data-id="${role.id}"`, "primary") : "唯讀；可建立獨立角色"}</td></tr>`;
      },
    });
  }

  function roleEditor(id) {
    const role = app.role(id);
    const scope = enteredStore;

    if (role) { try { app.assertRoleEditable(role); } catch(error) { return toast(error.message); } }

    const storeList = app.stores("roles", id ? "edit" : "create");

    window.openRoleModal({
      role,
      stores: storeList,
      defaultStore: scope,
      projects: app.data.projects.filter(p => app.can(p.id,"roles",id ? "edit" : "create")),
      actions,
      labels,
      allowed: (store, feature, action, project) =>
        app.roleActionAllowed(store, feature, action, project),
      save: (input) => {
        try { app.saveRole(input); }
        catch (error) {
          if (role && role.store !== input.store && app.roleTargets(role).length)
            throw Error("變更商店會影響既有授權，請保留原角色並另建角色。");
          throw error;
        }
        saveAndRender("角色設定已儲存");
      },
    });
  }

  // 同步「群組全選」checkbox 的狀態
  function groups() {
    main.querySelectorAll("[data-group]").forEach((group) => {
      const checks = [
        ...main.querySelectorAll(`[data-permission="${group.dataset.group}"]`),
      ];
      group.checked = checks.every((c) => c.checked);
      group.indeterminate = checks.some((c) => c.checked) && !group.checked;
    });
  }

  /* ==========================================================================
   * 7. 使用者管理
   * ======================================================================== */
  const grantLines = (projectIds, pick) =>
    projectIds
      .map((id) => `<div class="sys-user-grant-line">${esc(pick(id))}</div>`)
      .join("");

  function users(el) {
    const visible = userProjects()
      .filter((project) => !userProject || project.id === userProject)
      .map((project) => project.id);
    const list = app.data.users.filter(
      (user) =>
        !user.system &&
        (visible.some((project) => user.grants[project] || user.storeGrants?.[projectById(project)?.store] || user.platformRoles?.length) || Object.keys(user.storeGrants || {}).some(store => (!userStore || store === userStore) && app.canStore(store,"users","view"))) &&
        matches(user.name + " " + user.login + " " + (user.email || "")),
    );

    renderList(el, {
      create: app.stores("users","create").length
        ? button("新增", "new-user", "", "success")
        : "<span>未授予新增使用者權限</span>",
      list,
      head: ["姓名", "Email 帳號", "商店", "專案", "角色", "狀態"],
      row: (u) => {
        const granted = visible.filter((project) => u.grants[project] || u.storeGrants?.[projectById(project)?.store] || u.platformRoles?.length);
        const nameCell = userEditable(u) || Object.keys(u.storeGrants || {}).some(s => (!userStore || s === userStore) && app.canStore(s,"users","edit"))
          ? `<a href="#" data-action="edit-user" data-id="${esc(u.id)}">${esc(u.name)}</a>`
          : esc(u.name);
        const emptyStores = Object.keys(u.storeGrants || {}).filter(s => (!userStore || s === userStore) && app.canStore(s,"users","view") && !app.data.projects.some(p => p.store === s));
        return `<tr><td>${nameCell}</td><td>${esc(u.email || u.login)}</td><td>${grantLines(granted, (id) => storeName(projectById(id)?.store))}${emptyStores.map(s => esc(storeName(s))).join("、")}</td><td>${grantLines(granted, (id) => `${projectById(id)?.name}（${u.platformRoles?.length ? "全域授權" : u.storeGrants?.[projectById(id)?.store] ? "整店授權" : "指定專案"}）`)}${emptyStores.length ? "整店授權（目前無專案）" : ""}</td><td>${grantLines(granted, (id) => app.rolesAt(u,"project",id).map(r => r.name).join("、"))}${emptyStores.map(s => esc(app.role(u.storeGrants[s])?.name)).join("、")}</td><td>${u.enabled === false ? "不啟用" : "啟用"}</td></tr>`;
      },
    });
  }

  // --- 舊版整頁式編輯器（目前僅「加入既有帳號」使用）---
  const userModeSwitch = (mode) =>
    `<div class="sys-modes" role="group" aria-label="新增模式">${button("建立新帳號", "user-mode", `data-mode="new" aria-pressed="${mode === "new"}"`, mode === "new" ? "primary" : "plain")}${button("加入既有帳號", "user-mode", `data-mode="existing" aria-pressed="${mode === "existing"}"`, mode === "existing" ? "primary" : "plain")}</div>`;

  function userAccountFields(mode, edit, current) {
    if (mode === "existing") {
      const control = app.isSystem
        ? `<label>選擇既有帳號<select name="existing-id" required><option value="">請選擇</option>${options(app.data.users.filter(u => !u.system).map((u) => [u.id, `${u.name}（${u.login}）`]))}</select></label>`
        : '<label>既有登入帳號<input name="existing-login" required placeholder="輸入登入帳號"></label>';
      return `<div class="sys-form-fields">${control}</div>`;
    }
    const attr = edit ? "readonly" : "required";
    return `<div class="sys-form-fields"><label>姓名<input name="name" value="${esc(current?.name || "")}" ${attr}></label><label>登入帳號<input name="login" value="${esc(current?.login || "")}" ${attr}></label></div>`;
  }

  function userGrantRow(project, current, assignable) {
    const prior = app.role(current?.grants[project.id]);
    const lock =
      !app.isSystem &&
      (prior && !assignable.some((r) => r.id === prior.id));
    const roleCell = lock
      ? `<span>保留：${esc(prior.name)}<br>無此範圍的角色授予權限</span>`
      : `<select name="role-${project.id}" aria-label="${esc(project.name)}角色" ${prior ? "" : "disabled"}>${options(
          assignable.map((r) => [r.id, r.name]),
          prior?.id || assignable[0]?.id,
        )}</select>`;
    return `<tr><td><input type="checkbox" name="grant" value="${project.id}" aria-label="選擇${esc(project.name)}" ${prior && !lock ? "checked" : ""} ${lock ? "disabled" : ""}></td><td>${esc(project.name)}</td><td>${roleCell}</td></tr>`;
  }

  function userEditor(id, mode = id ? "edit" : "new", targetStore = userStore) {
    const edit = mode === "edit";
    const current = app.data.users.find((u) => u.id === id);
    if (edit && !app.canEditUser(id))
      return toast("沒有此使用者的編輯權限");

    const context = scoped(targetStore);
    const manageableProjects = targetStore ? context.manageable(edit ? "edit" : "create") : [];

    const grantTable = table(
      ["選擇", "專案名稱", "角色"],
      manageableProjects
        .map((p) => userGrantRow(p, current, context.assignableRoles(p.id)))
        .join(""),
    );

    main.querySelector("#sys-content").innerHTML =
      `<h2 tabindex="-1" class="sys-editor-title">${edit ? "編輯使用者授權" : "新增使用者"}</h2>` +
      (edit ? "" : userModeSwitch(mode)) +
      `<form id="sys-user-form" data-mode="${mode}" data-id="${esc(id || "")}">` +
      userAccountFields(mode, edit, current) +
      `<label>所屬商店<select id="existing-target-store" name="target-store" required>${options([["","請明確選擇商店"],...app.stores("users","create").map(s => [s.id,s.name])],targetStore)}</select></label>` +
      grantTable +
      `<div class="sys-form-actions"><button type="submit" class="btn primary">確定</button>${button("取消", "cancel")}</div><p class="sys-error" role="alert"></p></form>`;
    focusEditor();
  }

  // --- Modal 式新增 / 編輯 ---
  const assignableRolesOf = (store, project) => scoped(store).assignableRoles(project, store);
  const storeRolesOf = store => app.data.roles.filter(r => app.canStore(store,"users","edit") && app.canGrant(r,"store",store));
  const platformRolesOf = () => app.data.roles.filter(r => app.canPlatform("users","edit") && app.canGrant(r,"platform",""));
  const grantInput = (input, user) => {
    const grants = {}, storeGrants = {};
    let platformRoles;
    for (const g of input.revoked || []) {
      if (g.project === "__platform__") platformRoles = (platformRoles || app.roleIds(user?.platformRoles)).filter(id => id !== g.role);
      else (g.project === "__store__" ? storeGrants : grants)[g.project === "__store__" ? g.store : g.project] = null;
    }
    for (const g of input.grants.filter(g => !g.locked && !g.original)) {
      if (g.project === "__platform__") platformRoles = [...new Set([...(platformRoles || app.roleIds(user?.platformRoles)),g.role])];
      else (g.project === "__store__" ? storeGrants : grants)[g.project === "__store__" ? g.store : g.project] = g.role;
    }
    return {grants,storeGrants,...(platformRoles !== undefined ? {platformRoles} : {})};
  };

  function newUserModal() {
    const { stores, projects } = manageableScope("create");

    window.openUserCreateModal({
      stores,
      projects,
      roles: assignableRolesOf,
      storeRoles: storeRolesOf,
      platformRoles: platformRolesOf,
      roleName: id => app.role(id)?.name,
      defaultStore: userStore,
      onExisting: () => userEditor(undefined, "existing"),
      onSave: (input) => {
        const copy = cloneData();
        const created = new Management(copy,app.identity,app.store).saveUser({mode:"new",name:input.name,login:input.login,enabled:input.enabled,...grantInput(input)});
        created.email = input.login.trim();
        created.grantBatches = input.grantBatches || [];
        app.data.users = copy.users;
        saveAndRender("使用者授權已儲存");
      },
    });
  }

  function editUserModal(id) {
    const user = app.data.users.find((u) => u.id === id);

    // 先切換到使用者所屬、且有權編輯的商店
    const contextProject = userProjects().find(
      (project) =>
        user?.grants[project.id] && scoped(project.store).canEditUser(id),
    );

    if (!app.data.stores.some(s => scoped(s.id).canEditUser(id))) return toast("沒有此使用者的編輯權限");

    const { stores, projects } = manageableScope("edit");

    // 鎖定缺少目標管理或角色授予權的專案。
    const locked = (projectId) => {
      const prior = app.role(user.grants[projectId]);
      if (!projectById(projectId)) return true;
      const scope = scoped(projectById(projectId).store);
      return (
        !projects.some((item) => item.id === projectId) ||
        (!app.isSystem &&
          ((prior && !scope.assignableRoles(projectId).some((role) => role.id === prior.id))))
      );
    };

    window.openUserCreateModal({
      user,
      canChangeState: app.canChangeUserState(id),
      stores,
      projects,
      roles: assignableRolesOf,
      storeRoles: storeRolesOf,
      platformRoles: platformRolesOf,
      defaultStore: userStore,
      storeName,
      projectName: (projectId) => projectById(projectId)?.name,
      roleName: (roleId) => app.role(roleId)?.name,
      grants: [...Object.entries(user.grants).map(([project, role]) => ({
        project,
        role,
        original: true,
        store: projectById(project)?.store,
        locked: locked(project),
      })),...Object.entries(user.storeGrants || {}).map(([store,role]) => ({store,project:"__store__",role,original:true,locked:!app.canStore(store,"users","edit") || !app.canGrant({...app.role(role),enabled:true},"store",store)})),...app.roleIds(user.platformRoles).map(role => ({store:"__platform__",project:"__platform__",role,original:true,locked:!app.canPlatform("users","edit") || !app.canGrant({...app.role(role),enabled:true},"platform","")}))],
      onSave: (input) => {
        const copy = cloneData();
        const updated = new Management(copy,app.identity,app.store).saveUser({mode:"edit",id,enabled:input.enabled,...grantInput(input,user)});
        updated.name = input.name.trim();
        updated.grantBatches = input.grantBatches || [];
        app.data.users = copy.users;
        saveAndRender("使用者資料已儲存");
      },
    });
  }

  /* ==========================================================================
   * 8. 專案管理
   * ======================================================================== */
  function projects(el) {
    const list = accessibleProjects().filter(
      (p) =>
        app.can(p.id,"projects","view") &&
        (!projectStore || p.store === projectStore) &&
        matches(p.name + " " + storeName(p.store)),
    );

    renderList(el, {
      create: app.stores().some(s => app.canStore(s.id,"projects","create")) ? button("新增專案", "new-project", "", "success") : "",
      list,
      head: ["商店", "專案名稱", "狀態", "目前啟用支付工具", "功能"],
      cls: "project-management-table",
      row: (p) =>
        `<tr><td>${esc(storeName(p.store))}</td><td>${esc(p.name)}</td><td>${p.enabled === false ? "停用" : "啟用"}</td><td>${esc(app.paymentSettingsForProject(p.id).filter(t => t.enabled !== false).map(t => t.name).join("、"))}</td><td>${app.can(p.id,"fees","view") ? button("管理手續費", "fee-project", `data-id="${esc(p.id)}"`) : ""}${app.can(p.id,"projects","edit") ? button("編輯專案", "edit-project", `data-id="${esc(p.id)}"`) : button("檢視", "project-detail", `data-id="${p.id}"`, "gray")}</td></tr>`,
    });
  }

  function projectDetail(id) {
    const p = accessibleProjects().find((item) => item.id === id);
    if (!p) return toast("此專案未授權");

    const isAdmin = app.isSystem;
    const credit = app
      .paymentSettingsForProject(p.id)
      .find((t) => t.id === "credit-card");
    const head = [
      "專案名稱",
      "所屬商店",
      "目前身分的角色",
      ...(isAdmin ? ["國內信用卡手續費"] : []),
    ];
    const roleName = isAdmin
      ? "系統管理員"
      : esc(app.role(app.user.grants[p.id])?.name);
    const row = `<tr><td>${esc(p.name)}</td><td>${esc(storeName(p.store))}</td><td>${roleName}</td>${isAdmin ? `<td>${esc(credit.fee + credit.unit)}</td>` : ""}</tr>`;

    main.querySelector("#sys-content").innerHTML =
      `<h2 tabindex="-1" class="sys-editor-title">專案檢視：${esc(p.name)}</h2>` +
      table(head, row) +
      `<div class="sys-form-actions">${button("返回列表", "cancel")}${button("編輯", "unavailable", UNAVAILABLE)}</div>`;
    focusEditor();
  }

  function projectEditor(id = "") {
    if (!(id ? app.can(id,"projects","edit") : app.stores().some(s => app.canStore(s.id,"projects","create")))) return;
    const project = app.data.projects.find(p => p.id === id);
    const opener = document.activeElement;
    const close = () => { removeDialog("#project-profile-dialog"); opener?.focus(); };
    const dialog = createDialog("project-profile-dialog", "project-profile-title", `<h2 id="project-profile-title">${id ? "編輯專案" : "新增專案"}</h2><form class="store-profile-form"><label class="store-status-field"><span>狀態</span><input type="checkbox" data-switch name="enabled" aria-label="狀態" ${project?.enabled !== false ? "checked" : ""}></label><label><span>所屬商店 <em>*</em></span><select name="store" aria-label="所屬商店" required ${id ? "disabled" : ""}>${options([["", "請選擇所屬商店"],...app.data.stores.filter(s => id ? s.id === project?.store : app.canStore(s.id,"projects","create")).map(s=>[s.id,s.name])],project?.store || projectStore)}</select></label><label><span>專案名稱 <em>*</em></span><input name="name" aria-label="專案名稱" required value="${esc(project?.name || "")}"></label><label><span>專案 ID</span><input name="projectId" aria-label="專案 ID" value="${esc(project?.projectId ?? project?.id ?? "")}"></label><label><span>專案 Token</span><input name="token" aria-label="專案 Token" value="${esc(project?.token || "")}"></label><p class="sys-error" role="alert"></p><div class="sys-modal-actions">${button("取消","project-profile-close")}<button type="submit" class="btn primary">確定</button></div></form>`,close);
    dialog.querySelector('[data-action="project-profile-close"]').addEventListener("click",close);
    const form = dialog.querySelector("form");
    form.addEventListener("submit",event=>{
      event.preventDefault();
      try {
        commitFeeChange(()=>app.saveProject({id:id || undefined,name:form.elements.name.value,store:form.elements.store.value,projectId:form.elements.projectId.value,token:form.elements.token.value,enabled:form.elements.enabled.checked}));
        close(); render(); toast("專案已儲存");
      } catch(error) {form.querySelector(".sys-error").textContent = error.message;}
    });
    dialog.showModal();
  }

  /* ==========================================================================
   * 9. 商店管理
   * ======================================================================== */
  function stores(el) {
    const list = app
      .stores("stores")
      .filter((s) => (!storeFilter || s.id === storeFilter) && matches(s.name));

    return storesForAdmin(el, list);
  }

  function storesForAdmin(el, list) {
    renderList(el, {create: app.canPlatform("stores","create") ? button("新增商店", "new-store", "", "success") : "", list,
      head: ["商店名稱", "狀態", "目前啟用支付工具", "功能"],
      cls: "store-management-table",
      row: s => {
        const v = app.activeFeeVersion("store", s.id);
        const names = app.data.paymentTools.filter(t => v?.entries[t.id]?.enabled !== false).map(t => t.name);
        return `<tr><td>${esc(s.name)}</td><td>${s.enabled === false ? "停用" : "啟用"}</td><td class="store-tool-names">${esc(names.join("、") || "尚未設定")}</td><td>${app.canStore(s.id,"fees","view") ? button("管理手續費","fee-store",`data-id="${esc(s.id)}"`) : ""}${app.canStore(s.id,"stores","edit") ? button("編輯商店","edit-store",`data-id="${esc(s.id)}"`) : ""}</td></tr>`;
      }});
  }

  function storeEditor(id = "") {
    if (!(id ? app.canStore(id,"stores","edit") : app.canPlatform("stores","create"))) return;
    const store = app.data.stores.find(s => s.id === id);
    const opener = document.activeElement;
    const close = () => { removeDialog("#store-profile-dialog"); opener?.focus(); };
    const dialog = createDialog("store-profile-dialog", "store-profile-title", `<h2 id="store-profile-title">${id ? "編輯商店" : "新增商店"}</h2><form class="store-profile-form"><label class="store-status-field"><span>狀態</span><input type="checkbox" data-switch name="enabled" aria-label="狀態" ${store?.enabled !== false ? "checked" : ""}></label><label><span>商店名稱 <em>*</em></span><input name="name" aria-label="商店名稱" required value="${esc(store?.name || "")}"></label><label><span>商店 ID</span><input name="storeId" aria-label="商店 ID" value="${esc(store?.storeId ?? store?.id ?? "")}" placeholder="請輸入 ID"></label><label><span>商店 Token</span><input name="token" aria-label="商店 Token" value="${esc(store?.token || "")}" placeholder="請輸入 Token"></label><p class="sys-error" role="alert"></p><div class="sys-modal-actions">${button("取消","store-profile-close")}<button type="submit" class="btn primary">確定</button></div></form>`, close);
    dialog.querySelector('[data-action="store-profile-close"]').addEventListener("click",close);
    const form = dialog.querySelector("form");
    form.addEventListener("submit", e => {
      e.preventDefault();
      try {
        const name = form.elements.name.value.trim(), storeId = form.elements.storeId.value.trim();
        if (!name) throw Error("請輸入商店名稱");
        if (storeId && app.data.stores.some(s => s.id !== id && (s.storeId ?? s.id) === storeId)) throw Error("此商店 ID 已存在");
        const key = id || ("store-" + crypto.randomUUID());
        commitFeeChange(() => {
          const data = {name, storeId, token: form.elements.token.value.trim(), enabled:form.elements.enabled.checked};
          app.saveStore({id:id || undefined,...data});
        });
        close();
        if (storePageId) storeFeePage(storePageId); else render();
        toast("商店已儲存");
      } catch(error) {form.querySelector(".sys-error").textContent = error.message;}
    });
    dialog.showModal();
  }

  function storeFeePager(count) {
    const totalPages = Math.max(1, Math.ceil(count / feeSize));
    return `<div class="pager sys-pager" aria-label="手續費率分頁"><span>共 ${count} 項</span><select id="sys-size" aria-label="每頁筆數">${options([["2","2項/頁"],["10","10項/頁"],["20","20項/頁"],["50","50項/頁"]],String(feeSize))}</select>${button("上一頁","prev",feePage === 1 ? "disabled" : "")}<span>第 ${feePage} / ${totalPages} 頁</span>${button("下一頁","next",feePage === totalPages ? "disabled" : "")}</div>`;
  }

  function storeFeePage(id) {
    const scope = route === "projects" ? "project" : "store";
    if (!app.allowed(scope,id,"fees","view")) return;
    if (storePageId !== id) feePage = 1;
    storePageId = id;
    const breadcrumb = document.querySelector(".breadcrumb");
    if (breadcrumb) breadcrumb.dataset.storeName = feeTargetName(scope,id);
    const versions = app.feeVersions(scope,id), current = app.activeFeeVersion(scope,id);
    feePage = Math.max(1, Math.min(feePage, Math.ceil(versions.length / feeSize) || 1));
    const offset = (feePage - 1) * feeSize;
    const rows = versions.slice(offset,offset + feeSize).map((v,i) => {
      const attrs = `data-id="${esc(id)}" data-version="${esc(v.id)}"`;
      const start = v.effectiveAt.startsWith("1970-") ? "既有設定" : feeDate(v.effectiveAt);
      const end = v.endsAt ? feeDate(v.endsAt) : "無期限";
      const enabled = !v.cancelledAt && v.enabled !== false;
      const effectiveStatus = app.storeFeeState(id,v);
      const reason = v.cancelledAt ? "此版本已取消或被修訂" : !enabled ? "此版本已停用" : effectiveStatus === "未套用" && current ? `ID ${versions.length-versions.findIndex(n=>n.id===current.id)} 的手續費開始時間較近，目前優先套用` : "";
      return `<tr><td>${versions.length-offset-i}</td><td>${enabled ? "啟用" : "停用"}</td><td><span title="${esc(reason)}">${effectiveStatus}</span></td><td>${start}</td><td>${end}</td><td>${feeDate(v.createdAt)}</td><td>${button("編輯","store-fee-revise",attrs + (!app.allowed(scope,id,"fees","edit") || v.cancelledAt || effectiveStatus === "已結束" ? " disabled" : ""))}${button("檢視","store-fee-view",attrs)}</td></tr>`;
    }).join("");
    main.querySelector("#sys-content").innerHTML = `<div class="store-page-heading"><div>${button("返回","cancel")}<h2>${esc(feeTargetName(scope,id))}</h2></div></div><h3>手續費率</h3><div class="store-fee-heading">${storeFeePager(versions.length)}${app.allowed(scope,id,"fees","edit") ? button("新增手續費率","store-fee-new",`data-id="${esc(id)}"`,"success") : ""}</div>${!current ? `<p class="store-fee-fallback">目前${scope === "project" ? "繼承商店費率" : "套用系統費率"}</p>` : ""}${table(["ID","設定狀態","費率生效狀態","手續費開始時間","手續費結束時間","設定時間","功能"], rows || `<tr><td colspan="7" class="empty">尚無${scope === "project" ? "專案" : "商店"}費率版本</td></tr>`, "store-fee-versions-table")}`;
  }

  function storesForMember(el, list) {
    const rows = paged(list);
    const container = document.createElement("div");
    container.innerHTML = originalMain;
    const thead = container.querySelector("thead").outerHTML;

    const body =
      rows
        .map(
          (s) =>
            `<tr><td>${esc(s.name)}</td>${HIDDEN_FEE_CELLS}<td>${button("檢視", "store-detail", `data-id="${s.id}"`, "gray")}</td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="13" class="empty">無符合條件的商店</td></tr>';

    el.innerHTML =
      toolbar(unavailableCreate()) +
      pager(list.length) +
      `<div class="table-wrap store-table"><table>${thead}<tbody>${body}</tbody></table></div>`;
  }

  function storeDetail(id) {
    if (!app.stores().some((s) => s.id === id)) return toast("此商店未授權");

    const projectRows = app
      .data.projects.filter(p => p.store === id && app.can(p.id,"projects","view"))
      .map(
        (p) =>
          `<tr><td>${esc(p.name)}</td><td>${esc(storeName(p.store))}</td></tr>`,
      )
      .join("");

    main.querySelector("#sys-content").innerHTML =
      `<h2 tabindex="-1" class="sys-editor-title">商店檢視：${esc(storeName(id))}</h2>` +
      table(["專案名稱", "所屬商店"], projectRows) +
      `<div class="sys-form-actions"><a href="projects.html" class="btn primary">查看專案管理</a>${button("返回列表", "cancel")}</div>`;
    focusEditor();
  }

  /* ==========================================================================
   * 10. 支付工具設定
   * ======================================================================== */
  function paymentStatus(t) {
    if (new Date(t.version.effectiveAt) > new Date()) return "未啟用";
    return app.activeFeeVersion("global", t.id)?.id === t.version.id
      ? "啟用"
      : "已停用";
  }

  function payments(el) {
    if (!app.canPlatform("payments") && !app.canPlatform("fees")) {
      el.innerHTML = "<p>需要平台支付工具或費率檢視權限。</p>";
      return;
    }
    if (!app.canPlatform("fees","view")) {
      const list = app.data.paymentTools.filter(t => (!paymentPlatform || t.platform === paymentPlatform) && matches(t.platform+" "+t.name));
      renderList(el,{create:"",list,head:["第三方金流平台","支付工具","幣別","功能"],row:t => `<tr><td>${esc(t.platform)}</td><td>${esc(t.name)}</td><td>${esc(t.currency)}</td><td>${app.canPlatform("payments","edit") ? button("編輯工具資料","tool-metadata",`data-id="${esc(t.id)}"`) : "唯讀"}</td></tr>`});
      return;
    }

    // 每個支付工具的每個未取消版本各佔一列
    const list = app.data.paymentTools
      .filter(
        (t) =>
          (!paymentPlatform || t.platform === paymentPlatform) &&
          matches(t.platform + " " + t.name),
      )
      .flatMap((t) =>
        app
          .feeVersions("global", t.id)
          .filter((v) => !v.cancelledAt)
          .map((version) => ({ ...t, version })),
      );

    renderList(el, {
      create: app.canPlatform("payments","create") && app.canPlatform("fees","edit") ? button("新增", "new-payment", "", "success") : "",
      list,
      head: [
        "第三方金流平台",
        "支付工具",
        "手續費（含稅）",
        "幣別",
        "手續費開始時間 (GMT+8)",
        "狀態",
      ],
      cls: "payment-table",
      row: (t) => {
        const start = t.version.effectiveAt.startsWith("1970-")
          ? "既有設定"
          : feeDate(t.version.effectiveAt);
        return `<tr><td>${esc(t.platform)}</td><td><a href="#" data-action="fee-edit" data-key="${esc(t.id)}" data-version="${esc(t.version.id)}" aria-label="編輯 ${esc(t.name)}">${esc(t.name)}</a></td><td>${esc(t.version.entries[t.id].fee + t.unit)}</td><td>${esc(t.currency)}</td><td>${start}</td><td>${paymentStatus(t)}</td></tr>`;
      },
    });
  }

  const LIST_RENDERERS = { users, roles, projects, stores, payments };

  /* ==========================================================================
   * 11. Dialog 共用
   * ======================================================================== */
  function createDialog(id, labelledBy, html, onCancel) {
    const dialog = document.createElement("dialog");
    dialog.id = id;
    dialog.className = id;
    dialog.setAttribute("aria-labelledby", labelledBy);
    dialog.innerHTML = html;
    document.body.append(dialog);
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      onCancel();
    });
    return dialog;
  }

  function removeDialog(selector) {
    const dialog = document.querySelector(selector);
    if (dialog) {
      dialog.close();
      dialog.remove();
    }
  }

  const fieldLabel = (text, control) =>
    `<label><span><em>*</em> ${text}</span>${control}</label>`;

  /* ==========================================================================
   * 12. 支付工具 Dialog（新增 / 編輯）
   * ======================================================================== */
  let paymentOpener;

  function closePayment() {
    removeDialog("#sys-payment-dialog");
    paymentOpener?.focus();
  }

  const EMPTY_TOOL = {
    platform: "",
    name: "",
    code: "",
    unit: "%",
    currency: "新台幣",
    note: "",
  };

  function paymentFormHtml({ key, version, pending, tool }) {
    const platformItems = [
      ...new Set([...PLATFORMS, ...(tool.platform ? [tool.platform] : [])]),
    ].map((name) => [name, name]);

    const currencyItems = ["新台幣", tool.currency]
      .filter((x, i, a) => a.indexOf(x) === i)
      .map((x) => [x, x]);

    const effectiveField = `<label><span><em>*</em> 手續費開始時間 (GMT+8)</span><div><input name="effectiveAt" aria-label="手續費開始時間 (GMT+8)" type="datetime-local" step="1" ${!key ? "required" : ""} value="${version ? feeDate(version.effectiveAt).replace(" ", "T") : ""}">${!key ? "" : `<small>${pending ? "留空立即生效；填入未來時間可排程生效。" : "此費率已開始使用，不可變更手續費率、計價單位、幣別及開始時間；請新增相同支付工具的費率。"}</small>`}</div></label>`;

    const fields = [
      fieldLabel(
        "第三方金流平台",
        `<select name="platform" aria-label="第三方金流平台" required><option value="" disabled ${tool.platform ? "" : "selected"}>請選擇第三方金流平台</option>${options(platformItems, tool.platform)}</select>`,
      ),
      fieldLabel(
        "支付工具名稱",
        `<input name="name" value="${esc(tool.name)}" required>`,
      ),
      `<label class="sys-code-field"><span><em>*</em> 付款方式代碼</span><div><p id="sys-code-help">代碼請參照 API 文件的交易類別，例如 CREDIT、LINEPAY 等</p><input name="code" aria-label="付款方式代碼" aria-describedby="sys-code-help" value="${esc(tool.code || "")}" required></div></label>`,
      fieldLabel(
        "手續費",
        `<div class="sys-payment-fee"><input name="rate" type="number" min="0" step="any" required value="${esc(key ? version.entries[key].fee : "")}"><select name="unit" aria-label="計價單位" >${options(
          [
            ["%", "%"],
            ["元", "元"],
          ],
          tool.unit,
        )}</select></div>`,
      ),
      fieldLabel(
        "幣別",
        `<select name="currency" required>${options(currencyItems, tool.currency)}</select>`,
      ),
      effectiveField,
      `<label><span>備註</span><input name="note" value="${esc(tool.note || "")}"></label>`,
    ].join("\n      ");

    return `<div class="sys-modal-header"><h2 id="sys-payment-title">${key ? "編輯支付工具" : "新增支付工具"}</h2><button type="button" class="sys-modal-close" data-action="close-payment" aria-label="關閉"><img src="assets/x.svg" alt=""></button></div>
    <form id="sys-payment-form" data-key="${esc(key || "")}" data-source-time="${esc(version?.effectiveAt || "")}" data-source-version="${esc(version?.id || "")}" data-version="${pending ? esc(version.id) : ""}">
      <div class="sys-payment-fields">
      ${fields}
      </div>
      <p class="sys-error" role="alert"></p>
      <div class="sys-modal-actions">${button("取消", "close-payment")}<button type="submit" class="btn primary">確定</button></div>
    </form>`;
  }

  function feeEditor(key, versionId = "") {
    if (!(key ? app.canPlatform("payments","edit") || app.canPlatform("fees","edit") : app.canPlatform("payments","create") && app.canPlatform("fees","edit")))
      return toast("沒有平台支付工具或費率編輯權限");

    const version =
      key &&
      ((app.canPlatform("fees","view") ? app.feeVersions("global", key) : []).find((v) => v.id === versionId) ||
        app.activeFeeVersion("global", key));
    const pending =
      version &&
      !version.cancelledAt &&
      new Date(version.effectiveAt) > new Date();
    const tool = app.data.paymentTools.find((t) => t.id === key) || EMPTY_TOOL;

    paymentOpener = document.activeElement;
    const dialog = createDialog(
      "sys-payment-dialog",
      "sys-payment-title",
      paymentFormHtml({ key, version, pending, tool }),
      closePayment,
    );
    if (key && !app.canPlatform("fees","edit")) {
      const form = dialog.querySelector("form");
      form.dataset.metadataOnly = "true";
      for (const name of ["rate","effectiveAt"]) {
        const input = form.elements[name];
        if (input) { input.required = false; input.disabled = true; input.closest("label").hidden = true; }
      }
    }
    if (key && !app.canPlatform("payments","edit")) {
      for (const name of ["platform","name","code","currency","note"]) dialog.querySelector("form").elements[name].disabled = true;
    }
    if (version && new Date(version.effectiveAt) < new Date()) {
      for (const name of ["rate", "unit", "currency", "effectiveAt"])
        dialog.querySelector("form").elements[name].disabled = true;
    }
    dialog.showModal();
  }

  /* ==========================================================================
   * 13. 費率版本（共用邏輯）
   * ======================================================================== */
  // 寫入資料並保存；失敗時還原整份資料
  function commitFeeChange(change) {
    const previous = structuredClone(app.data);
    try {
      const result = change();
      persist(true);
      return result;
    } catch (error) {
      app.data = previous;
      throw error;
    }
  }

  const isFuture = (version) => new Date(version.effectiveAt) > new Date();

  function nextFeeVersion(scope, target) {
    return app
      .feeVersions(scope, target)
      .filter((v) => !v.cancelledAt && isFuture(v))
      .reverse()[0];
  }

  // 查詢「上層」費率與「本層」費率時使用的參數
  const parentFeeOptions = (scope, target) =>
    scope === "project" ? { storeId: projectById(target).store } : {};
  const ownFeeOptions = (scope, target) =>
    scope === "store"
      ? { storeId: target }
      : scope === "project"
        ? { projectId: target }
        : {};

  function feeTargetName(scope, target) {
    if (scope === "global")
      return app.data.paymentTools.find((t) => t.id === target).name;
    const source = scope === "store" ? app.data.stores : app.data.projects;
    return source.find((item) => item.id === target).name;
  }

  /* ==========================================================================
   * 14. 費率排程 Dialog
   * ======================================================================== */
  let feeOpener;
  let storeFeeTarget = "";
  let storePageId = "";
  let feePage = 1;
  let feeSize = 10;

  function closeFeeSchedule() {
    removeDialog("#fee-schedule-dialog");
    if (storeFeeTarget) {const id = storeFeeTarget; storeFeeTarget = ""; storeFeePage(id);}
    else feeOpener?.focus();
  }

  // --- 14-1. HTML 區塊 ---
  function feeHeaderHtml(ctx) {
    const { scope, readonly, name, upperLabel, target } = ctx;
    const context =
      scope === "global"
        ? "全站所有商店的預設費率；商店可自訂，專案預設繼承商店。"
        : `所有支付工具以整組版本生效。選擇繼承的工具會隨${upperLabel}費率連動，自訂值則保持不變。新增支付工具自動繼承。`;
    const metaButton =
      scope === "global" && !readonly && app.canPlatform("payments","edit")
        ? `<div class="fee-tool-meta">${button("編輯工具資料", "fee-metadata", `data-id="${esc(target)}"`)}</div>`
        : "";

    return `<div class="sys-modal-header"><h2 id="fee-schedule-title">${readonly ? "費率版本明細" : "費率設定"}：${esc(name)}</h2>${button("關閉", "fee-close")}</div>
      <p class="fee-context">${context}</p><p class="fee-context">時間皆為台北時間（UTC+8），以付款成功時間決定費率，歷史交易不重新計費。</p>
      ${metaButton}`;
  }

  function feeEffectiveFieldsHtml({ readonly, editing, selected }) {
    const dateValue = selected
      ? feeDate(selected.effectiveAt).replace(" ", "T")
      : "";
    const fixed = readonly || editing;
    return `<div class="fee-effective-fields"><label><span>${readonly ? "版本生效時間" : "生效方式"}</span><select name="timing" aria-label="生效方式" ${readonly ? "disabled" : ""}>${options(
      [
        ["scheduled", "指定時間生效"],
        ["now", "儲存後立即生效"],
      ],
      fixed ? "scheduled" : "now",
    )}</select></label>
      <label><span>生效時間（台北時間）</span><input name="effectiveAt" aria-label="生效時間（台北時間）" type="datetime-local" step="1" value="${fixed ? esc(dateValue) : ""}" ${readonly || !editing ? "disabled" : "required"}></label></div>`;
  }

  function feeToolRowHtml(ctx, t) {
    const { scope, target, readonly, selected, upperLabel } = ctx;
    const isGlobal = scope === "global";
    const entry = selected?.entries[t.id] || {
      mode: isGlobal ? "custom" : "inherit",
      fee: app.resolveFee(t.id).fee,
    };
    const upper = isGlobal
      ? null
      : app.resolveFee(t.id, parentFeeOptions(scope, target));

    const modeCell = isGlobal
      ? "全站預設"
      : `<select name="mode-${esc(t.id)}" aria-label="${esc(t.name)}設定方式" ${readonly ? "disabled" : ""}>${options(
          [
            ["inherit", `繼承${upperLabel}`],
            ["custom", "自訂"],
          ],
          entry.mode,
        )}</select>`;

    const isCustom = entry.mode === "custom";
    const maxAttr = t.unit === "%" ? 'max="100"' : "";

    return `<tr><td>${esc(t.name)}<div class="fee-platform">${esc(t.platform)} · ${esc(t.currency)}</div></td>
          ${scope === "store" ? `<td><input type="checkbox" name="enabled-${esc(t.id)}" aria-label="${esc(t.name)}啟用" ${entry.enabled !== false ? "checked" : ""} ${readonly ? "disabled" : ""}></td>` : ""}<td>${modeCell}</td>
          <td><span id="fee-upper-${esc(t.id)}">${feeText(upper || app.resolveFee(t.id))}</span></td>
          <td><div class="fee-value"><input name="fee-${esc(t.id)}" aria-label="${esc(t.name)}自訂費率" type="number" min="0" ${maxAttr} step="0.000001" value="${esc(isCustom ? entry.fee : "")}" ${readonly || !isCustom ? "disabled" : "required"}><span>${esc(t.unit)}</span></div></td>
          <td><span id="fee-preview-${esc(t.id)}"></span><div id="fee-source-${esc(t.id)}" class="fee-platform"></div></td></tr>`;
  }

  function feeSettingsTableHtml(ctx) {
    return table(
      [
        "支付工具",
        ...(ctx.scope === "store" ? ["啟用"] : []),
        "設定方式",
        ctx.scope === "global" ? "目前費率" : "上層費率",
        "自訂費率",
        "預計套用費率",
      ],
      ctx.tools.map((t) => feeToolRowHtml(ctx, t)).join(""),
      "fee-settings-table",
    );
  }

  function feeActionsHtml({ readonly, scope, target }) {
    const back = button(
      readonly ? "返回設定" : "取消",
      readonly ? "fee-back" : "fee-close",
      `data-scope="${scope}" data-id="${esc(target)}"`,
    );
    const submit = readonly
      ? ""
      : '<button type="submit" class="btn primary">儲存費率版本</button>';
    return `<div class="sys-modal-actions">${back}${submit}</div>`;
  }

  function versionStatus(v, current) {
    if (v.cancelledAt) return v.replacedBy ? "已修訂" : "已取消";
    if (isFuture(v)) return "待生效";
    return current?.id === v.id ? "目前生效" : "歷史版本";
  }

  function feeHistoryRowHtml(ctx, v) {
    const { versions, current } = ctx;
    const future = isFuture(v);
    const next = versions
      .filter(
        (n) =>
          !n.cancelledAt && new Date(n.effectiveAt) > new Date(v.effectiveAt),
      )
      .sort((a, b) => new Date(a.effectiveAt) - new Date(b.effectiveAt))[0];
    const period = v.effectiveAt.startsWith("1970-")
      ? "既有設定"
      : feeDate(v.effectiveAt);
    const until = v.cancelledAt
      ? ""
      : `<div class="fee-platform">至 ${next ? feeDate(next.effectiveAt) + " 前" : "下次變更"}</div>`;
    const cancelledNote = v.cancelledAt
      ? `<div class="fee-platform">${esc(v.cancelledBy)}於 ${feeDate(v.cancelledAt)} ${v.replacedBy ? "修訂" : "取消"}</div>`
      : "";
    const versionAttr = `data-version="${esc(v.id)}"`;
    const pendingButtons =
      future && !v.cancelledAt
        ? button("修改", "fee-revise", versionAttr) +
          button("取消排程", "fee-cancel-ask", versionAttr)
        : "";

    return `<tr><td>${period}${until}</td><td>${versionStatus(v, current)}</td><td>${esc(v.createdBy)}<div class="fee-platform">${feeDate(v.createdAt)}</div>${cancelledNote}</td><td>${button("檢視", "fee-view", versionAttr)}${pendingButtons}</td></tr>`;
  }

  function feeHistoryHtml(ctx) {
    return `<section class="fee-history"><h3>排程與歷程</h3><p>已生效版本不可修改。待生效版本可修改或取消；取消後會沿用前一個有效版本。</p>
      ${table(
        ["生效期間（台北時間）", "狀態", "設定人／設定時間", "功能"],
        ctx.versions.map((v) => feeHistoryRowHtml(ctx, v)).join(""),
        "fee-history-table",
      )}
      <div id="fee-cancel-confirm" aria-live="polite"></div></section>`;
  }

  function feeScheduleHtml(ctx) {
    const { scope, target, editing, versionId } = ctx;
    return `${feeHeaderHtml(ctx)}
      <form id="fee-schedule-form" data-scope="${scope}" data-target="${esc(target)}" data-version="${editing ? esc(versionId) : ""}">
      ${feeEffectiveFieldsHtml(ctx)}
      ${feeSettingsTableHtml(ctx)}
      <p id="fee-change-summary" class="fee-change-summary" aria-live="polite"></p>
      <p class="sys-error" role="alert"></p>
      ${feeActionsHtml(ctx)}</form>
      ${feeHistoryHtml(ctx)}`;
  }

  // --- 14-2. 即時預覽 ---
  function updateFeePreview(ctx, dialog, form) {
    const { scope, target, readonly, editing, selected, tools, upperLabel } =
      ctx;
    const scheduled = form.elements.timing.value === "scheduled";
    if (!readonly) {
      form.elements.effectiveAt.disabled = !scheduled;
      form.elements.effectiveAt.required = scheduled;
    }

    const value = scheduled && form.elements.effectiveAt.value;
    const at = readonly
      ? new Date(selected.effectiveAt)
      : value
        ? new Date(value + "+08:00")
        : new Date();
    const active = app.activeFeeVersion(scope, target, at);
    const setText = (selector, text) => {
      dialog.querySelector(selector).textContent = text;
    };

    const changes = [];
    for (const t of tools) {
      const mode =
        scope === "global" ? "custom" : form.elements[`mode-${t.id}`].value;
      const field = form.elements[`fee-${t.id}`];
      field.disabled = readonly || mode !== "custom";
      field.required = !readonly && mode === "custom";

      const parent =
        scope === "global"
          ? null
          : app.resolveFee(t.id, { at, ...parentFeeOptions(scope, target) });
      if (parent)
        setText(
          `#fee-upper-${CSS.escape(t.id)}`,
          parent.fee === null ? "尚未生效" : parent.fee + parent.unit,
        );

      const fee = mode === "custom" ? field.value : parent?.fee;
      const prior = active?.entries[t.id] || {
        mode: scope === "global" ? "custom" : "inherit",
      };
      const changed =
        mode !== prior.mode ||
        (mode === "custom" && String(fee) !== String(prior.fee));
      if (changed) {
        const previousRate = app.resolveFee(t.id, {
          at,
          ...ownFeeOptions(scope, target),
        });
        const before =
          previousRate.fee === null ? "尚未生效" : previousRate.fee + t.unit;
        const after = fee === "" || fee === undefined ? "待填寫" : fee + t.unit;
        changes.push(
          `${t.name}：${before} → ${after}（${mode === "custom" ? "自訂" : "繼承"}）`,
        );
      }

      setText(
        `#fee-preview-${CSS.escape(t.id)}`,
        fee === null
          ? "尚未生效"
          : fee === "" || fee === undefined
            ? "請填寫費率"
            : fee + t.unit,
      );
      setText(
        `#fee-source-${CSS.escape(t.id)}`,
        mode === "custom"
          ? scope === "global"
            ? "全站預設"
            : "本層自訂"
          : `${upperLabel}繼承 · ${feeSource(parent)}`,
      );
    }

    const next = nextFeeVersion(scope, target);
    setText(
      "#fee-change-summary",
      readonly
        ? `此版本保留 ${Object.keys(selected.entries).length} 種支付工具設定；後續新增工具預設繼承。`
        : feeSummaryText({ ctx, scheduled, value, at, changes, next }),
    );
  }

  function feeSummaryText({ ctx, scheduled, value, at, changes, next }) {
    const when = scheduled ? (value ? feeDate(at) : "指定時間") : "儲存後立即";
    const effect = ctx.scope === "global" ? "生效" : "整組生效";
    const detail = changes.length ? changes.join("；") + "。" : "";
    const pendingNote =
      next && !ctx.editing
        ? `另有 ${feeDate(next.effectiveAt)} 的待生效版本，屆時會再切換設定。`
        : "";
    return `${when}${effect}，${changes.length} 種設定變更。${detail}繼承值會隨上層有效費率連動。${pendingNote}`;
  }

  // --- 14-3. 事件 ---
  function cancelConfirmHtml(ctx, version) {
    const { scope } = ctx;
    return `<p>確定取消 ${feeDate(version.effectiveAt)} 的${scope === "global" ? "" : "整組"}排程？取消後沿用前一個有效版本。</p>${button("保留排程", "fee-cancel-dismiss")}${button("確認取消排程", "fee-cancel-confirm", `data-version="${esc(version.id)}"`, "danger")}`;
  }

  function handleFeeDialogClick(ctx, dialog, form, trigger) {
    const { scope, target, versions } = ctx;
    const versionId = trigger.dataset.version;
    const confirmBox = dialog.querySelector("#fee-cancel-confirm");

    switch (trigger.dataset.action) {
      case "fee-close":
        closeFeeSchedule();
        break;
      case "fee-back":
        feeScheduleEditor(scope, target);
        break;
      case "fee-metadata":
        closeFeeSchedule();
        feeEditor(target);
        break;
      case "fee-view":
        feeScheduleEditor(scope, target, versionId, true);
        break;
      case "fee-revise":
        feeScheduleEditor(scope, target, versionId, false);
        break;
      case "fee-cancel-ask": {
        const v = versions.find((item) => item.id === versionId);
        confirmBox.innerHTML = cancelConfirmHtml(ctx, v);
        break;
      }
      case "fee-cancel-dismiss":
        confirmBox.replaceChildren();
        break;
      case "fee-cancel-confirm":
        try {
          commitFeeChange(() => app.cancelFeeVersion(scope, target, versionId));
          render();
          feeScheduleEditor(scope, target);
          toast("排程已取消");
        } catch (error) {
          form.querySelector(".sys-error").textContent = error.message;
        }
        break;
    }
  }

  function submitFeeSchedule(ctx, form) {
    const { scope, target, tools } = ctx;
    try {
      const entries = Object.fromEntries(
        tools.map((t) => [
          t.id,
          {
            mode:
              scope === "global"
                ? "custom"
                : form.elements[`mode-${t.id}`].value,
            fee: form.elements[`fee-${t.id}`].value,
            ...(scope === "store" ? {enabled: form.elements[`enabled-${t.id}`].checked} : {}),
          },
        ]),
      );
      commitFeeChange(() =>
        app.saveFeeVersion(scope, target, {
          id: form.dataset.version || undefined,
          entries,
          effectiveAt:
            form.elements.timing.value === "scheduled"
              ? form.elements.effectiveAt.value
              : undefined,
        }),
      );
      render();
      if (scope === "store") {storeFeeTarget = ""; storeFeePage(target);}
      else feeScheduleEditor(scope, target);
      toast("費率版本已儲存");
    } catch (error) {
      form.querySelector(".sys-error").textContent = error.message;
    }
  }

  function storeFeeModal(ctx) {
    const {scope, target, versionId, readonly, selected, tools} = ctx;
    const state = selected && versionId ? app.storeFeeState(target,selected) : null;
    const editing = Boolean(versionId) && !readonly && state === "待生效" && !selected.cancelledAt;
    const locked = Boolean(versionId) && !editing;
    const fixed = readonly || locked;
    const endFixed = readonly || (locked && state !== "生效中");
    const statusFixed = readonly || state === "已結束" || selected?.cancelledAt;
    storeFeeTarget = target;
    const start = fixed || editing ? selected.effectiveAt : new Date(Math.ceil((Date.now()+60000)/60000)*60000).toISOString();
    const end = selected?.endsAt || "";
    const title = readonly ? "檢視手續費率" : versionId ? "編輯手續費率" : "新增手續費率";
    const rows = tools.map(t => {
      const entry = versionId ? selected?.entries[t.id] : undefined;
      const parent = app.resolveFee(t.id);
      const fee = entry?.mode === "custom" ? entry.fee : parent.fee;
      return `<tr><td>${esc(t.name)}</td><td><input type="checkbox" data-switch name="enabled-${esc(t.id)}" aria-label="${esc(t.name)}啟用" ${(entry?.mode === "custom" ? entry.enabled !== false : parent.enabled !== false) ? "checked" : ""} ${fixed ? "disabled" : ""}></td><td><div class="fee-value"><input name="fee-${esc(t.id)}" aria-label="${esc(t.name)}手續費率" type="number" min="0" ${t.unit === "%" ? 'max="100"' : ""} step="0.000001" required value="${esc(fee ?? "")}" ${fixed ? "disabled" : ""}><span>${esc(t.unit)}</span></div></td></tr>`;
    }).join("");
    const dialog = createDialog("fee-schedule-dialog", "fee-schedule-title", `<h2 id="fee-schedule-title">${title}</h2><form id="store-fee-modal-form"><div class="sys-payment-fields store-fee-dates"><label><span>狀態</span><div><input type="checkbox" data-switch name="versionEnabled" aria-label="費率版本狀態" ${(versionId ? selected?.enabled !== false : true) ? "checked" : ""} ${statusFixed ? "disabled" : ""}></div></label><label><span><em>*</em> 手續費率開始時間</span><input name="effectiveAt" aria-label="手續費率開始時間" type="datetime-local" step="1" required value="${feeDate(start).replace(" ","T")}" ${fixed ? "disabled" : ""}></label><label><span>手續費率結束時間</span><div class="store-fee-end-controls"><input name="endsAt" aria-label="手續費率結束時間" type="datetime-local" step="1" value="${end ? feeDate(end).replace(" ","T") : ""}" ${endFixed ? "disabled" : ""}>${endFixed ? "" : button("無期限","store-fee-unlimited")}</div></label></div><div class="store-fee-settings-row"><span class="store-fee-settings-label">設定費率</span><div class="store-fee-settings-content">${table(["支付工具","啟用","手續費率"],rows,"store-fee-modal-table")}</div></div>${selected?.endChanges?.length ? `<div class="store-fee-status-history">${selected.endChanges.map(change=>`<p>結束時間：${change.from ? feeDate(change.from) : "無期限"} → ${change.to ? feeDate(change.to) : "無期限"} · ${esc(change.by)} · ${feeDate(change.at)}</p>`).join("")}</div>` : ""}${selected?.statusChanges?.length ? `<div class="store-fee-status-history">${selected.statusChanges.map(change => `<p>${change.enabled ? "啟用" : "停用"}：${esc(change.by)} · ${feeDate(change.at)}</p>`).join("")}</div>` : ""}<p class="sys-error" role="alert"></p><div class="sys-modal-actions">${readonly ? "" : button("取消","fee-close")}<button type="${readonly ? "button" : "submit"}" ${readonly ? 'data-action="fee-close"' : ""} class="btn primary">確定</button></div></form>`, closeFeeSchedule);
    const form = dialog.querySelector("form");
    dialog.querySelector('[data-action="store-fee-unlimited"]')?.addEventListener("click", () => {
      form.elements.endsAt.value = "2999-12-31T23:59:59";
      form.elements.endsAt.dispatchEvent(new Event("input", {bubbles:true}));
      form.elements.endsAt.dispatchEvent(new Event("change", {bubbles:true}));
    });
    const syncToolFeeDisabled = () => {
      for (const tool of tools) {
        form.elements[`fee-${tool.id}`].disabled = fixed || !form.elements[`enabled-${tool.id}`].checked;
      }
    };
    syncToolFeeDisabled();
    form.addEventListener("change", syncToolFeeDisabled);
    form.addEventListener("submit", e => {
      e.preventDefault();
      if (readonly) return;
      const save = () => {
        try {
          if (locked) commitFeeChange(() => app.updateStoreFeeControls(target,versionId,{enabled:form.elements.versionEnabled.checked,...(state === "生效中" ? {endsAt:form.elements.endsAt.value || null} : {})},new Date(),scope));
          else {
            const entries = Object.fromEntries(tools.map(t => [t.id,{mode:"custom",fee:form.elements[`fee-${t.id}`].value,enabled:form.elements[`enabled-${t.id}`].checked}]));
            commitFeeChange(() => app.saveFeeVersion(scope,target,{id:editing ? versionId : undefined, enabled:form.elements.versionEnabled.checked, effectiveAt:form.elements.effectiveAt.value, endsAt:form.elements.endsAt.value || undefined, entries}));
          }
          if (!versionId) feePage = 1;
          closeFeeSchedule(); toast("費率版本已儲存");
        } catch(error) {form.querySelector(".sys-error").textContent = error.message;}
      };
      if (selected && app.activeFeeVersion(scope,target)?.id === selected.id && !form.elements.versionEnabled.checked) {
        const closeConfirm = () => removeDialog("#fee-disable-confirm");
        const confirm = createDialog("fee-disable-confirm","fee-disable-title",`<h2 id="fee-disable-title">停用手續費率</h2><p>停用後將套用其他已啟用且在生效期間內、開始時間最近的版本；若無符合版本，則${scope === "project" ? "繼承商店費率" : "套用系統費率"}。是否確定？</p><div class="sys-modal-actions"><button type="button" class="btn" data-disable-cancel>取消</button><button type="button" class="btn primary" data-disable-confirm>確定</button></div>`,closeConfirm);
        confirm.querySelector("[data-disable-cancel]").addEventListener("click",closeConfirm);
        confirm.querySelector("[data-disable-confirm]").addEventListener("click",()=>{closeConfirm();save();});
        confirm.showModal();
      } else save();
    });
    dialog.showModal();
  }

  // --- 14-4. 進入點 ---
  function feeScheduleEditor(scope, target, versionId = "", readonly = false) {
    try {
      if (readonly) { if (!(scope === "global" ? app.canPlatform("fees","view") : app.allowed(scope,target,"fees","view"))) throw Error("沒有目標範圍的費率檢視權限"); } else app.assertFeeScope(scope, target);
    } catch (error) {
      return toast(error.message);
    }

    // 已開啟時直接換內容，保留最初的 focus 來源
    const previous = document.querySelector("#fee-schedule-dialog");
    if (previous) {
      previous.close();
      previous.remove();
    } else feeOpener = document.activeElement;

    const versions = app.feeVersions(scope, target);
    const current = app.activeFeeVersion(scope, target);
    const ctx = {
      scope,
      target,
      versionId,
      readonly,
      editing: Boolean(versionId) && !readonly,
      versions,
      current,
      selected: versionId ? versions.find((v) => v.id === versionId) : current,
      name: feeTargetName(scope, target),
      tools:
        scope === "global"
          ? app.data.paymentTools.filter((t) => t.id === target)
          : app.data.paymentTools,
      upperLabel: scope === "project" ? "商店" : "全站",
    };

    if (scope !== "global") return storeFeeModal(ctx);
    const dialog = createDialog(
      "fee-schedule-dialog",
      "fee-schedule-title",
      feeScheduleHtml(ctx),
      closeFeeSchedule,
    );
    const form = dialog.querySelector("form");
    const preview = () => updateFeePreview(ctx, dialog, form);

    dialog.addEventListener("input", preview);
    dialog.addEventListener("change", preview);
    dialog.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-action]");
      if (trigger) handleFeeDialogClick(ctx, dialog, form, trigger);
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!readonly) submitFeeSchedule(ctx, form);
    });

    preview();
    dialog.showModal();
  }

  /* ==========================================================================
   * 15. 事件：change
   * ======================================================================== */
  const validStoreOrEmpty = (value) =>
    app.stores().some((store) => store.id === value) ? value : "";

  function resetListState() {
    search = "";
    page = 1;
  }

  const CHANGE_HANDLERS = {
    "existing-target-store": t => userEditor(undefined,"existing",t.value),
    "sys-store": (t) => {
      if (route === "stores") {
        storeFilter = validStoreOrEmpty(t.value);
        page = 1;
        render();
        return;
      }
      if (route === "users") {
        userStore = validStoreOrEmpty(t.value);
        userProject = "";
      }
      resetListState();
      render();
    },

    "sys-user-project": (t) => {
      userProject = userProjects().some((project) => project.id === t.value)
        ? t.value
        : "";
      page = 1;
      render();
    },

    "sys-role-store": (t) => {
      roleStore = validStoreOrEmpty(t.value);
      resetListState();
      render();
    },

    "sys-project-store": (t) => {
      projectStore = validStoreOrEmpty(t.value);
      page = 1;
      render();
    },

    "sys-size": (t) => {
      if (storePageId) {
        feeSize = Number(t.value);
        feePage = 1;
        storeFeePage(storePageId);
        return;
      }
      size = Number(t.value);
      page = 1;
      render();
    },
  };

  document.addEventListener("change", (e) => {
    const t = e.target;
    CHANGE_HANDLERS[t.id]?.(t);

    // 權限群組全選
    if (t.dataset.group) {
      main
        .querySelectorAll(`[data-permission="${t.dataset.group}"]`)
        .forEach((c) => (c.checked = t.checked));
      groups();
    }
    if (t.dataset.permission) groups();

    // 勾選專案時啟用對應的角色下拉
    if (t.name === "grant") {
      const select = main.querySelector(`[name="role-${t.value}"]`);
      if (select) select.disabled = !t.checked;
    }
  });

  /* ==========================================================================
   * 16. 事件：click
   * ======================================================================== */
  const CLICK_ACTIONS = {
    // 清除搜尋
    "reset-user-search": () => {
      search = "";
      userStore = defaultFilter(app.store);
      userProject = "";
      page = 1;
      render();
    },
    "reset-project-search": () => {
      search = "";
      projectStore = defaultFilter(enteredStore);
      page = 1;
      render();
    },
    "reset-stores-search": () => {
      search = "";
      storeFilter = defaultFilter(enteredStore);
      page = 1;
      render();
    },
    "reset-payments-search": () => {
      search = "";
      paymentPlatform = "";
      page = 1;
      render();
    },
    "reset-role-search": () => {
      search = "";
      roleStore = defaultFilter(app.store);
      page = 1;
      render();
    },

    // 角色 / 使用者
    "new-role": () => roleEditor(),
    "edit-role": (b) => roleEditor(b.dataset.id),
    "new-user": () => newUserModal(),
    "edit-user": (b) => editUserModal(b.dataset.id),
    "user-mode": (b) => userEditor(undefined, b.dataset.mode),

    // 商店 / 專案
    "store-detail": (b) => storeDetail(b.dataset.id),
    "project-detail": (b) => projectDetail(b.dataset.id),
    "new-project": () => projectEditor(),
    "edit-project": b => projectEditor(b.dataset.id),
    "fee-store": b => storeFeePage(b.dataset.id),
    "new-store": () => storeEditor(),
    "edit-store": b => storeEditor(b.dataset.id),
    "store-fee-view": b => feeScheduleEditor(route === "projects" ? "project" : "store",b.dataset.id,b.dataset.version,true),
    "fee-back": () => closeFeeSchedule(),
    "store-fee-new": b => feeScheduleEditor(route === "projects" ? "project" : "store",b.dataset.id),
    "store-fee-revise": b => feeScheduleEditor(route === "projects" ? "project" : "store",b.dataset.id,b.dataset.version),
    "store-fee-cancel": b => {try {commitFeeChange(()=>app.cancelFeeVersion("store",b.dataset.id,b.dataset.version));storeFeePage(b.dataset.id);toast("排程已取消");} catch(error) {toast(error.message);}},
    "fee-close": () => closeFeeSchedule(),
    "fee-project": (b) => storeFeePage(b.dataset.id),

    // 支付工具
    "fee-edit": (b, e) => {
      e.preventDefault();
      if (app.canPlatform("fees","edit") && !app.canPlatform("payments","edit")) feeScheduleEditor("global",b.dataset.key);
      else if (app.canPlatform("payments","edit")) feeEditor(b.dataset.key, b.dataset.version);
      else if (app.canPlatform("fees","view")) feeScheduleEditor("global",b.dataset.key,b.dataset.version,true);
    },
    "new-payment": () => feeEditor(),
    "tool-metadata": b => feeEditor(b.dataset.id),
    "close-payment": () => closePayment(),
    "payment-history": (b) => {
      closePayment();
      feeScheduleEditor("global", b.dataset.key);
    },

    // 通用
    cancel: () => render(),
    prev: () => {
      if (storePageId) {feePage = Math.max(1,feePage-1);storeFeePage(storePageId);return;}
      page = Math.max(1, page - 1);
      render();
    },
    next: () => {
      if (storePageId) {feePage++;storeFeePage(storePageId);return;}
      page++;
      render();
    },
  };

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (b) CLICK_ACTIONS[b.dataset.action]?.(b, e);
  });

  /* ==========================================================================
   * 17. 事件：submit
   * ======================================================================== */
  const SUBMIT_HANDLERS = {
    "sys-search": (form, data) => {
      search = data.get("search") || "";
      if (route === "payments") paymentPlatform = data.get("platform") || "";
      page = 1;
      render();
    },

    "sys-role-form": (form, data) => {
      const permissions = Object.fromEntries(
        Object.entries(actions).map(([feature, list]) => [
          feature,
          list.filter((action) => data.has(feature + ":" + action)),
        ]),
      );
      app.saveRole({
        id: form.dataset.id,
        name: data.get("name"),
        store: data.get("scope"),
        permissions,
      });
      saveAndRender("角色設定已儲存");
    },

    "sys-user-form": (form, data) => {
      const grants = Object.fromEntries(
        data.getAll("grant").map((p) => [p, data.get("role-" + p)]),
      );
      scoped(data.get("target-store")).saveUser({
        mode: form.dataset.mode,
        id:
          form.dataset.mode === "existing"
            ? data.get("existing-id")
            : form.dataset.id,
        existingLogin: data.get("existing-login"),
        name: data.get("name") || "",
        login: data.get("login") || "",
        grants,
      });
      saveAndRender("使用者授權已儲存");
    },

    "sys-payment-form": (form, data) => {
      const key = form.dataset.key;
      commitFeeChange(() =>
        app.savePaymentTool({
          id: key,
          metadataOnly: form.dataset.metadataOnly === "true",
          platform: data.get("platform"),
          name: data.get("name"),
          code: data.get("code"),
          fee: form.elements.rate.value,
          unit: form.elements.unit.value,
          effectiveAt: form.dataset.sourceTime && form.elements.effectiveAt.value === form.elements.effectiveAt.defaultValue
            ? form.dataset.sourceTime : form.elements.effectiveAt.value || undefined,
          versionId: form.dataset.version || undefined,
          sourceVersionId: form.dataset.sourceVersion || undefined,
          currency: form.elements.currency.value,
          note: data.get("note"),
        }),
      );
      closePayment();
      render();
      main.querySelector(`[data-action=fee-edit][data-key="${key}"]`)?.focus();
      if (!key) main.querySelector("[data-action=new-payment]")?.focus();
      toast("支付工具設定已儲存");
    },

    "sys-fee-form": (form, data) => {
      app.setFee(form.dataset.key, data.get("rate"));
      saveAndRender("手續費設定已儲存");
    },
  };

  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (!form.id.startsWith("sys-")) return;
    e.preventDefault();
    try {
      SUBMIT_HANDLERS[form.id]?.(form, new FormData(form));
    } catch (err) {
      const error = form.querySelector(".sys-error");
      if (error) error.textContent = err.message;
      else toast(err.message);
    }
  });

  function focusEditor() {
    main.querySelector(".sys-editor-title")?.focus();
  }

  /* ==========================================================================
   * 18. 啟動
   * ======================================================================== */
  render();
  if (route === "stores" && new URLSearchParams(location.search).get("store") === "fee-demo") storeFeePage("fee-demo");
  if (storageIssue) toast("無法讀取已儲存資料");
  if (!storageIssue && app.active) persist();

  // 排程費率到時間自動生效 → 重新渲染
  const activeFeeVersionIds = () =>
    app.data.feeVersions
      .filter((v) => !v.cancelledAt && v.enabled !== false && new Date(v.effectiveAt) <= new Date() && (!v.endsAt || new Date(v.endsAt) > new Date()))
      .map((v) => v.id)
      .join();

  let feeState = activeFeeVersionIds();
  setInterval(() => {
    const state = activeFeeVersionIds();
    if (state === feeState) return;
    feeState = state;
    if (storeFeeTarget) return;
    if (storePageId) {storeFeePage(storePageId); return;}
    render();
    document
      .querySelector("#fee-schedule-form")
      ?.dispatchEvent(new Event("input", { bubbles: true }));
  }, 1000);
})();
