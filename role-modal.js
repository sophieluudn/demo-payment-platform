window.openRoleModal = config => {
  document.querySelector('.role-modal')?.remove();
  const dialog = document.createElement('dialog');
  dialog.className = 'role-modal';
  dialog.setAttribute('aria-labelledby', 'role-modal-title');

  const editing = !!config.role?.id;

  dialog.innerHTML = `
    <div class="role-modal-heading">
      <h2 id="role-modal-title">${editing ? '編輯角色' : '新增角色'}</h2>
      <button type="button" class="role-close" aria-label="關閉角色視窗">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d="m3 3 10 10M13 3 3 13"/>
        </svg>
      </button>
    </div>
    <form>
      <div class="role-basics">
        <div class="role-setting-row">
          <span class="role-setting-label">狀態</span>
          <div class="role-status-controls">
            <button type="button" class="role-status-switch" role="switch" aria-label="角色狀態" aria-checked="true"></button>
            <input type="checkbox" name="enabled" checked hidden>
          </div>
        </div>
        <label>
          <span class="role-setting-label">商店</span>
          <select name="scope" aria-label="商店" required></select>
        </label>
        <label>
          <span class="role-setting-label">角色名稱</span>
          <input name="name" placeholder="請輸入角色名稱" required>
        </label>
        <label class="role-note">
          <span class="role-setting-label">備註</span>
          <textarea name="note" placeholder="請輸入角色說明" rows="2"></textarea>
        </label>
        <div class="role-setting-row role-permissions-row">
          <span class="role-setting-label">功能權限</span>
          <div class="role-permission-grid">
            <table class="role-permission-table">
              <thead>
                <tr><th>功能</th><th>操作權限</th></tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
      <p class="role-error" role="alert" hidden></p>
      <div class="role-modal-actions">
        <button type="button" class="btn plain role-cancel">取消</button>
        <button type="submit" class="btn primary">儲存</button>
      </div>
    </form>
  `;

  document.body.append(dialog);

  const form = dialog.querySelector('form');
  const stores = form.elements.scope;

  config.stores.forEach(store => stores.add(new Option(store.name, store.id)));
  if (editing && !config.role.store) stores.add(new Option('系統共用角色', ''));
  stores.value = editing ? config.role.store : config.defaultStore || config.stores[0]?.id || '';
  if (editing && !config.role.store) stores.required = false;
  stores.disabled = editing;

  form.elements.name.value = config.role?.name || '';
  form.elements.note.value = config.role?.note || '';
  form.elements.enabled.checked = config.role?.enabled !== false;

  const status = dialog.querySelector('.role-status-switch');
  status.setAttribute('aria-checked', String(form.elements.enabled.checked));
  status.addEventListener('click', () => {
    form.elements.enabled.checked = !form.elements.enabled.checked;
    status.setAttribute('aria-checked', String(form.elements.enabled.checked));
  });

  const render = () => {
    const grid = dialog.querySelector('.role-permission-table tbody');
    grid.replaceChildren();

    Object.entries(config.actions).forEach(([feature, valid]) => {
      const row = document.createElement('tr');
      const title = document.createElement('th');
      title.scope = 'row';
      title.textContent = config.labels[feature];
      const cell = document.createElement('td');
      const section = document.createElement('div');
      section.className = 'role-permission-options';
      cell.append(section);
      row.append(title, cell);

      const allLabel = document.createElement('label');
      allLabel.className = 'role-group-toggle';
      const all = document.createElement('input');
      all.type = 'checkbox';
      all.dataset.group = feature;
      all.setAttribute('aria-label', config.labels[feature] + '整組勾選');
      allLabel.append(all, document.createTextNode('全選'));
      section.append(allLabel);

      const inputs = [];
      valid.forEach(action => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = feature + ':' + action;
        input.checked = config.role?.permissions?.[feature]?.includes(action) || false;
        input.disabled = !config.allowed(stores.value, feature, action);
        input.dataset.permission = feature;
        input.setAttribute('aria-label', config.labels[feature] + config.labels[action]);
        label.append(input, document.createTextNode(config.labels[action]));
        section.append(label);
        inputs.push(input);
      });

      const sync = () => {
        const enabled = inputs.filter(input => !input.disabled);
        all.disabled = !enabled.length;
        all.checked = enabled.length > 0 && enabled.every(input => input.checked);
        all.indeterminate = enabled.some(input => input.checked) && !all.checked;
      };

      inputs.forEach(input => input.addEventListener('change', sync));
      all.addEventListener('change', () => {
        inputs.filter(input => !input.disabled).forEach(input => (input.checked = all.checked));
        sync();
      });
      sync();
      grid.append(row);
    });
  };

  stores.addEventListener('change', render);
  render();

  const close = () => dialog.close();
  dialog.querySelector('.role-close').addEventListener('click', close);
  dialog.querySelector('.role-cancel').addEventListener('click', close);
  dialog.addEventListener('close', () => document.body.classList.remove('role-modal-open'));

  form.addEventListener('submit', event => {
    event.preventDefault();
    const permissions = {};
    Object.entries(config.actions).forEach(([feature, valid]) => {
      permissions[feature] = valid.filter(action => form.querySelector('[name="' + feature + ':' + action + '"]').checked);
    });

    try {
      config.save({
        id: config.role?.id,
        name: form.elements.name.value,
        store: stores.value,
        note: form.elements.note.value,
        enabled: form.elements.enabled.checked,
        permissions
      });
      close();
    } catch (err) {
      const error = dialog.querySelector('.role-error');
      error.hidden = false;
      error.textContent = err.message;
    }
  });

  dialog.showModal();
  document.body.classList.add('role-modal-open');
};
