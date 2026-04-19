# 完整 UX 比較報告：我們的系統 vs nczz (idempiere-appointment)

日期: 2026-04-19

---

## 總評

兩套系統都以 iDempiere 12 為後端、FullCalendar 為行事曆核心，技術起點相似。nczz 系統是一個「預約專精」工具，設計緊湊、功能邊界清晰，有服務項目管理（含時長）和跨租戶資源分組，但僅限於預約行事曆，沒有諮詢、訂單、療程、付款等業務模組。我們的系統在功能廣度上全面領先：諮詢模組有看板、甘特圖、旅程漏斗、待分配、今日待辦五種延伸視圖，並完整串接訂單→療程→付款→出貨流程。差距集中在行事曆的幾個細節（服務項目時長預設、資源跨租戶分組、跨資源 drag-and-drop）以及 admin 管理面板的原地管理能力。

---

## 逐項比較

### 1. 預約行事曆 (Calendar)

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 視圖種類 | 月/週/3日/日/列表（5種） | 月/週/3日/日/列表（5種） | ⚠️ 差不多 |
| 行事曆套件 | FullCalendar v6 + Vue 3 wrapper | FullCalendar v6 + React wrapper | ⚠️ 差不多（不同 framework wrapper） |
| 預設視圖 | 週視圖（timeGridWeek） | 週視圖（timeGridWeek） | ⚠️ 差不多 |
| 語言/本地化 | zh-tw locale，按鈕全中文 | zh-tw locale，按鈕全中文 | ⚠️ 差不多 |
| 格線精度 | 15分鐘（slotDuration: '00:15:00'） | 15分鐘（slotDuration: '00:15:00'） | ⚠️ 差不多 |
| 營業時間範圍 | 09:00–18:00 | 09:00–18:00 | ⚠️ 差不多 |
| 全天欄位 | 隱藏（allDaySlot: false） | 隱藏（allDaySlot: false） | ⚠️ 差不多 |
| 今日指示器 | ✅ 有（nowIndicator: true） | ✅ 有（nowIndicator: true） | ⚠️ 差不多 |
| 拖拉移動（drag-drop） | ✅ 真正存檔（PUT AssignDateFrom/To） | ✅ 有，但 editable: true 是否真存檔依賴 `/update` API | ⚠️ 差不多 |
| resize 事件（調整結束時間） | ✅ EventResize → PUT AssignDateTo | 未在 Calendar.tsx 中看到 eventResize handler | ✅ 我們更好 |
| 事件顏色來源 | 狀態色 優先；回退資源色（兩層） | 資源色（從 ResourceManager 設定） | ✅ 我們更好（狀態優先邏輯） |
| 事件透明度（取消/未到） | ✅ terminal status 事件 opacity 0.45 | 未見實作 | ✅ 我們更好 |
| 事件標題格式 | 名稱（含 BPartner + 服務組合） | 標題 + 資源名稱（自訂 render） | ⚠️ 差不多 |
| 搜尋框 | ✅ Sidebar 搜尋預約 | ✅ Sidebar 搜尋（含日期跳轉功能） | ❌ nczz 多了「跳到日期」導航 |
| 今日按鈕語言 | 「今天」 | 「今天」 | ⚠️ 差不多 |

**說明**：核心行事曆功能兩者幾乎等價。我們的優勢在於 resize、狀態優先顏色、terminal 事件透明化。nczz 搜尋框多了「跳到日期」功能，是一個小但有用的 UX 改善。

---

