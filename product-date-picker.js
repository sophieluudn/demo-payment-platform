window.attachProductDatePicker = (dialog, inputs, onChangeCallback) => {
  // ───────────────────────── 1. 工具與 Helper 函式 ─────────────────────────
  const pad = (n) => String(n).padStart(2, "0");

  const getTaipeiNow = () =>
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

  // ───────────────────────── 2. DOM 面板建立 ─────────────────────────
  const createPickerPanel = () => {
    const panel = document.createElement("div");
    panel.className = "product-date-picker";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "選擇日期與時間");
    panel.innerHTML = `
      <div class="picker-inputs">
        <input type="date" aria-label="選擇日期">
        <input type="time" step="1" aria-label="選擇時間">
      </div>
      <div class="picker-navigation">
        <button type="button" data-month="-12" aria-label="上一年">«</button>
        <button type="button" data-month="-1" aria-label="上一月">‹</button>
        <span class="picker-current-month"></span>
        <button type="button" data-month="1" aria-label="下一月">›</button>
        <button type="button" data-month="12" aria-label="下一年">»</button>
      </div>
      <div class="picker-weekdays">
        <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
      </div>
      <div class="picker-days"></div>
      <div class="picker-actions">
        <button type="button" class="picker-now">現在</button>
        <button type="button" class="btn plain picker-confirm">確定</button>
      </div>
    `;
    dialog.append(panel);
    return panel;
  };

  const panel = createPickerPanel();
  const dateInput = panel.querySelector("[type=date]");
  const timeInput = panel.querySelector("[type=time]");
  const currentMonthLabel = panel.querySelector(".picker-current-month");
  const daysGrid = panel.querySelector(".picker-days");

  let currentTargetInput = null;
  let currentYear = 0;
  let currentMonth = 0; // 0-indexed (0 = 1月)

  // ───────────────────────── 3. UI 狀態與渲染邏輯 ─────────────────────────
  const closePanel = () => {
    panel.hidden = true;
    inputs.forEach((input) => input.setAttribute("aria-expanded", "false"));
  };

  const renderCalendar = () => {
    currentMonthLabel.textContent = `${currentYear} 年 ${currentMonth + 1} 月`;
    daysGrid.replaceChildren();

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

    for (let i = 0; i < 42; i++) {
      const dayDate = new Date(currentYear, currentMonth, i - firstDayIndex + 1);
      const dateString = `${dayDate.getFullYear()}-${pad(dayDate.getMonth() + 1)}-${pad(dayDate.getDate())}`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = dayDate.getDate();
      btn.setAttribute("aria-label", dateString);
      btn.classList.toggle("outside-month", dayDate.getMonth() !== currentMonth);
      btn.classList.toggle("selected", dateString === dateInput.value);

      btn.addEventListener("click", () => {
        dateInput.value = dateString;
        renderCalendar();
      });

      daysGrid.append(btn);
    }
  };

  const updateYearMonthFromDateInput = () => {
    if (!dateInput.value) return;
    currentYear = Number(dateInput.value.slice(0, 4));
    currentMonth = Number(dateInput.value.slice(5, 7)) - 1;
  };

  const syncPickerDateTime = (dateTimeString) => {
    const safeString = dateTimeString.replace("T", " ") || getTaipeiNow();
    dateInput.value = safeString.slice(0, 10);
    timeInput.value = safeString.slice(11) || "00:00:00";
    updateYearMonthFromDateInput();
  };

  const positionPanel = () => {
    if (!currentTargetInput) return;
    const rect = currentTargetInput.getBoundingClientRect();
    const panelWidth = Math.min(320, window.innerWidth - 32);

    panel.style.width = `${panelWidth}px`;
    panel.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - panelWidth - 16))}px`;

    const panelHeight = panel.offsetHeight;
    panel.style.top = `${Math.max(12, Math.min(rect.bottom + 10, window.innerHeight - panelHeight - 12))}px`;
  };

  // ───────────────────────── 4. 事件監聽 (Event Handlers) ─────────────────────────
  inputs.forEach((input) => {
    input.setAttribute("aria-haspopup", "dialog");
    input.setAttribute("aria-expanded", "false");

    const openPanel = () => {
      if (input.disabled) return;
      currentTargetInput = input;

      syncPickerDateTime(input.value);
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");

      renderCalendar();
      positionPanel();
    };

    input.addEventListener("click", openPanel);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        openPanel();
        dateInput.focus();
      }
    });
  });

  // 年月切換按鈕
  panel.querySelectorAll("[data-month]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const offset = Number(btn.dataset.month);
      const nextDate = new Date(currentYear, currentMonth + offset, 1);
      currentYear = nextDate.getFullYear();
      currentMonth = nextDate.getMonth();
      renderCalendar();
    });
  });

  // 日期輸入框變更
  dateInput.addEventListener("change", () => {
    updateYearMonthFromDateInput();
    renderCalendar();
  });

  // 「現在」按鈕
  panel.querySelector(".picker-now").addEventListener("click", () => {
    syncPickerDateTime(getTaipeiNow());
    renderCalendar();
  });

  // 「確定」按鈕
  panel.querySelector(".picker-confirm").addEventListener("click", () => {
    if (!dateInput.value || !timeInput.value || !dateInput.validity.valid || !timeInput.validity.valid) {
      return;
    }

    const formattedTime = timeInput.value.length === 5 ? `${timeInput.value}:00` : timeInput.value;
    currentTargetInput.value = `${dateInput.value} ${formattedTime}`;

    closePanel();
    onChangeCallback?.();
    currentTargetInput.focus();
  });

  // 點擊外部關閉面板
  dialog.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && !inputs.includes(e.target)) {
      closePanel();
    }
  });

  // 鍵盤 Escape 關閉
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
      currentTargetInput?.focus();
    }
  });

  // 視窗大小改變與 Dialog 關閉事件
  dialog.addEventListener("close", closePanel);
  window.addEventListener("resize", closePanel);

  return closePanel;
};