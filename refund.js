window.initializeRefund = order => {
  const [number, provider, product, , , , payment, rawAmount, , , , , invoice] = order;
  const amount = Number(rawAmount);
  const dialog = document.getElementById('refund-dialog');
  const trigger = document.getElementById('refund-button');
  const key = 'payment-demo-refund-' + number;
  let state;
  const demoState = () => JSON.parse(JSON.stringify(window.transactionDemoStates?.[number] || {}));
  try { state = JSON.parse(sessionStorage.getItem(key)) || demoState(); } catch { state = demoState(); }
  let busy = false;
  const currentMonth = window.transactionInvoices.isCurrentMonth(order);
  let action;
  const closeIcon = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m3 3 10 10M13 3 3 13"/></svg>';
  dialog.className = 'refund-modal';
  dialog.setAttribute('aria-labelledby', 'refund-title');
  dialog.innerHTML = `<div class="refund-heading"><h2 id="refund-title">退款</h2><button type="button" class="refund-close" aria-label="關閉退款視窗">${closeIcon}</button></div>
    <div class="refund-table-wrap"><table class="refund-table"><thead><tr><th>商店訂單編號</th><th>商品名稱</th><th>訂單金額</th><th>發票號碼</th><th>發票金額</th><th>退款金額</th><th>發票處理</th></tr></thead>
    <tbody><tr><td data-value="provider"></td><td data-value="product"></td><td data-value="amount"></td><td data-value="invoice"></td><td data-value="amount"></td><td><input id="refund-amount" aria-label="退款金額" type="number" min="1" step="1" value="0" aria-describedby="refund-error"></td><td><button class="btn plain invoice-process" type="button" disabled>折讓 / 作廢</button></td></tr><tr class="refund-total-row"><td colspan="4"></td><td>退款總金額</td><td><output id="refund-total" aria-live="polite">0</output></td><td></td></tr></tbody></table></div>
    <p id="refund-error" class="refund-error" role="alert" hidden></p>
    <section class="refund-settings" hidden><label for="refund-reason">退款原因:</label><div class="refund-reason-fields"><select id="refund-reason" aria-label="退款原因"><option>買家反悔</option><option>不慎誤購</option><option>重複訂購</option><option>詐欺訂單</option><option>其他原因</option></select><input id="refund-document" aria-label="電子公文文號" placeholder="若為線下退款，請輸入電子公文文號"></div><textarea id="refund-other-reason" aria-label="其他原因" placeholder="請輸入其他原因" rows="2" hidden disabled></textarea><button class="btn primary refund-submit" type="button">確定退款</button></section>`;
  dialog.querySelectorAll('[data-value]').forEach(el => { el.textContent = { provider, product, amount: amount.toLocaleString('zh-TW') + ' 元', invoice }[el.dataset.value]; });
  const input = dialog.querySelector('#refund-amount'); input.max = amount;
  const process = dialog.querySelector('.invoice-process');
  const settings = dialog.querySelector('.refund-settings');
  const submit = dialog.querySelector('.refund-submit');
  const reason = dialog.querySelector('#refund-reason');
  const documentNumber = dialog.querySelector('#refund-document');
  const otherReason = dialog.querySelector('#refund-other-reason');
  const error = dialog.querySelector('#refund-error');
  documentNumber.addEventListener('input', () => { if (documentNumber.value.trim()) error.hidden = true; });
  reason.addEventListener('change', () => {
    error.hidden = true;
    otherReason.hidden = reason.value !== '其他原因';
    otherReason.disabled = otherReason.hidden;
  });
  const confirmation = document.createElement('dialog');
  confirmation.className = 'refund-confirm';
  confirmation.setAttribute('aria-labelledby', 'refund-confirm-message');
  confirmation.innerHTML = `<button class="refund-close" type="button" aria-label="關閉確認視窗">${closeIcon}</button><p id="refund-confirm-message"></p><div class="refund-confirm-actions"><button type="button" class="btn plain confirm-cancel">取消</button><button type="button" class="btn primary confirm-accept">確定</button></div>`;
  document.body.append(confirmation);
  const notice = document.createElement('div');
  notice.className = 'refund-notice'; notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); notice.hidden = true;
  let noticeTimer;
  const notify = text => {
    clearTimeout(noticeTimer);
    (dialog.open ? dialog : document.body).append(notice);
    notice.replaceChildren();
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '16'); icon.setAttribute('height', '16'); icon.setAttribute('viewBox', '0 0 16 16'); icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<circle cx="8" cy="8" r="8" fill="currentColor"/><path d="m4 8 3 3 5-6" fill="none" stroke="white" stroke-width="1.5"/>';
    notice.append(icon, document.createTextNode(text)); notice.hidden = false;
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 4000);
  };
  const save = () => { try { sessionStorage.setItem(key, JSON.stringify(state)); } catch {} };
  const appendRecord = entry => {
    const tr = document.createElement('tr');
    entry.forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.append(td); });
    document.getElementById('order-history').append(tr);
  };
  (state.history || []).forEach(appendRecord);
  const record = (status, message) => {
    const now = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
    const entry = [now, status, message];
    state.history = [...(state.history || []), entry];
    save(); appendRecord(entry);
  };
  const updateStatus = () => {
    const invoiceTarget = document.querySelector('#payment-summary dd:last-child');
    window.transactionInvoices.render(invoiceTarget, order, state);
    if (!state.completed) return;
    const status = Number(state.value) === amount ? '取消交易' : '部份退款';
    [...document.querySelectorAll('#payment-summary dt')].find(el => el.textContent === '訂單狀態').nextElementSibling.textContent = status;
    trigger.disabled = true; trigger.textContent = '已退款';
  };
  const render = () => {
    if (state.processed) input.value = state.value;
    input.disabled = !!state.processed;
    process.disabled = !!state.processed || !input.validity.valid || Number(input.value) <= 0;
    process.textContent = state.processed ? (currentMonth ? '已作廢' : '已折讓') : '折讓 / 作廢';
    settings.hidden = !state.processed;
    document.getElementById('refund-total').textContent = input.value === '' || !Number.isFinite(input.valueAsNumber) ? '0' : input.value;
    updateStatus();
  };
  input.addEventListener('input', () => {
    error.hidden = input.validity.valid || input.value === '' || input.value === '0';
    error.textContent = '退款金額須為 1 至 ' + amount + ' 元的整數。';
    input.setAttribute('aria-invalid', String(!error.hidden)); render();
  });
  const ask = type => {
    action = type;
    confirmation.querySelector('p').textContent = type === 'invoice' ? '確認作廢 / 折讓?' : '確認退款?';
    confirmation.showModal();
  };
  process.addEventListener('click', () => { if (!process.disabled && !busy) ask('invoice'); });
  submit.addEventListener('click', () => {
    if (busy || !state.processed || state.completed) return;
    error.hidden = true; ask('refund');
  });
  const cancelConfirm = () => { if (!busy) confirmation.close(); };
  confirmation.querySelector('.confirm-cancel').addEventListener('click', cancelConfirm);
  confirmation.querySelector('.refund-close').addEventListener('click', cancelConfirm);
  confirmation.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  confirmation.querySelector('.confirm-accept').addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    confirmation.querySelectorAll('button').forEach(button => { button.disabled = true; });
    confirmation.querySelector('.confirm-accept').textContent = '處理中…';
    // Demo adapter: replace this delay with the invoice/refund service when an API is available.
    await new Promise(resolve => setTimeout(resolve, 450));
    confirmation.close();
    if (action === 'invoice') {
      state.value = Number(input.value); state.processed = true; save(); render();
      const voided = currentMonth;
      const result = voided ? '發票作廢成功' : '發票折讓開立成功';
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
      state.invoices = [{ number: invoice, amount, status: result, date: order[9] }];
      if (voided) {
        record('作廢發票', '執行發票作廢成功，發票 ' + invoice);
      } else {
        state.allowance = { number: 'A' + date.replace(/\D/g, '') + number.slice(-5), amount: state.value, remaining: amount - state.value, date };
        state.invoices[0].allowance = state.allowance;
        record('發票折讓開立成功', '發票號碼：' + invoice + '，折讓金額：NT$' + state.value + '，折讓後剩餘發票金額：NT$' + state.allowance.remaining + '，折讓單號：' + state.allowance.number);
      }
      if (currentMonth && state.value < amount) {
        const used = new Set(window.transactionOrders.map(row => row[12]));
        for (let index = 0; index < sessionStorage.length; index++) {
          const storageKey = sessionStorage.key(index);
          if (!storageKey.startsWith('payment-demo-refund-')) continue;
          try { (JSON.parse(sessionStorage.getItem(storageKey))?.invoices || []).forEach(item => used.add(item.number)); } catch {}
        }
        let next = Number(invoice.slice(2)) + 1;
        while (used.has(invoice.slice(0, 2) + String(next).padStart(8, '0'))) next++;
        const newInvoice = invoice.slice(0, 2) + String(next).padStart(8, '0');
        state.invoices.push({ number: newInvoice, amount: amount - state.value, status: '開發票成功', date });
        record('開發票成功', '重開發票 ' + newInvoice + '，金額 NT$' + (amount - state.value));
        record('開立發票', '新開立發票號碼：' + newInvoice + '，原訂單編號：' + number);
      }
      save(); render(); notify(currentMonth && state.value < amount ? '發票作廢及重開成功' : result); submit.focus();
    } else {
      record('取消交易處理中', '執行退款，金額 NT$' + state.value);
      state.completed = true; state.reason = reason.value; state.otherReason = reason.value === '其他原因' ? otherReason.value.trim() : ''; state.document = documentNumber.value.trim(); save(); updateStatus();
      record('退款成功', '執行退款成功，金額 NT$' + state.value + '；' + (state.value === amount ? '全額退款' : '部份退款') + '。退款原因：' + state.reason + (state.otherReason ? '：' + state.otherReason : ''));
      dialog.close(); notify('退款成功');
    }
    busy = false;
    confirmation.querySelectorAll('button').forEach(button => { button.disabled = false; });
    confirmation.querySelector('.confirm-accept').textContent = '確定';
  });
  dialog.querySelector('.refund-close').addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { document.body.classList.remove('refund-modal-open'); if (!notice.hidden) document.body.append(notice); });
  trigger.addEventListener('click', () => {
    if (state.completed) return;
    render(); dialog.showModal(); if (!notice.hidden) dialog.append(notice); document.body.classList.add('refund-modal-open');
  });
  render();
};
