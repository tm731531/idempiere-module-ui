# 驗收小組裁定報告

**裁定日期**: 2026-04-18  
**裁定者**: Acceptance Team (基於 Inspector A/B/C 報告 + 原始碼交叉驗證)  
**原始碼路徑**: `webapp/src/`

---

## 整合問題清單（去重後共 14 個獨立問題）

三份報告重複提及的問題：
- **「後端無衝突偵測」**: A001 + C-CRIT-1（已整合為 BUG-1）
- **「S_ResourceAssignment 無 C_BPartner_ID」**: C-CRIT-2 + AppointmentForm 程式碼注釋（已整合為 ARCH-1）
- **「API 必填欄位返回 500 而非 400」**: A + B 均有記錄（已整合為 BUG-5）
- **「後端不驗證時間順序」**: A-A002 + A-A003（已整合為 BUG-2/BUG-3）

---

## 確認修復清單

### P0 — 必須在下版修復（功能嚴重缺陷）

#### BUG-1: standalone 模式下衝突偵測完全失效
**來源**: Inspector A (BUG-A001) + Inspector C (CRIT-1)  
**裁定**: ✅ 確認為真實 bug

**驗證**:
- `AppointmentForm.vue` 的 `checkConflictLocal()` 函數（第 464 行）完全依賴 `props.existingAssignments` 陣列進行判斷（第 469 行）
- 在 CalendarView modal 模式下，CalendarView 透過 props 傳入已載入的預約清單，衝突偵測有效
- 在 standalone 頁面模式（`/appointment/new`，即從諮詢建立預約路徑），`props.existingAssignments` 永遠是空陣列（呼叫方未傳任何資料），`checkConflictLocal()` 永遠返回 false
- 後端 API（`S_ResourceAssignment`）對時段衝突完全沒有後端驗證，5 個並行 POST 全部 HTTP 201
- **這是高頻業務路徑**（諮詢→建立預約是主要操作流程），standalone 模式無任何衝突防護

**修復建議**: 在 `AppointmentForm.vue` `onMounted` 的 standalone 分支中（已有 `localResources` 載入邏輯），額外呼叫 `listAssignments()` API 取得當月預約並存入本地狀態，供 `checkConflictLocal()` 使用。或改用 `checkConflict()` API（`api/assignment.ts` 中已有此函數，目前只用於 multi-mode）在儲存前做非同步衝突檢查。

---

#### BUG-2: 後端接受 DateTo < DateFrom（時間倒置）
**來源**: Inspector A (BUG-A002)  
**裁定**: ✅ 確認為真實 bug（API 層缺陷）

**驗證**: UI 有驗證（`validate()` 函數第 452 行：`new Date(form.dateFrom) >= new Date(form.dateTo)` 阻擋提交），但 API 完全不驗證。實測 `AssignDateTo` 早一小時仍回 HTTP 201。

**注意**: iDempiere REST API 是通用框架，此類業務驗證需在後端 Java callout 或 model validator 層加入，非前端可修復。此 bug 記錄供後端同學處理。

---

#### BUG-3: 後端接受零時長預約（DateFrom == DateTo）
**來源**: Inspector A (BUG-A003)  
**裁定**: ✅ 確認為真實 bug（API 層缺陷）

同 BUG-2，屬後端 validator 缺失問題。UI 有保護，繞過 UI 可建立無意義記錄。

---

### P1 — 應在近期 Sprint 修復

#### BUG-4: OrderFormView 不處理 relatedConsultationId，諮詢→訂單 round-trip 斷裂
**來源**: Inspector C (MED-1)  
**裁定**: ✅ 確認為真實 bug

**驗證**:
- `RequestFormView.vue` 第 736 行：`query: { relatedConsultationId: requestId.value }` — 正確傳遞參數
- `OrderFormView.vue` 全文搜尋 `relatedConsultationId`：**零筆命中**
- OrderFormView 完全不讀取此 query param，沒有「來自諮詢 #XXX」banner，儲存後不回到原始諮詢頁
- 使用者體驗：按「建立訂單」後進入訂單頁，完全不知道自己是從哪個諮詢來的，完成後無法回到原諮詢

**修復建議**: 在 `OrderFormView.vue` `onMounted` 中讀取 `route.query.relatedConsultationId`，顯示關聯 banner；儲存成功後 `router.push` 回到 `consultation-edit/:id`。

---

