# iDempiere REST API 速查手冊

> iDempiere 12 + BX Service REST Plugin
> 給 Claude Code / AI Agent 的精簡參考，涵蓋認證、CRUD、查詢語法、Application Dictionary、Document Workflow。

---

## 1. 認證

### 多步登入（推薦）

```
1. POST /api/v1/auth/tokens  { "userName":"X", "password":"Y" }
   → { "clients": [...], "token": "temp-token" }

2. GET /api/v1/auth/roles?client={clientId}
   GET /api/v1/auth/organizations?client={clientId}&role={roleId}
   GET /api/v1/auth/warehouses?client={clientId}&role={roleId}&organization={orgId}

3. PUT /api/v1/auth/tokens  { "clientId":11, "roleId":102, "organizationId":11, "warehouseId":103 }
   → { "token": "final-token" }   ⚠️ 舊 token 立即失效！
```

### 一步登入（已知所有 ID）

```json
POST /api/v1/auth/tokens
{ "userName":"X", "password":"Y",
  "parameters": { "clientId":11, "roleId":102, "organizationId":11, "warehouseId":103, "language":"en_US" }}
→ { "token": "eyJ...", "refresh_token": "eyJ..." }
```

### Token
- `Authorization: Bearer {token}`
- 預設 1 小時過期，Refresh token 24 小時
- `POST /api/v1/auth/refresh` + `refresh_token`（只能用一次）
- `POST /api/v1/auth/logout`
- 只有 Role Type = `WebService` 或空白的角色可 API 登入

---

## 2. CRUD 端點

| 操作 | 方法 | 端點 |
|------|------|------|
| 列表 | GET | `/api/v1/models/{TableName}` |
| 單筆 | GET | `/api/v1/models/{TableName}/{id}` |
| 建立 | POST | `/api/v1/models/{TableName}` |
| 更新 | PUT | `/api/v1/models/{TableName}/{id}` (部分更新) |
| 刪除 | DELETE | `/api/v1/models/{TableName}/{id}` |
| 單欄位 | GET | `/api/v1/models/{TableName}/{id}/{ColumnName}` |

### 回應結構（集合）

```json
{ "page-count":5, "records-size":100, "skip-records":0,
  "row-count":450, "array-count":100, "records":[...] }
```

---

## 3. 資料型別 — 讀取 vs 寫入

| 型別 | GET 回傳 | POST/PUT 送出 |
|------|----------|---------------|
| String | `"text"` | `"text"` |
| Boolean | `true`/`false` | `true`/`false` |
| Numeric | `100.00` | `100.00` |
| DateTime | `"2025-01-15T08:30:00Z"` | `"2025-01-15T08:30:00Z"` (無毫秒) |
| **FK (外鍵)** | **`{"id":102, "identifier":"Name"}` 物件** | **數字 ID `102`** |
| **List 參照** | **`{"id":"DR", "identifier":"Drafted"}` 物件** | **Value 字串 `"DR"`** |

> **⚠️ GET 回傳的 FK/List 是物件** — 取值用 `.id`，顯示用 `.identifier`
> **⚠️ DateTime `Z` 後綴實為本地時間** — 解析時不要做 UTC 轉換

---

## 4. $filter 查詢語法

### 比較運算子

| 運算子 | 意義 | 範例 |
|--------|------|------|
| `eq` | = | `Name eq 'Joe'` |
| `neq` | ≠ | `DocStatus neq 'VO'` |
| `gt` | > | `GrandTotal gt 1000` |
| `ge` | ≥ | — |
| `lt` | < | — |
| `le` | ≤ | — |
| `in` | IN | `C_BPartner_ID in (119,120)` |

> **⚠️ `ne` 不支援，必須用 `neq`**
> **⚠️ `not (X eq Y)` 不行，`not` 只能搭配函式**

### 字串函式

```
contains(Name,'Garden')    startswith(Name,'Ga')    endswith(Name,'Co.')
tolower(Name) eq 'garden'  not contains(Name,'test')
```

### 邏輯

```
$filter=IsCustomer eq true and IsActive eq true
$filter=DocStatus eq 'CO' or DocStatus eq 'DR'
```

### Boolean 過濾

```
✅ IsActive eq true
✅ IsSOTrx eq false
❌ IsActive eq 'Y'     ← 'Y' 被當欄位名
```

---

## 5. $select / $orderby / $top / $skip

```
GET /api/v1/models/M_Product?$select=Name,Value&$orderby=Name desc&$top=20&$skip=40
```

---

## 6. $expand — 展開關聯

