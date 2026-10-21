# 支付平台 demo：權限與操作

此專案供 IT 理解介面、業務規則及互動。沿用靜態頁控制程式、Vue 3／Element Plus 相容層，以及 localStorage／sessionStorage，沒有正式認證、後端或支付串接。

## 啟動與驗證

使用 Node.js 22 以上，執行 `npm ci`、`npm start`，開啟 http://127.0.0.1:4173/users.html 。修改 ui 後執行 `npm run build`；ui/dist 是不提交的建置產物。

GitHub Pages 等靜態主機發布前也須執行 `npm ci` 與 `npm run build`，發布內容必須包含生成的 `ui/dist`、HTML、根目錄 JS／CSS 及 assets。僅上傳 Git 追蹤的原始碼不會包含 `ui/dist`，可能造成介面未載入；部署完成後可在瀏覽器 Network 確認 `ui/dist/element-app.js`、`ui/dist/element-app.css` 皆回傳 200。列表表頭與內容統一靠左，原始表格與 Element Plus 表格採相同設定。

已提供 `.github/workflows/pages.yml`：安裝依賴、建置、執行模型測試，僅封裝網站檔案與生成的 UI 後發布。推送這個檔案後，在 GitHub 儲存庫 Settings → Pages → Source 選擇 GitHub Actions，再到 Actions → Build and publish GitHub Pages → Run workflow 手動發布。流程只有手動觸發，不會因 push 自動部署；不需將 `ui/dist` 加入版本控制。

`npm test` 驗證模型、授權及費率；`npm run test:browser` 建置後執行 element-ui.spec.js 與 authorization-ui.spec.js，操作實際可見的 Element Plus 元件。其他舊版瀏覽器測試保留為遷移參考。

## 權限模型

每次操作同時檢查功能動作及目標範圍。集中入口為 `SystemManagement.allowed(scope,target,feature,action)`；can、canStore、canPlatform 分別包裝專案、整店及平台範圍。新增與編輯維持合併授權。交易、報表、對帳單的操作另要求同範圍檢視權。

使用者保留 `grants: {projectId: roleId}`，新增 `storeGrants: {storeId: roleId}` 與 `platformRoles: [roleId]`。平台授權涵蓋全部商店及專案；整店授權涵蓋既有及未來專案；指定專案不擴及其他專案。重疊範圍採功能聯集，不引入拒絕權限。角色的 store、project 只限定角色可適用範圍，不替使用者增加資料授權。

啟用中的系統管理員具全部功能及全域範圍。一般角色有對應權限即可操作授權資料；舊 manager 布林值不再決定誰能管理誰。新增商店、平台共用角色、支付工具基本資料、全域費率需平台權限。商店共用角色及新增專案需整店權限；專案角色只適用指定專案。支付工具基本資料與費率分開授予。

assignableRoles／saveUser 逐一檢查每個目標的可授予功能，沒有 viewer、refund 等 ID 特例，不能把 A 專案權限用於 B。一般角色不能變更自己的授權或系統管理員身分。saveRole 檢查適用範圍及所有既有指派，含停用帳號，以避免重新啟用後擴權；影響未授權範圍或自身授權時拒絕並提示建立獨立角色。

停用使用者、停用角色立即失去其提供的功能及資料存取。只有完全沒有儲存工作階段時使用明確的初始 demo 管理員；身分不存在、空白或資料毀損不回退管理員。

管理頁、商店選擇及共用權限入口一致區分「儲存鍵不存在」與「已儲存空字串／null／無效資料」。新版鍵存在時不改讀舊版身分。自身角色保護也檢查停用中的原始指派，不能藉重新啟用自身角色繞過限制；全域授權僅接受角色陣列或明確撤銷 null，儲存副本以避免呼叫端後續修改影響授權。

## 管理介面與撤銷

使用者、角色、專案、商店管理都預設目前進入的商店。查詢下拉只改顯示，不改頁首商店、工作階段或授權。「全部商店」是該功能授權範圍的聯集；清除恢復進入時商店。角色列表包含適用該店的平台共用、商店共用及指定專案角色，清楚標示範圍。

新增／編輯視窗顯示商店，全部商店新增需明確選擇範圍。使用者視窗分開提供全域、整店及指定專案授權。「指定目前全部專案」仍是逐專案授權，不包含未來專案。

按「撤銷授權」才產生明確撤銷。模型以 `grants: {A:null}`、`storeGrants: {edu:null}` 或明確提交 `platformRoles: []` 撤銷；未提交資料保持原樣。授權全部驗證後才寫入；視窗使用副本避免跨商店提交部分成功。啟停使用者影響全帳號，須能管理其所有授權範圍。

使用者視窗以 `canChangeUserState` 與模型儲存共用相同規則；缺少任一範圍權限時停用帳號狀態控制並說明原因，仍可修改或撤銷有權管理的授權。

操作入口採明確功能／動作識別，不依按鈕文字推測；儲存與模型再次驗權。

## 相容與交易範圍

主要儲存鍵維持 payment-system-management-v2，相容讀取 payment-system-demo-v1。舊逐專案授權原樣保留，不轉成整店。新增／編輯合併的既有遷移只執行一次，重讀不恢復已撤銷權限。舊版原本不生效的 payments／fees 欄位不會在升級後自動取得權限，須由管理者重新明確授予；新版角色以 permissionVersion 3 區分。

費率版本、狀態異動、排程、歷程與快照保留。舊 fees 中可可靠對應的信用卡商店／專案覆寫只匯入一次，成為該層版本；原值保存在 legacyFeeOverrides，不明值只保留不套用。詳見 README-fee-schedules.md。

transaction-data.js 的新編寫靜態 fixture 明確提供 projectId（相容陣列第 14 欄），商店及專案名稱由模型關係取得。data-access.js 共用列表、明細、退款、統計、對帳單及匯出範圍判斷；退款確認與匯出當下再驗權。靜態對帳單 fixture 明確提供 projectIds。

已儲存但缺少可靠專案 ID 的舊資料保留在原儲存區，不以名稱回填，也不顯示或匯出，需 IT 補正後才能使用。統計無快照的歷史費用顯示「—」，不臆算；對帳單報表仍是明確標示的模擬資料，只包含對帳單與操作者共同授權的專案。

主要檔案：system-model.js（模型／遷移）、system-admin.js（管理頁）、role-modal.js／user-create-modal.js（角色及授權互動）、ui/permissions.js（選單及入口）、data-access.js（交易範圍）。

## 正式系統由 IT 實作

瀏覽器資料與程式可由本機使用者修改，模型驗權只供 demo 驗證。正式服務須提供服務端認證、每次請求授權與資料隔離、帳號目錄、資料庫、交易退款狀態機、支付回呼驗證、稽核及並行控制。歷史關聯補正、真實統計／對帳及付款成功時原子鎖定費率快照也須由後端負責。
