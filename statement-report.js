(() => {
  // ───────────────────────── 1. 常數與表頭設定 ─────────────────────────
  const TABS = ["交易", "退款", "退款V2"];

  const COMMON_HEADERS = [
    "第三方金流序號",
    "udn金流訂單編號",
    "產品訂單編號",
    "email",
    "支付方式",
    "交易類別",
  ];

  const TAB_HEADERS = [
    // 0: 交易
    [
      ...COMMON_HEADERS,
      "金額(含稅)", "手續費(含稅)", "入帳金額(含稅)", "交易日期",
      "發票號碼", "稅額", "銷售額", "總計",
      "商店名稱", "專案名稱", "商品名稱", "備註", "標籤",
    ],
    // 1: 退款
    [
      ...COMMON_HEADERS,
      "金額(含稅)", "手續費(含稅)", "入帳金額(含稅)", "退款金額(含稅)",
      "退款日期", "發票號碼",
      "商店名稱", "專案名稱", "商品名稱", "備註", "標籤",
    ],
    // 2: 退款V2
    [
      ...COMMON_HEADERS,
      "退款金額(含稅)", "退款手續費", "退款入帳金額", "退款日期",
      "作廢發票號碼", "稅額", "銷售額", "總計",
      "作廢/折讓", "折讓單號",
      "商店名稱", "專案名稱", "商品名稱", "備註", "標籤",
    ],
  ];

  // 數值加總欄位索引（對應各自 Tab 的欄位位置）
  const NUMERIC_COLUMNS_BY_TAB = {
    0: [6, 7, 8, 11, 12, 13],
    1: [6, 7, 8, 9],
    2: [6, 7, 8, 11, 12, 13],
  };

  // ───────────────────────── 2. DOM 視窗建立 ─────────────────────────
  const createModalDialog = () => {
    const dialog = document.createElement("dialog");
    dialog.className = "statement-report";
    dialog.setAttribute("aria-label", "交易與退款紀錄");
    dialog.innerHTML = `
      <button class="report-close" type="button" aria-label="關閉交易與退款紀錄">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d="m3 3 10 10M13 3 3 13"/>
        </svg>
      </button>
      <div class="report-context"></div>
      <div class="report-tabs" role="tablist" aria-label="紀錄類型"></div>
      <div class="report-scroll" role="tabpanel" id="statement-report-panel">
        <table>
          <thead></thead>
          <tbody></tbody>
          <tfoot></tfoot>
        </table>
      </div>
      <div class="report-actions">
        <button class="btn plain report-export" type="button">匯出</button>
      </div>
    `;
    document.body.append(dialog);
    return dialog;
  };

  const dialog = createModalDialog();
  const tabsContainer = dialog.querySelector(".report-tabs");
  const thead = dialog.querySelector("thead");
  const tbody = dialog.querySelector("tbody");
  const tfoot = dialog.querySelector("tfoot");

  // ───────────────────────── 3. 狀態與工具函式 ─────────────────────────
  let currentStatement = null;
  let activeTabIndex = 0;
  let rawRecords = [];
  let renderedRows = [];

  const round = (val) => Math.round(val * 100) / 100;

  // 建立虛擬交易與退款數據
  const buildRecords = (statement) => {
    return (window.transactionOrders || []).map((order, index) => {
      const amount = Number(order[7]);
      const fee = window.TransactionFees?.read(order[0])?.feeAmount ?? round(amount * 0.02);
      const isTaxable = order[11] === "應稅";
      const tax = isTaxable ? Math.round(amount - amount / 1.05) : 0;

      const refund = index % 3 === 0 ? amount : index % 3 === 1 ? round(amount * 0.4) : 0;
      const refundFee = round(refund * 0.03);
      const refundTax = isTaxable ? Math.round(refund - refund / 1.05) : 0;

      return {
        order,
        amount,
        fee,
        tax,
        refund,
        refundFee,
        refundTax,
        date: `${statement.start} 12:30:${String(index).padStart(2, "0")}`,
        refundDate: `${statement.end} 15:40:${String(index).padStart(2, "0")}`,
        store: statement.stores[index % statement.stores.length],
        project: statement.projects[index % statement.projects.length],
        product: statement.products[0] === "全部商品"
          ? order[2]
          : statement.products[index % statement.products.length],
        allowance: statement.start.slice(0, 7) !== statement.end.slice(0, 7),
        note: refund
          ? `${refund === amount ? "全額退款" : "部份退款"}，退款原因：買家反悔`
          : "",
      };
    });
  };

  // 將單筆紀錄根據目前的 Tab 轉為對應的列陣列
  const mapRecordToRow = (record, tabIndex) => {
    const {
      order, amount, fee, tax, refund, refundFee, refundTax,
      date, refundDate, store, project, product, allowance, note,
    } = record;

    const prefix = [
      order[1],
      order[0],
      `DEMO-${order[0]}`,
      "customer@example.com",
      order[6],
      order[5],
    ];

    if (tabIndex === 0) {
      return [
        ...prefix,
        amount, fee, round(amount - fee), date,
        order[12], tax, amount - tax, amount,
        store, project, product, note, "",
      ];
    }

    if (tabIndex === 1) {
      return [
        ...prefix,
        amount, fee, round(amount - fee), refund,
        refundDate, order[12],
        store, project, product, note, "",
      ];
    }

    // tabIndex === 2 (退款V2)
    return [
      ...prefix,
      refund, refundFee, round(refund - refundFee), refundDate,
      order[12], refundTax, refund - refundTax, refund,
      allowance ? "折讓" : "作廢",
      allowance ? `A-DEMO-${order[0]}` : "",
      store, project, product, note, "",
    ];
  };

  // ───────────────────────── 4. 視圖渲染 (Rendering) ─────────────────────────
  const updateTabAccessibility = () => {
    tabsContainer.querySelectorAll("[role=tab]").forEach((tab, idx) => {
      const isSelected = idx === activeTabIndex;
      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
    });

    dialog
      .querySelector("[role=tabpanel]")
      .setAttribute("aria-labelledby", `statement-report-tab-${activeTabIndex}`);
  };

  const renderTableHeader = () => {
    thead.replaceChildren();
    const tr = thead.insertRow();
    TAB_HEADERS[activeTabIndex].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      th.scope = "col";
      tr.append(th);
    });
  };

  const renderTableBody = () => {
    tbody.replaceChildren();

    const filteredRecords = activeTabIndex
      ? rawRecords.filter((record) => record.refund > 0)
      : rawRecords;

    renderedRows = filteredRecords.map((rec) => mapRecordToRow(rec, activeTabIndex));

    if (!renderedRows.length) {
      const tr = tbody.insertRow();
      const td = tr.insertCell();
      td.colSpan = TAB_HEADERS[activeTabIndex].length;
      td.textContent = "暫無資料";
      return;
    }

    renderedRows.forEach((rowValues) => {
      const tr = tbody.insertRow();
      rowValues.forEach((val) => {
        tr.insertCell().textContent = val;
      });
    });
  };

  const renderTableFooter = () => {
    tfoot.replaceChildren();
    const tr = tfoot.insertRow();
    const numericCols = NUMERIC_COLUMNS_BY_TAB[activeTabIndex];

    TAB_HEADERS[activeTabIndex].forEach((_, colIndex) => {
      const td = tr.insertCell();
      if (colIndex === 0) {
        td.textContent = "總計";
      } else if (numericCols.includes(colIndex)) {
        const total = renderedRows.reduce((sum, row) => sum + Number(row[colIndex]), 0);
        td.textContent = round(total).toLocaleString("zh-TW", {
          maximumFractionDigits: 2,
        });
      } else {
        td.textContent = "";
      }
    });
  };

  const render = () => {
    updateTabAccessibility();
    renderTableHeader();
    renderTableBody();
    renderTableFooter();
    dialog.querySelector(".report-scroll").scrollTop = 0;
  };

  // ───────────────────────── 5. CSV 匯出邏輯 ─────────────────────────
  const exportToCSV = () => {
    const footerCells = [...tfoot.querySelectorAll("tr td")].map((td) => td.textContent);

    const sanitizeField = (value) => {
      const str = String(value ?? "");
      const safeStr = /^[=+@-]/.test(str) ? `'${str}` : str;
      return `"${safeStr.replaceAll('"', '""')}"`;
    };

    const allRows = [
      TAB_HEADERS[activeTabIndex],
      ...renderedRows,
      footerCells,
    ];

    const csvContent = "\uFEFF" + allRows.map((row) => row.map(sanitizeField).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const fileName = `${currentStatement.name.replace(/[\\/:*?"<>|]/g, "_")}-${TABS[activeTabIndex]}.csv`;

    link.href = url;
    link.download = fileName;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ───────────────────────── 6. 初始化與事件監聽 ─────────────────────────
  // 初始化 Tabs
  TABS.forEach((name, idx) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = name;
    tab.id = `statement-report-tab-${idx}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "statement-report-panel");

    tab.addEventListener("click", () => {
      activeTabIndex = idx;
      render();
    });

    // 鍵盤左右切換 Tab
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      activeTabIndex = (idx + (event.key === "ArrowRight" ? 1 : 2)) % TABS.length;
      render();
      tabsContainer.querySelectorAll("[role=tab]")[activeTabIndex].focus();
    });

    tabsContainer.append(tab);
  });

  // 全域開啟函式
  window.openStatementReport = (entry) => {
    currentStatement = entry;
    activeTabIndex = 0;
    rawRecords = buildRecords(entry);
    render();

    dialog.querySelector(".report-context").textContent =
      `${entry.name}｜${entry.start} 至 ${entry.end}（模擬資料）`;

    dialog.showModal();
    document.body.classList.add("statement-report-open");
  };

  // Modal 關閉控制
  const closeModal = () => dialog.close();
  dialog.querySelector(".report-close").addEventListener("click", closeModal);
  dialog.addEventListener("close", () =>
    document.body.classList.remove("statement-report-open")
  );

  // 匯出按鈕監聽
  dialog.querySelector(".report-export").addEventListener("click", exportToCSV);
})();