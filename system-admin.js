(() => {
  'use strict';
  const route = location.pathname.split('/').pop().replace('.html', '');
  if (!['users', 'roles', 'projects', 'stores', 'payments'].includes(route)) return;
  const { SystemManagement: Management, seed, actions, isSavedData, migrate } = SystemManagement;
  const STORAGE = 'payment-system-management-v2';
  let saved, storageIssue = false;
  try { saved = JSON.parse(localStorage.getItem(STORAGE) || localStorage.getItem('payment-system-demo-v1')); if (saved && !isSavedData(saved.data)) { saved = null; storageIssue = true; } } catch { storageIssue = true; }
  const app = new Management(migrate(saved?.data || seed()), saved?.currentUserId || 'admin', saved?.store);
  const main = document.querySelector('main');
  const originalMain = main.innerHTML;
  const labels = { transactions: '交易紀錄', products: '商品管理', reports: '統計報表', users: '使用者管理', fees: '手續費設定', view: '檢視', create: '新增', edit: '編輯', refund: '退款', export: '匯出' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const options = (items, selected) => items.map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const button = (title, action, extra = '', cls = 'plain') => `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${title}</button>`;
  const title = { users: '使用者管理', roles: '角色管理', stores: '商店管理', projects: '專案管理', payments: '支付工具設定' }[route];
  const table = (head, rows, cls = '') => `<div class="table-wrap ${cls}"><table><thead><tr>${head.map(x => `<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td class="empty" colspan="${head.length}">無符合條件或權限的資料</td></tr>`}</tbody></table></div>`;
  const storeName = id => app.data.stores.find(s => s.id === id)?.name || id;
  let search = '', page = 1, size = 50, toastTimer;
  let userStore = app.user.system ? '' : app.store, userProject = '';
  let roleStore = app.user.system ? '' : app.store;
  const userProjects = () => app.data.projects.filter(project => (!userStore || project.store === userStore) && app.can(project.id, 'users', 'view'));
  const userEditable = user => userProjects().some(project => user.grants[project.id] && new Management(app.data, app.identity, project.store).canEditUser(user.id));
  document.body.classList.add('system-admin');
  document.body.insertAdjacentHTML('beforeend', '<div id="sys-feedback" role="status" hidden></div>');
  function toast(message) { const el = document.querySelector('#sys-feedback'); el.textContent = message; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 6500); }
  function persist() { try { localStorage.setItem(STORAGE, JSON.stringify({ data: app.data, currentUserId: app.identity, store: app.store })); } catch { toast('無法保存資料，請確認瀏覽器儲存空間'); } }
  function context() {
    if (route === 'payments' || route === 'users' || route === 'roles') return '';
    return `<section class="sys-context" aria-label="商店範圍"><label>目前商店<select id="sys-store" ${app.stores().length ? '' : 'disabled'}>${app.stores().length ? options(app.stores().map(s => [s.id, s.name]), app.store) : '<option>無商店授權</option>'}</select></label></section>`;
  }
  function render() {
    app.normalize();
    main.innerHTML = `${context()}<section id="sys-content" aria-label="${title}"></section>`;
    const el = main.querySelector('#sys-content');
    document.querySelector('aside a[href="payments.html"]').hidden = !app.user.system;
    if (route === 'payments' && !app.user.system) { el.innerHTML = '<div class="sys-empty"><h2>無存取權限</h2><p>支付工具設定僅開放系統管理員。</p></div>'; return; }
    if (!app.stores().length) { el.innerHTML = '<div class="sys-empty"><h2>尚無商店授權</h2><p>目前帳號沒有可存取的商店與專案。</p></div>'; return; }
    if (route === 'users') {
      users(el);
      el.querySelector('.sys-users-list-toolbar').prepend(el.querySelector('.sys-pager'));
    }
    if (route === 'roles') {
      roles(el);
      el.querySelector('.sys-roles-list-toolbar').prepend(el.querySelector('.sys-pager'));
    }
    if (route === 'stores') stores(el);
    if (route === 'projects') projects(el);
    if (route === 'payments') payments(el);
  }
  function toolbar(create = '') {
    if(route==='roles')return `<form id="sys-search" class="filter sys-roles-search"><div class="sys-users-search-field"><label for="sys-role-store">商店</label><select id="sys-role-store">${options(app.user.system?[['','全部'],...app.stores().map(store=>[store.id,store.name])]:app.stores().map(store=>[store.id,store.name]),roleStore)}</select></div><div class="sys-users-search-field"><label for="sys-role-name">角色名稱</label><input id="sys-role-name" name="search" aria-label="角色名稱搜尋" placeholder="請輸入角色名稱" value="${esc(search)}"></div><div class="sys-users-search-actions"><button type="submit" class="btn primary">搜尋</button>${button('清除','reset-role-search')}</div></form><div class="sys-roles-list-toolbar">${create}</div>`;
    if (route === 'users') return `<form id="sys-search" class="filter sys-users-search"><div class="sys-users-search-field"><label for="sys-store">商店</label><select id="sys-store">${options([['', '全部'], ...app.stores().map(s => [s.id, s.name])], userStore)}</select></div><div class="sys-users-search-field"><label for="sys-user-project">專案</label><select id="sys-user-project" aria-label="專案搜尋">${options([['', '全部'], ...userProjects().map(project=>[project.id,project.name])],userProject)}</select></div><div class="sys-users-search-field"><label for="sys-user-search">姓名／帳號</label><input id="sys-user-search" aria-label="姓名或登入帳號" name="search" placeholder="請輸入姓名或登入帳號" value="${esc(search)}"></div><div class="sys-users-search-actions"><button type="submit" class="btn primary">搜尋</button>${button('清除', 'reset-user-search')}</div></form><div class="sys-users-list-toolbar">${create}</div>`;
    return `<form id="sys-search" class="filter toolbar"><div>${create}</div><div class="right"><input aria-label="${route === 'projects' ? '專案或商店名稱' : route === 'users' ? '姓名或登入帳號' : '名稱搜尋'}" name="search" placeholder="${route === 'projects' ? '請輸入專案或商店名稱' : route === 'users' ? '請輸入姓名或登入帳號' : '請輸入名稱'}" value="${esc(search)}"><button type="submit" class="btn primary">搜尋</button></div></form>`;
  }
  function matches(text) { return String(text).toLowerCase().includes(search.trim().toLowerCase()); }
  function paged(rows) { page = Math.min(page, Math.max(1, Math.ceil(rows.length / size))); return rows.slice((page - 1) * size, page * size); }
  function pager(count) {
    const pages = Math.max(1, Math.ceil(count / size));
    return `<div class="pager sys-pager"><span>共 ${count} 項</span><select id="sys-size" aria-label="每頁筆數">${options([['2', '2項/頁'], ['10', '10項/頁'], ['50', '50項/頁']], String(size))}</select>${button('上一頁', 'prev', page === 1 ? 'disabled' : '')}<span>第 ${page} / ${pages} 頁</span>${button('下一頁', 'next', page === pages ? 'disabled' : '')}</div>`;
  }
  function roles(el) {
    const list=app.data.roles.filter(role=>(app.user.system?(!roleStore||role.store===roleStore):role.store===roleStore)&&matches(role.name));
    const rows = paged(list);
    el.innerHTML=toolbar((app.user.system||app.canManageRoles(roleStore))?button('新增','new-role','','success'):'<span>無角色新增權限</span>')+pager(list.length)+table(['編號','角色名稱','商店','狀態','備註／權限','功能'],rows.map((role,index)=>`<tr><td>${(page-1)*size+index+1}</td><td>${esc(role.name)}</td><td>${esc(role.store?storeName(role.store):'系統共用')}</td><td>${role.enabled===false?'不啟用':'啟用'}</td><td>${esc(role.note||'')}<details class="sys-permissions"><summary>檢視權限</summary><ul>${Object.entries(role.permissions).filter(([,valid])=>valid.length).map(([feature,valid])=>`<li>${labels[feature]}：${valid.map(action=>labels[action]).join('、')}</li>`).join('')}</ul></details></td><td>${app.user.system||role.store===roleStore&&!role.manager&&app.canManageRoles(roleStore)?button('編輯','edit-role',`data-id="${role.id}"`,'primary'):'唯讀'}</td></tr>`).join(''));
  }
  function roleEditor(id) {
    const role=app.role(id);
    const scope=role?.store||roleStore||app.store;
    if(!app.canManageRoles(scope))return toast('沒有此商店的角色管理權限');
    if(!app.user.system&&role&&(!role.store||role.store!==scope||role.manager))return toast('只能編輯自己商店的自訂角色');
    window.openRoleModal({role,stores:app.user.system?app.stores():app.stores().filter(store=>store.id===scope),defaultStore:scope,actions,labels,allowed:(store,feature,action)=>app.roleActionAllowed(store,feature,action),save:input=>{if(input.store)app.switchStore(input.store);app.saveRole(input);persist();render();toast('角色設定已儲存');}});
  }
  function groups() {
    main.querySelectorAll('[data-group]').forEach(group => {
      const checks = [...main.querySelectorAll(`[data-permission="${group.dataset.group}"]`)];
      group.checked = checks.every(c => c.checked); group.indeterminate = checks.some(c => c.checked) && !group.checked;
    });
  }
  function users(el) {
    const visible = userProjects().filter(project=>!userProject||project.id===userProject).map(project=>project.id);
    const list = app.data.users.filter(user=>!user.system && visible.some(project=>user.grants[project]) && matches(user.name+' '+user.login+' '+(user.email||'')));
    const rows = paged(list);
    el.innerHTML = toolbar(app.manageable('create').length ? button('新增', 'new-user', '', 'success') : '<span>未授予新增使用者權限</span>') + pager(list.length) + table(['姓名', 'Gmail 帳號', '商店', '專案', '角色', '狀態', '功能'], rows.map(u => {
      const grants = visible.filter(project => u.grants[project]);
      return `<tr><td>${esc(u.name)}</td><td>${esc(u.email || u.login)}</td><td>${grants.map(project=>`<div class="sys-user-grant-line">${esc(storeName(app.data.projects.find(item=>item.id===project)?.store))}</div>`).join('')}</td><td>${grants.map(project=>`<div class="sys-user-grant-line">${esc(app.data.projects.find(item=>item.id===project)?.name)}</div>`).join('')}</td><td>${grants.map(project=>`<div class="sys-user-grant-line">${esc(app.role(u.grants[project])?.name)}</div>`).join('')}</td><td>${u.enabled === false ? '不啟用' : '啟用'}</td><td>${userEditable(u) ? button('編輯', 'edit-user', `data-id="${u.id}"`, 'primary') : '無編輯權限'}</td></tr>`;
    }).join(''));
  }
  function userEditor(id, mode = id ? 'edit' : 'new') {
    const edit = mode === 'edit', current = app.data.users.find(u => u.id === id);
    if (edit && !app.canEditUser(id)) return toast('此使用者編輯範圍或身分規則待確認');
    const ps = app.manageable(edit ? 'edit' : 'create');
    if (!ps.length) return toast('沒有此操作權限');
    const assignable = app.assignableRoles();
    main.querySelector('#sys-content').innerHTML = `<h2 tabindex="-1" class="sys-editor-title">${edit ? '編輯使用者授權' : '新增使用者'}</h2>${!edit ? `<div class="sys-modes" role="group" aria-label="新增模式">${button('建立新帳號', 'user-mode', `data-mode="new" aria-pressed="${mode === 'new'}"`, mode === 'new' ? 'primary' : 'plain')}${button('加入既有帳號', 'user-mode', `data-mode="existing" aria-pressed="${mode === 'existing'}"`, mode === 'existing' ? 'primary' : 'plain')}</div>` : ''}<form id="sys-user-form" data-mode="${mode}" data-id="${esc(id || '')}">${mode === 'existing' ? `<div class="sys-form-fields">${app.user.system ? `<label>選擇既有帳號<select name="existing-id" required><option value="">請選擇</option>${options(app.availableExisting().map(u => [u.id, `${u.name}（${u.login}）`]))}</select></label>` : '<label>既有登入帳號<input name="existing-login" required placeholder="輸入登入帳號"></label>'}</div>` : `<div class="sys-form-fields"><label>姓名<input name="name" value="${esc(current?.name || '')}" ${edit ? 'readonly' : 'required'}></label><label>登入帳號<input name="login" value="${esc(current?.login || '')}" ${edit ? 'readonly' : 'required'}></label></div>`}<h3>目前商店：${esc(storeName(app.store))}</h3>${table(['選擇', '專案名稱', '角色'], ps.map(p => {
      const prior = app.role(current?.grants[p.id]);
      const lock = !app.user.system && (prior?.manager || prior && !assignable.some(r => r.id === prior.id));
      return `<tr><td><input type="checkbox" name="grant" value="${p.id}" aria-label="選擇${esc(p.name)}" ${prior && !lock ? 'checked' : ''} ${lock ? 'disabled' : ''}></td><td>${esc(p.name)}</td><td>${lock ? `<span>保留：${esc(prior.name)}<br>此角色僅系統管理員可變更</span>` : `<select name="role-${p.id}" aria-label="${esc(p.name)}角色" ${prior ? '' : 'disabled'}>${options(assignable.map(r => [r.id, r.name]), prior?.id || assignable[0]?.id)}</select>`}</td></tr>`;
    }).join(''))}<div class="sys-form-actions"><button type="submit" class="btn primary">儲存授權</button>${button('取消', 'cancel')}</div><p class="sys-error" role="alert"></p></form>`;
    focusEditor();
  }
  function newUserModal() {
    const stores = app.stores().filter(store => new Management(app.data, app.identity, store.id).manageable('create').length);
    const projects = stores.flatMap(store => new Management(app.data, app.identity, store.id).manageable('create'));
    window.openUserCreateModal({ stores, projects,
      roles: store => new Management(app.data, app.identity, store).assignableRoles(),
      onExisting: () => userEditor(undefined, 'existing'),
      onSave: input => {
        const copy = JSON.parse(JSON.stringify(app.data));
        let created;
        for (const store of [...new Set(input.grants.map(grant => grant.store))]) {
          const scoped = new Management(copy, app.identity, store);
          const grants = Object.fromEntries(input.grants.filter(grant => grant.store === store).map(grant => [grant.project, grant.role]));
          created = scoped.saveUser({ mode: created ? 'existing' : 'new', id: created?.id, name: input.name, login: input.login, grants });
        }
        created.enabled = input.enabled;
        created.email = input.login.trim();
        app.data.users = copy.users;
        persist(); render(); toast('使用者授權已儲存');
      }
    });
  }
  function editUserModal(id) {
    const target = app.data.users.find(user=>user.id===id);
    const contextProject = userProjects().find(project=>target?.grants[project.id] && new Management(app.data,app.identity,project.store).canEditUser(id));
    if(contextProject) app.switchStore(contextProject.store);
    if (!app.canEditUser(id)) return toast('沒有此使用者的編輯權限');
    const user = app.data.users.find(user=>user.id===id);
    const stores=app.stores().filter(store=>new Management(app.data,app.identity,store.id).manageable('edit').length);
    const projects=stores.flatMap(store=>new Management(app.data,app.identity,store.id).manageable('edit'));
    const locked=project=>{const p=app.data.projects.find(item=>item.id===project);const scope=new Management(app.data,app.identity,p.store);const prior=app.role(user.grants[project]);return !projects.some(item=>item.id===project)||!app.user.system&&(prior?.manager||prior&&!scope.assignableRoles().some(role=>role.id===prior.id));};
    window.openUserCreateModal({user,stores,projects,roles:store=>new Management(app.data,app.identity,store).assignableRoles(),storeName,projectName:id=>app.data.projects.find(project=>project.id===id)?.name,roleName:id=>app.role(id)?.name,
      grants:Object.entries(user.grants).map(([project,role])=>({project,role,store:app.data.projects.find(item=>item.id===project).store,locked:locked(project)})),
      onSave:input=>{
        const copy=JSON.parse(JSON.stringify(app.data));
        const editable=input.grants.filter(grant=>!locked(grant.project));
        for(const store of [...new Set(editable.map(grant=>grant.store))])new Management(copy,app.identity,store).saveUser({mode:'edit',id,grants:Object.fromEntries(editable.filter(grant=>grant.store===store).map(grant=>[grant.project,grant.role]))});
        const target=copy.users.find(user=>user.id===id);
        for(const project of Object.keys(target.grants))if(!locked(project)&&!input.grants.some(grant=>grant.project===project))delete target.grants[project];
        target.name=input.name.trim();target.enabled=input.enabled;
        app.data.users=copy.users;persist();render();toast('使用者資料已儲存');
      }
    });
  }
  function projects(el) {
    const list = app.projects().filter(p => matches(p.name + ' ' + storeName(p.store))), rows = paged(list);
    el.innerHTML = toolbar(button('新增', 'unavailable', 'disabled title="尚未開放"', 'success')) + pager(list.length) + table(['專案名稱', '商店', '說明', '功能'], rows.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(storeName(p.store))}</td><td>—</td><td>${button('檢視', 'project-detail', `data-id="${p.id}"`, 'gray')}</td></tr>`).join(''));
  }
  function stores(el) {
    const list = app.stores().filter(s => matches(s.name)), rows = paged(list);
    // Retain the original store table and payment-tool columns. Undefined fees and dates stay explicit.
    const temp = document.createElement('div'); temp.innerHTML = originalMain;
    const thead = temp.querySelector('thead').outerHTML;
    const toolColumns = ['credit-card', 'apple-pay', 'google-pay', 'line-pay', 'atm', 'cvs', 'foreign-credit-card', 'foreign-apple-pay', 'foreign-google-pay'];
    el.innerHTML = toolbar(button('新增', 'unavailable', 'disabled title="尚未開放"', 'success')) + pager(list.length) + `<div class="table-wrap store-table"><table>${thead}<tbody>${rows.map(s => {
      const settings = app.paymentSettingsForStore(s.id);
      return `<tr><td>${esc(s.name)}</td>${toolColumns.map(id => { const tool = settings.find(t => t.id === id); return `<td>${app.user.system && tool ? esc(tool.fee + tool.unit) : '—'}</td>`; }).join('')}<td>—</td><td>—</td><td>${button('檢視', 'store-detail', `data-id="${s.id}"`, 'gray')}</td></tr>`;
    }).join('') || '<tr><td colspan="13" class="empty">無符合條件的商店</td></tr>'}</tbody></table></div>`;
  }
  function storeDetail(id) {
    if (!app.stores().some(s => s.id === id)) return toast('此商店未授權');
    app.switchStore(id); persist();
    const ps = app.projects();
    main.querySelector('#sys-store').value = app.store;
    main.querySelector('#sys-content').innerHTML = `<h2 tabindex="-1" class="sys-editor-title">商店檢視：${esc(storeName(id))}</h2>${table(['專案名稱', '所屬商店'], ps.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(storeName(p.store))}</td></tr>`).join(''))}<div class="sys-form-actions"><a href="projects.html" class="btn primary">查看專案管理</a>${button('返回列表', 'cancel')}</div>`;
    focusEditor();
  }
  function projectDetail(id) {
    const p = app.projects().find(p => p.id === id); if (!p) return toast('此專案未授權');
    const credit = app.paymentSettingsForProject(p.id).find(t => t.id === 'credit-card');
    main.querySelector('#sys-content').innerHTML = `<h2 tabindex="-1" class="sys-editor-title">專案檢視：${esc(p.name)}</h2>${table(['專案名稱', '所屬商店', '目前身分的角色', ...(app.user.system ? ['國內信用卡手續費'] : [])], `<tr><td>${esc(p.name)}</td><td>${esc(storeName(p.store))}</td><td>${app.user.system ? '系統管理員' : esc(app.role(app.user.grants[p.id])?.name)}</td>${app.user.system ? `<td>${esc(credit.fee + credit.unit)}</td>` : ''}</tr>`)}<div class="sys-form-actions">${button('返回列表', 'cancel')}${button('編輯', 'unavailable', 'disabled title="尚未開放"')}</div>`;
    focusEditor();
  }
  function payments(el) {
    if (!app.user.system) { el.innerHTML = '<p>支付工具設定僅開放系統管理員。</p>'; return; }
    const list = app.data.paymentTools.filter(t => matches(t.platform + ' ' + t.name)), rows = paged(list);
    el.innerHTML = toolbar(button('新增', 'new-payment', '', 'success')) + pager(list.length) + table(['第三方金流平台', '支付工具', '手續費（含稅）', '計價單位', '幣別'], rows.map(t => `<tr><td><a href="#" data-action="fee-edit" data-key="${esc(t.id)}" aria-label="編輯 ${esc(t.platform)} ${esc(t.name)}">${esc(t.platform)}</a></td><td>${esc(t.name)}</td><td>${esc(app.data.fees[t.id])}</td><td>${esc(t.unit)}</td><td>${esc(t.currency)}</td></tr>`).join(''), 'payment-table');
  }
  let paymentOpener;
  function closePayment() {
    const dialog = document.querySelector('#sys-payment-dialog');
    if (dialog) { dialog.close(); dialog.remove(); }
    paymentOpener?.focus();
  }
  function feeEditor(key) {
    if (!app.user.system || key && !app.feeCan(key, 'edit')) return toast('僅系統管理員可設定支付工具');
    const tool = app.data.paymentTools.find(t => t.id === key) || { platform: '', name: '', code: '', unit: '%', currency: '新台幣', note: '' };
    paymentOpener = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.id = 'sys-payment-dialog'; dialog.className = 'sys-payment-dialog';
    dialog.setAttribute('aria-labelledby', 'sys-payment-title');
    dialog.innerHTML = `<div class="sys-modal-header"><h2 id="sys-payment-title">${key ? '支付工具設定' : '新增支付工具'}</h2><button type="button" class="sys-modal-close" data-action="close-payment" aria-label="關閉"><img src="assets/x.svg" alt=""></button></div><form id="sys-payment-form" data-key="${esc(key || '')}"><div class="sys-payment-fields">
      <label><span><em>*</em> 第三方金流平台名稱</span><input name="platform" value="${esc(tool.platform)}" required></label>
      <label><span><em>*</em> 支付工具名稱</span><input name="name" value="${esc(tool.name)}" required></label>
      <label class="sys-code-field"><span><em>*</em> 付款方式代碼</span><div><p id="sys-code-help">代碼請參照 API 文件的交易類別，例如 CREDIT、LINEPAY 等</p><input name="code" aria-describedby="sys-code-help" value="${esc(tool.code || '')}" required></div></label>
      <label><span><em>*</em> 手續費</span><div class="sys-payment-fee"><input name="rate" type="number" min="0" step="any" value="${esc(key ? app.data.fees[key] : '')}" required><select name="unit" aria-label="計價單位">${options([['%', '%'], ['元', '元']], tool.unit)}</select></div></label>
      <label><span><em>*</em> 幣別</span><select name="currency" required>${options(['新台幣', tool.currency].filter((x,i,a)=>a.indexOf(x)===i).map(x=>[x,x]),tool.currency)}</select></label>
      <label><span>備註</span><input name="note" value="${esc(tool.note || '')}"></label>
      </div><p class="sys-error" role="alert"></p><div class="sys-modal-actions">${button('取消', 'close-payment')}<button type="submit" class="btn primary">儲存</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener('cancel', e => { e.preventDefault(); closePayment(); });
    dialog.showModal();
  }
  function focusEditor() { main.querySelector('.sys-editor-title')?.focus(); }
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'sys-store') { if(route === 'users'){userStore=t.value;userProject='';if(t.value)app.switchStore(t.value);}else app.switchStore(t.value); search = ''; page = 1; persist(); render(); }
    if (t.id === 'sys-user-project') { userProject = userProjects().some(project=>project.id===t.value) ? t.value : ''; page=1; render(); }
    if(t.id==='sys-role-store'){roleStore=t.value;if(t.value)app.switchStore(t.value);search='';page=1;persist();render();}
    if (t.id === 'sys-size') { size = Number(t.value); page = 1; render(); }
    if (t.dataset.group) { main.querySelectorAll(`[data-permission="${t.dataset.group}"]`).forEach(c => c.checked = t.checked); groups(); }
    if (t.dataset.permission) groups();
    if (t.name === 'grant') { const s = main.querySelector(`[name="role-${t.value}"]`); if (s) s.disabled = !t.checked; }
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]'); if (!b) return;
    switch (b.dataset.action) {
      case 'reset-user-search': search = ''; userStore=app.user.system?'':app.store;userProject='';page = 1; render(); break;
      case 'reset-role-search':search='';roleStore=app.user.system?'':app.store;page=1;render();break;
      case 'new-role': roleEditor(); break;
      case 'edit-role': roleEditor(b.dataset.id); break;
      case 'new-user': newUserModal(); break;
      case 'edit-user': editUserModal(b.dataset.id); break;
      case 'user-mode': userEditor(undefined, b.dataset.mode); break;      case 'store-detail': storeDetail(b.dataset.id); break;
      case 'project-detail': projectDetail(b.dataset.id); break;
      case 'fee-edit': e.preventDefault(); feeEditor(b.dataset.key); break;
      case 'new-payment': feeEditor(); break;
      case 'close-payment': closePayment(); break;      case 'cancel': render(); break;
      case 'prev': page = Math.max(1, page - 1); render(); break;
      case 'next': page++; render(); break;
    }
  });
  document.addEventListener('submit', e => {
    const form = e.target; if (!form.id.startsWith('sys-')) return; e.preventDefault();
    const data = new FormData(form);
    try {
      if (form.id === 'sys-search') { search = data.get('search') || ''; page = 1; render(); }
      if (form.id === 'sys-role-form') {
        const permissions = Object.fromEntries(Object.entries(actions).map(([f, a]) => [f, a.filter(x => data.has(f + ':' + x))]));
        app.saveRole({ id: form.dataset.id, name: data.get('name'), store: data.get('scope'), permissions }); persist(); render(); toast('角色設定已儲存');
      }
      if (form.id === 'sys-user-form') {
        const grants = Object.fromEntries(data.getAll('grant').map(p => [p, data.get('role-' + p)]));
        app.saveUser({ mode: form.dataset.mode, id: form.dataset.mode === 'existing' ? data.get('existing-id') : form.dataset.id, existingLogin: data.get('existing-login'), name: data.get('name') || '', login: data.get('login') || '', grants });
        persist(); render(); toast('使用者授權已儲存');
      }
      if (form.id === 'sys-payment-form') { app.savePaymentTool({ id: form.dataset.key, platform: data.get('platform'), name: data.get('name'), code: data.get('code'), fee: data.get('rate'), unit: data.get('unit'), currency: data.get('currency'), note: data.get('note') }); persist(); closePayment(); render(); main.querySelector(`[data-action=fee-edit][data-key="${form.dataset.key}"]`)?.focus(); if (!form.dataset.key) main.querySelector('[data-action=new-payment]')?.focus(); toast('支付工具設定已儲存'); }
      if (form.id === 'sys-fee-form') { app.setFee(form.dataset.key, data.get('rate')); persist(); render(); toast('手續費設定已儲存'); }
    } catch (err) { const error = form.querySelector('.sys-error'); if (error) error.textContent = err.message; else toast(err.message); }
  });
  render();
  if (storageIssue) toast('無法讀取已儲存資料');
  persist();
})();
