(function (root) {
  'use strict';
  const actions = {
    transactions: ['view', 'refund'], products: ['view', 'create', 'edit'],
    reports: ['view', 'export'], users: ['view', 'create', 'edit']
  };
  const uid = prefix => prefix + '-' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2));
  function paymentDefaults() {
    return [
      ['apple-pay', '藍新金流', 'Apple Pay', '1.68', '%'],
      ['google-pay', '藍新金流', 'Google Pay', '1.68', '%'],
      ['line-pay', 'Line Pay', 'Line Pay', '1.995', '%'],
      ['atm', '藍新金流', 'ATM轉帳', '5', '元'],
      ['cvs', '藍新金流', '超商代碼繳費', '23', '元'],
      ['credit-card', '藍新金流', '國內信用卡一次付清', '2', '%'],
      ['foreign-credit-card', '藍新金流', '信用卡一次付清(國外卡)', '2.5', '%'],
      ['tool-8', '汪新金流', '汪星人信用卡', '3.8', '%'],
      ['tool-9', '村上春樹', '村上春樹', '100', '%'],
      ['tool-10', '常常吃', 'fsadf', '0', '%'],
      ['tool-11', '31231rewr', '1發生', '0.123', '%']
    ].map(([id, platform, name, fee, unit]) => ({ id, platform, name, fee, unit, currency: '新台幣' }));
  }
  function seed() {
    const all = () => Object.fromEntries(Object.entries(actions).map(([feature, list]) => [feature, [...list]]));
    return {
      stores: [{ id: 'edu', name: '教育事業部' }, { id: 'u', name: 'U 好學' }],
      projects: [
        { id: 'A', store: 'edu', name: '線上商城專案 A' },
        { id: 'B', store: 'edu', name: '實體活動專案 B' },
        { id: 'C', store: 'u', name: '線上課程專案 C' }
      ],
      roles: [
        { id: 'large', name: '商店管理員（大）', store: '', manager: true, permissions: all() },
        { id: 'small', name: '商店管理員（小）', store: 'edu', manager: true, permissions: { ...all(), users: ['view', 'edit'] } },
        { id: 'viewer', name: '交易檢視角色', store: '', manager: false, permissions: { transactions: ['view'] } },
        { id: 'refund', name: '交易退款角色', store: '', manager: false, permissions: { transactions: ['view', 'refund'] } }
      ],
      users: [
        { id: 'admin', name: '系統管理員', login: 'admin', system: true, grants: {} },
        { id: 'charlie', name: '陳查理', login: 'charlie-a', grants: { A: 'viewer' } },
        { id: 'multi', name: '林冠宇', login: 'charlie-ab', grants: { A: 'refund', B: 'viewer' } },
        { id: 'david', name: '王大衛', login: 'david-b', grants: { B: 'refund' } },
        { id: 'cross', name: '李佳穎', login: 'cross-store', grants: { A: 'viewer', C: 'viewer' } },
        { id: 'big', name: '林志明', login: 'manager-large', grants: { A: 'large', B: 'large' } },
        { id: 'little', name: '吳雅婷', login: 'manager-small', grants: { A: 'small', B: 'small' } },
        { id: 'partial', name: '張怡君', login: 'manager-a', grants: { A: 'large' } }
      ],
      paymentTools: paymentDefaults().map(({ fee, ...tool }) => tool),
      fees: Object.fromEntries(paymentDefaults().map(t => [t.id, t.fee]))
    };
  }
  class SystemManagement {
    constructor(data = seed(), identity = 'admin', store = 'edu') { this.data = data; this.identity = identity; this.store = store; this.normalize(); }
    get user() { return this.data.users.find(u => u.id === this.identity) || this.data.users.find(u => u.system); }
    role(id) { return this.data.roles.find(r => r.id === id); }
    can(projectId, feature, action) {
      const p = this.data.projects.find(p => p.id === projectId);
      if (!p) return false;
      if (this.user.system) return true;
      if (feature === 'fees' || feature === 'payments') return false;
      const r = this.role(this.user.grants[p.id]);
      return !!r && r.enabled !== false && (!r.store || r.store === p.store) && !!r.permissions[feature]?.includes(action);
    }
    projects(feature, action = 'view') {
      return this.data.projects.filter(p => p.store === this.store && (feature ? this.can(p.id, feature, action) : this.user.system || !!this.role(this.user.grants[p.id]) && (!this.role(this.user.grants[p.id]).store || this.role(this.user.grants[p.id]).store === p.store)));
    }
    stores() {
      return this.data.stores.filter(s => this.user.system || this.data.projects.some(p => p.store === s.id && this.role(this.user.grants[p.id]) && (!this.role(this.user.grants[p.id]).store || this.role(this.user.grants[p.id]).store === s.id)));
    }
    normalize() {
      if (!this.data.users.some(u => u.id === this.identity)) this.identity = 'admin';
      const stores = this.stores();
      if (!stores.some(s => s.id === this.store)) this.store = stores[0]?.id || '';
    }
    switchStore(id) { if (!this.stores().some(s => s.id === id)) throw Error('此商店未授權'); this.store = id; }
    manageable(action) { return this.projects('users', action); }
    visibleUsers() {
      const ids = this.projects('users').map(p => p.id);
      return this.data.users.filter(u => !u.system && ids.some(p => u.grants[p]));
    }
    availableExisting() {
      // Only the system administrator can search the platform account directory.
      // Other managers use a known login rather than enumerating unrelated accounts.
      if (!this.manageable('create').length) return [];
      return this.user.system ? this.data.users.filter(u => !u.system && !this.projects().some(p => u.grants[p.id])) : [];
    }
    canManageRoles(store = this.store) { return this.user.system || this.data.projects.some(project => project.store === store && this.role(this.user.grants[project.id])?.manager && this.can(project.id, 'users', 'edit')); }
    roleActionAllowed(store, feature, action) { return this.user.system || this.data.projects.some(project => project.store === store && this.can(project.id, feature, action)); }
    assignableRoles() { return this.data.roles.filter(r => r.enabled !== false && (!r.store || r.store === this.store) && (this.user.system || ['viewer', 'refund'].includes(r.id) || r.store === this.store && !r.manager && Object.entries(r.permissions).every(([feature, valid]) => valid.every(action=>this.roleActionAllowed(this.store,feature,action))))); }
    canEditUser(id) {
      const u = this.data.users.find(u => u.id === id);
      if (!u || u.system) return false;
      if (this.user.system) return this.projects().some(p => u.grants[p.id]);
      if (u.id === this.user.id) return false;
      const relevant = this.data.projects.filter(p => p.store === this.store && u.grants[p.id]);
      // Partial-manager editing of a user with other project grants is explicitly unresolved.
      return relevant.length > 0 && relevant.every(p => this.can(p.id, 'users', 'edit')) && relevant.some(p => !this.role(u.grants[p.id])?.manager);
    }
    saveRole(input) {
      if (!this.canManageRoles(input.store)) throw Error('沒有此商店的角色管理權限');
      if (!String(input.name || '').trim()) throw Error('請填寫角色名稱');
      if (input.store && !this.data.stores.some(s => s.id === input.store)) throw Error('適用商店不存在');
      const old = this.role(input.id);
      if (!this.user.system && (!input.store || input.store !== this.store || old && (old.store !== this.store || old.manager))) throw Error('只能設定目前商店的自訂角色');
      if (!this.user.system && Object.entries(input.permissions || {}).some(([feature, valid]) => valid.some(action=>!this.roleActionAllowed(input.store,feature,action)))) throw Error('不能授予超出自身權限的功能');
      if (this.data.roles.some(role=>role.id!==input.id && role.store===(input.store||'') && role.name===input.name.trim())) throw Error('此商店已有相同角色名稱');
      if (input.id && !old) throw Error('角色不存在');
      if (old && input.store && this.data.users.some(u => Object.entries(u.grants).some(([p, r]) => r === old.id && this.data.projects.find(x => x.id === p)?.store !== input.store))) throw Error('此角色已有其他商店的授權；變更適用範圍的處理規則待確認');
      const role = {
        id: old?.id || uid('role'), name: input.name.trim(), store: input.store || '', manager: old?.manager || false, note: String(input.note || ''), enabled: input.enabled !== false,
        permissions: Object.fromEntries(Object.entries(actions).map(([feature, valid]) => [feature, valid.filter(a => input.permissions?.[feature]?.includes(a))]))
      };
      if (old) Object.assign(old, role); else this.data.roles.push(role);
      return role;
    }
    saveUser({ mode, id, existingLogin, name = '', login = '', grants = {} }) {
      if (!['new', 'existing', 'edit'].includes(mode)) throw Error('不支援的操作');
      const edit = mode === 'edit', allowed = this.manageable(edit ? 'edit' : 'create').map(p => p.id);
      if (!allowed.length) throw Error(edit ? '未授予使用者編輯權限' : '未授予使用者新增權限');
      let target = mode === 'existing' && existingLogin ? this.data.users.find(u => u.login === existingLogin.trim()) : this.data.users.find(u => u.id === id);
      if (edit && !this.canEditUser(id)) throw Error('無可編輯授權，或此操作涉及自己、管理員身分／未授權專案，規則待確認');
      if (target?.system) throw Error('此流程不能指派系統管理員帳號');
      if (mode === 'existing') {
        if (!target) throw Error('找不到此登入帳號，請確認輸入內容');
        if (this.data.projects.some(p => p.store === this.store && target.grants[p.id])) throw Error('帳號已加入目前商店，請使用編輯授權；不能透過新增流程更改既有管理員身分');
      }
      if (mode === 'new') {
        if (!name.trim() || !login.trim()) throw Error('請填寫姓名與登入帳號');
        if (this.data.users.some(u => u.login === login.trim())) throw Error('登入帳號已存在，請改用加入既有帳號');
      }
      const entries = Object.entries(grants);
      if (!entries.length) throw Error('請勾選至少一個專案；撤銷／移除流程待確認');
      for (const [p, roleId] of entries) {
        const r = this.role(roleId);
        if (!allowed.includes(p) || !r || r.store && r.store !== this.store) throw Error('專案或角色超出目前可設定範圍');
        if (!this.user.system && !this.assignableRoles().some(x => x.id === roleId)) throw Error('無權指派此角色');
        if (!this.user.system && this.role(target?.grants[p])?.manager) throw Error('商店管理員身分僅系統管理員可授予或變更');
      }
      const user = mode === 'new' ? { id: uid('user'), name: name.trim(), login: login.trim(), grants: {} } : target;
      // Omitted projects are deliberately preserved; removal has not been specified.
      Object.assign(user.grants, grants);
      if (mode === 'new') this.data.users.push(user);
      return user;
    }
    savePaymentTool(input) {
      if (!this.user.system) throw Error('僅系統管理員可設定支付工具');
      const old = this.data.paymentTools.find(t => t.id === input.id);
      if (input.id && !old) throw Error('支付工具不存在');
      const values = Object.fromEntries(['platform', 'name', 'code', 'currency', 'note'].map(k => [k, String(input[k] || '').trim()]));
      if (!values.platform || !values.name || !values.code || !values.currency) throw Error('請填寫有效的必填欄位');
      if (!['%', '元'].includes(input.unit)) throw Error('請選擇有效的計價單位');
      if (!String(input.fee ?? '').trim() || !Number.isFinite(Number(input.fee)) || Number(input.fee) < 0) throw Error('請填寫有效的必填欄位');
      const tool = { id: old?.id || uid('payment'), ...values, unit: input.unit };
      if (old) Object.assign(old, tool); else this.data.paymentTools.push(tool);
      this.data.fees[tool.id] = String(input.fee).trim();
      return tool;
    }
    feeCan(key, action) {
      return !!this.user.system && Object.hasOwn(this.data.fees, key) && this.data.paymentTools.some(t => t.id === key) && ['view', 'edit'].includes(action);
    }
    setFee(key, value) {
      if (!this.feeCan(key, 'edit')) throw Error('僅系統管理員可設定支付工具與手續費');
      if (!String(value).trim() || !Number.isFinite(Number(value))) throw Error('請填寫有效的費率數值');
      this.data.fees[key] = String(value).trim();
    }
    paymentSettingsForStore(storeId) {
      if (!this.data.stores.some(s => s.id === storeId)) throw Error('商店不存在');
      return this.data.paymentTools.map(t => ({ ...t, fee: this.data.fees[t.id] }));
    }
    paymentSettingsForProject(projectId) {
      const project = this.data.projects.find(p => p.id === projectId);
      if (!project) throw Error('專案不存在');
      return this.paymentSettingsForStore(project.store);
    }
  }
  function isSavedData(data) {
    if (!data || !['stores', 'projects', 'users', 'roles'].every(k => Array.isArray(data[k])) || !data.fees || typeof data.fees !== 'object') return false;
    return data.users.some(u => u.id === 'admin' && u.system) && data.users.every(u => typeof u.name === 'string' && typeof u.login === 'string' && u.grants && typeof u.grants === 'object') && data.roles.every(r => typeof r.name === 'string' && r.permissions && typeof r.permissions === 'object');
  }
  function migrate(data) {
    // Keep the platform setting; retire per-store/project copies rather than selecting an override.
    const defaults = paymentDefaults();
    if (!Array.isArray(data.paymentTools)) data.paymentTools = defaults.map(({ fee, ...tool }) => tool);
    const codes = { 'apple-pay': 'APPLEPAY', 'google-pay': 'GOOGLEPAY', 'line-pay': 'LINEPAY', atm: 'VACC', cvs: 'CVS', 'credit-card': 'CREDIT', 'foreign-credit-card': 'CREDIT' };
    data.paymentTools.forEach(t => { t.code ??= codes[t.id] || ''; t.note ??= ''; });
    const previous = data.fees;
    data.fees = Object.fromEntries(data.paymentTools.map(t => [t.id, previous[t.id] ?? (t.id === 'credit-card' ? previous.system : undefined) ?? defaults.find(d => d.id === t.id)?.fee ?? '0']));
    const names = { charlie: ['陳查理：原始範例', '陳查理'], multi: ['陳查理：多專案情境', '林冠宇'], cross: ['跨商店展示帳號', '李佳穎'], big: ['管理員展示：可新增／編輯', '林志明'], little: ['管理員展示：僅可編輯', '吳雅婷'], partial: ['管理員展示：僅專案 A', '張怡君'] };
    data.users.forEach(u => { const rename = names[u.id]; if (rename && u.name === rename[0]) u.name = rename[1]; if (u.id === 'admin' && u.login === 'demo-admin') u.login = 'admin'; });
    data.users = data.users.filter(u => !['fee-only', 'none'].includes(u.id));
    data.users.forEach(user => {
      if (!user.system && !user.email) user.email = user.login.includes('@') ? user.login : user.login + '@gmail.com';
    });
    data.roles = data.roles.filter(r => r.id !== 'fee-reader');
    data.roles.forEach(r => { delete r.permissions.fees; delete r.permissions.payments; if (r.id === 'refund' && r.name === '退款展示角色') r.name = '交易退款角色'; });
    data.projects.forEach(p => { if (p.id === 'C' && p.name === '示意專案 C') p.name = '線上課程專案 C'; });
    return data;
  }
  const api = { SystemManagement, seed, actions, isSavedData, migrate };
  if (typeof module !== 'undefined') module.exports = api; else root.SystemManagement = api;
})(typeof window !== 'undefined' ? window : globalThis);
