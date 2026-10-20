(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const number = params.get("order");
  const order = window.transactionOrders?.find(row => row[0] === number);
  const main = document.querySelector("main.order-detail");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  if (!order) {
    document.getElementById("order-breadcrumb").textContent = "訂單明細";
    main.innerHTML = `<a href="transactions.html" class="btn">返回所有交易紀錄</a><section class="detail-card"><h2>找不到此訂單</h2><p>請返回交易列表，選擇要查看的訂單。</p></section>`;
    return;
  }
  const [id, provider, product, store, project, card, payment, amount, created, paid, status] = order;
  const detail = window.transactionDetails?.[id] || {};
  const summary = (target, entries) => {
    document.getElementById(target).innerHTML = entries.map(([label,value])=>`<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join("");
  };
  const money = value => `NT$${Number(value).toLocaleString("en-US", {minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2, maximumFractionDigits:2})} 元`;
  document.getElementById("order-breadcrumb").textContent = id;
  document.title = `訂單 ${id}｜行動支付支援平台`;
  summary("product-summary",[["商品名稱",product],["商店",store],["專案",project]]);
  const tags = document.querySelector(".detail-tags");
  tags.innerHTML = `<span>標籤</span>${detail.tags?.length ? `<div>${detail.tags.map(esc).join("、")}</div>` : ""}`;
  const snapshot = window.TransactionFees?.read(id);
  const estimate = snapshot ? null : window.TransactionFees?.estimate(order);
  const feeMoney = value => `NT$${Number(value).toLocaleString("en-US", {minimumFractionDigits:5, maximumFractionDigits:5})} 元`;
  const rate = snapshot || estimate;
  const fee = rate ? feeMoney(rate.feeAmount) : "—";
  summary("payment-summary",[["udn金流訂單編號",id],["交易金額",money(amount)],[snapshot ? "交易手續費" : "預估手續費",fee],["訂單狀態",status],["支付方式",payment],["交易類別",card],["付款人 E-Mail",detail.email || "payer@example.com"],["發票資訊",""]]);
  summary("transaction-summary",[["第三方金流序號",provider],["產品訂單編號",detail.productOrder],["交易日期",created],["交易截止日期",detail.deadline],["支付日期",paid],["交易 IP",detail.ip],["備註",detail.note]]);
  const history = detail.history || [
    [created,"交易開始","訂單建立"],
    [created,"處理中",`開始${payment.includes("信用卡") ? "信用卡" : payment}交易`],
    ...(paid ? [
      [paid,"處理中","藍新回傳NotifyURL"],
      [paid,"交易成功",`${payment.includes("信用卡") ? "信用卡" : payment}成功`],
    ] : []),
    ...(order[12] ? [[paid,order[13] || "開發票成功",`發票${order[12]}開立成功`]] : []),
  ];
  const target = document.getElementById("order-history");
  target.innerHTML = history.map(row=>`<tr>${row.map(value=>`<td>${esc(value || "—")}</td>`).join("")}</tr>`).join("");
  const button = document.getElementById("refund-button");
  button.classList.add("danger");
  window.initializeRefund?.(order);
})();
