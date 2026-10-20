# 靜態 Demo 視覺檢查

final result: passed

範圍：11 張參考畫面的 HTML＋CSS 靜態重現；管理按鈕、分頁數字及查詢結果不具資料操作功能。

## 比對證據

- 來源：使用者附上的 11 張 `C:/Users/user/AppData/Local/Temp/codex-clipboard-*.png`，順序對應 index、transactions、products、tags、statistics、statements、users、roles、projects、stores、payments。
- 瀏覽器截圖：工作目錄 `work/{頁面名稱}.png`。
- 同一輸入內並排比較：`work/qa-0.png`、`work/qa-4.png`、`work/qa-8.png`；每列左側為來源，右側為實作。
- 細部比對：`work/qa-focus.png` 比對標籤表格表頭、框線、按鈕及列高。
- 桌面 CSS viewport：1920 × 911；來源影像為 1920 × 911。Browser 截圖保留其原始尺寸；比較圖中雙方各正規化至 960 × 456。比較不含瀏覽器外框。
- 狀態：各頁預設狀態，左側選單展開狀態依參考畫面。

## 檢查結果

- 字體：14px 表格及控制項，首頁 24px／30px 標題；Times New Roman、Microsoft JhengHei 與系統 fallback。字型邊緣及部分標點與原系統存在細微差異（P3）。
- 版面：210px 側邊欄、50px 頂欄、20px 內容邊距、40px 輸入欄及主按鈕；各頁使用相同表格與查詢區排列。
- 色彩：側欄 #304156、子選單 #1f2d3d、主要按鈕 #409eff、新增 #67c23a、表格框線 #ebeef5。
- 圖示：使用本機 Bootstrap Icons SVG 資產；無外部字型或圖示 CDN 依賴。圖示形狀與截圖中的原圖示庫存在細微差異（P3）。
- 文案：繁體中文導覽、表頭、控制項與可見示例資料依參考建立。示例資料筆數提示保留參考值，表格僅包含示例列。
- 統計頁不重現截圖中的暫時性錯誤訊息；此為展示預設空資料畫面的刻意選擇。

## 修正歷程

1. 初始比對：標籤按鈕缺少編輯圖示、商品分頁間距及頁碼數不同、商店表格缺少雙層表頭。
2. 修正：補入 pencil 圖示、調整分頁間距、商品／商店保留兩個頁碼，新增支付工具合併表頭與日期圖示。
3. 再次比對：對帳單列高及標籤密度不同，支付工具頁缺少頁碼輸入欄。
4. 修正：對帳單依各列設定列高、補齊可见標籤與區間，加入頁碼輸入欄；截圖更新至 work/statements.png、work/stores.png、work/payments.png。
5. 最終比較：主要版面及密度符合靜態 demo 範圍；保留 P3 字型及圖示微差。

## 驗證

- 全部 11 頁成功在瀏覽器載入，圖示全部完成載入。
- 所有本機頁面與資產連結存在。
- 已測試選單連結、側邊欄收合／展開、輸入欄及重置連結。
- 瀏覽器 console error 檢查無錯誤。
- 手機版未做精確視覺比對；本次驗收以提供的桌面畫面為準。
`nFont update: Noto Sans TC bundled locally; all body, button, input, select, th and td computed families verified as Noto Sans TC. Browser font readiness verified. Screenshot: outputs/demo-preview.png. User-requested typography replaces original reference typography.
