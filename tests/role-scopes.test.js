const test=require('node:test');const assert=require('node:assert/strict');const {SystemManagement,seed}=require('../system-model');
test('store roles allow distinct names and same name in different stores',()=>{
 const data=seed();const admin=new SystemManagement(data);
 const a=admin.saveRole({name:'專案管理員',store:'edu',permissions:{transactions:['view']},note:'A 商店'});
 const b=admin.saveRole({name:'子商店管理員',store:'u',permissions:{transactions:['view']}});
 assert.deepEqual(a.permissions,b.permissions);
 admin.saveRole({name:'專案管理員',store:'u',permissions:{transactions:['view']}});
 assert.throws(()=>admin.saveRole({name:'專案管理員',store:'edu',permissions:{}}));
 const manager=new SystemManagement(data,'big','edu');manager.saveRole({name:'教育自訂角色',store:'edu',permissions:{transactions:['view']}});
 assert.throws(()=>manager.saveRole({name:'不可建立',store:'u',permissions:{transactions:['view']}}));
 assert.throws(()=>manager.saveRole({id:b.id,name:'不可修改',store:'edu',permissions:{}}));
});
