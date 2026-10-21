(() => {
  "use strict";
  const model = () => window.SystemManagement.current();
  const record = order => ({projectId: order?.projectId || order?.[14]});
  window.PaymentAccess = {
    model, record,
    allows(order, feature = "transactions", action = "view") {
      const app = model(), item = record(order);
      return app.transactionAllowed(item, feature, action) && app.data.projects.some(p => p.id === item.projectId && p.store === app.store);
    },
    assert(order, feature = "transactions", action = "view") {
      if (!this.allows(order, feature, action)) throw Error("無此資料的操作權限");
    },
    statementAllowed(entry, action = "view") {
      const app = model();
      return !!entry?.projectIds?.length && entry.projectIds.every(id => app.transactionAllowed({projectId:id},"statements",action) && app.data.projects.some(p => p.id === id && p.store === app.store));
    },
  };
})();