```bash
# FK 展開（一對一）
?$expand=C_BPartner_ID

# 子表展開（一對多）
?$expand=C_OrderLine

# 帶過濾的子表（分號分隔參數）
?$expand=C_OrderLine($select=Line,LineNetAmt;$filter=LineNetAmt gt 1000;$orderby=Line)

# FK 欄位 $select
?$expand=M_Product_Category_ID($select=Name,IsDefault)

# 巢狀展開
?$expand=C_OrderLine($expand=C_OrderTax)

# 反向展開（自訂 join key）
?$expand=C_Order.SalesRep_ID($select=DocumentNo)
```

---

## 7. $valrule + $context — 套用驗證規則 ★

直接在 server 端執行 AD_Val_Rule，不需手動轉 SQL → OData。

```
GET /api/v1/models/C_DocType?$valrule=133&$context=IsSOTrx:Y
```

- `$valrule` = AD_Val_Rule_ID
- `$context` 格式: `Key:Value`，多個用逗號 `IsSOTrx:Y,AD_Client_ID:11`
- **Boolean 用 `Y`/`N`**（不是 `true`/`false`，跟 `$filter` 不同！）

---

## 8. 建立記錄

```json
POST /api/v1/models/C_Order
{ "AD_Org_ID": 11, "C_BPartner_ID": 119, "IsSOTrx": true,
  "DateOrdered": "2025-01-15T08:30:00Z", "M_PriceList_ID": 101 }
```

### 連同子記錄

```json
POST /api/v1/models/C_Order
{ "C_BPartner_ID": 119,
  "C_OrderLine": [{ "M_Product_ID": 122, "QtyOrdered": 10 }] }
```

---

## 9. Document Workflow (DocAction)

**前端不更新 DocAction 欄位。** 只 POST Process 端點。

```typescript
POST /api/v1/processes/{process-slug}
{ "record-id": 100, "table-id": 259 }
```

| Document | Table ID | Process Slug |
|----------|----------|--------------|
| C_Order | 259 | `c_order-process` |
| C_Invoice | 318 | `c_invoice-process` |
| C_Payment | 335 | `c_payment-process` |
| M_InOut | 319 | `m_inout-process` |
| M_Production | 325 | `m_production-process` |
| M_Inventory | 321 | `m_inventory-process` |
| M_Movement | 323 | `m_movement-process` |

新單據預設 `DocAction='CO'`，POST Process 即觸發 Complete。

---

## 10. Application Dictionary (AD) 查詢

iDempiere 的表單結構是 metadata-driven，欄位定義在 AD_Window → AD_Tab → AD_Field → AD_Column。

### 查詢 Tab 的欄位定義

```
GET /api/v1/models/AD_Field?$filter=AD_Tab_ID eq {tabId} and IsActive eq true and IsDisplayed eq true
  &$select=AD_Field_ID,Name,SeqNo,IsReadOnly,AD_FieldGroup_ID,AD_Column_ID&$orderby=SeqNo&$top=200
```

### 查詢欄位的 Column 屬性

```
GET /api/v1/models/AD_Column/{columnId}
  ?$select=ColumnName,AD_Reference_ID,AD_Reference_Value_ID,FieldLength,IsMandatory,DefaultValue,IsUpdateable,AD_Val_Rule_ID
```

### AD_Reference_ID → 元件類型

| Ref ID | 型別 | 前端元件 |
|--------|------|----------|
| 10 | String | text input |
| 11 | Integer | number input |
| 12 | Amount | number input (step 0.01) |
| 13 | ID | hidden |
| 14 | Text | textarea |
| 15 | Date | date input |
| 16 | DateTime | datetime-local input |
| 17 | List | select (選項從 AD_Ref_List 載入) |
| 18 | Table | FK selector (table 從 AD_Ref_Table 解析) |
| 19 | TableDirect | FK selector (table 從 column name 推導) |
| 20 | YesNo | checkbox |
| 28 | Button | hidden (DocAction 等) |
| 29 | Quantity | number input |
| 30 | Search | FK selector (有 AD_Reference_Value_ID 走 AD_Ref_Table，沒有則從 column name 推導) |
| 31 | Locator | FK selector (table 從 column name 推導，如 `M_Locator_ID` → `M_Locator`) |
| 38 | Memo | textarea |

### FK Table Name 解析邏輯

```
Ref 19/31 (TableDirect/Locator):
  column name 去掉 _ID → table name (M_Warehouse_ID → M_Warehouse)

Ref 18/30 (Table/Search) + 有 AD_Reference_Value_ID:
  AD_Ref_Table → AD_Table → TableName

Ref 18/30 (Table/Search) + 無 AD_Reference_Value_ID:
  fallback: column name 去掉 _ID → table name
  (大量核心欄位如 C_BPartner_ID, C_Order_ID 都是這種情況)
```

### List 參照選項 (Ref 17)

```
GET /api/v1/models/AD_Ref_List?$filter=AD_Reference_ID eq {referenceValueId} and IsActive eq true
  &$select=Value,Name&$orderby=Name
```