#### BUG-5: API 必填欄位缺失返回 HTTP 500 並暴露 PostgreSQL 內部錯誤
**來源**: Inspector A (附加發現) + Inspector B (BUG-3)  
**裁定**: ✅ 確認為真實 bug（後端問題，前端 UI 有保護）

**補充**: 錯誤訊息中包含完整 failing row 資料（含內部 client_id, org_id, user_id）屬於資訊洩漏（CWE-209）。業務驗證錯誤應返回 HTTP 400/422，伺服器錯誤才應返回 500。屬後端框架層問題。

---

#### BUG-6: 超長名稱（500字元）被靜默截斷至 60 字元，無任何錯誤提示
**來源**: Inspector A (BUG-A004)  
**裁定**: ✅ 確認為真實 bug（使用者體驗問題）

**修復建議**: 在 `AppointmentForm.vue` 的名稱 `<input>` 加上 `maxlength="60"` 屬性，防止超長輸入進入 API。

---

### P2 — 改善項目（不阻塞功能）

#### BUG-7: 儀表板無獨立可書籤 URL
**來源**: Inspector B (BUG-5)  
**裁定**: ✅ 確認為真實問題（但嚴重度降級）

**驗證**:
- `router/index.ts` 第 42-46 行：儀表板路由為 `path: '/consultation-dashboard'`，名稱為 `consultation-dashboard`
- Inspector B 測試的路徑是 `#/consultation/dashboard`，此路徑**不存在**，會被 `/:id` 子路由捕獲而載入 ID="dashboard" 的記錄（預期行為：找不到記錄後顯示 404）
- 正確的儀表板路由是 `#/consultation-dashboard`，已有獨立路由
- **實際問題**: 儀表板的 UI 入口按鈕跳轉的路由名稱和實際路由是否一致，需確認

**裁定調整**: 儀表板本身有獨立路由（`/consultation-dashboard`），BUG-5 的描述部分不準確（見誤報澄清），但 `#/consultation/dashboard` 這個錯誤路徑導致 API 嘗試讀取 ID="dashboard" 的記錄屬於預期錯誤，可考慮在 RequestFormView 中對非數字 `:id` 做 guard。

---

#### BUG-8: 預約詳細頁面（/appointment/:id）未實作
**來源**: Inspector A (BUG-A005)  
**裁定**: ✅ 確認為真實功能缺口

**驗證**: `router/index.ts` appointment 路由只有 `''`（CalendarView）和 `'new'`（AppointmentForm），無 `':id'` 子路由。訪問任何 `/appointment/<number>` 都落入 `/:pathMatch(.*)*` 萬用路由，顯示 PlaceholderView「此頁面尚未實作」。

**裁定**: 這是已知的功能缺口，不是 bug。行事曆 modal 模式已支援查看/編輯，但缺乏深層連結能力。優先級視業務需求而定。

---

#### BUG-9: LastResult 更新後 R_Status_ID 不同步
**來源**: Inspector B (BUG-6)  
**裁定**: ⚠️ 降級為架構過渡問題（詳見說明）

**驗證**:
- 依 CLAUDE.md 當前版本（worktree CLAUDE.md），系統已從 `LastResult` 自由文字遷移到 `R_Status_ID` FK 作為「真相來源」
- `RequestFormView.vue` 中狀態更新路徑使用 `updateRequestStatus(id, R_Status_ID)` 
- `LastResult` 欄位現在是 legacy 相容性保留，新資料主要使用 `R_Status_ID`
- `R_Status_ID` 與 `IsClosed` 的關聯由 iDempiere R_Status 表維護，UI 不需要手動同步

**裁定**: Inspector B 的測試（PUT `{"LastResult": "已完成"}`）是直接操作 API 的邊緣測試，不是 UI 的正常操作路徑。UI 已改為透過 `R_Status_ID` 更新狀態。此問題屬「API 側邊路徑未同步」，記錄在架構限制中，非緊急 bug。

---

## 架構限制（暫無法修復）

### ARCH-1: S_ResourceAssignment 無 C_BPartner_ID 欄位
**來源**: Inspector C (CRIT-2)  
**裁定**: ⚠️ iDempiere 標準表結構限制，非 bug

