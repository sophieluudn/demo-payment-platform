(() => {
  const id = new URLSearchParams(location.search).get('order');
  const order = window.transactionOrders.find(row => row[0] === id);
  if (!order) {
    document.querySelector('.order-detail').innerHTML = '<p>找不到此訂單。</p><a href="transactions.html">返回所有交易紀錄</a>';
    return;
  }
  const [number, provider, product, store, project, category, payment, amount, date, paid, status, tax, invoice] = order;
  document.getElementById('order-breadcrumb').textContent = number;
  document.title = number + '｜訂單明細';
  document.querySelector('.reset').href = location.href;
  const money = value => 'NT$' + Number(value).toLocaleString('zh-TW') + ' 元';
  const fill = (id, entries) => {
    const target = document.getElementById(id);
    entries.forEach(([label, value]) => {
      const term = document.createElement('dt'); term.textContent = label;
      const description = document.createElement('dd'); description.textContent = value;
      target.append(term, description);
    });
  };
  const day = date.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '2026-09-08';
  const paidDay = paid.match(/\d{4}-\d{2}-\d{2}/)?.[0] || day;
  fill('product-summary', [['商品名稱', product], ['商店', store], ['專案', project]]);
  fill('payment-summary', [['udn金流訂單編號', number], ['交易金額', money(amount)], ['預估手續費', money(Math.max(1, Math.round(Number(amount) * .02)))], ['訂單狀態', status], ['支付方式', payment], ['交易類別', category], ['付款人 E-Mail', 'customer@example.com'], ['發票資訊', invoice]]);
  const invoiceLink = document.createElement('a');
  invoiceLink.href = '#invoice-detail';
  invoiceLink.textContent = invoice;
  invoiceLink.dataset.invoiceOrder = JSON.stringify(order);
  invoiceLink.style.textDecoration = 'underline';
  document.querySelector('#payment-summary dd:last-child').replaceChildren(invoiceLink);
  fill('transaction-summary', [['第三方金流序號', provider], ['產品訂單編號', 'DEMO-' + number], ['交易日期', day + ' 15:54:58'], ['交易截止日期', '—'], ['支付日期', paidDay + ' 15:55:23'], ['交易 IP', '192.0.2.10'], ['備註', '模擬訂單；時間、手續費及付款人資料為示範內容']]);
  const history = [ ['15:54:58', '交易開始', '訂單建立'], ['15:54:58', '處理中', '開始' + payment + '交易'], ['15:54:59', '處理中', '取得支付網址成功'], ['15:55:22', '處理中', '確認支付結果'], ['15:55:23', '交易成功', payment + '交易成功'], ['15:55:27', status, '發票' + invoice + '開立成功（' + tax + '）'] ];
  history.forEach(([time, state, description]) => {
    const row = document.createElement('tr');
    [day + ' ' + time, state, description].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
    document.getElementById('order-history').append(row);
  });
  window.initializeRefund(order);
})();
