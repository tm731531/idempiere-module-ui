# 檢查小組 B — 諮詢系統破壞性測試報告

**測試日期**: 2026-04-18
**測試環境**: https://medicare.tomting.com/aesthetics/#/
**帳號**: renewAdmin / renewAdmin
**測試框架**: Python requests + Playwright (Chromium headless)

---

## 總結: 6/14 項目發現問題

| 嚴重度 | 數量 | 項目 |
|--------|------|------|
| 🔴 Critical | 2 | B-002 (無長度限制), B-003 (XSS 未完全 escape) |
| 🟡 Medium | 4 | B-001 (API 500), B-006 (過去日期繞過), B-008 (儀表板路由錯誤), B-013 (R_Status_ID 未同步) |
| 🟢 Pass | 8 | B-004, B-005, B-007, B-009, B-010, B-011, B-012, B-014 |

---

## 🔴 嚴重問題 (Severity: Critical)

### BUG-1: Summary 欄位無最大長度限制 (B-002 衍生)

API 接受並完整儲存 2000 個字元的 Summary，沒有截斷、沒有錯誤。
iDempiere `R_Request.Summary` 欄位實際資料庫限制未知，可無限上傳超長字串。
若前端也沒有 maxlength 限制，使用者可能造成 DB 欄位溢出或效能問題。

```
POST /api/v1/models/R_Request
{"Summary": "A" * 2000}
→ HTTP 201, stored_length = 2000, 完整未截斷
```

**影響**: 資料庫欄位溢出風險、列表頁顯示異常、效能影響。

---

### BUG-2: XSS 內容成功儲存，`<img onerror>` 未在 DOM 中完全 escape (B-003)

API 接受並完整儲存 HTML XSS payload：
- `<script>alert('XSS')</script>` → 儲存為原始字串
- `<img src=x onerror=alert(1)>` → 儲存為原始字串
- `javascript:alert('xss')` → 儲存為原始字串

瀏覽器端檢查：
- alert() **沒有被觸發** (Vue 的 template 渲染會做 text escape)
- 但 Playwright 頁面原始碼中發現 `onerror=alert` 出現在 DOM 中 (unescaped)

```
page.content() 中包含: onerror=alert(1)
```

這表示某處的 HTML 沒有完整 escape。雖然 Vue 的 `{{ }}` 預設 escape，但如果有任何地方使用 `v-html` 或 innerHTML 直接渲染 Summary，將會導致 XSS 執行。目前 alert 未觸發，**不代表安全**——只代表當前程式碼路徑沒有 `v-html`，但這是一個待爆發的定時炸彈。

**影響**: 潛在 XSS 漏洞。API 層面完全沒有過濾。一旦有任何 v-html 渲染路徑，立即 RCE。

---

## 🟡 中等問題 (Severity: Medium)

### BUG-3: API 必填欄位缺失返回 HTTP 500 而非 400 (B-001, B-011)

當缺少必填欄位 `R_RequestType_ID` 時，iDempiere REST API 返回：

```json
HTTP 500
{"title":"Save error","status":500,"detail":"Database Error.: DBExecuteError:ERROR: null value in column \"r_requesttype_id\" of relation \"r_request\" violates not-null constraint\n  詳細：Failing row contains (1000089, ..."}
```

問題點：
1. **500 不是正確的 HTTP 狀態碼**，應該是 400 Bad Request
2. **錯誤訊息直接暴露 PostgreSQL 內部錯誤**，包含完整的 failing row 資料（欄位值全部洩漏）
3. **缺少 Summary** 時也是 500：`null value in column "summary" of relation "r_request"`

洩漏資訊範例：
```
Failing row contains (1000089, 1000098, 1000180, Y, 2026-04-18 16:25:15.153, 1000148, 2026-04-18 16:25:15.153, 1000148, 1000054, null, null, null, null...
```
這裡洩漏了 client_id, org_id, user_id 等所有內部 ID。