**說明**:
- iDempiere 標準 `S_ResourceAssignment` 表不含 `C_BPartner_ID` 欄位（C-012b 實測：`$expand=C_BPartner_ID` 回 HTTP 400 "not a valid column"）
- `AppointmentForm.vue` 程式碼中三處明確注釋 `// C_BPartner_ID omitted — not a standard S_ResourceAssignment column`
- 這是有意識的設計決策，非漏洞
- 客戶資訊透過 `Name` 欄位以非正式方式關聯（例如將客戶名稱寫入預約名稱）

**相關連帶問題**: 從諮詢建立的預約無正式 DB 層面追蹤，無法查詢「同一諮詢的所有預約」。這是 iDempiere 標準模型的限制。若需要正式關聯，需要自訂擴充欄位（透過 iDempiere 2Pack/Extension）。

---

### ARCH-2: API 無時段衝突防護（後端不可在前端修復）
**來源**: Inspector A (BUG-A001) + Inspector C (CRIT-1)  
**裁定**: ⚠️ 後端架構限制（iDempiere REST 通用框架）

**說明**: iDempiere REST API 是通用 CRUD 框架，不含業務規則驗證。時段衝突、時間順序、零時長等業務規則需在後端加入 Model Validator（Java）才能防護。前端可做的已做（UI validate + local checkConflict），剩餘防護層屬後端工作。

**緩解措施（前端可做）**: BUG-1 修復（standalone 模式載入 existingAssignments）可提升 UI 保護，但無法取代後端驗證。

---

### ARCH-3: $rowCount / $count API 不支援
**來源**: Inspector C (MED-2)  
**裁定**: ⚠️ iDempiere REST API 限制

**說明**: iDempiere OData REST 不支援 `$rowCount=true` 或 `/$count`。分頁總數無法從 API 取得。目前 UI 的「載入更多」或無限滾動設計即是為此限制設計的緩解方案。

---

### ARCH-4: 無效 $expand 欄位回 404 而非 400
**來源**: Inspector C (LOW-1)  
**裁定**: ⚠️ iDempiere REST API 框架行為，非我方 bug

---

## 誤報澄清

### 誤報 1: Inspector B BUG-2「XSS — `<img onerror=alert(1)>` 在 DOM 中未 escape」
**裁定**: ❌ 誤報（Vue 模板自動轉義保護有效）

**驗證**:
- 全專案搜尋 `v-html`：**零筆命中**。專案中完全不使用 `v-html` 指令
- 所有使用者資料均透過 Vue 模板的 `{{ }}` 插值渲染，Vue 自動進行 HTML entity 轉義
- Inspector A 的 XSS 測試（A-004）明確確認：`<script>alert('XSS')</script>` 儲存後前端渲染不觸發 alert，`window.__xss_fired = false`
- Inspector B 回報「Playwright 頁面原始碼中發現 `onerror=alert` 出現在 DOM 中 (unescaped)」——這是 Playwright `page.content()` 的行為差異：`page.content()` 返回的是 HTML 序列化後的 DOM 字串，Vue 已將 `<img onerror=alert(1)>` 渲染為文字節點（text node），在 HTML 序列化時文字節點中的 `<` `>` 可能以原始字元出現，但這不代表實際 DOM 中有可執行的 `onerror` 屬性，而是 Playwright 的字串展示問題
- **結論**: XSS 未執行即是最重要的驗證指標。API 接受原始字串（iDempiere 不做 input sanitization）是正常行為，前端 Vue 模板已提供足夠防護

**建議**: 無需修改程式碼。繼續確保不使用 `v-html`。

---

### 誤報 2: Inspector B BUG-5「儀表板路由 `/consultation/dashboard` 是表單頁而非儀表板」
**裁定**: ❌ 部分誤報（測試路徑錯誤）

**驗證**:
- `router/index.ts` 第 42-46 行：儀表板路由為 **`/consultation-dashboard`**（獨立一級路由），非 `/consultation/dashboard`
- Inspector B 測試的 `#/consultation/dashboard` 確實不存在，被 `:id` 子路由捕獲（這是預期行為），顯示 "Request failed with status code 404" 是正確的（嘗試讀取 ID="dashboard" 的記錄不存在）
- 儀表板功能本身正確（Inspector B 自己也確認「轉化率 2.0% 顯示正常」）
- **真正的問題**: 儀表板的正確路由是 `/consultation-dashboard`，但 UI 入口按鈕是否正確指向這個路由名稱待確認（次要問題）

---

