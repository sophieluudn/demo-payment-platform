(() => {
  const update = () => {
    document.querySelectorAll('.transaction-table tbody tr').forEach(row => {
      const number = row.cells[0]?.textContent.trim();
      let state;
      try { state = JSON.parse(sessionStorage.getItem('payment-demo-refund-' + number)) || window.transactionDemoStates?.[number]; } catch { state = window.transactionDemoStates?.[number]; }
      const source = window.transactionOrders.find(order => order[0] === number);
      if (source) row.dataset.invoiceOrder = JSON.stringify(source);
      if (state?.completed && row.cells[8]) {
        row.cells[8].textContent = Number(state.value) === Number(source?.[7]) ? '取消交易' : '部份退款';
      }
      if (state?.invoices) {
        const order = window.transactionOrders.find(order => order[0] === number);
        if (!order) return;
        window.transactionInvoices.render(row.cells[10], order, state, false);
        row.cells[11].replaceChildren();
        state.invoices.forEach(invoice => { const status = document.createElement('div'); status.className = 'transaction-invoice-row'; status.textContent = invoice.status; row.cells[11].append(status); });
      }
    });
  };
  update();
  window.addEventListener('pageshow', update);
})();
