(() => {
  const trigger = document.querySelector('main > .btn.success');
  const dialog = document.createElement('dialog');
  dialog.className = 'product-modal'; dialog.setAttribute('aria-labelledby', 'product-modal-title');
  dialog.innerHTML = `<div class="product-modal-heading"><h2 id="product-modal-title">新增商品</h2><button type="button" class="product-modal-close" aria-label="關閉新增商品"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m3 3 10 10M13 3 3 13"/></svg></button></div>
  <form id="new-product-form"><div class="product-form-fields">
  <div class="product-form-row"><label for="new-product-project" class="required">專案</label><select id="new-product-project" name="project" required><option value="" disabled selected>請輸入專案</option><option>行動發展部</option></select></div>
  <div class="product-form-row"><label for="new-product-name" class="required">商品名稱</label><input id="new-product-name" name="name" placeholder="請勿超過30字元" maxlength="30" required></div>
  <div class="product-form-row"><label for="new-product-description">商品簡介</label><input id="new-product-description" name="description" placeholder="請勿超過50字元" maxlength="50"></div>
  <div class="product-form-row price-row"><label for="new-product-price">價格</label><div><div class="product-price-controls"><input id="new-product-price" name="price" type="number" min="0" step="1" value="0" required><span class="product-price-info" tabindex="0" aria-label="金額超過收款方上限時，自動隱藏不支援的付款方式"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="7" fill="currentColor"/><path d="M7.5 6 6.4 10M7.9 3.8h.01" stroke="white" stroke-width="1.4" stroke-linecap="round"/></svg></span></div><p class="product-price-help">金額超過收款方上限時，自動隱藏不支援的付款方式</p></div></div>
  <div class="product-form-row"><label for="new-product-start" class="required">上架開始日期</label><input id="new-product-start" name="start" type="text" placeholder="選擇上架開始日期" class="product-date" required></div>
  <div class="product-form-row"><label for="new-product-end" class="required">上架結束日期</label><div class="product-end-controls"><input id="new-product-end" name="end" type="text" placeholder="選擇上架結束日期" class="product-date" required><button type="button" class="btn gray product-unlimited" aria-pressed="false">不限</button></div></div>
  <div class="product-form-row"><span class="required product-form-label" id="product-tax-label">課稅別</span><div class="product-tax" role="radiogroup" aria-labelledby="product-tax-label"><label><input type="radio" name="tax" value="應稅" checked>應稅</label><label><input type="radio" name="tax" value="免稅">免稅</label></div></div>
  <div class="product-form-row"><label for="new-product-tag">標籤</label><select id="new-product-tag" name="tag"><option value="">選擇分類標籤</option><option>行動發展部</option></select></div>
  <div class="product-form-row"><label for="new-product-notice">注意事項</label><textarea id="new-product-notice" name="notice" placeholder="請勿超過300字元" maxlength="300" rows="1"></textarea></div>
  <div class="product-form-row"><label for="new-product-notes">備註</label><textarea id="new-product-notes" name="notes" rows="4"></textarea></div>
  </div><p class="product-form-error" role="alert" hidden></p><div class="product-modal-actions"><button type="button" class="btn plain product-cancel">取消</button><button type="submit" class="btn primary product-save" disabled>儲存</button></div></form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const info = dialog.querySelector('.product-price-info');
  const infoButton = document.createElement('button');
  infoButton.type = 'button';
  infoButton.className = 'product-price-info';
  infoButton.setAttribute('aria-label', '付款金額限制說明');
  infoButton.setAttribute('aria-expanded', 'false');
  infoButton.setAttribute('aria-controls', 'product-price-tooltip');
  infoButton.innerHTML = info.innerHTML;
  const infoWrapper = document.createElement('div');
  infoWrapper.className = 'product-price-info-wrapper';
  const tooltip = document.createElement('div');
  tooltip.id = 'product-price-tooltip';
  tooltip.className = 'product-price-tooltip';
  tooltip.hidden = true;
  tooltip.innerHTML = '1. 超商代收款金額最高新台幣 2 萬元<br>2. WebATM、ATM轉帳，單筆交易上限 49,999 元<br>3. 信用卡交易，單筆交易上限 199,999 元<br>4. 金額為 0，代表為不定額交易<br>5. 若課稅別為應稅，則交易金額為含稅價';
  infoWrapper.append(infoButton, tooltip);
  info.replaceWith(infoWrapper);
  const closeInfo = () => { tooltip.hidden = true; infoButton.setAttribute('aria-expanded', 'false'); };
  infoButton.addEventListener('click', () => {
    tooltip.hidden = !tooltip.hidden;
    infoButton.setAttribute('aria-expanded', String(!tooltip.hidden));
  });
  dialog.addEventListener('click', event => { if (!infoWrapper.contains(event.target)) closeInfo(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !tooltip.hidden) { event.preventDefault(); event.stopPropagation(); closeInfo(); }
  });
  dialog.addEventListener('close', closeInfo);
  const save = dialog.querySelector('.product-save');
  const start = form.elements.start, end = form.elements.end;
  const unlimited = dialog.querySelector('.product-unlimited');
  const error = dialog.querySelector('.product-form-error');
  let noEnd = false;
  let editing = null;
  let editingRow = null;
  const normalizeDate = value => value.replace('T', ' ') + (value.length === 16 ? ':00' : '');
  const refresh = () => {
    const invalidRange = start.value && end.value && normalizeDate(end.value) <= normalizeDate(start.value);
    end.setCustomValidity(invalidRange ? '上架結束日期須晚於開始日期。' : '');
    error.textContent = invalidRange ? '上架結束日期須晚於開始日期。' : '';
    error.hidden = !invalidRange;
    save.disabled = !form.checkValidity();
    form.querySelectorAll('select').forEach(select => select.classList.toggle('placeholder', !select.value));
  };
  [start, end].forEach(input => { input.pattern = '[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}(:[0-9]{2})?'; });
  const closePicker = window.attachProductDatePicker(dialog, [start,end], refresh);
  unlimited.addEventListener('click', () => {
    noEnd = true; end.disabled = false; end.required = true;
    end.value = '2999-12-31 23:59:59'; closePicker();
    unlimited.setAttribute('aria-pressed', String(noEnd)); refresh();
  });
  form.addEventListener('input', refresh); form.addEventListener('change', refresh);
  const close = () => dialog.close();
  dialog.querySelector('.product-modal-close').addEventListener('click', close);
  dialog.querySelector('.product-cancel').addEventListener('click', close);
  dialog.addEventListener('close', () => document.body.classList.remove('product-modal-open'));
  trigger.addEventListener('click', () => {
    editing = null; editingRow = null;
    dialog.querySelector('h2').textContent = '新增商品';
    dialog.querySelector('.product-modal-close').setAttribute('aria-label','關閉新增商品');
    form.elements.project.disabled = false; form.elements.price.disabled = false; start.disabled = false;
    form.reset(); noEnd = false; end.disabled = false; end.required = true;
    [start,end].forEach(input => input.type = 'text'); end.placeholder = '選擇上架結束日期';
    unlimited.setAttribute('aria-pressed', 'false'); refresh(); dialog.showModal(); document.body.classList.add('product-modal-open');
  });
  const tbody = document.querySelector('.product-table tbody');
  const pager = document.querySelector('.pager');
  const listToolbar = document.createElement('div');
  listToolbar.className = 'product-list-toolbar';
  trigger.before(listToolbar);
  listToolbar.append(pager, trigger);
  const initialCount = Number(pager.firstChild.textContent.match(/\d+/)?.[0] || tbody.rows.length);
  let products = [];
  try { products = JSON.parse(sessionStorage.getItem('payment-demo-products')) || []; } catch {}
  let edits = {};
  try { edits = JSON.parse(sessionStorage.getItem('payment-demo-product-edits')) || {}; } catch {}
  let deleted = [];
  try { deleted = JSON.parse(sessionStorage.getItem('payment-demo-product-deleted')) || []; } catch {}
  const canDelete = row => {
    const startValue = row.cells[6].textContent.trim().replace('T',' ');
    const now = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
    return !!startValue && startValue > now;
  };
  const updateDeleteButton = row => {
    const button = [...row.querySelectorAll('button')].find(button=>button.textContent.trim()==='刪除');
    if(button) button.disabled = !canDelete(row);
  };
  const fillRow = (row, product) => {
    [product.id,product.name,product.project,product.tag,Number(product.price).toLocaleString('zh-TW'),product.tax,product.start.replace('T',' '),product.end.replace('T',' ')].forEach((value,index) => { row.cells[index].textContent = value; });
    row.dataset.product = JSON.stringify(product);
    updateDeleteButton(row);
  };
  const addRow = product => {
    const row = document.createElement('tr');
    [product.id,product.name,product.project,product.tag,Number(product.price).toLocaleString('zh-TW'),product.tax,product.start.replace('T',' '),product.end.replace('T',' ')].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
    const actions = document.createElement('td');
    actions.innerHTML = '<button type="button" class="btn primary">編輯</button><button type="button" class="btn danger">刪除</button><br><button type="button" class="btn gray">付款連結管理</button>';
    row.append(actions); tbody.prepend(row);
    row.dataset.product = JSON.stringify(product);
    updateDeleteButton(row);
  };
  products.forEach(addRow);
  [...tbody.rows].forEach(row=>{const product=edits[row.cells[0].textContent.trim()];if(product)fillRow(row,product);});
  [...tbody.rows].forEach(row=>{if(deleted.includes(Number(row.cells[0].textContent)))row.remove();else updateDeleteButton(row);});
  tbody.addEventListener('click', event => {
    const button = event.target.closest('button'); if(!button || button.textContent.trim() !== '編輯') return;
    const row = button.closest('tr');
    const values = [...row.cells].map(cell=>cell.textContent.trim());
    editing = row.dataset.product ? JSON.parse(row.dataset.product) : {id:Number(values[0]),name:values[1],description:'',project:values[2],tag:values[3],price:values[4].replace(/,/g,''),tax:values[5],start:values[6],end:values[7],notice:'',notes:''};
    editingRow=row;form.reset();closePicker();closeInfo();
    for(const key of ['project','tag']){const select=form.elements[key];if(editing[key] && ![...select.options].some(option=>option.value===editing[key]))select.add(new Option(editing[key],editing[key]));}
    for(const key of ['project','name','description','price','tag','notice','notes'])form.elements[key].value=editing[key]||'';
    form.elements.tax.value=editing.tax;
    start.value=normalizeDate(editing.start);end.value=normalizeDate(editing.end);end.disabled=false;end.required=true;
    noEnd=end.value==='2999-12-31 23:59:59';unlimited.setAttribute('aria-pressed',String(noEnd));
    const now = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
    const launched=start.value<=now;
    form.elements.price.disabled=launched; start.disabled=launched;form.elements.project.disabled=true;
    dialog.querySelector('h2').textContent='編輯商品';dialog.querySelector('.product-modal-close').setAttribute('aria-label','關閉編輯商品');
    refresh();dialog.showModal();document.body.classList.add('product-modal-open');
  });
  const updateCount = () => { pager.firstChild.textContent = '共 ' + (initialCount + products.length - deleted.length) + ' 項'; };
  updateCount();
  const deleteDialog=document.createElement('dialog');
  deleteDialog.className='product-delete-confirm';deleteDialog.setAttribute('aria-labelledby','product-delete-question');
  deleteDialog.innerHTML='<button type="button" class="product-modal-close" aria-label="關閉刪除確認"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m3 3 10 10M13 3 3 13"/></svg></button><p id="product-delete-question">是否要刪除?</p><div class="product-delete-actions"><button type="button" class="btn plain delete-cancel">取消</button><button type="button" class="btn primary delete-confirm">確定</button></div>';
  document.body.append(deleteDialog);
  let pendingDelete=null;
  tbody.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.textContent.trim()!=='刪除'||button.disabled)return;
    const row=button.closest('tr');if(!canDelete(row)){updateDeleteButton(row);return;}
    pendingDelete=row;deleteDialog.showModal();document.body.classList.add('product-modal-open');
  });
  deleteDialog.querySelector('.delete-cancel').addEventListener('click',()=>deleteDialog.close());
  deleteDialog.querySelector('.product-modal-close').addEventListener('click',()=>deleteDialog.close());
  deleteDialog.addEventListener('close',()=>{pendingDelete=null;document.body.classList.remove('product-modal-open');});
  deleteDialog.querySelector('.delete-confirm').addEventListener('click',()=>{
    if(!pendingDelete||!canDelete(pendingDelete)){if(pendingDelete)updateDeleteButton(pendingDelete);deleteDialog.close();return;}
    const id=Number(pendingDelete.cells[0].textContent);
    const index=products.findIndex(product=>Number(product.id)===id);
    if(index>=0)products.splice(index,1);else if(!deleted.includes(id))deleted.push(id);
    delete edits[id];
    try{sessionStorage.setItem('payment-demo-products',JSON.stringify(products));sessionStorage.setItem('payment-demo-product-deleted',JSON.stringify(deleted));sessionStorage.setItem('payment-demo-product-edits',JSON.stringify(edits));}catch{}
    pendingDelete.remove();updateCount();deleteDialog.close();trigger.focus();
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); refresh(); if (save.disabled) return;
    const product = Object.fromEntries(new FormData(form));
    product.start = normalizeDate(start.value); product.end = normalizeDate(end.value);
    if(editing){
      product.id=editing.id; product.project=editing.project;
      if(form.elements.price.disabled)product.price=editing.price;
      if(start.disabled)product.start=editing.start;
      edits[product.id]=product;
      const index=products.findIndex(item=>item.id===product.id);if(index>=0)products[index]=product;
      try{sessionStorage.setItem('payment-demo-product-edits',JSON.stringify(edits));sessionStorage.setItem('payment-demo-products',JSON.stringify(products));}catch{}
      fillRow(editingRow,product);close();return;
    }
    product.id = Math.max(...[...tbody.rows].map(row => Number(row.cells[0].textContent)), 0) + 1;
    products.push(product); try { sessionStorage.setItem('payment-demo-products', JSON.stringify(products)); } catch {}
    addRow(product); updateCount(); close();
  });
})();
