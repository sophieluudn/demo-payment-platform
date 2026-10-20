window.transactionInvoices = {
  isCurrentMonth(order) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const value = (type) => parts.find((part) => part.type === type).value;
    return order[8].slice(0, 7) === value("year") + "-" + value("month");
  },
  get(order, state = {}) {
    if (state.invoices) return state.invoices;
    return [
      {
        number: order[12],
        amount: Number(order[7]),
        status: order[13] || "開發票成功",
        date: order[9],
      },
    ];
  },
  render(target, order, state, showStatus = true) {
    target.replaceChildren();
    this.get(order, state).forEach((invoice) => {
      const row = document.createElement("div");
      row.className = "transaction-invoice-row";
      const link = document.createElement("a");
      link.href = "#invoice-detail";
      link.textContent = invoice.number;
      const values = [...order];
      values[7] = String(invoice.amount);
      values[12] = invoice.number;
      values[13] = invoice.status;
      values[9] = invoice.date;
      link.dataset.invoiceOrder = JSON.stringify(values);
      link.setAttribute("aria-haspopup", "dialog");
      if (invoice.allowance)
        link.dataset.invoiceAllowance = JSON.stringify(invoice.allowance);
      row.append(link);
      if (showStatus) {
        const status = document.createElement("span");
        status.textContent = invoice.status;
        row.append(status);
      }
      target.append(row);
    });
  },
};