### 2. 預約建立/編輯 Dialog

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 服務人員選擇 | ✅ 下拉選單 + 即時新增按鈕（+） | ✅ 多選（checkbox list） | ⚠️ 各有千秋 |
| 多資源同時預約（create） | ✅ 模式切換：單一/多資源 checkbox + 並行 POST | ✅ 多選下拉 + group ID 機制 | ⚠️ 差不多 |
| 編輯模式多資源管理 | ❌ 編輯模式只能改名稱/狀態/備註（API限制） | ✅ 可加/移除資源（group-add/group-remove API） | ❌ 我們落後 |
| 開始時間選擇 | datetime-local input | date + time 兩個輸入（15分鐘 step） | ⚠️ 差不多 |
| 結束時間選擇 | datetime-local input | date + time 兩個輸入（15分鐘 step） | ⚠️ 差不多 |
| 名稱欄位 | ✅ 名稱（自動組合 BPartner + 服務） | ✅ 客戶姓名（必填） | ⚠️ 差不多 |
| 狀態選擇 | ✅ 從 AD_Reference 動態載入（create+edit） | ✅ 從 API 動態載入（僅 edit mode） | ⚠️ 差不多 |
| 客戶搜尋（BPartner） | ✅ 防抖搜尋（300ms, ≥2字）+ 清除 | ✅ 防抖搜尋（300ms, ≥2字）+ 顯示電話/Email | ❌ nczz 多顯示電話/Email |
| 服務項目選擇 | ✅ 可填寫服務名稱（自由文字） | ✅ 下拉預設服務（含時長分鐘數）| ❌ nczz 有服務時長預設，我們無 |
| 自動計算結束時間 | ❌ 無 | 有服務時長但未見自動帶入結束時間的程式碼 | ⚠️ 差不多 |
| 顏色自訂（每張預約） | ✅ 有 ColorPickerPopover（每張獨立色） | ❌ 無 per-appointment 顏色 | ✅ 我們更好 |
| 備註欄位 | ✅ 備註 textarea（3行） | ✅ 備註 textarea（2行） | ⚠️ 差不多 |
| 衝突偵測 | ✅ 本地衝突（前端 + API checkConflict） | ⚠️ 依賴後端 IsSingleAssignment 標記 | ✅ 我們更好（明確前端偵測） |
| 多資源衝突指示 | ✅ 紅點 conflict-dot 顯示衝突資源 | ❌ 無明確視覺提示 | ✅ 我們更好 |
| 關聯諮詢 banner | ✅ 從諮詢建立預約時顯示關聯 #ID | ❌ 無 | ✅ 我們更好 |
| 即時新增服務人員 | ✅ 在 dialog 內直接建立新 S_Resource | ❌ 需至 ResourceManager 管理 | ✅ 我們更好 |
| 驗證錯誤提示 | ✅ 行內 errorMsg 文字 | ✅ Toast 通知 | ⚠️ 差不多 |
| 取消預約語義 | ✅ CXL status（保留紀錄，釋放時段）+ confirm | ✅ cancel API（具體行為不明） | ⚠️ 差不多 |
| 儲存中狀態 | ✅ 按鈕 disabled + 「儲存中...」 | ✅ 有 saving state | ⚠️ 差不多 |

---

### 3. 狀態系統

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 預設狀態數量 | 7種（SCH/CFM/CHK/INP/DON/ABS/CXL） | 7種（Scheduled/Confirmed/Checked-in/In Progress/Completed/Absent/Cancelled）| ⚠️ 差不多 |
| 狀態 Value 代碼 | 英文縮寫（SCH, CFM...） | 未見縮寫，似乎以名稱為主 | ⚠️ 差不多 |
| 狀態顏色來源 | AD_Ref_List.Description 存 hex；fallback hardcode | StatusManager 存 API，可視覺編輯 | ❌ nczz 在 UI 內可直接改色（StatusManager），我們需改 AD_Ref_List |
| 狀態可否新增 | ❌ 不可（只能在 iDempiere AD_Ref_List 設定） | ❌ 不可新增（只能編輯現有） | ⚠️ 差不多（同樣無法 UI 新增） |
| 狀態可否重命名 | ❌ 需至 iDempiere AD | ✅ StatusManager 原地改名 | ❌ 我們落後 |
| 狀態顏色可否 UI 修改 | ❌ 需至 iDempiere AD | ✅ StatusManager color picker | ❌ 我們落後 |
| Terminal 狀態定義 | TERMINAL_CODES = {CXL, ABS} hardcoded | 不明，依 status value 判斷 | ⚠️ 差不多 |
| 狀態圖例 sidebar | ✅ 有 | ✅ 有 | ⚠️ 差不多 |
| 取消語義 | CXL status（soft cancel，保留記錄） | cancelAppointment API（具體實作不明） | ⚠️ 差不多 |

