window.initializeRefund = (order) => {
  // ───────────────────────── 1. 解構與狀態初始化 ─────────────────────────
  const [number, provider, product, , , , payment, rawAmount, , , , , invoice] = order;
  const amount = Number(rawAmount);
  const storageKey = `payment-demo-refund-${number}`;
  const closeIcon = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="m3 3 10 10M13 3 3 13"/></svg>`;

  const getInitialDemoState = () =>
    JSON.parse(JSON.stringify(window.transactionDemoStates?.[number] || {}));

  let state;
  try {
    state = JSON.parse(sessionStorage.getItem(storageKey)) || getInitialDemoState();
  } catch {
    state = getInitialDemoState();
  }

  let isBusy = false;
  let activeConfirmAction = null; // 'invoice' | 'refund'
  const isCurrentMonth = window.transactionInvoices.isCurrentMonth(order);

  // ───────────────────────── 2. DOM 視窗建立 ─────────────────────────
  const dialog = document.getElementById("refund-dialog");
  const trigger = document.getElementById("refund-button");

  dialog.className = "refund-modal";
  dialog.setAttribute("aria-labelledby", "refund-title");
  dialog.innerHTML = `
    <div class="refund-heading">
      <h2 id="refund-title">退款</h2>
      <button type="button" class="refund-close" aria-label="關閉退款視窗">${closeIcon}</button>
    </div>
    <div class="refund-table-wrap">
      <table class="refund-table">
        <thead>
          <tr>
            <th>商店訂單編號</th>
            <th>商品名稱</th>
            <th>訂單金額</th>
            <th>發票號碼</th>
            <th>發票金額</th>
            <th>退款金額</th>
            <th>發票處理</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-value="provider"></td>
            <td data-value="product"></td>
            <td data-value="amount"></td>
            <td data-value="invoice"></td>
            <td data-value="amount"></td>
            <td>
              <input id="refund-amount" aria-label="退款金額" type="number" min="1" step="1" value="0" aria-describedby="refund-error">
            </td>
            <td>
              <button class="btn plain invoice-process" type="button" disabled>折讓 / 作廢</button>
            </td>
          </tr>
          <tr class="refund-total-row">
            <td colspan="4"></td>
            <td>退款總金額</td>
            <td><output id="refund-total" aria-live="polite">0</output></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p id="refund-error" class="refund-error" role="alert" hidden></p>
    <section class="refund-settings" hidden>
      <div class="refund-reason-label">
      <label for="refund-reason">退款原因:</label>
      </div>
      <div class="refund-reason-fields">
        <select id="refund-reason" aria-label="退款原因">
          <option>買家反悔</option>
          <option>不慎誤購</option>
          <option>重複訂購</option>
          <option>詐欺訂單</option>
          <option>其他原因</option>
        </select>
        <input id="refund-document" aria-label="電子公文文號" placeholder="若為線下退款，請輸入電子公文文號">
      </div>
      <div class="refund-other-row" hidden>
      <textarea id="refund-other-reason" aria-label="其他原因" placeholder="請輸入其他原因" rows="2" hidden disabled></textarea>
      </div>
      <button class="btn primary refund-submit" type="button">確定退款</button>
    </section>
  `;

  // 填入表格基礎數據
  dialog.querySelectorAll("[data-value]").forEach((el) => {
    const valMap = {
      provider,
      product,
      amount: `${amount.toLocaleString("zh-TW")} 元`,
      invoice,
    };
    el.textContent = valMap[el.dataset.value];
  });

  // 建立確認彈窗 Modal
  const createConfirmationModal = () => {
    const modal = document.createElement("dialog");
    modal.className = "refund-confirm";
    modal.setAttribute("aria-labelledby", "refund-confirm-message");
    modal.innerHTML = `
      <button class="refund-close" type="button" aria-label="關閉確認視窗">${closeIcon}</button>
      <p id="refund-confirm-message"></p>
      <div class="refund-confirm-actions">
        <button type="button" class="btn plain confirm-cancel">取消</button>
        <button type="button" class="btn primary confirm-accept">確定</button>
      </div>
    `;
    document.body.append(modal);
    return modal;
  };

  const confirmationModal = createConfirmationModal();

  // ───────────────────────── 3. 工具與 Helper 函式 ─────────────────────────
  const formatNow = () =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());

  const saveState = () => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  };

  const appendHistoryRow = (entry) => {
    const tr = document.createElement("tr");
    entry.forEach((val) => {
      const td = document.createElement("td");
      td.textContent = val;
      tr.append(td);
    });
    document.getElementById("order-history")?.append(tr);
  };

  (state.history || []).forEach(appendHistoryRow);

  const addHistoryRecord = (status, message) => {
    const entry = [formatNow(), status, message];
    state.history = [...(state.history || []), entry];
    saveState();
    appendHistoryRow(entry);
  };

  // 通知訊息 Helper (Toast)
  const noticeEl = document.createElement("div");
  noticeEl.className = "refund-notice";
  noticeEl.setAttribute("role", "status");
  noticeEl.setAttribute("aria-live", "polite");
  noticeEl.hidden = true;
  let noticeTimer;

  const notify = (message) => {
    clearTimeout(noticeTimer);
    (dialog.open ? dialog : document.body).append(noticeEl);
    noticeEl.replaceChildren();

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    icon.setAttribute("viewBox", "0 0 16 16");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<circle cx="8" cy="8" r="8" fill="currentColor"/><path d="m4 8 3 3 5-6" fill="none" stroke="white" stroke-width="1.5"/>';

    noticeEl.append(icon, document.createTextNode(message));
    noticeEl.hidden = false;
    noticeTimer = setTimeout(() => {
      noticeEl.hidden = true;
    }, 4000);
  };

  // ───────────────────────── 4. UI 畫面渲染 ─────────────────────────
  const input = dialog.querySelector("#refund-amount");
  input.max = amount;

  const processBtn = dialog.querySelector(".invoice-process");
  const settingsSec = dialog.querySelector(".refund-settings");
  const submitBtn = dialog.querySelector(".refund-submit");
  const reasonSelect = dialog.querySelector("#refund-reason");
  const docInput = dialog.querySelector("#refund-document");
  const otherReasonInput = dialog.querySelector("#refund-other-reason");
  const errorMsg = dialog.querySelector("#refund-error");

  const updateOrderStatusUI = () => {
    const invoiceTarget = document.querySelector("#payment-summary dd:last-child");
    window.transactionInvoices.render(invoiceTarget, order, state, false);

    if (!state.completed) return;

    const statusText = Number(state.value) === amount ? "取消交易" : "部份退款";
    const statusDt = [...document.querySelectorAll("#payment-summary dt")].find(
      (el) => el.textContent === "訂單狀態"
    );
    if (statusDt) statusDt.nextElementSibling.textContent = statusText;

    trigger.disabled = true;
    trigger.textContent = "已退款";
  };

  const renderUI = () => {
    if (state.processed) input.value = state.value;

    input.disabled = !!state.processed;
    processBtn.disabled =
      !!state.processed || !input.validity.valid || Number(input.value) <= 0;
    processBtn.textContent = state.processed
      ? isCurrentMonth
        ? "已作廢"
        : "已折讓"
      : "折讓 / 作廢";

    settingsSec.hidden = !state.processed;

    const totalVal = input.value === "" || !Number.isFinite(input.valueAsNumber)
      ? "0"
      : input.value;
    document.getElementById("refund-total").textContent = totalVal;

    updateOrderStatusUI();
  };

  // ───────────────────────── 5. 發票與退款處理邏輯 ─────────────────────────
  // 找出目前所有已使用的發票號碼（避免重號）
  const getUsedInvoiceNumbers = () => {
    const used = new Set(window.transactionOrders.map((row) => row[12]));
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k.startsWith("payment-demo-refund-")) continue;
      try {
        (JSON.parse(sessionStorage.getItem(k))?.invoices || []).forEach(
          (item) => used.add(item.number)
        );
      } catch {}
    }
    return used;
  };

  // 發票作廢 / 折讓處理
  const processInvoiceAction = () => {
    PaymentAccess.assert(order,"transactions","refund");
    state.value = Number(input.value);
    state.processed = true;
    saveState();

    const date = formatNow();
    const resultText = isCurrentMonth ? "發票作廢成功" : "發票折讓開立成功";

    state.invoices = [{ number: invoice, amount, status: resultText, date: order[9] }];

    if (isCurrentMonth) {
      addHistoryRecord("作廢發票", `執行發票作廢成功，發票 ${invoice}`);
    } else {
      state.allowance = {
        number: `A${date.replace(/\D/g, "")}${number.slice(-5)}`,
        amount: state.value,
        remaining: amount - state.value,
        date,
      };
      state.invoices[0].allowance = state.allowance;
      addHistoryRecord(
        "發票折讓開立成功",
        `發票號碼：${invoice}，折讓金額：NT$${state.value}，折讓後剩餘發票金額：NT$${state.allowance.remaining}，折讓單號：${state.allowance.number}`
      );
    }

    // 當月作廢且為部份退款時：自動重開一張剩餘金額的發票
    if (isCurrentMonth && state.value < amount) {
      const usedInvoices = getUsedInvoiceNumbers();
      let nextSeq = Number(invoice.slice(2)) + 1;

      while (usedInvoices.has(invoice.slice(0, 2) + String(nextSeq).padStart(8, "0"))) {
        nextSeq++;
      }

      const newInvoiceNo = invoice.slice(0, 2) + String(nextSeq).padStart(8, "0");
      const remainingAmount = amount - state.value;

      state.invoices.push({
        number: newInvoiceNo,
        amount: remainingAmount,
        status: "開發票成功",
        date,
      });

      addHistoryRecord("開發票成功", `重開發票 ${newInvoiceNo}，金額 NT$${remainingAmount}`);
      addHistoryRecord("開立發票", `新開立發票號碼：${newInvoiceNo}，原訂單編號：${number}`);
    }

    saveState();
    renderUI();
    notify(isCurrentMonth && state.value < amount ? "發票作廢及重開成功" : resultText);
    submitBtn.focus();
  };

  // 退款處理
  const processRefundAction = () => {
    PaymentAccess.assert(order,"transactions","refund");
    addHistoryRecord("取消交易處理中", `執行退款，金額 NT$${state.value}`);

    state.completed = true;
    state.reason = reasonSelect.value;
    state.otherReason = reasonSelect.value === "其他原因" ? otherReasonInput.value.trim() : "";
    state.document = docInput.value.trim();

    saveState();
    updateOrderStatusUI();

    const refundType = state.value === amount ? "全額退款" : "部份退款";
    const extraReason = state.otherReason ? `：${state.otherReason}` : "";

    addHistoryRecord(
      "退款成功",
      `執行退款成功，金額 NT$${state.value}；${refundType}。退款原因：${state.reason}${extraReason}`
    );

    dialog.close();
    notify("退款成功");
  };

  // ───────────────────────── 6. 事件處理與觸發器 ─────────────────────────
  docInput.addEventListener("input", () => {
    if (docInput.value.trim()) errorMsg.hidden = true;
  });

  reasonSelect.addEventListener("change", () => {
    errorMsg.hidden = true;
    otherReasonInput.hidden = reasonSelect.value !== "其他原因";
    otherReasonInput.closest(".refund-other-row").hidden = otherReasonInput.hidden;
    otherReasonInput.disabled = otherReasonInput.hidden;
  });

  input.addEventListener("input", () => {
    const isInvalid = !input.validity.valid && input.value !== "" && input.value !== "0";
    errorMsg.hidden = !isInvalid;
    errorMsg.textContent = `退款金額須為 1 至 ${amount} 元的整數。`;
    input.setAttribute("aria-invalid", String(isInvalid));
    renderUI();
  });

  const promptConfirm = (type) => {
    activeConfirmAction = type;
    confirmationModal.querySelector("p").textContent =
      type === "invoice" ? "確認作廢 / 折讓?" : "確認退款?";
    confirmationModal.showModal();
  };

  processBtn.addEventListener("click", () => {
    if (!processBtn.disabled && !isBusy) promptConfirm("invoice");
  });

  submitBtn.addEventListener("click", () => {
    if (isBusy || !state.processed || state.completed) return;
    errorMsg.hidden = true;
    promptConfirm("refund");
  });

  // 確認視窗按鈕與非同步模擬
  const acceptBtn = confirmationModal.querySelector(".confirm-accept");
  const cancelConfirmModal = () => {
    if (!isBusy) confirmationModal.close();
  };

  confirmationModal.querySelector(".confirm-cancel").addEventListener("click", cancelConfirmModal);
  confirmationModal.querySelector(".refund-close").addEventListener("click", cancelConfirmModal);
  confirmationModal.addEventListener("cancel", (e) => {
    if (isBusy) e.preventDefault();
  });

  acceptBtn.addEventListener("click", async () => {
    if (isBusy) return;

    isBusy = true;
    confirmationModal.querySelectorAll("button").forEach((btn) => (btn.disabled = true));
    acceptBtn.textContent = "處理中…";

    // 模擬 API 操作延遲
    await new Promise((resolve) => setTimeout(resolve, 450));

    confirmationModal.close();

    try {
      if (activeConfirmAction === "invoice") processInvoiceAction();
      else processRefundAction();
    } catch (error) {
      errorMsg.hidden = false;
      errorMsg.textContent = error.message;
    }

    isBusy = false;
    confirmationModal.querySelectorAll("button").forEach((btn) => (btn.disabled = false));
    acceptBtn.textContent = "確定";
  });

  // 主 Dialog 關閉與開啟觸發
  dialog.querySelector(".refund-close").addEventListener("click", () => {
    if (!isBusy) dialog.close();
  });

  dialog.addEventListener("cancel", (e) => {
    if (isBusy) e.preventDefault();
  });

  dialog.addEventListener("close", () => {
    document.body.classList.remove("refund-modal-open");
    if (!noticeEl.hidden) document.body.append(noticeEl);
  });

  trigger.dataset.permissionFeature = "transactions";
  trigger.dataset.permissionAction = "refund";
  trigger.dataset.projectId = order[14];
  trigger.hidden = !PaymentAccess.allows(order,"transactions","refund");
  trigger.addEventListener("click", () => {
    if (!PaymentAccess.allows(order,"transactions","refund")) return;
    if (state.completed) return;
    renderUI();
    dialog.showModal();
    if (!noticeEl.hidden) dialog.append(noticeEl);
    document.body.classList.add("refund-modal-open");
  });

  // 初始化畫面
  renderUI();
};
