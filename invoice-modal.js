/**
 * 發票明細彈窗（Invoice Modal）
 *
 * 目錄：
 *   1. 彈窗建立與開關控制
 *   2. 表格繪製 Helper
 *   3. 表格內容構建
 *   4. 事件監聽（點擊發票連結 → 開啟彈窗）
 *
 * 訂單資料欄位索引（values 陣列，依下方程式實際用途整理）：
 *   values[0]  訂單序號（用於產生 ezPay 開立序號）
 *   values[2]  品名
 *   values[7]  金額
 *   values[9]  發票日期（含日期字串）
 *   values[11] 課稅別（例如「應稅」）
 *   values[12] 發票號碼
 *   values[13] 發票狀態（例如「發票作廢成功」、「發票折讓成功」）
 */
(() => {
  // ═══════════════════════════════════════════════════════
  // 1. 彈窗建立與開關控制
  // ═══════════════════════════════════════════════════════

  /**
   * 建立彈窗 <dialog> 並加入頁面
   * @returns {HTMLDialogElement}
   */
  const createModalDialog = () => {
    const dialog = document.createElement("dialog");
    dialog.className = "invoice-modal";
    dialog.setAttribute("aria-labelledby", "invoice-modal-title");

    // 彈窗骨架：標題列（含關閉按鈕）+ 內容區（之後動態填入表格）
    dialog.innerHTML = `
      <header class="invoice-modal-header">
        <h2 id="invoice-modal-title">發票明細</h2>
        <button type="button" class="invoice-close" aria-label="關閉發票明細">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <path d="m3 3 10 10M13 3 3 13"/>
          </svg>
        </button>
      </header>
      <div class="invoice-modal-content"></div>
    `;

    document.body.append(dialog);
    return dialog;
  };

  // 建立彈窗並取得內容區節點
  const dialog = createModalDialog();
  const modalContent = dialog.querySelector(".invoice-modal-content");

  // 關閉彈窗
  const closeModal = () => dialog.close();

  // ── 關閉方式 1：點擊右上角關閉按鈕 ──
  dialog.querySelector(".invoice-close").addEventListener("click", closeModal);

  // ── 關閉方式 2：點擊彈窗外的背景遮罩 ──
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();

    // 點擊目標為 dialog 本身，且座標落在彈窗範圍之外，才視為點擊背景
    const isOutside =
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom);

    if (isOutside) closeModal();
  });

  // ── 彈窗關閉後：解除頁面捲動鎖定 ──
  dialog.addEventListener("close", () =>
    document.body.classList.remove("invoice-modal-open"),
  );

  // ═══════════════════════════════════════════════════════
  // 2. 表格繪製 Helper
  // ═══════════════════════════════════════════════════════

  /**
   * 金額格式化，例如 1234 → "NT$1,234"
   * @param {number|string} num
   * @returns {string}
   */
  const formatMoney = (num) => `NT$${Number(num).toLocaleString("zh-TW")}`;

  /**
   * 建立空白發票表格
   * @returns {HTMLTableElement}
   */
  const createTable = () => {
    const table = document.createElement("table");
    table.className = "invoice-table";
    return table;
  };

  /**
   * 在指定列新增一個儲存格
   * @param {HTMLTableRowElement} tr         目標列
   * @param {string}              text       儲存格文字
   * @param {number}              span       橫向合併欄數（colSpan）
   * @param {boolean}             isHeading  true 為 <th>（標題格），false 為 <td>
   * @returns {HTMLTableCellElement}
   */
  const createCell = (tr, text, span = 1, isHeading = false) => {
    const el = document.createElement(isHeading ? "th" : "td");

    el.textContent = text;
    el.colSpan = span;
    if (isHeading) el.scope = "row";

    tr.append(el);
    return el;
  };

  // ═══════════════════════════════════════════════════════
  // 3. 表格內容構建
  // ═══════════════════════════════════════════════════════

  /**
   * 繪製「發票主表」：賣方 / 買方 / 發票號碼與日期
   * @param {Array}  values   訂單資料陣列
   * @param {string} dateStr  發票日期（YYYY-MM-DD）
   * @returns {HTMLTableElement}
   */
  const renderSummaryTable = (values, dateStr) => {
    const summaryTable = createTable();

    // 每列為「標題, 值, 標題, 值」；只有兩格的列，值會橫跨整列
    // ※ 賣方資訊、隨機碼、時間為固定 Demo 資料
    const rowsData = [
      ["賣方營業名稱", "聯合報股份有限公司", "賣方統編", "03799802"],
      ["買受人名稱", "顧客", "買受人編號", ""],
      ["買受人地址", ""],
      ["發票號碼", values[12], "ezPay電子發票開立序號", `DEMO-${values[0]}`],
      ["發票日期", `${dateStr} 15:55:24`, "隨機碼", "6952"],
    ];

    rowsData.forEach((rowValues) => {
      const tr = summaryTable.insertRow();

      rowValues.forEach((val, idx) => {
        // 偶數位置為標題格，奇數位置為內容格
        const isHeading = idx % 2 === 0;

        // 合併欄數：兩格的列，內容格橫跨 8 欄；其餘標題格 2 欄、內容格 3 欄
        const colSpan =
          rowValues.length === 2 && idx === 1 ? 8 : isHeading ? 2 : 3;

        createCell(tr, val, colSpan, isHeading);
      });
    });

    return summaryTable;
  };

  /**
   * 繪製「品項明細表」：品項、稅額、總計、備註與折讓資訊
   * @param {Array}       values     訂單資料陣列
   * @param {number}      amount     發票金額
   * @param {number}      taxAmount  稅額
   * @param {Object|null} allowance  折讓單資訊（無折讓時為 null）
   * @returns {HTMLTableElement}
   */
  const renderItemsTable = (values, amount, taxAmount, allowance) => {
    const itemsTable = createTable();
    const taxType = values[11];
    const invoiceStatus = values[13];

    // ── 1. 表頭 ──
    let tr = itemsTable.insertRow();
    createCell(tr, "發票資訊", 6, true);

    tr = itemsTable.insertRow();
    ["品項編號", "品名", "數量", "單位", "單價", "金額"].forEach((title) =>
      createCell(tr, title, 1, true),
    );

    // ── 2. 品項列（目前固定為 1 份） ──
    tr = itemsTable.insertRow();
    [
      "1",
      values[2],
      "1",
      "份",
      formatMoney(amount),
      formatMoney(amount),
    ].forEach((val) => createCell(tr, val));

    // ── 3. 發票備註：依發票狀態決定顯示文字 ──
    const getInvoiceNote = () => {
      if (invoiceStatus === "發票作廢成功") return "已作廢 不索取";
      if (allowance || invoiceStatus === "發票折讓成功") return "已開立折讓單";
      return "已開立 不索取";
    };

    // ── 4. 稅額與總計明細 ──
    const taxDetails = [
      ["課稅別", taxType],
      ["稅率", taxType === "應稅" ? "5%" : "0%"],
      ["稅額", formatMoney(taxAmount)],
      ["銷售額", formatMoney(amount - taxAmount)],
      ["總計", formatMoney(amount)],
      ["發票備註", getInvoiceNote()],
    ];

    taxDetails.forEach(([label, val]) => {
      const row = itemsTable.insertRow();
      createCell(row, label, 1, true);
      createCell(row, val, 5);
    });

    // ── 5. 折讓資訊（僅在有折讓單時追加顯示） ──
    if (allowance) {
      const allowanceDetails = [
        ["折讓單號", allowance.number],
        ["折讓日期", allowance.date],
        ["折讓金額", formatMoney(allowance.amount)],
        ["折讓後剩餘發票金額", formatMoney(allowance.remaining)],
      ];

      allowanceDetails.forEach(([label, val]) => {
        const row = itemsTable.insertRow();
        createCell(row, label, 1, true);
        createCell(row, val, 5);
      });
    }

    return itemsTable;
  };

  // ═══════════════════════════════════════════════════════
  // 4. 事件監聽（點擊發票連結 → 開啟彈窗）
  // ═══════════════════════════════════════════════════════

  // 使用事件委派：監聽整份文件的點擊，動態產生的連結也適用
  document.addEventListener("click", (event) => {
    // ── 4-1. 判斷是否點擊發票連結 ──
    // 對象：帶有 data-invoice-order 的 <a>，或交易表格第 11 欄的連結
    const link = event.target.closest(
      "a[data-invoice-order], .transaction-table tbody td:nth-child(11) a",
    );
    if (!link) return;

    event.preventDefault();

    // ── 4-2. 讀取資料 ──
    // 訂單資料：優先取連結本身，其次取所在列（<tr>）
    const orderData =
      link.dataset.invoiceOrder || link.closest("tr")?.dataset.invoiceOrder;
    if (!orderData) return;

    const values = JSON.parse(orderData);

    // 折讓資料（選填）
    const allowance = link.dataset.invoiceAllowance
      ? JSON.parse(link.dataset.invoiceAllowance)
      : null;

    // ── 4-3. 計算金額、稅額與日期 ──
    const amount = Number(values[7]);
    const taxType = values[11];

    // 應稅：含稅金額反推稅額（÷1.05）；非應稅：稅額為 0
    const taxAmount =
      taxType === "應稅" ? Math.round(amount - amount / 1.05) : 0;

    // 擷取 YYYY-MM-DD；若取不到則使用預設日期（Demo 用）
    const invoiceDate =
      values[9]?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "2026-09-08";

    // ── 4-4. 清空並重新生成彈窗內容 ──
    modalContent.replaceChildren();

    const summaryTable = renderSummaryTable(values, invoiceDate);
    const itemsTable = renderItemsTable(values, amount, taxAmount, allowance);

    modalContent.append(summaryTable, itemsTable);

    // ── 4-5. 開啟彈窗並鎖定頁面捲動 ──
    dialog.showModal();
    document.body.classList.add("invoice-modal-open");
  });
})();