---

### 4. 左側 Sidebar

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 搜尋框 | ✅ 即時過濾（名稱/BPartner/服務） | ✅ 搜尋 + 日期跳轉導航 | ❌ nczz 多日期跳轉 |
| 資源篩選 | ✅ chip 式 + 右鍵改色 + 全選/取消全選 | ✅ checkbox + 按類型分組 + 全選/取消全選 | ❌ nczz 按類型分組（更清楚），我們有右鍵改色 |
| 資源分組（按類型） | ❌ 無分組，所有資源平鋪 | ✅ S_ResourceType 分組 | ❌ 我們落後（多資源場景下難以辨識） |
| 服務篩選 | ❌ 無服務篩選 | ✅ 服務項目 checkbox 篩選 | ❌ 我們落後 |
| 狀態圖例 | ✅ 有 | ✅ 有 | ⚠️ 差不多 |
| 顯示已取消 toggle | ✅ checkbox | ✅ checkbox | ⚠️ 差不多 |
| 管理面板入口 | ❌ 無（需另開 Admin 路由） | ✅ 三個管理按鈕（資源/服務/狀態）直接在 Sidebar | ❌ 我們落後（管理動線較長） |
| 資源顏色右鍵 picker | ✅ 右鍵 context menu 改色 | ❌ 顏色在 ResourceManager 設定 | ✅ 我們更好（快速改色） |
| 空狀態提示 | ✅ 有（請至管理員設定） | 未見明確 empty state | ✅ 我們更好 |

---

### 5. 諮詢模組 (Consultation / R_Request)

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 是否有此模組 | ✅ 完整模組（6個子視圖） | ❌ 無 | ✅ 我們更好（壓倒性差距） |
| 諮詢列表視圖 | ✅ 有 | ❌ 無 | ✅ 我們更好 |
| 看板視圖 | ✅ 有（按 R_Status 列、按 SalesRep 泳道） | ❌ 無 | ✅ 我們更好 |
| 甘特圖視圖 | ✅ 有（多縮放級別、今日線、週末高亮） | ❌ 無 | ✅ 我們更好 |
| 旅程漏斗 | ✅ 有（按 R_Status 階段，含轉化率/流失計算） | ❌ 無 | ✅ 我們更好 |
| 待分配視圖 | ✅ 有（未分配諮詢單 + 未開單潛在客戶兩 Tab） | ❌ 無 | ✅ 我們更好 |
| 今日待辦視圖 | ✅ 有 | ❌ 無 | ✅ 我們更好 |
| 儀表板（Dashboard） | ✅ 有（轉化率/時間/待轉化 + 諮詢師排名） | ❌ 無 | ✅ 我們更好 |
| 狀態管理 | ✅ R_Status FK（IsClosed 驅動轉化判定） | ❌ 無 | ✅ 我們更好 |
| 諮詢→訂單轉換 | ✅ 「建立訂單」按鈕（需 C_BPartner_ID） | ❌ 無 | ✅ 我們更好 |
| 諮詢→預約關聯 | ✅ 「建立預約」按鈕 + 關聯 banner 回流 | ❌ 無 | ✅ 我們更好 |
| 活動記錄 Timeline | ✅ RequestTimeline 組件 + ActivityInputModal | ❌ 無 | ✅ 我們更好 |
| 快速操作欄 | ✅ QuickActionBar（sticky bottom，加活動/改狀態/設跟進） | ❌ 無 | ✅ 我們更好 |
| 下次跟進日期 | ✅ DateNextAction 欄位 + 紅/橙/黃/灰 badge | ❌ 無 | ✅ 我們更好 |
| 客戶歷史側欄 | ✅ CustomerHistorySidebar 組件 | ❌ 無 | ✅ 我們更好 |
| 諮詢師績效排名 | ✅ 按 SalesRep_ID 分組，可點擊跳轉篩選 | ❌ 無 | ✅ 我們更好 |
| 附件/照片 | ✅ AD_Attachment 上傳 + 縮圖預覽 + 刪除 | ❌ 無 | ✅ 我們更好 |
| 認領功能 | ✅ 待分配頁面有認領按鈕 | ❌ 無 | ✅ 我們更好 |

