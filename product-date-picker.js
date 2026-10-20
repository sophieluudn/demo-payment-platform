window.attachProductDatePicker = (dialog, inputs, changed) => {
  const panel = document.createElement('div'); panel.className = 'product-date-picker'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '選擇日期與時間');
  panel.innerHTML = '<div class="picker-inputs"><input type="date" aria-label="選擇日期"><input type="time" step="1" aria-label="選擇時間"></div><div class="picker-navigation"><button type="button" data-month="-12" aria-label="上一年">«</button><button type="button" data-month="-1" aria-label="上一月">‹</button><span></span><button type="button" data-month="1" aria-label="下一月">›</button><button type="button" data-month="12" aria-label="下一年">»</button></div><div class="picker-weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="picker-days"></div><div class="picker-actions"><button type="button" class="picker-now">現在</button><button type="button" class="btn plain picker-confirm">確認</button></div>';
  dialog.append(panel);
  const date = panel.querySelector('[type=date]'), time = panel.querySelector('[type=time]');
  let target, year, month;
  const pad = n => String(n).padStart(2, '0');
  const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
  const close = () => { panel.hidden = true; inputs.forEach(input=>input.setAttribute('aria-expanded','false')); };
  const render = () => {
    panel.querySelector('.picker-navigation span').textContent = year + ' 年 ' + (month + 1) + ' 月';
    const grid = panel.querySelector('.picker-days'); grid.replaceChildren();
    const first = new Date(year, month, 1).getDay();
    for(let i=0;i<42;i++){
      const day = new Date(year, month, i - first + 1);
      const value = day.getFullYear()+'-'+pad(day.getMonth()+1)+'-'+pad(day.getDate());
      const button=document.createElement('button'); button.type='button'; button.textContent=day.getDate(); button.setAttribute('aria-label',value);
      button.classList.toggle('outside-month',day.getMonth()!==month);button.classList.toggle('selected',value===date.value);
      button.addEventListener('click',()=>{date.value=value;render();});grid.append(button);
    }
  };
  const position = () => {
    const rect=target.getBoundingClientRect(); const width=Math.min(320,innerWidth-32);
    panel.style.width=width+'px'; panel.style.left=Math.max(16,Math.min(rect.left,innerWidth-width-16))+'px';
    const height=panel.offsetHeight;
    panel.style.top=Math.max(12,Math.min(rect.bottom+10,innerHeight-height-12))+'px';
  };
  inputs.forEach(input=>{
    input.setAttribute('aria-haspopup','dialog'); input.setAttribute('aria-expanded','false');
    const open=()=>{if(input.disabled)return;target=input;const value=input.value.replace('T',' ')||today();date.value=value.slice(0,10);time.value=value.slice(11)||'00:00:00';year=Number(date.value.slice(0,4));month=Number(date.value.slice(5,7))-1;panel.hidden=false;input.setAttribute('aria-expanded','true');render();position();};
    input.addEventListener('click',open);
    input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();open();date.focus();}});
  });
  panel.querySelectorAll('[data-month]').forEach(button=>button.addEventListener('click',()=>{const next=new Date(year,month+Number(button.dataset.month),1);year=next.getFullYear();month=next.getMonth();render();}));
  date.addEventListener('change',()=>{if(!date.value)return;year=Number(date.value.slice(0,4));month=Number(date.value.slice(5,7))-1;render();});
  panel.querySelector('.picker-now').addEventListener('click',()=>{const value=today();date.value=value.slice(0,10);time.value=value.slice(11);year=Number(date.value.slice(0,4));month=Number(date.value.slice(5,7))-1;render();});
  panel.querySelector('.picker-confirm').addEventListener('click',()=>{if(!date.value||!time.value||!date.validity.valid||!time.validity.valid)return;target.value=date.value+' '+(time.value.length===5?time.value+':00':time.value);close();changed();target.focus();});
  dialog.addEventListener('click',event=>{if(!panel.contains(event.target)&&!inputs.includes(event.target))close();});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopPropagation();close();target.focus();}});
  dialog.addEventListener('close',close); window.addEventListener('resize',close);
  return close;
};