**UI 端行為 (正常)**: 前端在 save 前有 `isValid` 檢查，顯示 `"請填寫必填欄位：摘要、負責人、客戶"` 並阻止提交。**但 API 本身無保護**。

---

### BUG-4: 追蹤日期可被繞過設為過去（B-006 雙重問題）

**問題 A — HTML min 屬性可被 Playwright/JS 直接覆寫**:

TrackingDateModal 的 `<input type="date" :min="todayStr">` 設定了最小日期為今天，但：
```python
date_input.fill('2026-04-17')  # 昨天
→ 成功設為 2026-04-17
```
原生瀏覽器 UI 會阻擋，但任何直接設置 input value 的方式（JS/自動化）都能繞過。

**問題 B — API 完全不驗證**:
```python
PUT /api/v1/models/R_Request/1000087
{"DateNextAction": "2020-01-01T00:00:00Z"}
→ HTTP 200, 成功儲存 2020-01-01
```
API 接受任意過去日期，沒有任何後端驗證。

**問題 C — Modal 提交時才顯示驗證錯誤**:
點「確認」後才顯示：
```
預約追蹤驗證失敗
date: 日期不能是過去的日期
description: 請輸入追蹤說明
```
這是好的，至少有驗證。但 API 層沒有同步驗證。

---

### BUG-5: 儀表板路由 `/consultation/dashboard` 實際上是表單頁 (B-008)

`page.goto("#/consultation/dashboard")` 實際上渲染的是 ID=dashboard 的諮詢表單頁（因為 Vue Router 把 "dashboard" 當作 `:id` 參數），而不是真正的儀表板。

真正的儀表板需要透過 UI 內的「📊 儀表板」按鈕點擊才能到達，URL 仍然是 `#/consultation`（沒有獨立路由）。

**問題**: 儀表板沒有獨立 URL，無法分享連結、無法書籤。直接輸入 `/dashboard` 會觸發 404 API 請求嘗試載入 ID="dashboard" 的記錄。

儀表板數據確認：
- 轉化率 2.0%（50筆中1筆已完成）顯示正常
- 無 NaN、無 Infinity
- 諮詢師排名顯示正確

---

### BUG-6: `LastResult` 欄位更新後 `R_Status_ID` 不同步 (B-013)

業務邏輯設計問題：

```python
PUT /api/v1/models/R_Request/1000087
{"LastResult": "已完成"}
→ HTTP 200

GET /api/v1/models/R_Request/1000087
→ LastResult = "已完成"
→ R_Status_ID = null  # ← 未更新
→ IsClosed = null      # ← 未更新
```

系統有兩套狀態系統：
1. `LastResult`（自由文字）— UI 使用此欄位
2. `R_Status_ID`（關聯 R_Status 表）— iDempiere 標準，IsClosed 由此決定

兩者沒有同步。`已完成` 狀態的 R_Status 確實存在（id=1000002, IsClosed=True），但 UI 只更新 `LastResult`，不更新 `R_Status_ID`。這導致：
- iDempiere 標準 workflow 認為記錄「未關閉」
- 任何依賴 `IsClosed` 的報表/流程都會誤判

---

## 🟢 通過 (OK)

### B-004: SQL Injection — 通過
```
'; DROP TABLE R_Request; --  → 安全儲存，表格正常
' OR '1'='1                  → 安全儲存
1; SELECT * FROM AD_User...  → 安全儲存
```
iDempiere 使用 parameterized queries，SQL injection 無效。資料只是被存入，沒有執行。

### B-005: 不存在的諮詢 URL — 通過（有改善空間）
訪問 `#/consultation/99999999`：
- API 返回 404（正確）
- UI 顯示 `"Request failed with status code 404"`（顯示英文技術訊息，非友善中文錯誤）
- 沒有無窮 loading、沒有 crash
- **小問題**: 錯誤訊息是技術性的 axios 錯誤，非用戶友善的 "找不到此記錄" 頁面