### Identifier Column（FK 顯示欄位）

```
GET /api/v1/models/AD_Column?$filter=AD_Table_ID eq {tableId} and IsIdentifier eq true and IsActive eq true
  &$select=ColumnName,SeqNo&$orderby=SeqNo&$top=1
```

### 查詢必填欄位

```
GET /api/v1/models/AD_Column?$filter=AD_Table_ID eq {tableId} and IsMandatory eq true and IsActive eq true
  &$select=ColumnName,DefaultValue,AD_Reference_ID
```

### AD_Val_Rule 驗證規則

```
GET /api/v1/models/AD_Val_Rule/{ruleId}?$select=Code
→ { "Code": "C_DocType.DocBaseType IN ('SOO','POO') AND ..." }
```

優先用 `$valrule` 參數讓 server 端執行，避免手動轉 SQL → OData。

### DefaultValue 解析規則

| 格式 | 意義 | 範例 |
|------|------|------|
| `Y` / `N` | Boolean | `true` / `false` |
| `@#Date@` | 今天 | `2025-01-15` |
| `@AD_Org_ID@` | Context 變數 | 當前組織 ID |
| `@SQL=SELECT...` | SQL 查詢 | 由 server 處理 |
| `SYSDATE` | 當前時間 | ISO datetime |
| 數字 `0`, `100` | 整數/FK ID | 依 Ref ID 判斷型別 |

---

## 11. Processes / Reports

```json
POST /api/v1/processes/{slug}
{ "record-id": 123, "table-id": 208, "params": { "DateFrom": "2025-01-01" } }
```

- **slug = AD_Process.Value 小寫** (e.g. `pp_product_bom`, `c_order-process`)
- **⚠️ 不能用數字 ID** — `processes/136` 回 404
- `record-id` + `table-id` 用於 record-bound process
- 回傳: `summary`、`isError`、`logs`。報表回傳 PDF/HTML。

---

## 12. 其他功能

```bash
# 顯示生成的 SQL（debug 用）
GET /api/v1/models/C_Order/100?showsql
GET /api/v1/models/C_Order/100?showsql=nodata

# REST Views（自訂視圖）
GET /api/v1/views/{viewName}

# Attachments
GET /api/v1/models/{table}/{id}/attachments
POST /api/v1/models/{table}/{id}/attachments (multipart)
```

---

## 13. 常見陷阱速查 ⚠️

| 陷阱 | 說明 |
|------|------|
| `ne` 不支援 | 用 `neq` |
| `not (X eq Y)` 不行 | `not` 只能搭配函式如 `not contains()` |
| `IsActive eq 'Y'` | ❌ `'Y'` 被當欄位名，正確: `IsActive eq true` |
| `$context` boolean | 用 `Y`/`N`（不是 `true`/`false`） |
| `$filter` boolean | 用 `true`/`false`（不是 `'Y'`/`'N'`） |
| PUT /auth/tokens | 回傳**新 token**，舊 token 立即失效 |
| Refresh token | 只能用一次，重複使用觸發安全封鎖 |
| DateTime `Z` 後綴 | 實為本地時間，不要做 UTC 轉換 |
| DateTime 無毫秒 | 格式: `yyyy-MM-ddTHH:mm:ssZ` |
| GET FK 回傳物件 | `{"id":102, "identifier":"Name"}`，取值用 `.id` |
| POST FK 傳數字 | 直接傳 ID 數字，不是物件 |
| List 欄位寫入 | 傳 Value 字串如 `"DR"`，不是物件 |
| JS falsy zero | `!0 === true`，永遠用 `=== null` 檢查 |
| 混合日期欄位 | 不要混用兩個日期欄位做範圍查詢 |
| 401 處理 | 不要 auto-logout，用 `sessionExpired` flag + UI banner |
| DocAction | 不要 PUT 更新欄位，走 Process 端點 |

---

## 14. 常用查詢範例

```bash
# 客戶列表
GET /api/v1/models/C_BPartner?$filter=IsCustomer eq true and IsActive eq true&$orderby=Name&$top=50

# 搜尋產品
GET /api/v1/models/M_Product?$filter=contains(Name,'玻尿酸') and IsActive eq true&$select=Name,Value

# 訂單 + 明細
GET /api/v1/models/C_Order/100?$expand=C_OrderLine($orderby=Line)

# 單據類型（銷售）
GET /api/v1/models/C_DocType?$valrule=133&$context=IsSOTrx:Y&$select=Name

# BOM 產品
GET /api/v1/models/M_Product?$filter=IsBOM eq true and IsVerified eq true

# 完成訂單
POST /api/v1/processes/c_order-process  { "record-id": 100, "table-id": 259 }
```
