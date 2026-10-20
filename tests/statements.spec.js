const {test,expect}=require('@playwright/test');
test('statement add, edit, archive and locked dates persist',async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T04:00:00Z')});
 await page.goto('/statements.html');await page.getByRole('button',{name:'新增',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'新增對帳單',exact:true});await expect(modal.getByRole('button',{name:'確定',exact:true})).toBeDisabled();
 await modal.getByRole('radio',{name:'財務(全部)',exact:true}).check();await modal.getByLabel('對帳單名稱').fill('新測試對帳單');
 for(const [label,value] of [['選擇商店','行動發展部'],['選擇專案','行動發展部'],['選擇商品','全部商品']]){await modal.getByLabel(label,{exact:true}).click();await modal.getByRole('checkbox',{name:value,exact:true}).check();await modal.getByLabel(label,{exact:true}).click();}
 await modal.getByLabel('開始日期',{exact:true}).fill('2026-10-01');await modal.getByLabel('結束日期',{exact:true}).fill('2026-10-14');await modal.getByRole('button',{name:'確定',exact:true}).click();
 const row=page.locator('.statement-table tbody tr').first();await expect(row).toContainText('新測試對帳單');await row.getByRole('link').click();
 const edit=page.getByRole('dialog',{name:'編輯對帳單',exact:true});await expect(edit.getByLabel('開始日期',{exact:true})).toBeEnabled();await edit.getByLabel('備註',{exact:true}).fill('備註已修改');await edit.getByRole('button',{name:'確定',exact:true}).click();
 await row.getByRole('button',{name:'封存',exact:true}).click();await expect(row).toContainText('2026/10/14 12:00:');await row.getByRole('link').click();await expect(edit.getByLabel('開始日期',{exact:true})).toBeDisabled();await expect(edit.getByLabel('結束日期',{exact:true})).toBeDisabled();
 await page.screenshot({path:'test-results/statement-archived.png'});await edit.getByLabel('備註',{exact:true}).fill('封存後備註');await edit.getByRole('button',{name:'確定',exact:true}).click();await page.reload();await expect(row).toContainText('封存後備註');await expect(row.getByRole('button',{name:'封存',exact:true})).toHaveCount(0);await row.getByRole('link').click();await expect(edit.getByLabel('開始日期',{exact:true})).toHaveValue('2026-10-01');await expect(edit.getByLabel('開始日期',{exact:true})).toBeDisabled();
});
