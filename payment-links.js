(() => {
  // ───────────────────────── 1. 常數與 Helper 函式 ─────────────────────────
  const PAYMENT_METHODS = [
    "國內信用卡一次付清",
    "Apple Pay",
    "Google Pay",
    "Line Pay",
    "ATM轉帳",
    "超商代碼繳費",
    "信用卡一次付清(國外信用卡)",
    "Apple Pay (國外卡)",
    "Google Pay (國外卡)",
  ];

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

  const generateToken = () =>
    crypto.randomUUID
      ? crypto.randomUUID().replaceAll("-", "")
      : Date.now().toString(36) + Math.random().toString(36).slice(2);

  // ───────────────────────── 2. DOM 視窗建立 ─────────────────────────
  const createModalDialog = () => {
    const dialog = document.createElement("dialog");
    dialog.className = "payment-links-modal";
    dialog.setAttribute("aria-labelledby", "payment-links-title");
    dialog.setAttribute("aria-label", "付款連結管理");
    dialog.innerHTML = `
      <div class="payment-links-heading">
        <h2 id="payment-links-title"></h2>
        <button type="button" class="payment-links-close" aria-label="關閉付款連結管理">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <path d="m3 3 10 10M13 3 3 13"/>
          </svg>
        </button>
      </div>
      <form class="payment-links-config">
        <div class="payment-links-fields">
          <div class="payment-method-field">
            <span class="payment-method-label required" id="payment-method-label">可付款方式:</span>
            <div>
              <label class="payment-checkbox">
                <input type="checkbox" class="payment-select-all">全選
              </label>
              <div class="payment-method-options" role="group" aria-labelledby="payment-method-label"></div>
            </div>
          </div>
          <div class="payment-invoice-field">
            <span>是否開立發票:</span>
            <button type="button" role="switch" aria-checked="true" aria-label="是否開立發票" class="payment-switch"></button>
          </div>
          <label class="payment-return-field">
            <span>交易結果返回頁:</span>
            <input type="url" aria-label="交易結果返回頁">
          </label>
          <p class="payment-links-error" role="alert" hidden></p>
        </div>
        <button type="submit" class="btn primary payment-link-add" aria-label="新增付款連結">+</button>
      </form>
      <div class="payment-links-table-wrap">
        <table class="payment-links-table">
          <thead>
            <tr>
              <th>編號</th>
              <th>啟用</th>
              <th>建立日期</th>
              <th>可付款方式</th>
              <th>是否開立發票</th>
              <th>付款網址</th>
              <th>交易結果返回頁</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    document.body.append(dialog);
    return dialog;
  };

  const dialog = createModalDialog();
  const form = dialog.querySelector("form");
  const optionsContainer = dialog.querySelector(".payment-method-options");
  const selectAllCheckbox = dialog.querySelector(".payment-select-all");
  const invoiceSwitch = dialog.querySelector(".payment-switch");
  const returnPageInput = dialog.querySelector("[type=url]");
  const errorAlert = dialog.querySelector(".payment-links-error");
  const tbody = dialog.querySelector("tbody");

  // 初始化付款方式選項
  PAYMENT_METHODS.forEach((method) => {
    const label = document.createElement("label");
    label.className = "payment-checkbox";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = method;
    label.append(input, document.createTextNode(method));
    optionsContainer.append(label);
  });

  const methodCheckboxes = [...optionsContainer.querySelectorAll("input")];

  // ───────────────────────── 3. State 與 Storage ─────────────────────────
  let currentProductId = null;
  let linkEntries = [];

  const loadEntries = (productId) => {
    try {
      return JSON.parse(sessionStorage.getItem(`payment-demo-links-${productId}`)) || [];
    } catch {
      return [];
    }
  };

  const persistEntries = () => {
    try {
      sessionStorage.setItem(
        `payment-demo-links-${currentProductId}`,
        JSON.stringify(linkEntries)
      );
    } catch {}
  };

  // ───────────────────────── 4. UI 渲染邏輯 ─────────────────────────
  const renderTable = () => {
    tbody.replaceChildren();

    if (!linkEntries.length) {
      const tr = tbody.insertRow();
      const td = tr.insertCell();
      td.colSpan = 7;
      td.className = "payment-links-empty";
      td.textContent = "暫無資料";
      return;
    }

    linkEntries.forEach((entry) => {
      const tr = tbody.insertRow();

      const addCellText = (val) => {
        const td = tr.insertCell();
        td.textContent = val;
        return td;
      };

      // 1. 編號
      addCellText(entry.id);

      // 2. 啟用開關
      const enabledCell = tr.insertCell();
      const switchBtn = document.createElement("button");
      switchBtn.type = "button";
      switchBtn.className = "payment-switch";
      switchBtn.setAttribute("role", "switch");
      switchBtn.setAttribute("aria-label", `啟用付款連結 ${entry.id}`);
      switchBtn.setAttribute("aria-checked", String(entry.enabled));

      switchBtn.addEventListener("click", () => {
        entry.enabled = !entry.enabled;
        switchBtn.setAttribute("aria-checked", String(entry.enabled));
        persistEntries();
      });
      enabledCell.append(switchBtn);

      // 3. 建立日期
      addCellText(entry.created);

      // 4. 付款方式 Chips
      const methodCell = tr.insertCell();
      entry.methods.forEach((m) => {
        const chip = document.createElement("span");
        chip.className = "payment-method-chip";
        chip.textContent = m;
        methodCell.append(chip);
      });

      // 5. 是否開立發票
      addCellText(entry.invoice ? "是" : "否");

      // 6. 付款網址
      const urlCell = addCellText(entry.url);
      urlCell.className = "payment-link-url";

      // 7. 交易結果返回頁
      addCellText(entry.returnPage);
    });
  };

  // ───────────────────────── 5. 表單連動與驗證 ─────────────────────────
  const toggleSwitch = (button) => {
    const isChecked = button.getAttribute("aria-checked") === "true";
    button.setAttribute("aria-checked", String(!isChecked));
  };

  invoiceSwitch.addEventListener("click", () => toggleSwitch(invoiceSwitch));

  // 全選連動
  selectAllCheckbox.addEventListener("change", () => {
    methodCheckboxes.forEach((cb) => (cb.checked = selectAllCheckbox.checked));
    selectAllCheckbox.indeterminate = false;
    errorAlert.hidden = true;
  });

  // 個別 Checkbox 連動全選狀態
  methodCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      const checkedCount = methodCheckboxes.filter((input) => input.checked).length;
      selectAllCheckbox.checked = checkedCount === methodCheckboxes.length;
      selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < methodCheckboxes.length;
      errorAlert.hidden = true;
    });
  });

  const validateAndSubmit = () => {
    const selectedMethods = methodCheckboxes
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    if (!selectedMethods.length) {
      errorAlert.textContent = "請選擇至少一種付款方式。";
      errorAlert.hidden = false;
      methodCheckboxes[0].focus();
      return false;
    }

    if (returnPageInput.value && !/^https?:\/\//i.test(returnPageInput.value)) {
      errorAlert.textContent = "交易結果返回頁請輸入 http 或 https 網址。";
      errorAlert.hidden = false;
      returnPageInput.focus();
      return false;
    }

    errorAlert.hidden = true;

    const newEntry = {
      id: Math.max(0, ...linkEntries.map((item) => item.id)) + 1,
      enabled: false,
      created: formatNow(),
      methods: selectedMethods,
      invoice: invoiceSwitch.getAttribute("aria-checked") === "true",
      returnPage: returnPageInput.value,
      url: `https://payment.example.com/pay/${currentProductId}/${generateToken()}`,
    };

    linkEntries.push(newEntry);
    persistEntries();
    renderTable();
    return true;
  };

  // ───────────────────────── 6. 事件監聽 (Event Listeners) ─────────────────────────
  // 開啟 Modal（從商品列表點擊「付款連結管理」）
  document
    .querySelector(".product-table tbody")
    ?.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || button.textContent.trim() !== "付款連結管理") return;

      const row = button.closest("tr");
      currentProductId = row.cells[0].textContent.trim();
      dialog.querySelector("h2").textContent = row.cells[1].textContent.trim();

      form.reset();
      selectAllCheckbox.indeterminate = false;
      invoiceSwitch.setAttribute("aria-checked", "true");
      errorAlert.hidden = true;

      linkEntries = loadEntries(currentProductId);
      renderTable();

      dialog.showModal();
      document.body.classList.add("payment-links-open");
    });

  // Modal 關閉控制
  const closeModal = () => dialog.close();
  dialog.querySelector(".payment-links-close").addEventListener("click", closeModal);
  dialog.addEventListener("close", () =>
    document.body.classList.remove("payment-links-open")
  );

  // 表單 Submit
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    validateAndSubmit();
  });
})();
