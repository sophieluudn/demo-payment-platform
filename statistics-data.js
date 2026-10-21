(() => {
  "use strict";
  const form = document.querySelector("main form"), tbody = document.querySelector("main tbody");
  const selects = [...form.querySelectorAll("select")];
  const app = PaymentAccess.model(), projects = app.projects("reports");
  const fill = (select, values) => { select.replaceChildren(new Option("全部", "")); values.forEach(([id,name]) => select.add(new Option(name,id))); };
  fill(selects[0],projects.map(p => [p.id,p.name]));
  fill(selects[1],[...new Set(window.transactionOrders.filter(o => PaymentAccess.allows(o,"reports")).map(o => o[2]))].map(name => [name,name]));
  const records = action => {
    const dates = form.querySelector("input").value.match(/\d{4}-\d{1,2}-\d{1,2}/g) || [];
    return window.transactionOrders.filter(o => PaymentAccess.allows(o,"reports",action) && (!selects[0].value || o[14] === selects[0].value) && (!selects[1].value || o[2] === selects[1].value) && (dates.length !== 2 || (o[9]?.slice(0,10) >= dates[0] && o[9]?.slice(0,10) <= dates[1])));
  };
  const rows = action => {
    const grouped = new Map(), byPayment = form.querySelectorAll('input[type="radio"]')[1]?.checked;
    records(action).forEach(o => {
    let state;
    try { state = JSON.parse(sessionStorage.getItem("payment-demo-refund-"+o[0])); } catch { /* fixture state */ }
    state ||= window.transactionDemoStates[o[0]];
    const refund = Number(state?.value || 0), fee = app.data.feeSnapshots[o[0]]?.feeAmount;
      const label = byPayment ? o[6] : o[2], key = JSON.stringify([o[14],label]);
      const row = grouped.get(key) || [app.data.projects.find(p => p.id === o[14])?.name,label,byPayment ? "—" : o[7],0,0,0,0,0,"—",0];
      if (!byPayment && row[2] !== o[7]) row[2] = "多種價格";
      row[3]++; row[4] += Number(o[7]); row[6] += refund ? 1 : 0; row[7] += refund;
      row[5] = row[5] === "—" || fee === undefined ? "—" : row[5] + fee;
      row[9] = row[5] === "—" ? "—" : row[4]-row[7]-row[5];
      grouped.set(key,row);
    });
    return [...grouped.values()];
  };
  const render = () => {
    tbody.replaceChildren();
    document.querySelector("main th:nth-child(2)").textContent = form.querySelectorAll('input[type="radio"]')[1]?.checked ? "支付方式" : "商品名稱";
    rows("view").forEach(values => { const row = tbody.insertRow(); values.forEach(v => row.insertCell().textContent = v); });
    if (!tbody.rows.length) { const cell = tbody.insertRow().insertCell(); cell.colSpan = 10; cell.className = "empty"; cell.textContent = "無符合授權範圍的交易資料"; }
    document.querySelector(".pager").firstChild.textContent = `共 ${records("view").length} 項`;
  };
  form.addEventListener("submit",event => {event.preventDefault(); render();});
  form.querySelector('button[type="button"]')?.addEventListener("click",render);
  form.addEventListener("reset",() => setTimeout(render));
  const button = document.querySelector(".export button");
  button.dataset.permissionAction = "export";
  button.addEventListener("click",() => {
    const url = URL.createObjectURL(new Blob(["\uFEFF"+rows("export").map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a"); link.href = url; link.download = "statistics.csv"; link.click(); URL.revokeObjectURL(url);
  });
  button.textContent = "匯出 CSV";
  render();
})();