---

### 6. 訂單模組 (Order)

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 是否有此模組 | ✅ 完整 C_Order + C_OrderLine | ❌ 無 | ✅ 我們更好 |
| 銷售/採購切換 | ✅ IsSOTrx segmented button | ❌ 無 | ✅ 我們更好 |
| 明細行管理 | ✅ 新增/編輯/刪除行；自動同步總金額 | ❌ 無 | ✅ 我們更好 |
| 文件動作（Complete/Void） | ✅ DocActionBar | ❌ 無 | ✅ 我們更好 |

### 7. 療程模組 (Treatment / M_Production)

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 是否有此模組 | ✅ M_Production（BOM 療程）| ❌ 無 | ✅ 我們更好 |

### 8. 付款模組 (Payment)

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 是否有此模組 | ✅ C_Payment 完整 CRUD | ❌ 無 | ✅ 我們更好 |

### 9. 出貨模組 (Shipment)

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 是否有此模組 | ✅ M_InOut + M_InOutLine | ❌ 無 | ✅ 我們更好 |

### 10. 商品管理 (Product)

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 是否有此模組 | ✅ M_Product 完整 CRUD + BOM 篩選 | ❌ 無 | ✅ 我們更好 |

---

### 11. 客戶管理 (BPartner/Customer)

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 是否有此模組 | ✅ 有（C_BPartner + AD_User 聯絡人） | ❌ 無獨立模組（只有預約 dialog 內的搜尋）| ✅ 我們更好 |
| 搜尋方式 | ✅ 列表搜尋 + 防抖 | ❌ 只在 AppointmentDialog 內有 BPartner 搜尋 | ✅ 我們更好 |
| BPartner 搜尋顯示資訊 | 名稱 | 名稱 + 電話 + Email | ❌ 我們落後（搜尋結果少了電話/Email）|
| 聯絡人（AD_User）管理 | ✅ 有 | ❌ 無 | ✅ 我們更好 |
| 詳細資料頁 | ✅ CustomerDetailView | ❌ 無 | ✅ 我們更好 |

---

### 12. 儀表板/統計

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 預約行事曆儀表板 | ❌ 無（行事曆即主視圖）| ❌ 無 | ⚠️ 差不多 |
| 諮詢儀表板 | ✅ 有（諮詢師排名 + 3個指標卡）| ❌ 無 | ✅ 我們更好 |
| 指標種類 | 轉化率、平均轉化時間、待轉化諮詢數 | ❌ 無 | ✅ 我們更好 |
| 日期範圍篩選 | ✅ 7/30/90天/全部 | ❌ 無 | ✅ 我們更好 |
| 自動刷新 | ✅ 5分鐘（visibilitychange 暫停） | ❌ 無 | ✅ 我們更好 |
| 視覺化方式 | 卡片 + 排名表格（可點擊跳轉）| ❌ 無 | ✅ 我們更好 |

---

