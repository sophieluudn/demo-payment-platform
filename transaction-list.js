(() => {
  const REFUND_STORAGE_PREFIX = "payment-demo-refund-";

  // 表格欄位索引
  const COL = {
    ORDER_NUMBER: 0,
    TRANSACTION_TYPE: 8,
    INVOICE: 10,
    INVOICE_STATUS: 11,
  };

  // transactionOrders 內每筆訂單陣列的欄位索引
  const ORDER = {
    NUMBER: 0,
    AMOUNT: 7,
  };

  const getDemoState = (number) => window.transactionDemoStates?.[number];

  // 優先使用 sessionStorage 內的退款狀態，沒有或解析失敗時退回 demo 資料
  const getState = (number) => {
    try {
      const stored = JSON.parse(
        sessionStorage.getItem(REFUND_STORAGE_PREFIX + number),
      );
      return stored || getDemoState(number);
    } catch {
      return getDemoState(number);
    }
  };

  const findOrder = (number) =>
    window.transactionOrders.find((order) => order[ORDER.NUMBER] === number);

  // 全額退款 → 取消交易；否則 → 部份退款
  const updateTransactionType = (cell, state, order) => {
    if (!state?.completed || !cell) return;
    const isFullRefund = Number(state.value) === Number(order?.[ORDER.AMOUNT]);
    cell.textContent = isFullRefund ? "取消交易" : "部份退款";
  };

  const updateInvoices = (row, state, order) => {
    window.transactionInvoices.render(
      row.cells[COL.INVOICE],
      order,
      state,
      false,
    );

    const statusCell = row.cells[COL.INVOICE_STATUS];
    statusCell.replaceChildren(
      ...state.invoices.map((invoice) => {
        const status = document.createElement("div");
        status.className = "transaction-invoice-row";
        status.textContent = invoice.status;
        return status;
      }),
    );
  };

  const updateRow = (row) => {
    const number = row.cells[COL.ORDER_NUMBER]?.textContent.trim();
    const state = getState(number);
    const order = findOrder(number);

    if (order) row.dataset.invoiceOrder = JSON.stringify(order);

    updateTransactionType(row.cells[COL.TRANSACTION_TYPE], state, order);

    if (state?.invoices && order) updateInvoices(row, state, order);
  };

  const update = () => {
    document
      .querySelectorAll(".transaction-table tbody tr")
      .forEach(updateRow);
  };

  update();
  window.addEventListener("pageshow", update);
})();