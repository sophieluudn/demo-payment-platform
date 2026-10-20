(() => {
  // ───────────────────────── 1. 常數與 DOM 節點 ─────────────────────────
  const TYPES = ["財務(全部)", "財務(藍新)", "財務(LINEPAY)", "BU"];
  const DEFAULT_PRODUCTS = [
    "全部商品",
    "(免稅) 不定額商品",
    "(應稅) 不定額商品",
    "高單價商品",
    "Lady M",
    "[測試] 未上架商品",
  ];

  const tbody = document.querySelector(".statement-table tbody");
  const pager = document.querySelector(".pager");
  const baselineCount = Number(pager.firstChild.textContent.match(/\d+/)[0]);
  const baselineRows = tbody.rows.length;

  // ───────────────────────── 2. 資料管理 (State) ─────────────────────────
  const normalizeDate = (value) => String(value || "").trim().replaceAll("/", "-");
  const getInitialEntries = () => {
    const chips = (cell) =>
      [...cell.querySelectorAll(".chip")].map((chip) => chip.textContent);

    return [...tbody.rows].map((row) => {
      const [start, end] = row.cells[5].textContent
        .split(" - ")
        .map(normalizeDate);

      return {
        id: Number(row.cells[0].textContent),
        name: row.cells[1].textContent,
        type: row.cells[2].textContent,
        stores: chips(row.cells[3]),
        projects: chips(row.cells[4]),
        products: ["全部商品"],
        start,
        end,
        notes: row.cells[8].textContent,
        archived: "",
      };
    });
  };

  const loadEntries = () => {
    try {
      return (
        JSON.parse(sessionStorage.getItem("payment-demo-statements")) ||
        getInitialEntries()
      );
    } catch {
      return getInitialEntries();
    }
  };

  let entries = loadEntries().map((entry) => ({
    ...entry,
    start: normalizeDate(entry.start),
    end: normalizeDate(entry.end),
  }));
  let editingEntry = null;
  let selectedChoices = {};

  const choices = {
    stores: [...new Set(entries.flatMap((entry) => entry.stores))],
    projects: [...new Set(entries.flatMap((entry) => entry.projects))],
    products: DEFAULT_PRODUCTS,
  };

  const persistEntries = () => {
    try {
      sessionStorage.setItem(
        "payment-demo-statements",
        JSON.stringify(entries),
      );
    } catch {}
  };

  // ───────────────────────── 3. Modal 視窗建立 ─────────────────────────
  const createDialog = () => {
    const dialog = document.createElement("dialog");
    dialog.className = "statement-modal";
    dialog.setAttribute("aria-labelledby", "statement-modal-title");
    dialog.innerHTML = `
      <div class="statement-modal-heading">
        <h2 id="statement-modal-title">新增對帳單</h2>
        <button type="button" class="statement-close" aria-label="關閉對帳單視窗">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <path d="m3 3 10 10M13 3 3 13"/>
          </svg>
        </button>
      </div>
      <form id="statement-form" novalidate data-validation-submitted="false">
        <div class="statement-fields">
          <div class="statement-form-row">
            <span class="statement-label required" id="statement-type-label">類型</span>
            <div class="statement-types" role="radiogroup" aria-labelledby="statement-type-label"></div>
          </div>
          <div class="statement-form-row">
            <label class="required" for="statement-name">對帳單名稱</label>
            <input id="statement-name" name="name" placeholder="請輸入對帳單名稱" required>
          </div>
          <div class="statement-form-row"><span class="statement-label required">商店</span><div data-multi="stores"></div></div>
          <div class="statement-form-row"><span class="statement-label required">專案</span><div data-multi="projects"></div></div>
          <div class="statement-form-row"><span class="statement-label required">商品</span><div data-multi="products"></div></div>
          <div class="statement-form-row">
            <span class="statement-label required">時間</span>
            <div class="statement-date-range">
              <input type="date" name="start" aria-label="開始日期" required>
              <span>至</span>
              <input type="date" name="end" aria-label="結束日期" required>
            </div>
          </div>
          <div class="statement-form-row">
            <label for="statement-notes">備註</label>
            <textarea id="statement-notes" name="notes" rows="4"></textarea>
          </div>
        </div>
        <p class="statement-error" role="alert" hidden></p>
        <div class="statement-actions">
          <button type="button" class="btn plain statement-cancel">取消</button>
          <button type="submit" class="btn primary statement-save">確定</button>
        </div>
      </form>`;
    document.body.append(dialog);

    // 填充「類型」 Radio Buttons
    const typeGroup = dialog.querySelector(".statement-types");
    TYPES.forEach((type) => {
      const label = document.createElement("label");
      label.innerHTML = `<input type="radio" name="type" value="${type}" required>${type}`;
      typeGroup.append(label);
    });

    return dialog;
  };

  const dialog = createDialog();
  const form = dialog.querySelector("form");
  const saveBtn = dialog.querySelector(".statement-save");
  const errorMsg = dialog.querySelector(".statement-error");

  // ───────────────────────── 4. UI 渲染與互動邏輯 ─────────────────────────
  const validateForm = () => {
    const { start, end } = form.elements;
    const isInvalidRange = start.value && end.value && end.value < start.value;

    end.setCustomValidity(isInvalidRange ? "結束日期不可早於開始日期。" : "");
    errorMsg.textContent = "";
    errorMsg.hidden = true;

    const hasEmptyMultiSelect = Object.keys(choices).some(
      (key) => !selectedChoices[key]?.length,
    );

    saveBtn.disabled = false;
    Object.keys(choices).forEach((key) => {
      const container = dialog.querySelector(`[data-multi="${key}"]`);
      container.querySelector(".statement-selection-error")?.remove();
      if (form.dataset.validationSubmitted === "true" && !selectedChoices[key]?.length) {
        const error = document.createElement("p");
        error.className = "statement-selection-error";
        error.setAttribute("role", "status");
        error.textContent = `請選擇${{stores:"商店", projects:"專案", products:"商品"}[key]}`;
        container.append(error);
      }
    });
    return !hasEmptyMultiSelect;
  };

  const renderMultiSelect = (key) => {
    const container = dialog.querySelector(`[data-multi="${key}"]`);
    container.replaceChildren();

    const labels = { stores: "選擇商店", projects: "選擇專案", products: "選擇商品" };
    const details = document.createElement("details");
    details.className = "statement-multi";

    const summary = document.createElement("summary");
    summary.setAttribute("aria-label", labels[key]);

    const selected = selectedChoices[key] || [];
    if (!selected.length) {
      summary.textContent = "選擇分類標籤";
      summary.classList.add("placeholder");
    } else {
      summary.innerHTML = `<span class="statement-selected">${selected[0]}</span>`;
      if (selected.length > 1) {
        summary.innerHTML += `<span class="statement-selected">+ ${selected.length - 1}</span>`;
      }
    }

    const list = document.createElement("div");
    list.className = "statement-multi-options";

    const allOptions = [...new Set([...choices[key], ...selected])];
    allOptions.forEach((value) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selected.includes(value);

      label.append(checkbox, document.createTextNode(value));
      list.append(label);

      checkbox.addEventListener("change", () => {
        selectedChoices[key] = checkbox.checked
          ? [...selectedChoices[key], value]
          : selectedChoices[key].filter((item) => item !== value);

        renderMultiSelect(key);
        container.querySelector("details").open = true;
        validateForm();
      });
    });

    details.append(summary, list);
    container.append(details);
  };

  const renderTable = () => {
    tbody.replaceChildren();

    entries.forEach((entry) => {
      const row = tbody.insertRow();
      row.dataset.id = entry.id;

      // ID, 名稱, 類型
      [entry.id, entry.name, entry.type].forEach((val) => {
        row.insertCell().textContent = val;
      });

      // 商店與專案 Chips
      [entry.stores, entry.projects].forEach((items) => {
        const cell = row.insertCell();
        items.forEach((item) => {
          const chip = document.createElement("span");
          chip.className = "chip";
          chip.textContent = item;
          cell.append(chip);
        });
      });

      // 時間範圍 (編輯連結)
      const dateCell = row.insertCell();
      const link = document.createElement("a");
      link.href = "#statement-edit";
      link.textContent = `${entry.start.replaceAll("-", "/")} - ${entry.end.replaceAll("-", "/")}`;
      dateCell.append(link);

      // 封存欄位
      const archiveCell = row.insertCell();
      archiveCell.innerHTML = entry.archived
        ? entry.archived
        : '<button type="button" class="btn plain statement-archive">封存</button>';

      // 操作欄位與備註
      row.insertCell().innerHTML = '<button type="button" class="btn primary">檢視 / 匯出</button>';
      row.insertCell().textContent = entry.notes;
    });

    pager.firstChild.textContent = `共 ${baselineCount + entries.length - baselineRows} 項`;
  };

  const openModal = (entry = null) => {
    editingEntry = entry;
    form.reset();
    form.dataset.validationSubmitted = "false";

    dialog.querySelector("h2").textContent = entry ? "編輯對帳單" : "新增對帳單";

    selectedChoices = {
      stores: [...(entry?.stores || [])],
      projects: [...(entry?.projects || [])],
      products: [...(entry?.products || [])],
    };

    Object.keys(choices).forEach(renderMultiSelect);

    ["name", "type", "start", "end", "notes"].forEach((key) => {
      form.elements[key].value = entry?.[key] || "";
    });

    const isArchived = !!entry?.archived;
    form.elements.start.disabled = isArchived;
    form.elements.end.disabled = isArchived;
    dialog
      .querySelector(".statement-date-range")
      .classList.toggle("archived", isArchived);

    validateForm();
    dialog.showModal();
    document.body.classList.add("statement-modal-open");
  };

  // ───────────────────────── 5. 事件監聽 (Event Listeners) ─────────────────────────
  const formatNow = () =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(new Date())
      .replaceAll("-", "/");

  // 表格點擊事件代理
  tbody.addEventListener("click", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;

    const entry = entries.find((item) => item.id === Number(row.dataset.id));
    if (!entry) return;

    if (event.target.closest("a")) {
      event.preventDefault();
      openModal(entry);
    } else if (event.target.closest("button")?.textContent.trim() === "檢視 / 匯出") {
      window.openStatementReport(entry);
    } else if (event.target.closest(".statement-archive")) {
      entry.archived = formatNow();
      persistEntries();
      renderTable();
    }
  });

  // 主按鈕：新增對帳單
  document
    .querySelector("main>.success")
    ?.addEventListener("click", () => openModal(null));

  // 表單驗證與送出
  form.addEventListener("input", validateForm);
  form.addEventListener("change", validateForm);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.dataset.validationSubmitted = "true";
    const hasSelections = validateForm();
    if (!form.checkValidity() || !hasSelections) return;

    const formData = Object.fromEntries(new FormData(form));
    const newEntry = {
      ...formData,
      ...selectedChoices,
      id: editingEntry?.id || Math.max(0, ...entries.map((e) => e.id)) + 1,
      archived: editingEntry?.archived || "",
    };

    if (editingEntry?.archived) {
      newEntry.start = editingEntry.start;
      newEntry.end = editingEntry.end;
    }

    if (editingEntry) {
      entries[entries.indexOf(editingEntry)] = newEntry;
    } else {
      entries.unshift(newEntry);
    }

    persistEntries();
    renderTable();
    dialog.close();
  });

  // Modal 關閉控制
  const closeModal = () => dialog.close();
  dialog.querySelector(".statement-close").addEventListener("click", closeModal);
  dialog.querySelector(".statement-cancel").addEventListener("click", closeModal);
  dialog.addEventListener("close", () =>
    document.body.classList.remove("statement-modal-open"),
  );

  // 初始化渲染
  renderTable();
})();
