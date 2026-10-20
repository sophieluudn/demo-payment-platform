window.openUserCreateModal = config => {
  document.querySelector('.user-create-modal')?.remove();
  const dialog = document.createElement('dialog');
  dialog.className = 'user-create-modal';
  dialog.setAttribute('aria-labelledby', 'user-create-title');

  const editing = !!config.user;

  dialog.innerHTML = `
    <div class="user-create-heading">
      <h2 id="user-create-title">${editing ? '編輯使用者' : '新增使用者'}</h2>
      <button type="button" class="user-create-close" aria-label="${editing ? '關閉編輯使用者' : '關閉新增使用者'}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d="m3 3 10 10M13 3 3 13"/>
        </svg>
      </button>
    </div>
    <form>
      <div class="user-create-fields">
        <div class="user-create-row">
          <span>狀態</span>
          <div class="user-enabled">
            <button type="button" class="user-status-switch" role="switch" aria-label="使用者狀態" aria-checked="true"></button>
          </div>
        </div>
        <div class="user-create-row">
          <label for="user-create-name">姓名</label>
          <input id="user-create-name" name="name" placeholder="請輸入說明字詞" required>
        </div>
        <div class="user-create-row">
          <label for="user-create-email">Gmail 帳號</label>
          <input id="user-create-email" name="login" type="text" placeholder="請輸入說明字詞" required>
        </div>
        <div class="user-create-row user-grants-row">
          <span class="user-grants-label">可管理專案</span>
          <div class="user-grant-rows-container"></div>
        </div>
        <p class="user-create-error" role="alert" hidden></p>
      </div>
      <div class="user-create-actions">
        <button type="button" class="btn plain user-create-cancel">取消</button>
        <button type="submit" class="btn primary user-create-save">儲存</button>
      </div>
    </form>
  `;

  document.body.append(dialog);

  const form = dialog.querySelector('form');
  const rowsContainer = dialog.querySelector('.user-grant-rows-container');
  const error = dialog.querySelector('.user-create-error');
  const enabledBtn = dialog.querySelector('.user-status-switch');

  const updateSwitch = isEnabled => {
    enabledBtn.setAttribute('aria-checked', String(isEnabled));
  };

  let isEnabled = true;
  if (config.user) {
    form.elements.name.value = config.user.name || '';
    form.elements.login.value = config.user.email || config.user.login || '';
    form.elements.login.readOnly = true;
    isEnabled = config.user.enabled !== false;
  }
  updateSwitch(isEnabled);

  enabledBtn.addEventListener('click', () => {
    isEnabled = !isEnabled;
    updateSwitch(isEnabled);
  });

  const getStoreRoles = storeId => {
    if (typeof config.roles === 'function') {
      return config.roles(storeId) || [];
    }
    return [];
  };

  const getStoreProjects = storeId => {
    if (!storeId) return config.projects || [];
    return (config.projects || []).filter(p => p.store === storeId);
  };

  function updateRowButtons() {
    const rows = rowsContainer.querySelectorAll('.user-grant-row');
    rows.forEach((row, idx) => {
      const actions = row.querySelector('.user-grant-actions');
      actions.innerHTML = '';
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'user-grant-btn-add';
      addBtn.title = '新增';
      addBtn.setAttribute('aria-label', '新增');
      addBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2H9v4a1 1 0 1 1-2 0V9H3a1 1 0 0 1 0-2h4V3a1 1 0 0 1 1-1z"/></svg>';
      addBtn.addEventListener('click', () => {
        const newRow = createGrantRow();
        row.after(newRow);
        updateRowButtons();
      });
      actions.append(addBtn);

      if (idx > 0) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'user-grant-btn-del';
        delBtn.title = '刪除';
        delBtn.setAttribute('aria-label', '刪除');
        delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>';
        delBtn.addEventListener('click', () => {
          row.remove();
          updateRowButtons();
        });
        actions.append(delBtn);
      }
    });
  }

  function createGrantRow(initialData = {}) {
    const row = document.createElement('div');
    row.className = 'user-grant-row';

    const storeSelect = document.createElement('select');
    storeSelect.className = 'grant-store-select';
    storeSelect.setAttribute('aria-label', '所有商店');
    storeSelect.add(new Option('所有商店', ''));
    (config.stores || []).forEach(s => storeSelect.add(new Option(s.name, s.id)));

    const projectSelect = document.createElement('select');
    projectSelect.className = 'grant-project-select';
    projectSelect.setAttribute('aria-label', '所有專案');

    const roleSelect = document.createElement('select');
    roleSelect.className = 'grant-role-select';
    roleSelect.setAttribute('aria-label', '選擇角色');

    function populateProjects(storeId, currentVal) {
      projectSelect.replaceChildren(new Option('所有專案', ''));
      const list = getStoreProjects(storeId);
      list.forEach(p => projectSelect.add(new Option(p.name, p.id)));
      if (currentVal && list.some(p => p.id === currentVal)) {
        projectSelect.value = currentVal;
      }
    }

    function populateRoles(storeId, currentVal) {
      roleSelect.replaceChildren(new Option('選擇角色', ''));
      const list = getStoreRoles(storeId);
      list.forEach(r => roleSelect.add(new Option(r.name, r.id)));
      if (currentVal && list.some(r => r.id === currentVal)) {
        roleSelect.value = currentVal;
      }
    }

    storeSelect.addEventListener('change', () => {
      populateProjects(storeSelect.value, projectSelect.value);
      populateRoles(storeSelect.value, roleSelect.value);
    });

    projectSelect.addEventListener('change', () => {
      if (projectSelect.value && !storeSelect.value) {
        const found = (config.projects || []).find(p => p.id === projectSelect.value);
        if (found && found.store) {
          storeSelect.value = found.store;
          populateProjects(found.store, projectSelect.value);
          populateRoles(found.store, roleSelect.value);
        }
      }
    });

    if (initialData.store) storeSelect.value = initialData.store;
    populateProjects(storeSelect.value, initialData.project);
    populateRoles(storeSelect.value, initialData.role);

    if (initialData.locked) {
      storeSelect.disabled = true;
      projectSelect.disabled = true;
      roleSelect.disabled = true;
    }

    const actions = document.createElement('div');
    actions.className = 'user-grant-actions';

    row.append(storeSelect, projectSelect, roleSelect, actions);
    return row;
  }

  // Populate initial rows
  if (config.grants && config.grants.length > 0) {
    config.grants.forEach(g => {
      const row = createGrantRow(g);
      rowsContainer.append(row);
    });
  } else {
    // New mode: starts with 1 row
    rowsContainer.append(createGrantRow());
  }
  updateRowButtons();

  const close = () => dialog.close();
  dialog.querySelector('.user-create-close').addEventListener('click', close);
  dialog.querySelector('.user-create-cancel').addEventListener('click', close);
  dialog.addEventListener('close', () => document.body.classList.remove('user-create-open'));

  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const login = form.elements.login.value.trim();

    if (!name) {
      error.hidden = false;
      error.textContent = '請輸入姓名';
      return;
    }
    if (!login) {
      error.hidden = false;
      error.textContent = '請輸入 Gmail 帳號';
      return;
    }

    const rows = rowsContainer.querySelectorAll('.user-grant-row');
    const grants = [];
    for (const r of rows) {
      const s = r.querySelector('.grant-store-select').value;
      const p = r.querySelector('.grant-project-select').value;
      const role = r.querySelector('.grant-role-select').value;

      if (!s && !p && !role) continue;

      if (!role) {
        error.hidden = false;
        error.textContent = '請為設定的專案選擇角色';
        return;
      }

      if (p) {
        const found = (config.projects || []).find(item => item.id === p);
        grants.push({
          store: s || found?.store || config.stores?.[0]?.id || '',
          project: p,
          role
        });
      } else if (s) {
        const list = (config.projects || []).filter(item => item.store === s);
        if (list.length) {
          list.forEach(item => grants.push({ store: s, project: item.id, role }));
        } else {
          error.hidden = false;
          error.textContent = '該商店下尚無專案';
          return;
        }
      } else {
        if ((config.projects || []).length) {
          (config.projects || []).forEach(item => grants.push({ store: item.store, project: item.id, role }));
        }
      }
    }

    if (grants.length === 0) {
      error.hidden = false;
      error.textContent = '請選擇至少一個可管理專案與角色';
      return;
    }

    const uniqueGrants = Object.values(Object.fromEntries(grants.map(g => [g.project, g])));

    try {
      config.onSave({
        name,
        login,
        enabled: isEnabled,
        grants: uniqueGrants
      });
      close();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });

  dialog.showModal();
  document.body.classList.add('user-create-open');
};
