# 檢查小組 C — 整合流程破壞性測試報告

**執行時間**: 2026-04-18  
**測試環境**: https://medicare.tomting.com/aesthetics/#/  
**帳號**: renewAdmin / renewAdmin  
**總結**: **6/14 項目發現問題**（嚴重 2、中等 3、低 1）

---

## 🔴 嚴重問題 (Severity: Critical)

### CRIT-1: 預約衝突 API 完全不防護（C-013）

iDempiere REST API 不做任何衝突偵測。同一服務人員、同一時間可以建立多個預約，伺服器回 201 Created。

**實測**：
```
POST /models/S_ResourceAssignment
{S_Resource_ID: 1000018 (林諮詢師), AssignDateFrom: 2026-04-19T10:00:00Z, AssignDateTo: 2026-04-19T11:00:00Z}
→ HTTP 201，新 ID: 1000133 (已清除)
```

系統全靠前端 `checkConflictLocal()` 防護。此函數依賴從 CalendarView 傳入的 `existingAssignments` prop。

**問題**：`AppointmentForm.vue` 在 **standalone 模式**（`/appointment/new`，即從諮詢跳轉而來）時，`props.existingAssignments` 永遠是 `[]`，`checkConflictLocal()` 永遠不觸發。從諮詢建立預約時，**衝突偵測完全失效**。

**影響**：從「建立預約」按鈕（諮詢→預約）的整個流程，都沒有衝突保護。

---

### CRIT-2: C_BPartner_ID 不儲存到 S_ResourceAssignment（C-004/C-014）

`AppointmentForm.vue` 中，C_BPartner_ID（客戶）**不會被儲存**到 S_ResourceAssignment。程式碼中明確有三處注釋：

```typescript
// C_BPartner_ID omitted — not a standard S_ResourceAssignment column
```

**實際 S_ResourceAssignment 欄位**（從 AD 查得）：
```
AssignDateTo, S_ResourceAssignment_ID, IsConfirmed, S_Resource_ID, Qty,
AssignDateFrom, Name, Description, Updated, IsActive, Created, CreatedBy,
UpdatedBy, AD_Org_ID, AD_Client_ID, S_ResourceAssignment_UU
```

確認：**沒有 C_BPartner_ID**、**沒有 R_Request_ID**。

**連帶問題**：
1. 從諮詢建立的預約，根本不記錄「這個預約屬於哪位客戶」
2. 無法在 DB 層面追蹤「同一諮詢→多個預約」的關係
3. 行事曆上的預約沒有客戶資訊，只有名稱和服務人員

---

## 🟡 中等問題 (Severity: Medium)

### MED-1: OrderFormView 完全不處理 relatedConsultationId（C-003/C-014）

`RequestFormView.vue` 有正確的「建立訂單」按鈕，且傳遞了 `relatedConsultationId` 參數：
```typescript
router.push({ name: 'order-edit', query: { relatedConsultationId: String(requestId.value) } })
```

但 `OrderFormView.vue` **完全沒有處理 `relatedConsultationId`**——沒有讀取 query param，沒有 banner，沒有任何回導邏輯。

**結果**：
- 按「建立訂單」後，URL 確實帶了 `relatedConsultationId=1000026`
- 訂單表單不顯示任何「關聯諮詢」banner（使用者不知道這是從哪個諮詢來的）
- 完成訂單後，按返回會回到「訂單列表」，不是回到原來的諮詢
- 整個「諮詢→訂單」的 round-trip 流程斷掉

---

### MED-2: $rowCount 參數不支援（C-007）

API 文件建議用 `$rowCount=true` 取得總筆數，但實測：

```
GET /models/R_Request?$top=1&$rowCount=true
→ Response 沒有 rowCount 欄位
```

`$count` endpoint 也不支援：
```
GET /models/R_Request/$count → HTTP 400: "Wrong ID $count is not an UU value"
```

**影響**：UI 無法得知總資料筆數，無法實作正確的「共 X 筆」提示，分頁器無法顯示總頁數。實測確認 `$top`/`$skip` 分頁本身正常（page0 ID=1000014 ≠ page1 ID=1000015）。

---

### MED-3: S_ResourceAssignment $expand=C_BPartner_ID 回 400（C-012b）

```
GET /models/S_ResourceAssignment?$expand=C_BPartner_ID
→ HTTP 400: "C_BPartner_ID is not a valid column of table S_ResourceAssignment"
```

