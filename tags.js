(() => {
  const tbody=document.querySelector('main table tbody');
  const add=document.querySelector('#tag-add');
  const pager=document.querySelector('.pager');
  const toolbar=document.querySelector('.tag-list-toolbar');
  const sort=toolbar.querySelector('.tag-sort-label');
  document.getElementById('tag-search-form').prepend(sort);
  toolbar.prepend(pager);
  let tags=[...tbody.rows].map((row,index)=>({id:index+1,name:row.cells[0].textContent,description:row.cells[1].textContent}));
  try{tags=JSON.parse(sessionStorage.getItem('payment-demo-tags'))||tags;}catch{}
  let active=null;
  let query='';
  const editMarkup='編輯';
  const render=()=>{
    const visible=tags.filter(tag=>tag.name.includes(query));
    tbody.replaceChildren();visible.forEach(tag=>{
      const row=tbody.insertRow();row.dataset.id=tag.id;
      [tag.name,tag.description].forEach(value=>{const cell=row.insertCell();cell.textContent=value;});
      row.insertCell().innerHTML='<button type="button" class="btn primary tag-edit">'+editMarkup+'</button>';
    });
    pager.firstChild.textContent='共 '+visible.length+' 項';add.disabled=false;
  };
  const finish=()=>{active=null;render();};
  const begin=tag=>{
    if(active)return;
    active=tag||{id:Math.max(0,...tags.map(tag=>tag.id))+1,name:'',description:'',isNew:true};
    let row;
    if(active.isNew){row=tbody.insertRow(0);for(let i=0;i<3;i++)row.insertCell();}
    else row=[...tbody.rows].find(row=>Number(row.dataset.id)===tag.id);
    row.classList.add('tag-editing');
    const fields=['name','description'];
    fields.forEach((key,index)=>{
      const input=document.createElement('input');input.value=active[key];input.setAttribute('aria-label',key==='name'?'標籤名稱':'標籤說明');
      row.cells[index].replaceChildren(input);
    });
    row.cells[2].innerHTML='<button type="button" class="btn success tag-save">確定</button><button type="button" class="btn gray tag-cancel">取消</button>';
    add.disabled=true;tbody.querySelectorAll('.tag-edit').forEach(button=>button.disabled=true);
    const inputs=[...row.querySelectorAll('input')];const confirm=row.querySelector('.tag-save');
    const validate=()=>{confirm.disabled=!inputs[0].value.trim();};validate();inputs[0].addEventListener('input',validate);
    const commit=()=>{
      if(!inputs[0].value.trim())return;
      const saved={id:active.id,name:inputs[0].value.trim(),description:inputs[1].value.trim()};
      if(active.isNew)tags.unshift(saved);else tags[tags.findIndex(tag=>tag.id===active.id)]=saved;
      try{sessionStorage.setItem('payment-demo-tags',JSON.stringify(tags));}catch{}
      finish();
    };
    confirm.addEventListener('click',commit);row.querySelector('.tag-cancel').addEventListener('click',finish);
    row.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();finish();}else if(event.key==='Enter'&&event.target.tagName==='INPUT'){event.preventDefault();commit();}});
    inputs[0].focus();
  };
  tbody.addEventListener('click',event=>{const button=event.target.closest('.tag-edit');if(!button||button.disabled)return;begin(tags.find(tag=>tag.id===Number(button.closest('tr').dataset.id)));});
  add.addEventListener('click',()=>begin());render();
  document.getElementById('tag-search-form').addEventListener('submit',event=>{event.preventDefault();if(active)return;query=document.getElementById('tag-search-name').value.trim();render();});
  document.getElementById('tag-search-reset').addEventListener('click',()=>{if(active)return;document.getElementById('tag-search-form').reset();query='';render();});
})();