### 13. 服務項目管理 (Service Presets)

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 服務項目概念 | ❌ 無獨立服務項目（服務名稱為自由文字） | ✅ 有（名稱 + 時長分鐘）| ❌ 我們落後 |
| 服務項目 CRUD | ❌ 無 | ✅ 新增/編輯/停用 | ❌ 我們落後 |
| Sidebar 服務篩選 | ❌ 無 | ✅ 有（依服務過濾行事曆事件）| ❌ 我們落後 |
| 服務時長自動帶入 | ❌ 無 | ⚠️ 有欄位但自動帶入結束時間未明確確認 | ❌ 我們落後 |

---

### 14. 資源管理 (Resource Management)

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 資源建立 | ✅ 在 AppointmentForm 內即時建立 | ✅ ResourceManager dialog | ⚠️ 差不多 |
| 資源類型分組 | ❌ 無 S_ResourceType 分組 | ✅ 按 ResourceType 分層管理 | ❌ 我們落後 |
| 資源顏色管理 | ✅ 右鍵 sidebar chip 改色 | ✅ ResourceManager 內 color picker | ⚠️ 差不多（入口不同）|
| 資源停用 | ❌ 未見明確停用 | ✅ 有停用（軟刪除）| ❌ 我們落後 |
| 跳至 iDempiere 記錄 | ❌ 無 | ✅ 🔗 按鈕直接 zoom 到 S_Resource 表 | ❌ 我們落後 |

---

### 15. 登入/認證流程

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 登入步驟 | 5步驟：帳密→Client→Role→Org→Warehouse | JWT from ZK session（單一無需另登入）| ❌ nczz 整合 ZK session，使用者無感 |
| 多公司/角色/組織支援 | ✅ 完整 cascade 選擇 | ✅ 繼承 ZK session（無需另選）| ⚠️ 各有千秋 |
| Session 管理 | localStorage + sessionExpired banner | JWT postMessage 刷新 | ⚠️ 差不多 |
| 獨立應用 | ✅ 完全獨立 SPA（可直連）| ⚠️ 嵌入在 ZK iframe 內（依賴母系統登入）| ✅ 我們更好（獨立部署）|
| Token 刷新 | ✅ 401 → sessionExpired flag（不自動登出） | window.postMessage token 刷新 | ⚠️ 差不多 |

---

### 16. 行動裝置支援

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| RWD 響應式 | ✅ 有（@media max-width: 640px sidebar 轉為水平折疊）| 未明確看到 RWD 樣式 | ✅ 我們更好 |
| Touch 支援 | ✅ min-height: var(--min-touch) 全站生效 | 未見 touch target 規範 | ✅ 我們更好 |
| Kanban 行動限制 | Kanban 在手機顯示 fallback 提示 | ❌ 無 Kanban | ⚠️ 差不多 |
| 行事曆手機版 | sidebar 轉為頂部水平佈局 | 未明確看到 | ✅ 我們更好 |
| 行事曆高度固定 | 手機版 600px 固定高度 | 未明確看到 | ⚠️ 差不多 |

---

### 17. 整體 UX 品質

| 項目 | 我們的系統 | nczz | 差距 |
|------|-----------|------|------|
| 導航結構 | AppHeader 頂部導航 + 路由分頁 | Sidebar 左側管理面板 + 行事曆主體 | ⚠️ 各有千秋（我們多模組，nczz 更聚焦）|
| 錯誤訊息品質 | ✅ 行內 errorMsg + detail 從 API response 提取 | ✅ Toast 通知 | ⚠️ 差不多 |
| 載入狀態 | ✅ 各 section 獨立 loading state | ✅ 全域 loading + toast | ⚠️ 差不多 |
| 空狀態處理 | ✅ 明確空狀態文字（如「尚未設定任何資源」）| 未見完整空狀態 | ✅ 我們更好 |
| Toast 通知 | ✅ useToast composable（severity/summary/detail/life）| ✅ 有 toast system | ⚠️ 差不多 |
| 鍵盤操作 | ✅ Esc 關閉 dialog、Enter 新增資源 | 未見明確鍵盤支援 | ✅ 我們更好 |
| 無障礙（ARIA） | ✅ role="dialog" aria-modal aria-labelledby | 未見 ARIA 標記 | ✅ 我們更好 |
| 多結果部分失敗提示 | ✅ multiResultSummary（成功X/失敗Y）| 未見 | ✅ 我們更好 |
| 儲存中 disabled 防重複 | ✅ saving/cancelling/creatingResource 各自獨立 | ✅ 有 saving state | ⚠️ 差不多 |
| 全站 CSS 設計語言 | 客製化 CSS（tailwind-like class naming）| 客製化 CSS | ⚠️ 差不多 |
| 深色模式 | ❌ 未見 | ❌ 未見 | ⚠️ 差不多 |
| 複製預約（Copy Assignment） | ✅ CopyAssignmentDialog（複製到下週）| 未見 | ✅ 我們更好（README 提到此功能在 nczz 有，但 Dialog 中見到是我們的）|

