(() => {
  // ───────────────────────── 1. DOM 視窗與基礎 Helper ─────────────────────────
  const createModalDialog = () => {
    const dialog = document.createElement("dialog");
    dialog.className = "invoice-modal";
    dialog.setAttribute("aria-labelledby", "invoice-modal-title");
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

  const dialog = createModalDialog();
  const modalContent = dialog.querySelector(".invoice-modal-content");

  const closeModal = () => dialog.close();

  // 關閉按鈕與背景點擊監聽
  dialog.querySelector(".invoice-close").addEventListener("click", closeModal);
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    const isOutside =
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom);

    if (isOutside) closeModal();
  });

  dialog.addEventListener("close", () =>
    document.body.classList.remove("invoice-modal-open")
  );

  // ───────────────────────── 2. 表格繪製 Helper ─────────────────────────
  const formatMoney = (num) => `NT$${Number(num).toLocaleString("zh-TW")}`;

  const createTable = () => {
    const table = document.createElement("table");
    table.className = "invoice-table";
    return table;
  };

  const createCell = (tr, text, span = 1, isHeading = false) => {
    const el = document.createElement(isHeading ? "th" : "td");
    el.textContent = text;
    el.colSpan = span;
    if (isHeading) el.scope = "row";
    tr.append(el);
    return el;
  };

  // ───────────────────────── 3. 表格內容構建 ─────────────────────────
  // 繪製賣方 / 買方發票主表資訊
  const renderSummaryTable = (values, dateStr) => {
    const summaryTable = createTable();
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
        const isHeading = idx % 2 === 0;
        const colSpan = rowValues.length === 2 && idx === 1 ? 8 : isHeading ? 2 : 3;
        createCell(tr, val, colSpan, isHeading);
      });
    });

    return summaryTable;
  };

  // 繪製品項、稅額與折讓細項
  const renderItemsTable = (values, amount, taxAmount, allowance) => {
    const itemsTable = createTable();
    const taxType = values[11];
    const invoiceStatus = values[13];

    // 1. 標頭
    let tr = itemsTable.insertRow();
    createCell(tr, "發票資訊", 6, true);

    tr = itemsTable.insertRow();
    ["品項編號", "品名", "數量", "單位", "單價", "金額"].forEach((title) =>
      createCell(tr, title, 1, true)
    );

    // 2. 單品列
    tr = itemsTable.insertRow();
    ["1", values[2], "1", "份", formatMoney(amount), formatMoney(amount)].forEach(
      (val) => createCell(tr, val)
    );

    // 3. 備註狀態計算
    const getInvoiceNote = () => {
      if (invoiceStatus === "發票作廢成功") return "已作廢 不索取";
      if (allowance || invoiceStatus === "發票折讓成功") return "已開立折讓單";
      return "已開立 不索取";
    };

    // 4. 稅額與總計明細
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

    // 5. 若有折讓單資訊則追加顯示
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

  // ───────────────────────── 4. 事件監聽 (Event Listeners) ─────────────────────────
  document.addEventListener("click", (event) => {
    const link = event.target.closest(
      "a[data-invoice-order], .transaction-table tbody td:nth-child(11) a"
    );
    if (!link) return;

    event.preventDefault();

    // 讀取屬性資料
    const orderData = link.dataset.invoiceOrder || link.closest("tr")?.dataset.invoiceOrder;
    if (!orderData) return;

    const values = JSON.parse(orderData);
    const allowance = link.dataset.invoiceAllowance
      ? JSON.parse(link.dataset.invoiceAllowance)
      : null;

    const amount = Number(values[7]);
    const taxType = values[11];
    const taxAmount = taxType === "應稅" ? Math.round(amount - amount / 1.05) : 0;
    const invoiceDate = values[9]?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "2026-09-08";

    // 清空並重新生成視窗內容
    modalContent.replaceChildren();

    const summaryTable = renderSummaryTable(values, invoiceDate);
    const itemsTable = renderItemsTable(values, amount, taxAmount, allowance);

    modalContent.append(summaryTable, itemsTable);

    dialog.showModal();
    document.body.classList.add("invoice-modal-open");
  });
})();