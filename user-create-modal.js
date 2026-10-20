/**
 * 開啟「新增 / 編輯使用者」視窗。
 *
 * config 參數：
 *   user            編輯時傳入的使用者；新增時不傳
 *   grants          既有授權  [{ store, project, role, locked? }]
 *   stores          商店清單  [{ id, name }]
 *   projects        專案清單  [{ id, name, store }]
 *   roles(storeId)  回傳該商店可用的角色  [{ id, name }]
 *   storeName / projectName / roleName   （選用）自訂授權列表的顯示名稱
 *   onSave(data)    按「確定」時呼叫；若丟出錯誤，訊息會顯示在視窗內
 */
(() => {
  // ───────────────────────── 常數 ─────────────────────────
  const ALL = "*"; // 「全部商店」「全部專案」使用的特殊值

  const ERROR_MESSAGES = {
    NO_TARGET: "沒有可授權的專案或此角色不適用於所選商店。",
    ROLE_CONFLICT: "範圍內已有不同角色的授權，請先移除原授權。",
    ALL_ADDED: "所選專案已全部加入。",
  };

  // ───────────────────────── 視窗 HTML ─────────────────────────
  const createModalMarkup = (editing) =>
    `
    <div class="user-create-heading">
      <h2 id="user-create-title">${editing ? "編輯使用者" : "新增使用者"}</h2>
      <button type="button" class="user-create-close" aria-label="關閉使用者視窗">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m3 3 10 10M13 3 3 13"/></svg>
      </button>
    </div>
    <form id="user-create-form" novalidate>
      <div class="user-create-fields">

        <div class="user-create-row">
          <span>狀態</span>
          <div class="user-enabled">
            <button type="button" class="user-status-switch" role="switch" aria-label="使用者狀態" aria-checked="true"></button>
          </div>
        </div>

        <div class="user-create-row">
          <label for="user-create-name">姓名</label>
          <input id="user-create-name" name="name" placeholder="請輸入姓名" required>
        </div>

        <div class="user-create-row">
          <label for="user-create-email">Email 帳號</label>
          <input id="user-create-email" name="login" type="email" placeholder="請輸入 Email 帳號" required>
        </div>

        <div class="user-create-row user-grants-row">
          <span>管理專案</span>
          <div>
            <div class="user-grant-list"></div>
            <div class="user-grant-draft">
              <select aria-label="商店"><option value="">請選擇商店</option></select>
              <select aria-label="專案" disabled><option value="">請選擇專案</option></select>
              <select aria-label="角色" disabled><option value="">請選擇角色</option></select>
              <button type="button" class="user-grant-add success" aria-label="加入授權" disabled>新增</button>
            </div>
          </div>
        </div>

        <p class="user-create-error" role="alert" hidden></p>
      </div>

      <div class="user-create-actions">
        <button type="button" class="btn plain user-create-cancel">取消</button>
        <button type="submit" class="btn primary user-create-save">確定</button>
      </div>
    </form>
  `.replace(/\n\s*/g, "");

  const generateBatchId = () =>
    "batch-" + Date.now() + "-" + Math.random().toString(36).slice(2);

  // ───────────────────────── 主函式 ─────────────────────────
  window.openUserCreateModal = (config) => {
    // 一次只保留一個視窗
    document.querySelector(".user-create-modal")?.remove();

    const editing = !!config.user;
    const dialog = document.createElement("dialog");
    dialog.className = "user-create-modal";
    dialog.setAttribute("aria-labelledby", "user-create-title");
    dialog.innerHTML = createModalMarkup(editing);
    document.body.append(dialog);

    // ── 取得視窗內的元素 ──
    const form = dialog.querySelector("form");
    const [storeSelect, projectSelect, roleSelect] = dialog.querySelectorAll(
      ".user-grant-draft select",
    );
    const addButton = dialog.querySelector(".user-grant-add");
    const saveButton = dialog.querySelector(".user-create-save");
    const errorBox = dialog.querySelector(".user-create-error");
    const grantList = dialog.querySelector(".user-grant-list");
    const statusSwitch = dialog.querySelector("[role=switch]");

    // ── 狀態：目前已加入的授權（複製一份，避免改到外部傳入的資料） ──
    let grants = (config.grants || []).map((grant) => ({ ...grant }));

    const showError = (message) => {
      errorBox.hidden = false;
      errorBox.textContent = message;
    };

    const hideError = () => {
      errorBox.hidden = true;
    };

    // ───────────── 授權範圍計算 ─────────────

    /** 目前所選商店底下的專案（選「全部商店」則為所有專案） */
    const getCandidateProjects = () =>
      config.projects.filter(
        (item) => storeSelect.value === ALL || item.store === storeSelect.value,
      );

    /** 可選的角色：必須在候選專案所屬的「每一間」商店都存在 */
    const getAvailableRoles = () => {
      const storeIds = [
        ...new Set(getCandidateProjects().map((item) => item.store)),
      ];
      if (!storeIds.length) return [];

      return config
        .roles(storeIds[0])
        .filter((candidate) =>
          storeIds.every((id) =>
            config.roles(id).some((item) => item.id === candidate.id),
          ),
        );
    };

    // ───────────── 授權列表的顯示文字 ─────────────

    const getStoreLabel = (grant) =>
      grant.batchStore === ALL
        ? "全部商店"
        : config.storeName?.(grant.store) ||
          config.stores.find((item) => item.id === grant.store)?.name;

    const getProjectLabel = (grant, groupSize) =>
      grant.batchId
        ? `全部專案（${groupSize}）`
        : config.projectName?.(grant.project) ||
          config.projects.find((item) => item.id === grant.project)?.name;

    const getRoleLabel = (grant) =>
      config.roleName?.(grant.role) ||
      config.roles(grant.store).find((item) => item.id === grant.role)?.name;

    // ───────────── 畫面更新 ─────────────

    /** 依目前內容啟用 / 停用「加入授權」與「確定」按鈕 */
    const updateButtonStates = () => {
      addButton.disabled =
        !storeSelect.value || !projectSelect.value || !roleSelect.value;
      saveButton.disabled = false;
      [storeSelect, projectSelect, roleSelect].forEach((select, index) => {
        const labels = ["商店", "專案", "角色"];
        select.dataset.validationError = !grants.length && !select.value
          ? `請選擇${labels[index]}` : "";
      });
      if (!grants.length && storeSelect.value && projectSelect.value && roleSelect.value)
        projectSelect.dataset.validationError = "請按＋將所選專案加入管理專案";
    };

    /** 重設下拉選單的選項；沒有選項時停用該選單 */
    const fillSelect = (select, placeholder, items) => {
      select.replaceChildren(new Option(placeholder, ""));
      items.forEach((item) => select.add(new Option(item.name, item.id)));
      select.disabled = !items.length;
    };

    /** 把授權分組：同一批次（全部專案）合成一列，其餘各自一列 */
    const groupGrants = () => {
      const groups = new Map();
      grants.forEach((grant) => {
        const key = grant.batchId || grant.project;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(grant);
      });
      return [...groups.values()];
    };

    const createGrantRow = (items) => {
      const grant = items[0];
      const row = document.createElement("div");
      row.className = "user-grant-saved";

      [
        ["商店", getStoreLabel(grant), grant.batchStore || grant.store],
        ["專案", getProjectLabel(grant, items.length), grant.project],
        ["角色", getRoleLabel(grant), grant.role],
      ].forEach(([field, label, value]) => {
        const select = document.createElement("select");
        select.setAttribute("aria-label", `已加入${field}`);
        select.add(new Option(label, value || ""));
        select.disabled = true;
        row.append(select);
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "user-grant-remove danger";
      removeButton.textContent = "移除";
      removeButton.setAttribute("aria-label", "移除授權");
      removeButton.disabled = items.some((item) => item.locked); // 鎖定的授權不能移除
      removeButton.addEventListener("click", () => {
        grants = grants.filter((item) => !items.includes(item));
        renderGrants();
      });
      row.append(removeButton);

      return row;
    };

    const renderGrants = () => {
      grantList.replaceChildren();
      groupGrants().forEach((items) => grantList.append(createGrantRow(items)));
      updateButtonStates();
    };

    // ───────────── 加入授權 ─────────────

    const addGrant = () => {
      if (addButton.disabled) return;

      const roleId = roleSelect.value;
      const targets = getCandidateProjects().filter(
        (item) => projectSelect.value === ALL || item.id === projectSelect.value,
      );

      // 沒有可授權的專案，或角色不適用於所選商店
      if (
        !targets.length ||
        !getAvailableRoles().some((item) => item.id === roleId)
      ) {
        showError(ERROR_MESSAGES.NO_TARGET);
        return;
      }

      // 範圍內已有「不同角色」的授權
      const hasRoleConflict = targets.some((target) =>
        grants.some(
          (grant) => grant.project === target.id && grant.role !== roleId,
        ),
      );
      if (hasRoleConflict) {
        showError(ERROR_MESSAGES.ROLE_CONFLICT);
        return;
      }

      // 排除已經加入過的專案
      const newTargets = targets.filter(
        (target) => !grants.some((grant) => grant.project === target.id),
      );
      if (!newTargets.length) {
        showError(ERROR_MESSAGES.ALL_ADDED);
        return;
      }

      // 選「全部專案」時，這批授權共用一個 batchId，之後顯示成一列
      const batchId = projectSelect.value === ALL ? generateBatchId() : undefined;

      newTargets.forEach((target) =>
        grants.push({
          store: target.store,
          project: target.id,
          role: roleId,
          ...(batchId ? { batchId, batchStore: storeSelect.value } : {}),
        }),
      );

      projectSelect.value = "";
      roleSelect.value = "";
      hideError();
      renderGrants();
    };

    // ───────────── 儲存 ─────────────

    /** 把帶有 batchId 的授權還原成批次資料，供外部儲存 */
    const buildGrantBatches = () => {
      const batchIds = [
        ...new Set(
          grants.filter((grant) => grant.batchId).map((grant) => grant.batchId),
        ),
      ];

      return batchIds.map((id) => {
        const items = grants.filter((grant) => grant.batchId === id);
        return {
          id,
          store: items[0].batchStore,
          role: items[0].role,
          projects: items.map((grant) => grant.project),
        };
      });
    };

    const closeDialog = () => dialog.close();

    const handleSubmit = (event) => {
      event.preventDefault();
      form.dataset.validationSubmitted = "true";
      updateButtonStates();
      if (!form.checkValidity() || !grants.length) return;

      try {
        const rolesByProject = new Map();
        for (const grant of grants) {
          const key = JSON.stringify([grant.store, grant.project]);
          if (rolesByProject.has(key) && rolesByProject.get(key) !== grant.role) {
            roleSelect.dataset.validationError = "同一商店的同一專案只能設定一個角色權限";
            return;
          }
          rolesByProject.set(key, grant.role);
        }
        config.onSave({
          name: form.elements.name.value.trim(),
          login: form.elements.login.value.trim(),
          enabled: statusSwitch.getAttribute("aria-checked") === "true",
          grants,
          grantBatches: buildGrantBatches(),
        });
        closeDialog();
      } catch (err) {
        showError(err.message);
      }
    };

    // ───────────── 初始化 ─────────────

    // 商店下拉選單
    storeSelect.add(new Option("全部商店", ALL));
    config.stores.forEach((item) =>
      storeSelect.add(new Option(item.name, item.id)),
    );

    // 編輯時：把「全部專案」授權標記回原本的批次
    // （只有當批次內的專案與角色都還完整存在時才標記）
    (config.user?.grantBatches || []).forEach((batch) => {
      const matching = grants.filter(
        (grant) =>
          batch.projects.includes(grant.project) && grant.role === batch.role,
      );
      if (matching.length === batch.projects.length) {
        matching.forEach((grant) =>
          Object.assign(grant, { batchId: batch.id, batchStore: batch.store }),
        );
      }
    });

    // 編輯時：帶入既有資料，帳號不可修改
    if (editing) {
      form.elements.name.value = config.user.name;
      form.elements.login.type = "text";
      form.elements.login.value = config.user.email || config.user.login;
      form.elements.login.readOnly = true;
    }

    // 狀態開關：預設啟用，除非使用者明確為停用
    statusSwitch.setAttribute(
      "aria-checked",
      String(config.user?.enabled !== false),
    );

    // ───────────── 事件綁定 ─────────────

    statusSwitch.addEventListener("click", () =>
      statusSwitch.setAttribute(
        "aria-checked",
        String(statusSwitch.getAttribute("aria-checked") !== "true"),
      ),
    );

    // 選了商店 → 更新專案與角色的選項
    storeSelect.addEventListener("change", () => {
      fillSelect(projectSelect, "請選擇專案", [
        { id: ALL, name: "全部專案" },
        ...getCandidateProjects(),
      ]);
      fillSelect(roleSelect, "請選擇角色", getAvailableRoles());
      updateButtonStates();
    });
    projectSelect.addEventListener("change", updateButtonStates);
    roleSelect.addEventListener("change", updateButtonStates);
    form.addEventListener("input", updateButtonStates);

    addButton.addEventListener("click", addGrant);

    dialog
      .querySelector(".user-create-close")
      .addEventListener("click", closeDialog);
    dialog
      .querySelector(".user-create-cancel")
      .addEventListener("click", closeDialog);
    dialog.addEventListener("close", () =>
      document.body.classList.remove("user-create-open"),
    );

    form.addEventListener("submit", handleSubmit);

    // ───────────── 顯示 ─────────────
    renderGrants();
    dialog.showModal();
    document.body.classList.add("user-create-open");
  };
})();