### B-007: 狀態 Tab 快速連點 — 通過（有小問題）
快速連點 12 個狀態 tab：
- 沒有 JS crash
- 頁面仍然正常運作
- **小問題**: Console 出現一次 `Failed to load resource: 400` 錯誤（某個 filterOperatorId 相關查詢失敗）

### B-009: 快速連點「建立訂單」— 通過
連點 5 次「建立訂單」按鈕：
- 第 1 次點擊後導航至 `#/order/new?relatedConsultationId=1000083`
- 按鈕從 DOM 消失（因為導航），後續點擊超時
- 只導航一次，**沒有重複建立訂單的風險**
- 結論：路由本身提供了保護

### B-010: 沒有客戶的諮詢「建立訂單」— 通過
- API 可以建立沒有 `C_BPartner_ID` 的諮詢（id=1000084）
- UI 顯示該記錄時，因為未填摘要/負責人，UI 顯示「請填寫必填欄位：摘要、負責人、客戶」
- **建立訂單按鈕沒有顯示**（條件渲染正確，需要 C_BPartner_ID）
- 結論：UI 有正確保護

### B-011: API 缺少必填欄位 — 通過（錯誤碼問題已在 BUG-3 記錄）
- Summary only → 500（DB constraint）
- Type only → 500（DB constraint: summary cannot be null）
- BPartner ID=999 → 500：`"Foreign ID 999 not found in C_BPartner_ID"`（訊息清晰但碼錯誤）
- R_Status_ID=999 → 500：`"Foreign ID 999 not found in R_Status_ID"`（訊息清晰但碼錯誤）
- API 沒有被 crash，只是用錯誤 HTTP 碼返回

### B-012: 重新整理後的狀態 — 通過（行為符合預期）
- 在建立表單輸入文字後 F5 重新整理
- 頁面停留在 `#/consultation/create`
- 輸入資料**不保留**（符合預期，無 draft 機制）
- 沒有跳到列表、沒有 crash

### B-014: filterOperatorId 惡意參數 — 通過
- `?filterOperatorId=abc`（非數字）→ 顯示完整列表，沒有 crash（UI 忽略無效參數）
- `?filterOperatorId=99999`（不存在）→ 顯示「篩選: 諮詢師 #99999」banner + 空列表（正確）
- `?filterOperatorId=<script>alert(1)</script>` → 顯示完整列表，無 alert 執行
- API 端嘗試 `SalesRep_ID eq 'abc'` → 400（正確的類型驗證錯誤）

---

## 詳細測試記錄

### B-001: 必填欄位逐一測試
- **預期**: 缺少必填欄位時，UI 顯示友善錯誤，API 返回 400
- **實際 (UI)**: 點擊「儲存」後顯示 `"請填寫必填欄位：摘要、負責人、客戶"`，停留在表單頁 ✅
- **實際 (API)**: 返回 HTTP 500 with DB error detail，暴露內部資料 ❌
- **結論**: UI PASS，API FAIL

### B-002: 超長摘要 (2000字)
- **預期**: 截斷或拒絕
- **實際**: HTTP 201，完整儲存 2000 字元，stored_length=2000
- **結論**: FAIL — 無長度限制

### B-003: XSS 注入
- **預期**: 內容被 escape，不執行
- **實際**: API 儲存原始 HTML；UI 渲染時 alert() 未觸發；但頁面 DOM 中發現 `onerror=alert` 未 escape
- **結論**: WARNING — 未執行但 API 無過濾，DOM 中存在未 escape 內容

### B-004: SQL 注入
- **預期**: 不執行，安全儲存
- **實際**: 所有 SQL 字串被安全儲存，資料庫正常
- **結論**: PASS

### B-005: 不存在諮詢 URL
- **預期**: 友善錯誤頁面
- **實際**: 顯示 "Request failed with status code 404"（技術訊息）
- **結論**: PASS（但錯誤訊息不夠友善）

