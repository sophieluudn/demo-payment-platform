(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'invoice-modal';
  dialog.setAttribute('aria-labelledby', 'invoice-modal-title');
  dialog.innerHTML = '<header class="invoice-modal-header"><h2 id="invoice-modal-title">發票明細</h2><button type="button" class="invoice-close" aria-label="關閉發票明細"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m3 3 10 10M13 3 3 13"/></svg></button></header><div class="invoice-modal-content"></div>';
  document.body.append(dialog);
  const content = dialog.querySelector('.invoice-modal-content');
  const close = () => dialog.close();
  dialog.querySelector('.invoice-close').addEventListener('click', close);
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) close();
  });
  dialog.addEventListener('close', () => document.body.classList.remove('invoice-modal-open'));
  const cell = (row, text, span = 1, heading = false) => {
    const element = document.createElement(heading ? 'th' : 'td');
    element.textContent = text;
    element.colSpan = span;
    if (heading) element.scope = 'row';
    row.append(element);
  };
  const table = () => { const element = document.createElement('table'); element.className = 'invoice-table'; return element; };
  document.addEventListener('click', event => {
      const link = event.target.closest('a[data-invoice-order], .transaction-table tbody td:nth-child(11) a');
      if (!link) return;
      event.preventDefault();
      const values = JSON.parse(link.dataset.invoiceOrder || link.closest('tr').dataset.invoiceOrder);
      const allowance = link.dataset.invoiceAllowance ? JSON.parse(link.dataset.invoiceAllowance) : null;
      const amount = Number(values[7]);
      const tax = values[11];
      const taxAmount = tax === '應稅' ? Math.round(amount - amount / 1.05) : 0;
      const money = number => 'NT$' + number.toLocaleString('zh-TW');
      const day = values[9].match(/\d{4}-\d{2}-\d{2}/)?.[0] || '2026-09-08';
      content.replaceChildren();
      const summary = table();
      const summaryRows = [
        ['賣方營業名稱', '聯合報股份有限公司', '賣方統編', '03799802'],
        ['買受人名稱', '顧客', '買受人編號', ''],
        ['買受人地址', ''],
        ['發票號碼', values[12], 'ezPay電子發票開立序號', 'DEMO-' + values[0]],
        ['發票日期', day + ' 15:55:24', '隨機碼', '6952']
      ];
      summaryRows.forEach(values => {
        const tr = summary.insertRow();
        values.forEach((value, index) => cell(tr, value, values.length === 2 && index === 1 ? 8 : index % 2 === 0 ? 2 : 3, index % 2 === 0));
      });
      const items = table();
      let tr = items.insertRow(); cell(tr, '發票資訊', 6, true);
      tr = items.insertRow(); ['品項編號', '品名', '數量', '單位', '單價', '金額'].forEach(value => cell(tr, value, 1, true));
      tr = items.insertRow(); ['1', values[2], '1', '份', money(amount), money(amount)].forEach(value => cell(tr, value));
      [['課稅別', tax], ['稅率', tax === '應稅' ? '5%' : '0%'], ['稅額', money(taxAmount)], ['銷售額', money(amount - taxAmount)], ['總計', money(amount)], ['發票備註', values[13] === '發票作廢成功' ? '已作廢 不索取' : allowance || values[13] === '發票折讓成功' ? '已開立折讓單' : '已開立 不索取']].forEach(([label, value]) => {
        const tr = items.insertRow(); cell(tr, label, 1, true); cell(tr, value, 5);
      });
      if (allowance) {
        [['折讓單號', allowance.number], ['折讓日期', allowance.date], ['折讓金額', money(allowance.amount)], ['折讓後剩餘發票金額', money(allowance.remaining)]].forEach(([label, value]) => {
          const tr = items.insertRow(); cell(tr, label, 1, true); cell(tr, value, 5);
        });
      }
      content.append(summary, items);
      dialog.showModal();
      document.body.classList.add('invoice-modal-open');
  });
})();