任何嘗試 expand C_BPartner_ID 的程式碼都會直接 400。目前 AppointmentForm.vue 沒有 expand 這個欄位（因為根本不存在），但這個 400 行為需要在文件中明確說明。

---

## 🟠 低嚴重度問題 (Severity: Low)

### LOW-1: 無效 $expand 欄位回 404 而非 400（C-012c）

```
GET /models/R_Request?$expand=NonExistentField_ID
→ HTTP 404: {"title":"Invalid table name","status":404,"detail":"No match found for table name: NonExistentField_ID"}
```

語義上應該是 400（Bad Request），但實際回 404。這不會造成功能問題，但對 API 使用者的除錯體驗很差。

---

## 🟢 通過 (OK)

### C-001: 諮詢→預約 URL 參數（部分通過）

`RequestFormView.vue` 確認有正確實作：
```typescript
router.push({
  name: 'appointment-new',
  query: { customerId: String(customerId), consultationId: String(requestId.value) }
})
```

`AppointmentForm.vue` 有正確讀取 `consultationId`，並顯示 banner：
```html
<div v-if="linkedConsultationId" class="consultation-banner">
  關聯諮詢 #{{ linkedConsultationId }}
</div>
```

完成/取消後也有正確導回諮詢頁。

**但**：banner 只在 `consultationId` query param 存在時顯示，無法驗證 consultation 是否真實存在（C-002 的問題）。

---

### C-002: 假 consultationId 不崩潰

訪問 `#/appointment/new?consultationId=99999&customerId=1000998`：
- 頁面不崩潰（grace degradation）
- Banner 顯示「關聯諮詢 #99999」（直接信任 query param，不驗證存在性）
- API 查詢不存在的 consultation 回 404

接受此行為：UX 上 banner 顯示假 ID 無害，預約本身仍可建立。

---

### C-007: $top/$skip 分頁正常

```
$top=1,$skip=0 → ID 1000014
$top=1,$skip=1 → ID 1000015
```
分頁正確工作。

---

### C-008: 並發 API 請求無競爭條件

3 個並行 session 同時查詢 R_Request：
```
Thread 1: HTTP 200, 5 records, 0.14s
Thread 2: HTTP 200, 5 records, 0.14s
Thread 3: HTTP 200, 5 records, 0.14s
```
無競爭條件，token 不失效。

---

### C-009: 認證邊界全部通過

| 測試 | 結果 |
|------|------|
| 有效 token 查詢 | HTTP 200 ✅ |
| 假 token → 401 | HTTP 401 ✅ |
| 無 token → 401 | HTTP 401 ✅ |
| Step-1 token（pre-PUT）查詢 | HTTP 401（正確拒絕）✅ |

Step-1 token 不能直接查資料，強制執行 PUT /auth/tokens 的 context 設定流程。

---

### C-010: API 效能全部通過

| 端點 | 響應時間 |
|------|----------|
| R_Request list (50筆+expand) | 0.47s |
| S_ResourceAssignment list | 0.04s |
| R_Status list | 0.03s |
| AD_Field metadata (tab 344) | 0.25s |

全部遠低於 3s 警告線。

---

### C-011: 空列表狀態正確

```
GET /models/R_Request?$filter=SalesRep_ID eq 99999999
→ HTTP 200, records: []
```
API 正確回空陣列，不回錯誤。UI 的空狀態顯示邏輯得到正確的輸入。

---

### C-012a: R_Request $expand 正常

```
$expand=C_BPartner_ID,SalesRep_ID,R_Status_ID 全部成功展開
R_Status_ID 包含 IsClosed, SeqNo, Name 欄位
```

R_Status 確認有 4 筆：待處理(IsClosed=F)、處理中(IsClosed=F)、已完成(IsClosed=T)、已取消(IsClosed=T)。`isRequestCompleted()` 的 IsClosed 邏輯基礎正確。

---

### C-012d: R_Status 表正常

4 筆狀態，SeqNo 有序，IsClosed 欄位存在且值正確。

---

### C-006: 行事曆日期範圍 API 查詢正常

```
GET /models/S_ResourceAssignment?$filter=AssignDateFrom ge '...' and AssignDateFrom le '...'
→ HTTP 200, 9 筆四月預約
```

---

### C-005: Hash routing 有 appointment-new 路由

```typescript
{ path: 'new', name: 'appointment-new', component: () => import('@/views/appointment/AppointmentForm.vue') }
```