**備注**：nczz README 中提到有「複製到下週」功能，但在程式碼中未確認具體實作位置；我們的 CopyAssignmentDialog 明確實作此功能。

---

## 我們的優勢

1. **業務模組完整度**：我們有諮詢、訂單、療程、付款、出貨、商品管理六大業務模組，nczz 只有預約行事曆。這是架構層面的壓倒性優勢。

2. **諮詢管理深度**：看板、甘特圖、旅程漏斗、待分配、今日待辦、儀表板——六個子視圖組成完整的諮詢工作流，nczz 完全沒有這個維度。

3. **諮詢→預約→訂單串接**：從諮詢建立預約（含關聯 banner 回流）、從諮詢建立訂單，業務閉環完整。nczz 沒有跨模組串接。

4. **EventResize 支援**：拖拉調整預約結束時間，直接 PUT 存檔；nczz 未見 eventResize 實作。

5. **狀態優先顏色邏輯**：行事曆事件以「狀態色 > 資源色」雙層判斷，terminal 事件自動半透明。

6. **Per-appointment 顏色覆蓋**：每張預約可設定獨立顏色（ColorPickerPopover + useAssignmentColors 持久化），nczz 無此功能。

7. **多資源衝突視覺提示**：衝突資源旁顯示紅點 conflict-dot，nczz 無明確衝突視覺。

8. **行動裝置最佳化**：min-touch target、sidebar 響應式折疊、ARIA dialog 屬性，nczz 無明確記錄。

9. **諮詢活動時間線**：RequestTimeline + ActivityInputModal，完整的活動記錄功能。

10. **下次跟進日期追蹤**：DateNextAction 欄位 + 紅/橙/黃/灰 overdue/today/tomorrow/later badge 系統。

11. **獨立 SPA 部署**：不依賴 ZK session 母系統，可直接以 URL 訪問；nczz 需嵌入在 ZK iframe 內使用。

---

## 我們的不足（需補強，按優先度排序）

### 高優先度

1. **服務項目管理（ServicePreset）缺失**
   - nczz 有「服務項目」概念（名稱 + 時長分鐘），可以在 Sidebar 過濾、在 dialog 選擇預設時長。
   - 我們的服務欄位是自由文字，沒有時長預設，Sidebar 也沒有服務篩選。
   - 影響：診所人員每次都要手動算結束時間；無法用「服務」維度分析行事曆。

2. **資源類型分組缺失**
   - nczz Sidebar 以 S_ResourceType 分層顯示資源（例如：「治療師」分組下有 A、B、C）。
   - 我們所有資源平鋪，資源多時難以辨識。
   - 影響：規模稍大的診所（10+ 資源）導航困難。

3. **Sidebar 管理面板動線過長**
   - nczz 在 Sidebar 底部有「管理資源」「管理服務」「管理狀態」三個按鈕，管理者一鍵進入。
   - 我們的管理功能在獨立 Admin 路由，路徑較深。

