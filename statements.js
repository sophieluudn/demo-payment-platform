(() => {
  const tbody=document.querySelector('.statement-table tbody');
  const pager=document.querySelector('.pager');const baselineCount=Number(pager.firstChild.textContent.match(/\d+/)[0]);const baselineRows=tbody.rows.length;
  const chips=cell=>[...cell.querySelectorAll('.chip')].map(chip=>chip.textContent);
  let entries=[...tbody.rows].map(row=>{const range=row.cells[5].textContent.split(' - ').map(date=>date.replaceAll('/','-'));return {id:Number(row.cells[0].textContent),name:row.cells[1].textContent,type:row.cells[2].textContent,stores:chips(row.cells[3]),projects:chips(row.cells[4]),products:['全部商品'],start:range[0],end:range[1],notes:row.cells[8].textContent,archived:''};});
  try{entries=JSON.parse(sessionStorage.getItem('payment-demo-statements'))||entries;}catch{}
  const choices={stores:[...new Set(entries.flatMap(entry=>entry.stores))],projects:[...new Set(entries.flatMap(entry=>entry.projects))],products:['全部商品','(免稅) 不定額商品','(應稅) 不定額商品','高單價商品','Lady M','[測試] 未上架商品']};
  const dialog=document.createElement('dialog');dialog.className='statement-modal';dialog.setAttribute('aria-labelledby','statement-modal-title');
  dialog.innerHTML=`<div class="statement-modal-heading"><h2 id="statement-modal-title">新增對帳單</h2><button type="button" class="statement-close" aria-label="關閉對帳單視窗"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m3 3 10 10M13 3 3 13"/></svg></button></div><form><div class="statement-fields"><div class="statement-form-row"><span class="statement-label required" id="statement-type-label">類型</span><div class="statement-types" role="radiogroup" aria-labelledby="statement-type-label"></div></div><div class="statement-form-row"><label class="required" for="statement-name">對帳單名稱</label><input id="statement-name" name="name" placeholder="請輸入對帳單名稱" required></div><div class="statement-form-row"><span class="statement-label required">商店</span><div data-multi="stores"></div></div><div class="statement-form-row"><span class="statement-label required">專案</span><div data-multi="projects"></div></div><div class="statement-form-row"><span class="statement-label required">商品</span><div data-multi="products"></div></div><div class="statement-form-row"><span class="statement-label required">時間</span><div class="statement-date-range"><input type="date" name="start" aria-label="開始日期" required><span>至</span><input type="date" name="end" aria-label="結束日期" required></div></div><div class="statement-form-row"><label for="statement-notes">備註</label><textarea id="statement-notes" name="notes" rows="4"></textarea></div></div><p class="statement-error" role="alert" hidden></p><div class="statement-actions"><button type="button" class="btn plain statement-cancel">取消</button><button type="submit" class="btn primary statement-save" disabled>儲存</button></div></form>`;
  document.body.append(dialog);const form=dialog.querySelector('form');const save=dialog.querySelector('.statement-save');const error=dialog.querySelector('.statement-error');
  ['財務(全部)','財務(藍新)','財務(LINEPAY)','BU'].forEach(value=>{const label=document.createElement('label');const input=document.createElement('input');input.type='radio';input.name='type';input.value=value;input.required=true;label.append(input,document.createTextNode(value));dialog.querySelector('.statement-types').append(label);});
  let editing=null,selected={};
  const validate=()=>{const bad=form.elements.start.value&&form.elements.end.value&&form.elements.end.value<form.elements.start.value;form.elements.end.setCustomValidity(bad?'結束日期不可早於開始日期。':'');error.textContent=bad?'結束日期不可早於開始日期。':'';error.hidden=!bad;save.disabled=!form.checkValidity()||Object.keys(choices).some(key=>!selected[key]?.length);};
  const drawMulti=key=>{
    const container=dialog.querySelector('[data-multi="'+key+'"]');container.replaceChildren();
    const details=document.createElement('details');details.className='statement-multi';
    const summary=document.createElement('summary');summary.setAttribute('aria-label',{stores:'選擇商店',projects:'選擇專案',products:'選擇商品'}[key]);
    if(!selected[key].length){summary.textContent='選擇分類標籤';summary.classList.add('placeholder');}
    else{const chip=document.createElement('span');chip.className='statement-selected';chip.textContent=selected[key][0];summary.append(chip);if(selected[key].length>1){const rest=document.createElement('span');rest.className='statement-selected';rest.textContent='+ '+(selected[key].length-1);summary.append(rest);}}
    const list=document.createElement('div');list.className='statement-multi-options';
    [...new Set([...choices[key],...selected[key]])].forEach(value=>{const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.checked=selected[key].includes(value);label.append(input,document.createTextNode(value));list.append(label);input.addEventListener('change',()=>{selected[key]=input.checked?[...selected[key],value]:selected[key].filter(item=>item!==value);drawMulti(key);container.querySelector('details').open=true;validate();});});
    details.append(summary,list);container.append(details);
  };
  const persist=()=>{try{sessionStorage.setItem('payment-demo-statements',JSON.stringify(entries));}catch{}};
  const render=()=>{
    tbody.replaceChildren();entries.forEach(entry=>{
      const row=tbody.insertRow();row.dataset.id=entry.id;
      [entry.id,entry.name,entry.type].forEach(value=>row.insertCell().textContent=value);
      [entry.stores,entry.projects].forEach(values=>{const cell=row.insertCell();values.forEach(value=>{const chip=document.createElement('span');chip.className='chip';chip.textContent=value;cell.append(chip);});});
      const link=document.createElement('a');link.href='#statement-edit';link.textContent=entry.start.replaceAll('-','/')+' - '+entry.end.replaceAll('-','/');row.insertCell().append(link);
      const archive=row.insertCell();if(entry.archived)archive.textContent=entry.archived;else archive.innerHTML='<button type="button" class="btn plain statement-archive">封存</button>';
      row.insertCell().innerHTML='<button type="button" class="btn primary">檢視 / 匯出</button>';row.insertCell().textContent=entry.notes;
    });pager.firstChild.textContent='共 '+(baselineCount+entries.length-baselineRows)+' 項';
  };
  const open=entry=>{
    editing=entry;form.reset();dialog.querySelector('h2').textContent=entry?'編輯對帳單':'新增對帳單';
    selected={stores:[...(entry?.stores||[])],projects:[...(entry?.projects||[])],products:[...(entry?.products||[])]};Object.keys(choices).forEach(drawMulti);
    for(const key of ['name','type','start','end','notes'])form.elements[key].value=entry?.[key]||'';
    form.elements.start.disabled=!!entry?.archived;form.elements.end.disabled=!!entry?.archived;
    dialog.querySelector('.statement-date-range').classList.toggle('archived',!!entry?.archived);
    validate();dialog.showModal();document.body.classList.add('statement-modal-open');
  };
  document.querySelector('main>.success').addEventListener('click',()=>open(null));
  tbody.addEventListener('click',event=>{const row=event.target.closest('tr');if(!row)return;const entry=entries.find(entry=>entry.id===Number(row.dataset.id));if(event.target.closest('a')){event.preventDefault();open(entry);}else if(event.target.closest('button')?.textContent.trim()==='檢視 / 匯出'){window.openStatementReport(entry);}else if(event.target.closest('.statement-archive')){entry.archived=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replaceAll('-','/');persist();render();}});
  form.addEventListener('input',validate);form.addEventListener('change',validate);
  form.addEventListener('submit',event=>{event.preventDefault();validate();if(save.disabled)return;const data=Object.fromEntries(new FormData(form));const entry={...data,...selected,id:editing?.id||Math.max(0,...entries.map(entry=>entry.id))+1,archived:editing?.archived||''};if(editing?.archived){entry.start=editing.start;entry.end=editing.end;}if(editing)entries[entries.indexOf(editing)]=entry;else entries.unshift(entry);persist();render();dialog.close();});
  dialog.querySelector('.statement-close').addEventListener('click',()=>dialog.close());dialog.querySelector('.statement-cancel').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>document.body.classList.remove('statement-modal-open'));render();
})();
