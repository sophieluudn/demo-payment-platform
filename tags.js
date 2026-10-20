(() => {
  // ───────────────────────── 常數 ─────────────────────────
  const STORAGE_KEY = "payment-demo-tags";
  const EDIT_LABEL = "編輯";
  const FIELDS = [
    { key: "name", ariaLabel: "標籤名稱" },
    { key: "description", ariaLabel: "標籤說明" },
  ];

  // ───────────────────────── DOM 元素 ─────────────────────────
  const tbody = document.querySelector("main table tbody");
  const addButton = document.querySelector("#tag-add");
  const pager = document.querySelector(".pager");
  const toolbar = document.querySelector(".tag-list-toolbar");
  const sortLabel = toolbar.querySelector(".tag-sort-label");
  const searchForm = document.getElementById("tag-search-form");
  const searchInput = document.getElementById("tag-search-name");
  const resetButton = document.getElementById("tag-search-reset");

  // 調整版面：排序選單移到搜尋表單，分頁資訊移到工具列最前面
  searchForm.prepend(sortLabel);
  toolbar.prepend(pager);

  // ───────────────────────── 資料與儲存 ─────────────────────────
  /** 讀取 HTML 表格中原本的資料，當作初始標籤 */
  const readTagsFromTable = () =>
    [...tbody.rows].map((row, index) => ({
      id: index + 1,
      name: row.cells[0].textContent,
      description: row.cells[1].textContent,
    }));

  /** 優先使用 sessionStorage 的資料，讀不到或格式錯誤就用 fallback */
  const loadTags = (fallback) => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || fallback;
    } catch {
      return fallback;
    }
  };

  const saveTags = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
    } catch {}
  };

  const getNextTagId = () => Math.max(0, ...tags.map((tag) => tag.id)) + 1;

  // ───────────────────────── 狀態 ─────────────────────────
  let tags = loadTags(readTagsFromTable());
  let activeTag = null; // 目前正在編輯（或新增）的標籤，沒有則為 null
  let searchQuery = "";

  // ───────────────────────── 畫面小工具 ─────────────────────────
  const createButton = (label, className) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn ${className}`;
    button.textContent = label;
    return button;
  };

  // ───────────────────────── 列表渲染 ─────────────────────────
  const render = () => {
    const visibleTags = tags.filter((tag) => tag.name.includes(searchQuery));

    tbody.replaceChildren();
    visibleTags.forEach((tag) => {
      const row = tbody.insertRow();
      row.dataset.id = tag.id;
      row.insertCell().textContent = tag.name;
      row.insertCell().textContent = tag.description;
      row.insertCell().append(createButton(EDIT_LABEL, "primary tag-edit"));
    });

    pager.firstChild.textContent = `共 ${visibleTags.length} 項`;
    addButton.disabled = false;
  };

  const stopEditing = () => {
    activeTag = null;
    render();
  };

  // ───────────────────────── 編輯 / 新增 ─────────────────────────
  const createEmptyTag = () => ({
    id: getNextTagId(),
    name: "",
    description: "",
    isNew: true,
  });

  /** 取得要進入編輯狀態的那一列：新增時在最上方插入空白列，編輯時找出既有列 */
  const getEditRow = (tag) => {
    if (tag.isNew) {
      const row = tbody.insertRow(0);
      for (let i = 0; i < 3; i++) row.insertCell();
      return row;
    }
    return [...tbody.rows].find((row) => Number(row.dataset.id) === tag.id);
  };

  /** 傳入既有標籤 = 編輯；不傳 = 新增 */
  const startEditing = (existingTag) => {
    if (activeTag) return; // 已有一列在編輯中，不重複進入

    activeTag = existingTag || createEmptyTag();
    const row = getEditRow(activeTag);
    row.classList.add("tag-editing");

    // 把欄位換成輸入框
    const [nameInput, descriptionInput] = FIELDS.map(
      ({ key, ariaLabel }, index) => {
        const input = document.createElement("input");
        input.value = activeTag[key];
        input.setAttribute("aria-label", ariaLabel);
        row.cells[index].replaceChildren(input);
        return input;
      },
    );

    // 操作欄換成「確定 / 取消」
    const saveButton = createButton("確定", "success tag-save");
    const cancelButton = createButton("取消", "gray tag-cancel");
    row.cells[2].replaceChildren(saveButton, cancelButton);

    // 編輯期間不能新增，也不能編輯其他列
    addButton.disabled = true;
    tbody
      .querySelectorAll(".tag-edit")
      .forEach((button) => (button.disabled = true));

    // 標籤名稱為必填：空白時「確定」不可按
    const updateSaveButtonState = () => {
      saveButton.disabled = !nameInput.value.trim();
    };
    updateSaveButtonState();
    nameInput.addEventListener("input", updateSaveButtonState);

    const commit = () => {
      const name = nameInput.value.trim();
      if (!name) return;

      const savedTag = {
        id: activeTag.id,
        name,
        description: descriptionInput.value.trim(),
      };

      if (activeTag.isNew) {
        tags.unshift(savedTag);
      } else {
        tags[tags.findIndex((tag) => tag.id === activeTag.id)] = savedTag;
      }

      saveTags();
      stopEditing();
    };

    saveButton.addEventListener("click", commit);
    cancelButton.addEventListener("click", stopEditing);

    // 鍵盤操作：Esc 取消、在輸入框按 Enter 儲存
    row.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        stopEditing();
      } else if (event.key === "Enter" && event.target.tagName === "INPUT") {
        event.preventDefault();
        commit();
      }
    });

    nameInput.focus();
  };

  // ───────────────────────── 事件綁定 ─────────────────────────
  // 點擊列表中的「編輯」按鈕（事件委派）
  tbody.addEventListener("click", (event) => {
    const editButton = event.target.closest(".tag-edit");
    if (!editButton || editButton.disabled) return;

    const id = Number(editButton.closest("tr").dataset.id);
    startEditing(tags.find((tag) => tag.id === id));
  });

  addButton.addEventListener("click", () => startEditing());

  // 搜尋
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (activeTag) return;

    searchQuery = searchInput.value.trim();
    render();
  });

  // 重設搜尋
  resetButton.addEventListener("click", () => {
    if (activeTag) return;

    searchForm.reset();
    searchQuery = "";
    render();
  });

  // ───────────────────────── 初始化 ─────────────────────────
  render();
})();