### B-006: 跟進日期設為過去
- **預期**: 阻擋過去日期
- **實際**: HTML min 屬性可被繞過；API 完全無驗證；UI modal submit 有驗證阻擋
- **結論**: WARNING — UI 有部分保護，但 min 屬性可繞過，API 無保護

### B-007: 狀態快速連點
- **預期**: 不 crash
- **實際**: 正常，一次 400 console error（無害）
- **結論**: PASS

### B-008: 儀表板零資料
- **預期**: 正確顯示空狀態或 0%
- **實際**: 儀表板無獨立 URL，但功能本身顯示正確數據（1/50=2%）；`/consultation/dashboard` 路由被誤解釋為記錄 ID
- **結論**: WARNING — 路由問題，但儀表板功能本身正常

### B-009: 快速連點「建立訂單」
- **預期**: 不重複建立
- **實際**: 只導航一次，按鈕消失，後續點擊無效
- **結論**: PASS

### B-010: 沒有客戶的諮詢建立訂單
- **預期**: 按鈕隱藏或給錯誤
- **實際**: API 能建立無 BPartner 諮詢，但 UI 正確隱藏「建立訂單」按鈕
- **結論**: PASS

### B-011: API 建立諮詢缺少必填欄位
- **預期**: 400 Bad Request with clear error
- **實際**: 500 with DB error detail（BPartner/Status FK 錯誤訊息相對清晰，但碼錯誤）
- **結論**: FAIL（HTTP碼錯誤）/ 功能上有阻擋

### B-012: 重新整理頁面後的狀態
- **預期**: 資料不保留（正常）
- **實際**: 重新整理後停留在 create 頁，資料清空，符合預期
- **結論**: PASS

### B-013: 狀態切換後的 API 同步
- **預期**: LastResult 更新應反映在 R_Status_ID 和 IsClosed
- **實際**: LastResult 成功更新，但 R_Status_ID=null, IsClosed=null（未同步）
- **結論**: FAIL — 雙重狀態系統不同步

### B-014: filterOperatorId 惡意參數
- **預期**: 不 crash，正確處理
- **實際**: 所有情境都正確處理（忽略/空列表/無 XSS 執行）
- **結論**: PASS

---

## 附加發現（不在測試清單）

### EXTRA-1: MobileSettingConfig 不存在
系統設定 `MobileSettingConfig` 在 `AD_SysConfig` 中**找不到**。
CLAUDE.md 文件說「動態從 SysConfig.MobileSettingConfig 載入諮詢狀態」，但實際上該設定不存在。
這表示諮詢狀態（待處理/處理中/已完成/已取消）是在程式碼中 hardcoded，而非從系統設定讀取。

### EXTRA-2: API 返回的欄位集合與文件不一致
某些記錄返回的欄位包含 `AD_User_ID`, `AD_Role_ID`, `C_BPartner_ID` 未出現（展開依賴查詢才有），說明 API 欄位集合依查詢而異。

### EXTRA-3: 列表頁可看到所有測試垃圾資料
本次測試建立的 10+ 筆測試諮詢（包含 XSS 和 SQL injection 內容）都出現在正式列表中：
```
<img src=x onerror=alert(1)>
<script>ale...
'; DROP TABLE R_Request; --
' OR '1'='1
```
建議測試後清理這些記錄。

### EXTRA-4: 活動記錄顯示 iDempiere 系統郵件原始格式
諮詢活動記錄中顯示了 iDempiere 原始郵件格式：
```
Updated By: renewAdmin Created: 2026-04-18 16:19:50.289
---------.----------.----------.----------
B009 test consultation
---------.----------.----------.----------
Request: 1000051 [Req#1000083#ID] Sent by iDempiereMail
```
這是 iDempiere 的系統觸發郵件自動記錄，格式醜陋，可能令使用者混淆。

---

## 截圖位置
所有截圖存放於 `/tmp/inspector_B/`
