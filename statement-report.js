(() => {
  const dialog=document.createElement('dialog');dialog.className='statement-report';dialog.setAttribute('aria-label','交易與退款紀錄');
  dialog.innerHTML='<button class="report-close" type="button" aria-label="關閉交易與退款紀錄"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m3 3 10 10M13 3 3 13"/></svg></button><div class="report-context"></div><div class="report-tabs" role="tablist" aria-label="紀錄類型"></div><div class="report-scroll" role="tabpanel" id="statement-report-panel"><table><thead></thead><tbody></tbody><tfoot></tfoot></table></div><div class="report-actions"><button class="btn plain report-export" type="button">匯出</button></div>';
  document.body.append(dialog);
  const common=['第三方金流序號','udn金流訂單編號','產品訂單編號','email','支付方式','交易類別'];
  const headers=[
    [...common,'金額(含稅)','手續費(含稅)','入帳金額(含稅)','交易日期','發票號碼','稅額','銷售額','總計','商店名稱','專案名稱','商品名稱','備註','標籤'],
    [...common,'金額(含稅)','手續費(含稅)','入帳金額(含稅)','退款金額(含稅)','退款日期','發票號碼','商店名稱','專案名稱','商品名稱','備註','標籤'],
    [...common,'退款金額(含稅)','退款手續費','退款入帳金額','退款日期','作廢發票號碼','稅額','銷售額','總計','作廢/折讓','折讓單號','商店名稱','專案名稱','商品名稱','備註','標籤']
  ];
  let statement,active=0,records=[],currentRows=[];
  const tabs=['交易','退款','退款V2'];
  tabs.forEach((name,index)=>{const tab=document.createElement('button');tab.type='button';tab.textContent=name;tab.id='statement-report-tab-'+index;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','statement-report-panel');tab.addEventListener('click',()=>{active=index;render();});tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();active=(index+(event.key==='ArrowRight'?1:2))%3;render();dialog.querySelectorAll('[role=tab]')[active].focus();});dialog.querySelector('.report-tabs').append(tab);});
  const round=value=>Math.round(value*100)/100;
  const build=()=>{
    // Standalone report fixtures use the selected statement's range and scope.
    records=window.transactionOrders.map((order,index)=>{
      const amount=Number(order[7]);const fee=round(amount*.02);const tax=order[11]==='應稅'?Math.round(amount-amount/1.05):0;
      const refund=index%3===0?amount:index%3===1?round(amount*.4):0;
      const refundFee=round(refund*.03);const refundTax=order[11]==='應稅'?Math.round(refund-refund/1.05):0;
      return {order,amount,fee,tax,refund,refundFee,refundTax,date:statement.start+' 12:30:'+String(index).padStart(2,'0'),refundDate:statement.end+' 15:40:'+String(index).padStart(2,'0'),store:statement.stores[index%statement.stores.length],project:statement.projects[index%statement.projects.length],product:statement.products[0]==='全部商品'?order[2]:statement.products[index%statement.products.length],allowance:statement.start.slice(0,7)!==statement.end.slice(0,7),note:refund?(refund===amount?'全額退款':'部份退款')+'，退款原因：買家反悔':''};
    });
  };
  const render=()=>{
    dialog.querySelectorAll('[role=tab]').forEach((tab,index)=>{tab.setAttribute('aria-selected',String(index===active));tab.tabIndex=index===active?0:-1;});
    dialog.querySelector('[role=tabpanel]').setAttribute('aria-labelledby','statement-report-tab-'+active);
    const head=dialog.querySelector('thead'),body=dialog.querySelector('tbody'),foot=dialog.querySelector('tfoot');head.replaceChildren();body.replaceChildren();foot.replaceChildren();
    const header=head.insertRow();headers[active].forEach(label=>{const th=document.createElement('th');th.textContent=label;th.scope='col';header.append(th);});
    const visible=active?records.filter(record=>record.refund>0):records;
    currentRows=visible.map(record=>{
      const {order,amount,fee,tax,refund,refundFee,refundTax,date,refundDate,store,project,product,allowance,note}=record;
      const prefix=[order[1],order[0],'DEMO-'+order[0],'customer@example.com',order[6],order[5]];
      if(active===0)return [...prefix,amount,fee,round(amount-fee),date,order[12],tax,amount-tax,amount,store,project,product,note,''];
      if(active===1)return [...prefix,amount,fee,round(amount-fee),refund,refundDate,order[12],store,project,product,note,''];
      return [...prefix,refund,refundFee,round(refund-refundFee),refundDate,order[12],refundTax,refund-refundTax,refund,allowance?'折讓':'作廢',allowance?'A-DEMO-'+order[0]:'',store,project,product,note,''];
    });
    currentRows.forEach(values=>{const row=body.insertRow();values.forEach(value=>{const cell=row.insertCell();cell.textContent=value;});});
    if(!currentRows.length){const cell=body.insertRow().insertCell();cell.colSpan=headers[active].length;cell.textContent='暫無資料';}
    const total=foot.insertRow();const numeric=active===0?[6,7,8,11,12,13]:active===1?[6,7,8,9]:[6,7,8,11,12,13];
    headers[active].forEach((label,index)=>{const cell=total.insertCell();cell.textContent=index===0?'總計':numeric.includes(index)?round(currentRows.reduce((sum,row)=>sum+Number(row[index]),0)).toLocaleString('zh-TW',{maximumFractionDigits:2}):'';});
    dialog.querySelector('.report-scroll').scrollTop=0;
  };
  window.openStatementReport=entry=>{statement=entry;active=0;build();render();dialog.querySelector('.report-context').textContent=entry.name+'｜'+entry.start+' 至 '+entry.end+'（模擬資料）';dialog.showModal();document.body.classList.add('statement-report-open');};
  dialog.querySelector('.report-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>document.body.classList.remove('statement-report-open'));
  dialog.querySelector('.report-export').addEventListener('click',()=>{
    const total=[...dialog.querySelector('tfoot tr').cells].map(cell=>cell.textContent);
    const escape=value=>'"'+String(typeof value==='string'&&/^[=+@-]/.test(value)?"'"+value:value).replaceAll('"','""')+'"';
    const csv='\uFEFF'+[headers[active],...currentRows,total].map(row=>row.map(escape).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=statement.name.replace(/[\\/:*?"<>|]/g,'_')+'-'+tabs[active]+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
})();