路由存在且正確。

---

## 詳細測試記錄

### C-001: 從諮詢建立預約 — URL 參數驗證
- **預期**: URL 包含 `consultationId=<ID>` 和 `customerId=<ID>`
- **實際**: RequestFormView.vue 正確 push query params；AppointmentForm.vue 正確讀取並顯示 banner；save/cancel 後回諮詢頁
- **結論**: PASS（但衝突偵測在此路徑失效，見 CRIT-1）

### C-002: 假造 consultationId 訪問預約建立
- **預期**: 頁面不崩潰
- **實際**: 頁面正常渲染，顯示 banner「關聯諮詢 #99999」（不驗證存在性）
- **結論**: PASS（行為可接受）

### C-003: 從諮詢建立訂單 URL 驗證
- **預期**: OrderFormView 讀取 relatedConsultationId 並回導
- **實際**: RequestFormView 傳參數正確，OrderFormView 完全不讀取此參數，無 banner，無回導
- **結論**: FAIL

### C-004: 同一諮詢建立多個預約
- **預期**: 兩個預約都存在且都關聯到 C1
- **實際**: DB schema 沒有 R_Request_ID 欄位在 S_ResourceAssignment；只有 Name 欄位可做非正式關聯；多預約可以建立但無正式追蹤
- **結論**: WARNING（架構限制，非 bug）

### C-005: Hash routing 基礎
- **預期**: 路由正確處理 query params
- **實際**: Router 有 appointment-new 路由；AppointmentForm 正確讀取 route.query
- **結論**: PASS

### C-006: 行事曆日期導航 API
- **預期**: 日期範圍過濾正常
- **實際**: HTTP 200，OData ge/le 過濾日期正確工作
- **結論**: PASS（UI 壓力測試無法自動化，人工測試需補）

### C-007: API 分頁測試
- **預期**: $top/$skip 正常，rowCount 可查
- **實際**: 分頁正常；rowCount 不支援（無此 response 欄位）
- **結論**: PASS（分頁） / FAIL（rowCount）

### C-008: 並發 API 請求
- **預期**: 無競爭條件
- **實際**: 3 並行全部 200，無競爭
- **結論**: PASS

### C-009: 登入狀態測試
- **預期**: 有效/無效 token 行為正確
- **實際**: 全部正確
- **結論**: PASS

### C-010: 列表頁效能
- **預期**: 所有端點 < 5s
- **實際**: 最慢 0.47s（帶 expand 的 R_Request）
- **結論**: PASS

### C-011: 空列表狀態
- **預期**: HTTP 200 + 空陣列
- **實際**: HTTP 200, records: []
- **結論**: PASS

### C-012: API $expand 邊界
- **預期**: 有效 expand 正常，無效 expand 回合理錯誤
- **實際**: R_Request expand 全部正常；S_ResourceAssignment expand C_BPartner_ID → 400（欄位不存在）；無效欄位名 → 404（應為 400）
- **結論**: PARTIAL PASS / FAIL（404 vs 400 語義錯誤）

### C-013: 預約衝突偵測
- **預期**: API 或前端拒絕衝突預約
- **實際**: API 完全不檢查衝突（HTTP 201 成功建立衝突預約）；前端 checkConflictLocal() 在 standalone 模式（諮詢→預約路徑）失效
- **結論**: FAIL（Critical）

### C-014: 跨模組導航一致性
- **預期**: 建立訂單後回到諮詢；行事曆刷新
- **實際**: 諮詢→訂單路徑的 round-trip 斷掉（OrderFormView 不讀 relatedConsultationId）；諮詢→預約 round-trip 正確
- **結論**: FAIL（訂單路徑）/ PASS（預約路徑）

---

## 需要修復的優先清單

1. **[P0] CRIT-1**: AppointmentForm standalone 模式加載 `existingAssignments`，修復衝突偵測失效
2. **[P1] CRIT-2**: 決定是否需要客戶資訊關聯——若需要，考慮在 `Name` 欄位加入 BPartner ID 或透過其他欄位追蹤
3. **[P1] MED-1**: OrderFormView 讀取 `relatedConsultationId` query param，顯示 banner，save 後回諮詢頁
4. **[P2] MED-2**: 不要依賴 `$rowCount`（API 不支援），改用其他方式判斷是否有更多資料

---

*報告由 Inspector C 自動測試腳本生成，補充手動程式碼分析。截圖位於 `/tmp/inspector_C/`。*
