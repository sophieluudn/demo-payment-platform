(() => {
  // ───────────────────────── 1. 常數與 Helper 函式 ─────────────────────────
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
    }).format(new Date());

  const normalizeDate = (val) =>
    val.replace("T", " ") + (val.length === 16 ? ":00" : "");

  const canDeleteRow = (row) => {
    const startVal = row.cells[6].textContent.trim().replace("T", " ");
    return !!startVal && startVal > formatNow();
  };

  // ───────────────────────── 2. Local/Session Storage 管理 ─────────────────────────
  const loadStorage = (key, fallback) => {
    try {
      return JSON.parse(sessionStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  };

  const saveStorage = (key, value) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  let products = loadStorage("payment-demo-products", []);
  let edits = loadStorage("payment-demo-product-edits", {});
  let deleted = loadStorage("payment-demo-product-deleted", []);

  // ───────────────────────── 3. DOM 節點初始化 ─────────────────────────
  const trigger = document.querySelector("main > .btn.success");
  const tbody = document.querySelector(".product-table tbody");
  const pager = document.querySelector(".pager");

  const listToolbar = document.createElement("div");
  listToolbar.className = "product-list-toolbar";
  trigger.before(listToolbar);
  listToolbar.append(pager, trigger);

  const initialCount = Number(
    pager.firstChild.textContent.match(/\d+/)?.[0] || tbody.rows.length
  );

  // ───────────────────────── 4. Tooltip & Delete Modal 建立 ─────────────────────────
  const setupPriceTooltip = (container) => {
    const origInfo = container.querySelector(".product-price-info");
    if (!origInfo) return () => {};

    const infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.className = "product-price-info";
    infoBtn.setAttribute("aria-label", "付款金額限制說明");
    infoBtn.setAttribute("aria-expanded", "false");
    infoBtn.setAttribute("aria-controls", "product-price-tooltip");
    infoBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="7" fill="currentColor"/><path d="M7.5 6 6.4 10M7.9 3.8h.01" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round"/></svg>`;

    const wrapper = document.createElement("div");
    wrapper.className = "product-price-info-wrapper";

    const tooltip = document.createElement("div");
    tooltip.id = "product-price-tooltip";
    tooltip.className = "product-price-tooltip";
    tooltip.hidden = true;
    tooltip.innerHTML = `
      1. 超商代收款金額最高新台幣 2 萬元<br>
      2. WebATM、ATM轉帳，單筆交易上限 49,999 元<br>
      3. 信用卡交易，單筆交易上限 199,999 元<br>
      4. 金額為 0，代表為不定額交易<br>
      5. 若課稅別為應稅，則交易金額為含稅價
    `;

    wrapper.append(infoBtn, tooltip);
    origInfo.replaceWith(wrapper);

    const closeTooltip = () => {
      tooltip.hidden = true;
      infoBtn.setAttribute("aria-expanded", "false");
    };

    infoBtn.addEventListener("click", () => {
      tooltip.hidden = !tooltip.hidden;
      infoBtn.setAttribute("aria-expanded", String(!tooltip.hidden));
    });

    container.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) closeTooltip();
    });

    container.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !tooltip.hidden) {
        e.preventDefault();
        e.stopPropagation();
        closeTooltip();
      }
    });

    container.addEventListener("close", closeTooltip);
    return closeTooltip;
  };

  const createDeleteModal = () => {
    const dialog = document.createElement("dialog");
    dialog.className = "product-delete-confirm";
    dialog.setAttribute("aria-labelledby", "product-delete-question");
    dialog.innerHTML = `
      <button type="button" class="product-modal-close" aria-label="關閉刪除確認">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m3 3 10 10M13 3 3 13"/></svg>
      </button>
      <p id="product-delete-question">是否要刪除?</p>
      <div class="product-delete-actions">
        <button type="button" class="btn plain delete-cancel">取消</button>
        <button type="button" class="btn primary delete-confirm">確定</button>
      </div>
    `;
    document.body.append(dialog);
    return dialog;
  };

  // ───────────────────────── 5. 主 Modal 建立與 UI 控制 ─────────────────────────
  const createProductModal = () => {
    const dialog = document.createElement("dialog");
    dialog.className = "product-modal";
    dialog.setAttribute("aria-labelledby", "product-modal-title");
    dialog.innerHTML = `
      <div class="product-modal-heading">
        <h2 id="product-modal-title">新增商品</h2>
        <button type="button" class="product-modal-close" aria-label="關閉新增商品">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m3 3 10 10M13 3 3 13"/></svg>
        </button>
      </div>
      <form id="new-product-form" novalidate data-validation-submitted="false">
        <div class="product-form-fields">
          <div class="product-form-row"><label for="new-product-project" class="required">專案</label><select id="new-product-project" name="project" required><option value="" disabled selected>請輸入專案</option><option>行動發展部</option></select></div>
          <div class="product-form-row"><label for="new-product-name" class="required">商品名稱</label><input id="new-product-name" name="name" placeholder="請勿超過30字元" maxlength="30" required></div>
          <div class="product-form-row"><label for="new-product-description">商品簡介</label><input id="new-product-description" name="description" placeholder="請勿超過50字元" maxlength="50"></div>
          <div class="product-form-row price-row"><label for="new-product-price">價格</label><div><div class="product-price-controls"><input id="new-product-price" name="price" type="number" min="0" step="1" value="0" required><span class="product-price-info"></span></div><p class="product-price-help">金額超過收款方上限時，自動隱藏不支援的付款方式</p></div></div>
          <div class="product-form-row"><label for="new-product-start" class="required">上架開始日期</label><input id="new-product-start" name="start" type="text" placeholder="選擇上架開始日期" class="product-date" required></div>
          <div class="product-form-row"><label for="new-product-end" class="required">上架結束日期</label><div class="product-end-controls"><input id="new-product-end" name="end" type="text" placeholder="選擇上架結束日期" class="product-date" required><button type="button" class="btn gray product-unlimited" aria-pressed="false">不限</button></div></div>
          <div class="product-form-row"><span class="required product-form-label" id="product-tax-label">課稅別</span><div class="product-tax" role="radiogroup" aria-labelledby="product-tax-label"><label><input type="radio" name="tax" value="應稅" checked>應稅</label><label><input type="radio" name="tax" value="免稅">免稅</label></div></div>
          <div class="product-form-row"><label for="new-product-tag">標籤</label><select id="new-product-tag" name="tag"><option value="">選擇分類標籤</option><option>行動發展部</option></select></div>
          <div class="product-form-row"><label for="new-product-notice">注意事項</label><textarea id="new-product-notice" name="notice" placeholder="請勿超過300字元" maxlength="300" rows="1"></textarea></div>
          <div class="product-form-row"><label for="new-product-notes">備註</label><textarea id="new-product-notes" name="notes" rows="4"></textarea></div>
        </div>
        <p class="product-form-error" role="alert" hidden></p>
        <div class="product-modal-actions">
          <button type="button" class="btn plain product-cancel">取消</button>
          <button type="submit" class="btn primary product-save">確定</button>
        </div>
      </form>
    `;
    document.body.append(dialog);
    return dialog;
  };

  const dialog = createProductModal();
  const form = dialog.querySelector("form");
  const saveBtn = dialog.querySelector(".product-save");
  const errorMsg = dialog.querySelector(".product-form-error");
  const unlimitedBtn = dialog.querySelector(".product-unlimited");
  const startInput = form.elements.start;
  const endInput = form.elements.end;

  const closeTooltip = setupPriceTooltip(dialog);

  let editingProduct = null;
  let editingRow = null;

  // 驗證表單與欄位狀態
  const refreshValidation = () => {
    const invalidRange =
      startInput.value &&
      endInput.value &&
      normalizeDate(endInput.value) <= normalizeDate(startInput.value);

    endInput.setCustomValidity(invalidRange ? "上架結束日期須晚於開始日期。" : "");
    errorMsg.textContent = form.dataset.validationSubmitted === "true" && invalidRange ? "上架結束日期須晚於開始日期。" : "";
    errorMsg.hidden = !errorMsg.textContent;

    saveBtn.disabled = false;

    form.querySelectorAll("select").forEach((select) => {
      select.classList.toggle("placeholder", !select.value);
    });
  };

  [startInput, endInput].forEach((input) => {
    input.pattern = "[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}(:[0-9]{2})?";
  });

  const closeDatePicker = window.attachProductDatePicker(
    dialog,
    [startInput, endInput],
    refreshValidation
  );

  unlimitedBtn.addEventListener("click", () => {
    endInput.disabled = false;
    endInput.required = true;
    endInput.value = "2999-12-31 23:59:59";
    closeDatePicker();
    unlimitedBtn.setAttribute("aria-pressed", "true");
    refreshValidation();
  });

  form.addEventListener("input", refreshValidation);
  form.addEventListener("change", refreshValidation);
  form.addEventListener("reset", () => {
    form.dataset.validationSubmitted = "false";
    errorMsg.textContent = "";
    errorMsg.hidden = true;
  });

  const closeModal = () => dialog.close();
  dialog.querySelector(".product-modal-close").addEventListener("click", closeModal);
  dialog.querySelector(".product-cancel").addEventListener("click", closeModal);
  dialog.addEventListener("close", () =>
    document.body.classList.remove("product-modal-open")
  );

  // ───────────────────────── 6. 表格操作邏輯 (Render & CRUD) ─────────────────────────
  const updateDeleteButtonState = (row) => {
    const btn = [...row.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "刪除"
    );
    if (btn) btn.disabled = !canDeleteRow(row);
  };

  const updateProductCountUI = () => {
    pager.firstChild.textContent = `共 ${initialCount + products.length - deleted.length} 項`;
  };

  const fillRowCells = (row, product) => {
    const values = [
      product.id,
      product.name,
      product.project,
      product.tag,
      Number(product.price).toLocaleString("zh-TW"),
      product.tax,
      product.start.replace("T", " "),
      product.end.replace("T", " "),
    ];

    values.forEach((val, i) => {
      row.cells[i].textContent = val;
    });
    row.dataset.product = JSON.stringify(product);
    updateDeleteButtonState(row);
  };

  const addProductRow = (product) => {
    const row = document.createElement("tr");
    const values = [
      product.id,
      product.name,
      product.project,
      product.tag,
      Number(product.price).toLocaleString("zh-TW"),
      product.tax,
      product.start.replace("T", " "),
      product.end.replace("T", " "),
    ];

    values.forEach((val) => {
      const td = document.createElement("td");
      td.textContent = val;
      row.append(td);
    });

    const actionCell = document.createElement("td");
    actionCell.innerHTML = `
      <button data-permission-action="edit" type="button" class="btn primary">編輯</button>
      <button data-permission-action="delete" type="button" class="btn danger">刪除</button><br>
      <button type="button" class="btn gray">付款連結管理</button>
    `;
    row.append(actionCell);

    tbody.prepend(row);
    row.dataset.product = JSON.stringify(product);
    updateDeleteButtonState(row);
  };

  // 初始化列表渲染
  products.forEach(addProductRow);

  [...tbody.rows].forEach((row) => {
    const product = edits[row.cells[0].textContent.trim()];
    if (product) fillRowCells(row, product);
  });

  [...tbody.rows].forEach((row) => {
    if (deleted.includes(Number(row.cells[0].textContent))) {
      row.remove();
    } else {
      updateDeleteButtonState(row);
    }
  });

  updateProductCountUI();

  // ───────────────────────── 7. 新增與編輯事件 ─────────────────────────
  // 開啟新增視窗
  trigger.addEventListener("click", () => {
    editingProduct = null;
    editingRow = null;

    dialog.querySelector("h2").textContent = "新增商品";
    dialog.querySelector(".product-modal-close").setAttribute("aria-label", "關閉新增商品");

    form.elements.project.disabled = false;
    form.elements.price.disabled = false;
    startInput.disabled = false;

    form.reset();
    endInput.disabled = false;
    endInput.required = true;
    startInput.type = "text";
    endInput.type = "text";
    endInput.placeholder = "選擇上架結束日期";
    unlimitedBtn.setAttribute("aria-pressed", "false");

    refreshValidation();
    dialog.showModal();
    document.body.classList.add("product-modal-open");
  });

  // 點擊編輯按鈕
  tbody.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.textContent.trim() !== "編輯") return;

    const row = button.closest("tr");
    const cellTexts = [...row.cells].map((c) => c.textContent.trim());

    editingProduct = row.dataset.product
      ? JSON.parse(row.dataset.product)
      : {
          id: Number(cellTexts[0]),
          name: cellTexts[1],
          description: "",
          project: cellTexts[2],
          tag: cellTexts[3],
          price: cellTexts[4].replace(/,/g, ""),
          tax: cellTexts[5],
          start: cellTexts[6],
          end: cellTexts[7],
          notice: "",
          notes: "",
        };

    editingRow = row;
    form.reset();
    closeDatePicker();
    closeTooltip();

    ["project", "tag"].forEach((key) => {
      const select = form.elements[key];
      if (
        editingProduct[key] &&
        ![...select.options].some((opt) => opt.value === editingProduct[key])
      ) {
        select.add(new Option(editingProduct[key], editingProduct[key]));
      }
    });

    ["project", "name", "description", "price", "tag", "notice", "notes"].forEach(
      (key) => {
        form.elements[key].value = editingProduct[key] || "";
      }
    );

    form.elements.tax.value = editingProduct.tax;
    startInput.value = normalizeDate(editingProduct.start);
    endInput.value = normalizeDate(editingProduct.end);

    endInput.disabled = false;
    endInput.required = true;
    const isUnlimited = endInput.value === "2999-12-31 23:59:59";
    unlimitedBtn.setAttribute("aria-pressed", String(isUnlimited));

    const launched = startInput.value <= formatNow();
    form.elements.price.disabled = launched;
    startInput.disabled = launched;
    form.elements.project.disabled = true;

    dialog.querySelector("h2").textContent = "編輯商品";
    dialog.querySelector(".product-modal-close").setAttribute("aria-label", "關閉編輯商品");

    refreshValidation();
    dialog.showModal();
    document.body.classList.add("product-modal-open");
  });

  // 表單 Submit 處理 (新增 / 編輯)
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.dataset.validationSubmitted = "true";
    refreshValidation();
    if (!form.checkValidity()) return;

    const formData = Object.fromEntries(new FormData(form));
    formData.start = normalizeDate(startInput.value);
    formData.end = normalizeDate(endInput.value);

    if (editingProduct) {
      formData.id = editingProduct.id;
      formData.project = editingProduct.project;
      if (form.elements.price.disabled) formData.price = editingProduct.price;
      if (startInput.disabled) formData.start = editingProduct.start;

      edits[formData.id] = formData;
      const idx = products.findIndex((item) => item.id === formData.id);
      if (idx >= 0) products[idx] = formData;

      saveStorage("payment-demo-product-edits", edits);
      saveStorage("payment-demo-products", products);

      fillRowCells(editingRow, formData);
      closeModal();
      return;
    }

    // 新增商品
    formData.id =
      Math.max(
        ...[...tbody.rows].map((row) => Number(row.cells[0].textContent)),
        0
      ) + 1;

    products.push(formData);
    saveStorage("payment-demo-products", products);

    addProductRow(formData);
    updateProductCountUI();
    closeModal();
  });

  // ───────────────────────── 8. 刪除邏輯 ─────────────────────────
  const deleteModal = createDeleteModal();
  let pendingDeleteRow = null;

  tbody.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.textContent.trim() !== "刪除" || button.disabled) return;

    const row = button.closest("tr");
    if (!canDeleteRow(row)) {
      updateDeleteButtonState(row);
      return;
    }

    pendingDeleteRow = row;
    deleteModal.showModal();
    document.body.classList.add("product-modal-open");
  });

  const closeDeleteModal = () => deleteModal.close();
  deleteModal.querySelector(".delete-cancel").addEventListener("click", closeDeleteModal);
  deleteModal.querySelector(".product-modal-close").addEventListener("click", closeDeleteModal);

  deleteModal.addEventListener("close", () => {
    pendingDeleteRow = null;
    document.body.classList.remove("product-modal-open");
  });

  deleteModal.querySelector(".delete-confirm").addEventListener("click", () => {
    if (!pendingDeleteRow || !canDeleteRow(pendingDeleteRow)) {
      if (pendingDeleteRow) updateDeleteButtonState(pendingDeleteRow);
      deleteModal.close();
      return;
    }

    const id = Number(pendingDeleteRow.cells[0].textContent);
    const index = products.findIndex((p) => Number(p.id) === id);

    if (index >= 0) products.splice(index, 1);
    else if (!deleted.includes(id)) deleted.push(id);

    delete edits[id];

    saveStorage("payment-demo-products", products);
    saveStorage("payment-demo-product-deleted", deleted);
    saveStorage("payment-demo-product-edits", edits);

    pendingDeleteRow.remove();
    updateProductCountUI();
    deleteModal.close();
    trigger.focus();
  });
})();
