window.openRoleModal = (config) => {
  // ───────────────────────── 1. 建立 Dialog 彈窗 ─────────────────────────
  document.querySelector(".role-modal")?.remove();

  const dialog = document.createElement("dialog");
  dialog.className = "role-modal";
  dialog.setAttribute("aria-labelledby", "role-modal-title");

  const isEditing = !!config.role?.id;
  const selection = structuredClone(config.role?.permissions || {});
  const displayActions = Object.fromEntries(Object.entries(config.actions).map(([feature, actions]) => [
    feature, actions.filter(action => action !== "edit").map(action => action === "create" ? "createEdit" : action),
  ]));
  const underlyingActions = action => action === "createEdit" ? ["create", "edit"] : [action];

  dialog.innerHTML = `
    <div class="role-modal-heading">
      <h2 id="role-modal-title">${isEditing ? "編輯角色" : "新增角色"}</h2>
      <button type="button" class="role-close" aria-label="關閉角色視窗">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d="m3 3 10 10M13 3 3 13"/>
        </svg>
      </button>
    </div>
    <form>
      <div class="role-basics">
        <div class="role-setting-row">
          <span class="role-setting-label">狀態</span>
          <div class="role-status-controls">
            <button type="button" class="role-status-switch" role="switch" aria-label="角色狀態"></button>
            <input type="checkbox" name="enabled" hidden>
          </div>
        </div>
        <label>
          <span class="role-setting-label required">商店</span>
          <select name="scope" aria-label="商店" required></select>
        </label>
        <label>
          <span class="role-setting-label">角色適用範圍</span>
          <select name="project" aria-label="角色適用範圍"></select>
        </label>
        <label>
          <span class="role-setting-label">角色名稱</span>
          <input name="name" placeholder="請輸入角色名稱" required>
        </label>
        <label class="role-note">
          <span class="role-setting-label">備註</span>
          <textarea name="note" placeholder="請輸入角色說明" rows="2"></textarea>
        </label>
        <div class="role-setting-row role-permissions-row">
          <span class="role-setting-label">功能權限</span>
          <div class="role-permission-grid">
            <p class="role-permission-help">依側邊選單設定功能權限；灰色項目表示您無法授予此權限。商店及專案的資料範圍沿用使用者授權。</p>
            <table class="role-permission-table">
              <thead>
                <tr><th>功能</th><th>操作權限</th></tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
      <p class="role-error" role="alert" hidden></p>
      <div class="role-modal-actions">
        <button type="button" class="btn plain role-cancel">取消</button>
        <button type="submit" class="btn primary">確定</button>
      </div>
    </form>
  `;

  document.body.append(dialog);

  // ───────────────────────── 2. 表單與預設值初始化 ─────────────────────────
  const form = dialog.querySelector("form");
  const storeSelect = form.elements.scope;
  const statusBtn = dialog.querySelector(".role-status-switch");
  const enabledCheckbox = form.elements.enabled;
  const errorAlert = dialog.querySelector(".role-error");

  // 填入商店選單
  storeSelect.add(new Option("請明確選擇商店或平台共用範圍", ""));
  config.stores.forEach((store) =>
    storeSelect.add(new Option(store.name, store.id || "__platform__"))
  );
  storeSelect.value = isEditing
    ? (config.role.store || "__platform__")
    : (config.defaultStore ?? config.stores[0]?.id ?? "");
  const projectSelect = form.elements.project;
  const fillProjects = () => {
    projectSelect.replaceChildren(new Option(storeSelect.value === "__platform__" ? "平台共用角色" : "商店共用角色", ""));
    (config.projects || []).filter(p => p.store === storeSelect.value).forEach(p => projectSelect.add(new Option(`指定專案：${p.name}`,p.id)));
    projectSelect.value = config.role?.project || "";
  };
  fillProjects();

  // 填入基本欄位
  form.elements.name.value = config.role?.name || "";
  form.elements.note.value = config.role?.note || "";
  enabledCheckbox.checked = config.role?.enabled !== false;

  // 綁定開關按鈕狀態
  const updateStatusSwitch = () => {
    statusBtn.setAttribute("aria-checked", String(enabledCheckbox.checked));
  };
  updateStatusSwitch();

  statusBtn.addEventListener("click", () => {
    enabledCheckbox.checked = !enabledCheckbox.checked;
    updateStatusSwitch();
  });

  // ───────────────────────── 3. 權限表格渲染邏輯 ─────────────────────────
  const renderPermissionRow = ([feature, actions]) => {
    const row = document.createElement("tr");

    // 表格標題（功能名稱）
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = config.labels[feature];

    const td = document.createElement("td");
    const container = document.createElement("div");
    container.className = "role-permission-options";
    td.append(container);
    row.append(th, td);

    // 「全選」 Checkbox
    const groupLabel = document.createElement("label");
    groupLabel.className = "role-group-toggle";
    const groupCheckbox = document.createElement("input");
    groupCheckbox.type = "checkbox";
    groupCheckbox.dataset.group = feature;
    groupCheckbox.setAttribute("aria-label", `${config.labels[feature]}整組勾選`);
    groupLabel.append(groupCheckbox, document.createTextNode("全選"));
    if (actions.length > 1) container.append(groupLabel);

    // 子項操作 Checkbox 列表
    const actionInputs = actions.map((action) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = `${feature}:${action}`;
      input.checked = underlyingActions(action).some(value => selection[feature]?.includes(value));
      input.disabled = !storeSelect.value || !underlyingActions(action).every(value => config.allowed(storeSelect.value === "__platform__" ? "" : storeSelect.value, feature, value, projectSelect.value));
      input.dataset.permission = feature;
      input.setAttribute("aria-label", config.labels[feature] + config.labels[action]);

      label.append(input, document.createTextNode(config.labels[action]));
      container.append(label);
      return input;
    });

    // 全選與子項狀態同步
    const syncGroupState = () => {
      const activeInputs = actionInputs.filter((input) => !input.disabled);
      const checkedCount = activeInputs.filter((input) => input.checked).length;

      groupCheckbox.disabled = activeInputs.length === 0;
      groupCheckbox.checked = activeInputs.length > 0 && checkedCount === activeInputs.length;
      groupCheckbox.indeterminate = checkedCount > 0 && checkedCount < activeInputs.length;
    };

    // 事件連動監聽
    const remember = () => {
      selection[feature] = actions.filter((action, index) => actionInputs[index].checked && !actionInputs[index].disabled).flatMap(underlyingActions);
      syncGroupState();
    };
    actionInputs.forEach((input) => input.addEventListener("change", remember));
    groupCheckbox.addEventListener("change", () => {
      actionInputs
        .filter((input) => !input.disabled)
        .forEach((input) => (input.checked = groupCheckbox.checked));
      remember();
    });

    syncGroupState();
    if (feature === "stores") {
      const note = document.createElement("small");
      note.className = "role-permission-help";
      note.textContent = "新增商店需平台權限；編輯需目標商店權限。費率另行授權。";
      container.append(note);
    }
    if (feature === "projects") {
      const note = document.createElement("small");
      note.className = "role-permission-help";
      note.textContent = "新增需整店專案管理權限；編輯限授權專案。費率另行授權。";
      container.append(note);
    }
    return row;
  };

  const renderPermissionsTable = () => {
    const tbody = dialog.querySelector(".role-permission-table tbody");
    tbody.replaceChildren();

    Object.entries(displayActions).forEach((entry) => {
      tbody.append(renderPermissionRow(entry));
    });
  };

  storeSelect.addEventListener("change", () => { fillProjects(); renderPermissionsTable(); });
  projectSelect.addEventListener("change", renderPermissionsTable);
  renderPermissionsTable();

  // ───────────────────────── 4. Modal 控制與事件監聽 ─────────────────────────
  const closeModal = () => dialog.close();

  dialog.querySelector(".role-close").addEventListener("click", closeModal);
  dialog.querySelector(".role-cancel").addEventListener("click", closeModal);
  dialog.addEventListener("close", () =>
    document.body.classList.remove("role-modal-open")
  );

  // 表單送出處理
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    // 收集所有選擇的權限
    const permissions = {};
    Object.entries(displayActions).forEach(([feature, actions]) => {
      permissions[feature] = actions.filter(
        (action) => form.elements[`${feature}:${action}`]?.checked && !form.elements[`${feature}:${action}`]?.disabled
      ).flatMap(underlyingActions);
    });

    try {
      config.save({
        id: config.role?.id,
        name: form.elements.name.value,
        store: storeSelect.value === "__platform__" ? "" : storeSelect.value,
        project: projectSelect.value,
        note: form.elements.note.value,
        enabled: enabledCheckbox.checked,
        permissions,
      });
      closeModal();
    } catch (err) {
      errorAlert.hidden = false;
      errorAlert.textContent = err.message;
    }
  });

  dialog.showModal();
  document.body.classList.add("role-modal-open");
};