4. **狀態顏色/名稱 UI 管理缺失**
   - nczz StatusManager 可在 UI 內直接改狀態名稱和顏色。
   - 我們需要進入 iDempiere AD_Ref_List 修改，非技術人員無法操作。

5. **編輯模式多資源操作受限**
   - 現有 iDempiere API 限制（S_Resource_ID IsUpdateable=N），編輯模式無法更換資源。
   - nczz 有 group-add/group-remove API 可以在編輯時加減資源。
   - 此問題需要後端新增自訂 REST endpoint 才能解決。

### 中優先度

6. **BPartner 搜尋結果不顯示電話/Email**
   - nczz AppointmentDialog 搜尋客戶時顯示姓名 + 電話 + Email，辨識度高。
   - 我們只顯示姓名。

7. **資源停用功能缺失**
   - nczz ResourceManager 有「停用」（軟刪除）按鈕。
   - 我們目前無法在 UI 中停用資源。

8. **搜尋框缺「跳到日期」功能**
   - nczz Sidebar 搜尋可直接跳轉到指定日期的預約。
   - 我們只能過濾已顯示範圍內的事件。

### 低優先度

9. **資源記錄跳轉（Zoom to iDempiere）**
   - nczz 有 🔗 按鈕直接開啟 iDempiere S_Resource 記錄，方便 admin 快速切換。

10. **Sidebar 服務項目篩選**
    - 需先完成「服務項目管理」才有意義。

---

## 建議下一步（具體可行動 TODO 清單）

### 立即執行（不需後端改動）

- [ ] **BPartner 搜尋結果補電話/Email 顯示**
  - 在 `AppointmentForm.vue` 的 `bp-dropdown-item` 中補 `Phone` / `EMail` 欄位
  - 需確認 `searchCustomers()` API 回傳是否包含這兩欄，必要時擴充 `$select`

- [ ] **Sidebar 加「跳到日期」搜尋功能**
  - 在搜尋結果列表中加「點擊跳到該日期」（FullCalendar API: `calendarRef.getApi().gotoDate(date)`）

- [ ] **狀態管理 UI（StatusManagementPanel 已有組件）**
  - 確認 `StatusManagementPanel.vue` 是否已實作顏色/名稱的 UI 管理，若已實作則補入 Sidebar 或 Admin 面板入口

### 短期計劃（2週內）

- [ ] **服務項目管理（ServicePreset）**
  - 設計 `AD_Reference` 或獨立 table 存「服務名稱 + 時長」
  - 建立 ServiceManager 組件（CRUD）
  - AppointmentForm 新增「服務項目」下拉，選後自動帶入結束時間
  - Sidebar 加服務篩選 checkbox
  - 行事曆 events 標題帶入服務名稱

- [ ] **資源類型分組（Sidebar 視覺改善）**
  - 呼叫 `listResourceTypes()` API（或查 `S_ResourceType` 表）
  - Sidebar resource-chips 區塊改為按 ResourceType 分組顯示
  - 新增「全選此類型」的群組 toggle

- [ ] **Sidebar 新增 Admin 快捷按鈕**
  - 在 Sidebar 底部加「管理資源」「管理狀態」按鈕，直接導向對應 Admin 路由

### 中期計劃（1個月內）

- [ ] **資源停用功能**
  - AppointmentForm 或 ResourceManager 加「停用服務人員」按鈕（PUT IsActive=N）
  - 停用資源不再出現在資源 chip 列表（需篩選 IsActive=Y）

- [ ] **編輯模式多資源操作**
  - 評估是否新增自訂 REST endpoint（POST /appointment/{id}/addResource, DELETE /appointment/{id}/removeResource）
  - 或改用 S_ResourceAssignment 的 copy + cancel 機制模擬

- [ ] **服務時長自動計算結束時間**
  - 選擇服務項目後，自動設定 `form.dateTo = form.dateFrom + minutes`