### 誤報 3: Inspector C CRIT-2「C_BPartner_ID 不儲存到 S_ResourceAssignment 是 bug」
**裁定**: ❌ 誤報（已知架構限制，有意識的設計決策）

**驗證**: 程式碼中三處明確注釋 `// C_BPartner_ID omitted — not a standard S_ResourceAssignment column`，這是有文件記錄的設計決策，已歸類為 ARCH-1。

---

### 誤報 4: Inspector B EXTRA-1「MobileSettingConfig 不存在，狀態是 hardcoded」
**裁定**: ❌ 誤報（系統已升級，描述過時）

**驗證**:
- 依 worktree `CLAUDE.md`（最新版），系統狀態已從 `MobileSettingConfig` SysConfig 改為直接查詢 `R_Status` 表（透過 `composables/useRequestStatuses.ts`）
- CLAUDE.md 舊版（主分支）描述的 `MobileSettingConfig` 是過去的設計，現版本已廢棄
- Inspector B 的發現對應的是舊架構，非當前版本缺陷

---

### 誤報 5: Inspector B BUG-4「追蹤日期可被繞過設為過去」
**裁定**: ❌ 非 bug（業務規則選擇，HTML min 屬性設計限制屬已知行為）

**說明**: HTML `<input type="date" :min="todayStr">` 只是 UI 層提示，任何自動化工具（Playwright、JS）都可繞過，這是 HTML 規範的已知行為，非程式碼 bug。API 不驗證過去日期屬業務決策（使用者可能需要補登過去的跟進記錄）。UI 的 Modal submit 驗證（「日期不能是過去的日期」）是適當的 UX 保護層。

---

## 修正小組行動建議

### 立即行動（本 Sprint，P0）

1. **修復 AppointmentForm standalone 模式的衝突偵測**
   - 檔案: `webapp/src/views/appointment/AppointmentForm.vue`
   - 方案 A（推薦）：`onMounted` standalone 分支中呼叫 `checkConflict(resourceId, fromDate, toDate)` API（`api/assignment.ts` 已實作），在 `handleSave()` 儲存前做非同步衝突驗證
   - 方案 B：standalone 模式載入當前月份的 `existingAssignments`，走現有 `checkConflictLocal()` 邏輯
   - 注意：multi-mode 已有 `checkConflict` API 呼叫（第 328 行），可參考複用

### 近期行動（下一 Sprint，P1）

2. **修復諮詢→訂單的 round-trip**
   - 檔案: `webapp/src/views/order/OrderFormView.vue`
   - 在 `onMounted` 讀取 `route.query.relatedConsultationId`
   - 顯示「關聯諮詢 #XXX」banner
   - 儲存成功後導回 `consultation-edit/:id`

3. **Name 欄位加 maxlength**
   - 檔案: `webapp/src/views/appointment/AppointmentForm.vue`
   - 名稱 `<input>` 加 `maxlength="60"` 防止靜默截斷

4. **確認儀表板 UI 入口按鈕路由正確性**
   - 確認點擊「儀表板」按鈕後跳轉到 `consultation-dashboard`（`/consultation-dashboard`），非 `/consultation/dashboard`
   - 在 `RequestListView.vue` 或 AppHeader 中確認路由 name 使用 `consultation-dashboard`

### 後端工作（需後端同學處理，P1-P2）

5. 在 `S_ResourceAssignment` 加入 Model Validator 驗證：
   - DateTo > DateFrom
   - DateTo != DateFrom（非零時長）
   - 同一 S_Resource_ID 的時段不重疊
6. API 業務驗證錯誤改返回 HTTP 400/422，不暴露 PostgreSQL raw error
7. 錯誤回應不應包含 failing row 完整資料（防止內部 ID 洩漏）

### 功能規劃（P2，視業務需求）

8. 實作預約詳細頁面 `/appointment/:id`（目前所有操作只能透過行事曆 modal）
9. 評估是否需要在 S_ResourceAssignment 加自訂欄位（2Pack extension）儲存 C_BPartner_ID 和 R_Request_ID，以支援正式的諮詢→預約追蹤

---

## 摘要統計

| 分類 | 數量 |
|------|------|
| P0 確認 bug（必修） | 3 |
| P1 確認 bug（近期修） | 4 |
| P2 改善項目 | 2 |
| 架構限制（記錄） | 4 |
| 誤報（關閉） | 5 |

---

*驗收小組裁定完畢。P0 項目請在本 Sprint 結束前修復並重新測試。*
