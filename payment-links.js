(() => {
  const methods = ['國內信用卡一次付清','Apple Pay','Google Pay','Line Pay','ATM轉帳','超商代碼繳費','信用卡一次付清(國外信用卡)','Apple Pay (國外卡)','Google Pay (國外卡)'];
  const dialog = document.createElement('dialog');
  dialog.className = 'payment-links-modal';
  dialog.setAttribute('aria-labelledby','payment-links-title');
  dialog.setAttribute('aria-label','付款連結管理');
  dialog.innerHTML = `<div class="payment-links-heading"><h2 id="payment-links-title"></h2><button type="button" class="payment-links-close" aria-label="關閉付款連結管理"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m3 3 10 10M13 3 3 13"/></svg></button></div>
  <form class="payment-links-config"><div class="payment-links-fields"><div class="payment-method-field"><span class="payment-method-label" id="payment-method-label">可付款方式:</span><div><label class="payment-checkbox"><input type="checkbox" class="payment-select-all">全選</label><div class="payment-method-options" role="group" aria-labelledby="payment-method-label"></div></div></div><div class="payment-invoice-field"><span>是否開立發票:</span><button type="button" role="switch" aria-checked="true" aria-label="是否開立發票" class="payment-switch"></button></div><label class="payment-return-field"><span>交易結果返回頁:</span><input type="url" aria-label="交易結果返回頁"></label><p class="payment-links-error" role="alert" hidden></p></div><button type="submit" class="btn primary payment-link-add" aria-label="新增付款連結">+</button></form>
  <div class="payment-links-table-wrap"><table class="payment-links-table"><thead><tr><th>編號</th><th>啟用</th><th>建立日期</th><th>可付款方式</th><th>是否開立發票</th><th>付款網址</th><th>交易結果返回頁</th></tr></thead><tbody></tbody></table></div>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const options = dialog.querySelector('.payment-method-options');
  methods.forEach(method=>{
    const label=document.createElement('label');label.className='payment-checkbox';
    const input=document.createElement('input');input.type='checkbox';input.value=method;
    label.append(input,document.createTextNode(method));options.append(label);
  });
  const all=dialog.querySelector('.payment-select-all');
  const checkboxes=[...options.querySelectorAll('input')];
  const invoice=dialog.querySelector('.payment-switch');
  const returnPage=dialog.querySelector('[type=url]');
  const error=dialog.querySelector('.payment-links-error');
  const tbody=dialog.querySelector('tbody');
  let productId, entries=[];
  const persist=()=>{try{sessionStorage.setItem('payment-demo-links-'+productId,JSON.stringify(entries));}catch{}};
  const toggle = button => button.setAttribute('aria-checked', String(button.getAttribute('aria-checked') !== 'true'));
  invoice.addEventListener('click',()=>toggle(invoice));
  all.addEventListener('change',()=>{checkboxes.forEach(input=>input.checked=all.checked);all.indeterminate=false;error.hidden=true;});
  checkboxes.forEach(input=>input.addEventListener('change',()=>{
    const count=checkboxes.filter(input=>input.checked).length;
    all.checked=count===checkboxes.length;all.indeterminate=count>0&&count<checkboxes.length;error.hidden=true;
  }));
  const render=()=>{
    tbody.replaceChildren();
    if(!entries.length){const tr=tbody.insertRow();const td=tr.insertCell();td.colSpan=7;td.className='payment-links-empty';td.textContent='暫無資料';return;}
    entries.forEach(entry=>{
      const tr=tbody.insertRow();
      const text=value=>{const td=tr.insertCell();td.textContent=value;return td;};
      text(entry.id);
      const enabled=tr.insertCell();
      const button=document.createElement('button');button.type='button';button.className='payment-switch';button.setAttribute('role','switch');button.setAttribute('aria-label','啟用付款連結 '+entry.id);button.setAttribute('aria-checked',String(entry.enabled));
      button.addEventListener('click',()=>{entry.enabled=!entry.enabled;button.setAttribute('aria-checked',String(entry.enabled));persist();});enabled.append(button);
      text(entry.created);
      const methodCell=tr.insertCell();entry.methods.forEach(method=>{const chip=document.createElement('span');chip.className='payment-method-chip';chip.textContent=method;methodCell.append(chip);});
      text(entry.invoice?'是':'否');
      const url=text(entry.url);url.className='payment-link-url';
      text(entry.returnPage);
    });
  };
  document.querySelector('.product-table tbody').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.textContent.trim()!=='付款連結管理')return;
    const row=button.closest('tr');productId=row.cells[0].textContent.trim();
    dialog.querySelector('h2').textContent=row.cells[1].textContent.trim();
    form.reset();all.indeterminate=false;invoice.setAttribute('aria-checked','true');error.hidden=true;
    try{entries=JSON.parse(sessionStorage.getItem('payment-demo-links-'+productId))||[];}catch{entries=[];}
    render();dialog.showModal();document.body.classList.add('payment-links-open');
  });
  dialog.querySelector('.payment-links-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>document.body.classList.remove('payment-links-open'));
  form.addEventListener('submit',event=>{
    event.preventDefault();const selected=checkboxes.filter(input=>input.checked).map(input=>input.value);
    if(!selected.length){error.textContent='請選擇至少一種付款方式。';error.hidden=false;checkboxes[0].focus();return;}
    if(returnPage.value && !/^https?:\/\//i.test(returnPage.value)){error.textContent='交易結果返回頁請輸入 http 或 https 網址。';error.hidden=false;returnPage.focus();return;}
    error.hidden=true;
    const created=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
    const token=crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):Date.now().toString(36)+Math.random().toString(36).slice(2);
    entries.push({id:Math.max(0,...entries.map(entry=>entry.id))+1,enabled:false,created,methods:selected,invoice:invoice.getAttribute('aria-checked')==='true',returnPage:returnPage.value,url:'https://payment.example.com/pay/'+productId+'/'+token});
    persist();render();
  });
})();
