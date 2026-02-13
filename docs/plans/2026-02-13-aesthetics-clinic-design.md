# 醫美診所 UI 設計文件

> **專案**: idempiere-module-ui
> **GitHub**: https://github.com/tm731531/idempiere-module-ui
> **日期**: 2026-02-13
> **狀態**: 設計審查中

---

## 1. 專案概述

### 目標
為醫美診所打造 Mobile-First 的 iDempiere 前端 UI，部署為 OSGi WAB bundle，可與現有一般診所 UI (`idempiere-skin-ui`) 同時運行在同一台 iDempiere 伺服器上。

### 核心特色
- **動態欄位渲染** — 基於 AD_Field + AD_Column metadata，欄位定義不寫死在前端
- **附件管理** — 支援圖片上傳、原圖壓縮、預覽
- **Document Action** — 完整的文件動作流程（完成/作廢/反轉）
- **三表聯動** — 業務夥伴建立時同步建立 Location + Contact
- **角色權限** — AD_SysConfig 定義角色→頁面對照表，控制選單可見性

### 身份識別
| 項目 | 值 |
|---|---|
| Bundle SymbolicName | `org.idempiere.ui.aesthetics` |
| Web-ContextPath | `/aesthetics/` |
| URL | `https://<host>:8443/aesthetics/#/` |

---

## 2. 技術棧

| 項目 | 選擇 | 理由 |
|---|---|---|
| Framework | Vue 3 + TypeScript | 與 skin-ui 一致，團隊經驗 |
| 建構工具 | Vite 7 | 快速 HMR、Tree-shaking |
| 狀態管理 | Pinia | Vue 3 官方推薦 |
| HTTP 客戶端 | Axios | 攔截器模式成熟 |
| UI 元件庫 | **PrimeVue 4** | 動態表單需要豐富的 input 元件（Calendar、AutoComplete、FileUpload、DataTable），手刻成本太高 |
| 測試 | Vitest + happy-dom | 與 skin-ui 一致 |
| 部署 | OSGi WAB JAR | 與 iDempiere 整合的標準方式 |
| 路由 | Vue Router (Hash mode) | OSGi WAB 必須 |
| 圖片壓縮 | browser-image-compression | 客戶端壓縮，減少上傳大小 |

### 為什麼選 PrimeVue
1. **Vue 3 原生** — 完整 Composition API 支援
2. **豐富元件** — Calendar、AutoComplete、FileUpload、DataTable、Dialog 等，醫美表單需求高
3. **無樣式模式（Unstyled）** — 可完全自訂主題，不強制外觀
4. **Tree-shakable** — 只打包用到的元件
5. **MIT 授權** — 商業使用無限制

### UX 設計原則

**漸進式揭露（Progressive Disclosure）**:
動態欄位系統雖然可以渲染大量欄位，但 UI 不應一次全部攤開。

1. **分層顯示** — 表單依 `FieldGroup` 分組為可收合區塊，預設只展開必填/常用區塊
2. **主要欄位優先** — 初始只顯示核心欄位（5-8 個），其餘收在「更多資訊」區塊
3. **Mobile-First** — 單欄排版，一個欄位一行，拇指可觸及的按鈕大小（最小 44px）
4. **即時回饋** — 欄位驗證即時顯示（不等到送出），必填欄位明確標示
5. **上下文相關** — SearchSelector 只在聚焦時展開搜尋，不預先載入全部選項
6. **操作確認** — DocAction（完成/作廢/反轉）必須二次確認，防止誤觸

**動態欄位的顯示策略**:
```
AD_Field.FieldGroup 分組 → 每組一個可收合面板

面板 A: 基本資訊（展開）     ← 必填欄位所在
面板 B: 詳細資訊（收合）     ← 選填欄位
面板 C: 其他（收合）         ← 進階/少用欄位
```

**列表頁設計**:
- 預設顯示 3-5 個關鍵欄位（不是全部欄位）
- 支援篩選/搜尋，但不做複雜的多條件組合
- 點擊直接進入詳情/編輯，減少點擊次數

---

## 3. 業務模組

### 3.1 模組總覽

```
┌─────────────────────────────────────────────────┐
│                  醫美診所 UI                      │
├─────────┬──────────┬──────────┬─────────────────┤
│ 資源預約  │  諮詢單   │   訂單    │    療程單       │
│ S_Resource│ R_Request│ C_Order  │ M_Production    │
│ Assignment│          │ C_Order  │ M_Production    │
│          │          │  Line    │  Line           │
├──────────┴──────────┴──────────┴─────────────────┤
│ 業務夥伴（三表聯動）│ 收付款      │ 收發貨          │
│ C_BPartner          │ C_Payment  │ M_InOut         │
│ C_BPartner_Location │            │ M_InOutLine     │
│ C_Location          │            │                 │
│ AD_User             │            │                 │
├─────────────────────┴────────────┴─────────────────┤
│              橫切面功能                             │
│ 動態欄位 │ 附件管理 │ DocAction │ 搜尋選擇器 │ 欄位設定 │ 角色權限 │
└────────────────────────────────────────────────────┘
```

### 3.2 業務流程

**核心原則：各模組獨立操作，不強制固定流程順序。**

**典型流程（諮詢驅動）**:
```
[業務夥伴] 建立或查詢客戶資料
  ↓
[諮詢單] 初步諮詢 → 評估方案 → 拍術前照
  ↓
[訂單] 開立銷售訂單（療程+產品）
  ↓
[療程單] 執行療程，扣耗材庫存
  ↓
[諮詢單] 術後追蹤回診，拍術後照對比
```

**資源預約（獨立模組，隨時可用）**:
```
預約不從屬於任何流程，使用場景多元：

- 純諮詢預約 → 客戶想跟醫師聊聊
- 療程預約   → 確定要做，預約手術/療程時段
- 回診預約   → 術後追蹤
- 設備預約   → 預約特定設備/診間
- 臨時加約   → 現場直接安排
```

**收款（獨立於主流程，時機不定）**:
```
收款時機由業務情境決定，不綁定固定步驟：

1. 訂單前全額預付  → 先收款，再開訂單
2. 訂單時全額付清  → 訂單完成時收款
3. 訂單時付訂金    → 部分收款，療程後補尾款
4. 療程後才付款    → 療程完成後收款
5. 關係戶/VIP     → 可能延後收款或特殊安排
6. 分期付款       → 多筆 C_Payment 關聯同一 C_Order
```

**收發貨（獨立補貨流程）**:
```
耗材/產品不足時
  ↓
[訂單] 採購訂單（C_Order IsSOTrx=false）
  ↓
[收發貨] 供應商送貨 → 收貨入庫（M_InOut）
```

**反向流程**:
```
訂單作廢   → C_Order Void → 已收款則 C_Payment Reverse
療程單反轉  → M_Production Reverse → 耗材回沖庫存
```

**流程特點**:
- 各模組可獨立操作，不強制按順序
- 資源預約是獨立入口，不綁定訂單或諮詢
- 諮詢單是常見起點，但不是唯一起點
- 收款與主流程解耦，支援各種付款時機
- 每筆操作都有 CreatedBy/UpdatedBy 追蹤

### 3.3 資源預約 (S_ResourceAssignment)

**用途**: 客戶預約醫美療程的時段管理

**資料模型**:
- `S_ResourceAssignment` — 預約紀錄（時段、資源、客戶）
- `S_Resource` — 資源（醫師、設備、診間）
- `S_ResourceType` — 資源類型

**畫面**:
- 行事曆週視圖（依資源分欄）
- 預約建立/編輯表單（動態欄位）
- 當日預約列表

**關鍵邏輯**:
- 衝突檢測（同一資源同一時段不可重複預約）
- 預約狀態管理（`IsConfirmed` 不可透過 REST PUT 更新，需注意）
- 拖曳調整時段（行事曆互動）

### 3.4 諮詢單 (R_Request)

**用途**: 醫美諮詢紀錄，記錄客戶需求、診斷、建議方案

**資料模型**:
- `R_Request` — 諮詢主檔
- `R_RequestType` — 諮詢類型（初診諮詢、回診、術後追蹤）
- `R_Status` — 狀態流轉
- `R_Category` — 分類
- `AD_Attachment` — 諮詢照片（術前/術後對比）

**畫面**:
- 諮詢單列表（依狀態篩選）
- 諮詢單表單（動態欄位 + 附件區）
- 照片對比檢視

**關鍵邏輯**:
- R_Request **無 DocAction** — 狀態透過 `R_Status_ID` 管理，完成用 `Processed=true`
- 照片上傳必須壓縮（原圖可能 5MB+，壓縮至 < 500KB）
- 可關聯到 C_BPartner（客戶）、C_Order（訂單）

### 3.5 業務夥伴 (C_BPartner 三表聯動)

**用途**: 客戶資料管理，一次建立完整客戶資訊

**資料模型（三表聯動）**:
1. `C_BPartner` — 主檔（姓名、統編、分類）
2. `C_Location` → `C_BPartner_Location` — 地址
3. `AD_User` — 聯絡人（電話、Email）

**建立流程（單次 API 不可分步）**:
```
前端收集所有資料
  ↓
1. POST C_Location（建地址）→ 取得 C_Location_ID
  ↓
2. POST C_BPartner（建主檔）→ 取得 C_BPartner_ID
  ↓
3. POST C_BPartner_Location（綁定地址）
  ↓
4. POST AD_User（建聯絡人，綁定 C_BPartner_ID）
```

**畫面**:
- 客戶搜尋（TaxID / 姓名 / 電話）
- 客戶建立表單（動態欄位，所有資訊一頁填寫）
- 客戶詳情（含歷史諮詢、訂單、療程）

**關鍵邏輯**:
- 禁止單獨建立 C_BPartner — 必須三表聯動
- QuickCreate — 選擇器中找不到時可快速新增
- 搜尋選擇器邏輯：≤20 筆 Dropdown、21-200 筆 Search、>200 筆 Search+分頁

### 3.6 訂單 (C_Order + C_OrderLine)

**用途**: 銷售訂單，記錄客戶購買的療程/產品

**資料模型**:
- `C_Order` — 訂單主檔（客戶、日期、金額）
- `C_OrderLine` — 訂單明細（產品/療程、數量、單價）

**畫面**:
- 訂單列表（依 DocStatus 篩選：草稿/已完成/已作廢）
- 訂單表單 — Header + Lines 同頁（動態欄位）
- 訂單明細行可新增/刪除/修改

**關鍵邏輯**:
- **DocAction 支援** — Complete(CO)、Void(VO)、Close(CL)、Reverse(RE)
- `doc-action` key 是小寫加連字號（不是 `DocAction`）
- 完成後不可編輯 — 需作廢後重建
- 必填欄位從 AD_Column 動態讀取

### 3.7 療程單 (M_Production + M_ProductionLine)

**用途**: 療程執行記錄，扣減耗材庫存

**資料模型**:
- `M_Production` — 療程主檔（日期、產品/療程、數量）
- `M_ProductionLine` — 耗材明細（使用的材料、數量）

**畫面**:
- 療程單列表
- 療程單表單（動態欄位）
- 耗材明細行管理

**關鍵邏輯**:
- **DocAction 支援** — Complete(CO) 會自動扣庫存
- BOM 展開 — 療程關聯的 BOM 自動帶入耗材明細
- `IsCreated` / `IsUseProductionPlan` 欄位控制建立方式

### 3.8 收付款 (C_Payment)

**用途**: 收款（客戶付款）與付款（供應商付款）

**畫面**:
- 收款表單（關聯訂單、金額、付款方式）
- 付款記錄列表

**關鍵邏輯**:
- **DocAction 支援** — Complete(CO)、Void(VO)
- TenderType — 現金、信用卡、轉帳
- 可關聯到 C_Order 或 C_Invoice
- 預收款（儲值卡概念）支援

### 3.9 收發貨 (M_InOut + M_InOutLine)

**用途**: 產品/耗材的進貨與出貨

**畫面**:
- 收發貨列表
- 收發貨表單（動態欄位）
- 明細行管理

**關鍵邏輯**:
- **DocAction 支援** — Complete(CO)、Reverse(RE)
- 收貨增加庫存、出貨減少庫存
- 可從 C_Order 自動產生

---

## 4. 橫切面功能

### 4.1 動態欄位系統

**兩層 Metadata 架構**:

```
AD_Window → AD_Tab → AD_Field  (展示層)
    ↓           ↓          ↓
AD_Table → AD_Column         (實體層)
```

**前端讀取順序**:
1. 查詢 `AD_Field`（依 Window/Tab）→ 取得 `SeqNo`（排序）、`FieldGroup`（分組）、`IsDisplayed`（可見性）、`IsReadOnly`
2. 查詢對應的 `AD_Column` → 取得 `IsMandatory`（必填）、`AD_Reference_ID`（欄位類型）、`AD_Reference_Value_ID`（下拉選項來源）、`FieldLength`、`DefaultValue`
3. 前端 `DynamicForm` 元件根據 metadata 自動渲染對應的 input 元件

**AD_Reference_ID 對應 UI 元件**:

| AD_Reference_ID | 類型 | PrimeVue 元件 |
|---|---|---|
| 10 | String | InputText |
| 11 | Integer | InputNumber |
| 12 | Amount | InputNumber (currency) |
| 13 | ID | Hidden / AutoComplete |
| 14 | Text | Textarea |
| 15 | Date | DatePicker |
| 16 | DateTime | DatePicker (showTime) |
| 17 | List | Select (靜態選項從 AD_Ref_List) |
| 19 | Table Direct | AutoComplete (SearchSelector) |
| 20 | YesNo | Checkbox / ToggleSwitch |
| 29 | Quantity | InputNumber |
| 30 | Search | AutoComplete (SearchSelector) |
| 37 | Assignment | 資源預約選擇器 |
| 38 | Memo | Textarea (大) |

**SearchSelector 智慧邏輯**:
- ≤ 20 筆 → Dropdown（直接載入所有選項）
- 21–200 筆 → Search input（輸入後過濾）
- \> 200 筆 → Search + 分頁（延遲載入）
- 所有 SearchSelector 必須提供 **QuickCreate** 按鈕

**欄位快取策略**:
- AD_Field / AD_Column metadata 在 session 內快取（不需每次重新查詢）
- 快取 key: `metadata_{windowId}_{tabId}`
- 切換 Client/Role 時清除快取

### 4.2 附件管理系統

**API 端點** (所有 model 通用):
```
GET    /api/v1/models/{table}/{id}/attachments           → 列出附件
GET    /api/v1/models/{table}/{id}/attachments/{name}    → 下載附件
POST   /api/v1/models/{table}/{id}/attachments           → 上傳附件
DELETE /api/v1/models/{table}/{id}/attachments/{name}    → 刪除附件
```

**上傳格式**:
```json
{
  "name": "photo_before.jpg",
  "data": "<base64-encoded>",
  "overwrite": false
}
```

**原圖壓縮策略**:
1. 使用 `browser-image-compression` 在客戶端壓縮
2. 壓縮參數:
   - `maxSizeMB: 0.5` (最大 500KB)
   - `maxWidthOrHeight: 1920` (最大邊 1920px)
   - `useWebWorker: true` (不阻塞 UI)
3. 保留原始尺寸比例
4. 僅壓縮圖片格式（jpg/png/webp），其他檔案直接上傳

**附件元件 (`AttachmentManager.vue`)**:
- 拖曳上傳區
- 圖片預覽（縮圖 grid）
- 點擊放大檢視
- 刪除確認
- 上傳進度指示
- 支援多檔同時上傳

### 4.3 Document Action 系統

**通用 DocAction 元件 (`DocActionBar.vue`)**:

根據當前 `DocStatus` 動態顯示可用動作：

| DocStatus | 可用動作 | 按鈕樣式 |
|---|---|---|
| DR (草稿) | Complete, Void | Primary, Danger |
| IP (處理中) | Complete, Void | Primary, Danger |
| CO (已完成) | Close, Void, Reverse | Default, Danger, Warning |
| CL (已關閉) | (無) | — |
| VO (已作廢) | (無) | — |

**API 呼叫方式**:
```typescript
// 在 PUT 請求中加入 doc-action
await apiClient.put(`/api/v1/models/C_Order/${id}`, {
  'doc-action': 'CO'  // 注意：小寫加連字號
})
```

**R_Request 例外**: 無 DocAction，狀態透過 `R_Status_ID` + `Processed` 管理

**鎖定邏輯**:
- `DocStatus !== 'DR'` 時，所有欄位變為唯讀
- DocAction 按鈕仍可操作（作廢、反轉等）
- 作廢/反轉後，原單唯讀，新單可編輯

### 4.4 搜尋選擇器 (SearchSelector)

**通用元件**: 用於所有 Foreign Key 欄位（C_BPartner_ID、M_Product_ID、S_Resource_ID 等）

**行為**:
1. 接收 `AD_Column` 的 `AD_Reference_ID` 和 `AD_Reference_Value_ID`
2. 自動判斷資料來源表和顯示欄位
3. 根據筆數自動切換模式（Dropdown / Search / Search+分頁）
4. **QuickCreate** — 找不到時彈出快速建立 Dialog

### 4.5 欄位設定管理

**用途**: 管理員在前端直接調整各表單的欄位顯示/隱藏、排序，不需進 iDempiere ZK 後台。

**原理**: 直接透過 REST API 更新 AD_Field 記錄（`IsDisplayed`、`SeqNo`、`FieldGroup` 等），修改的是 iDempiere 本身的 metadata，前端下次載入表單時自動生效。

**API 操作**:
```
GET  /api/v1/models/AD_Field?$filter=AD_Tab_ID eq {tabId}
     &$select=AD_Field_ID,Name,SeqNo,IsDisplayed,FieldGroup,IsReadOnly
     &$orderby=SeqNo

PUT  /api/v1/models/AD_Field/{id}
     { "IsDisplayed": true/false, "SeqNo": 10, "FieldGroup": "基本資訊" }
```

**權限限制**: AD_Field 是 System level（AccessLevel=4），只有 UserLevel 含 'S' 的角色才能寫入。
一般 Client 角色可以**讀取** AD_Field（表單渲染正常），但**不能寫入**。
因此欄位設定頁僅限 System 角色操作（登入時選 System Administrator 角色）。

**管理頁面 (`FieldConfigView.vue`)**:
- 路由: `/admin/fields`
- 權限: 僅 System 角色可見（前端檢查 `userLevel` 含 'S'）
- 選擇 Window → Tab → 顯示該 Tab 下所有 AD_Field
- 每個欄位一行：名稱 | 顯示開關 | 排序拖曳 | 分組選擇
- 拖曳排序自動更新 `SeqNo`
- 開關切換 `IsDisplayed`
- 儲存後清除前端 metadata 快取，立即生效

**頁面 Key**: `fieldconfig`（加入角色權限對照）

### 4.6 角色權限系統

**設計原則**: 只控制頁面可見性，不限制頁面內操作。操作紀錄依靠 iDempiere 內建的 `CreatedBy` / `UpdatedBy` 自動追蹤。

**AD_SysConfig 對照表**:
```
Key:   AESTHETICS_ROLE_{AD_Role_ID}_PAGES
Value: appointment,consultation,customer,order,treatment,payment,shipment
```

**範例**:
| AD_SysConfig Key | Value | 說明 |
|---|---|---|
| `AESTHETICS_ROLE_1000001_PAGES` | `appointment,consultation,customer,order,treatment,payment,shipment` | 管理員（全部頁面） |
| `AESTHETICS_ROLE_1000002_PAGES` | `appointment,consultation,customer,order,treatment` | 醫師（不含收付款/收發貨） |
| `AESTHETICS_ROLE_1000003_PAGES` | `appointment,customer,order,payment` | 櫃台（不含諮詢/療程/收發貨） |
| `AESTHETICS_ROLE_1000004_PAGES` | `shipment` | 倉管（僅收發貨） |

**前端實作**:
1. 登入完成後（取得 `AD_Role_ID`），查詢 `AD_SysConfig` 取得該角色的 `PAGES` 值
2. 解析為頁面 key 陣列
3. Router guard 根據此陣列過濾可存取的路由
4. 首頁選單只顯示有權限的模組
5. 未設定 `AESTHETICS_ROLE_{roleId}_PAGES` 的角色 → 預設不顯示任何業務頁面（僅登入頁）

**頁面 Key 對照**:

| Page Key | 路由 | 對應模組 |
|---|---|---|
| `appointment` | `/appointment` | 資源預約 |
| `consultation` | `/consultation` | 諮詢單 |
| `customer` | `/customer` | 業務夥伴 |
| `order` | `/order` | 訂單 |
| `treatment` | `/treatment` | 療程單 |
| `payment` | `/payment` | 收付款 |
| `shipment` | `/shipment` | 收發貨 |
| `fieldconfig` | `/admin/fields` | 欄位設定管理（System 角色限定，不走 SysConfig） |

**Composable**: `usePermission.ts`
```typescript
// 用法
const { allowedPages, canAccess } = usePermission()

if (canAccess('order')) {
  // 顯示訂單選單項目
}
```

---

## 5. 專案結構

```
idempiere-module-ui/
├── docs/
│   ├── plans/                          # 設計文件
│   └── BUSINESS_DECISIONS.md           # 業務決策記錄
├── CLAUDE.md                           # 開發者指南
├── README.md
├── build.sh                            # 建構+部署腳本
│
├── webapp/                             # Vue 3 前端
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── index.html
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       ├── config.ts
│       │
│       ├── api/                        # API 層
│       │   ├── client.ts               # Axios instance + 401 攔截器
│       │   ├── auth.ts                 # 認證 API
│       │   ├── metadata.ts             # AD_Field / AD_Column 查詢
│       │   ├── attachment.ts           # 附件上傳/下載/刪除
│       │   ├── lookup.ts              # 動態 ID 查詢（快取）
│       │   ├── bpartner.ts            # 業務夥伴三表聯動
│       │   ├── request.ts             # R_Request 諮詢單
│       │   ├── order.ts               # C_Order 訂單
│       │   ├── production.ts          # M_Production 療程單
│       │   ├── payment.ts             # C_Payment 收付款
│       │   ├── inout.ts               # M_InOut 收發貨
│       │   ├── resource.ts            # S_Resource 資源
│       │   ├── assignment.ts          # S_ResourceAssignment 預約
│       │   └── utils.ts               # OData 工具、日期格式化
│       │
│       ├── composables/               # Vue Composables
│       │   ├── useMetadata.ts         # 動態欄位 metadata 載入+快取
│       │   ├── useAttachment.ts       # 附件管理邏輯（壓縮+上傳）
│       │   ├── useDocAction.ts        # DocAction 狀態判斷+執行
│       │   ├── useSearchSelector.ts   # 搜尋選擇器邏輯
│       │   └── usePermission.ts       # 角色→頁面權限控制
│       │
│       ├── components/                # 通用元件
│       │   ├── DynamicForm.vue        # 動態表單渲染器
│       │   ├── DynamicField.vue       # 單一動態欄位
│       │   ├── SearchSelector.vue     # 搜尋選擇器（含 QuickCreate）
│       │   ├── DocActionBar.vue       # 文件動作列
│       │   ├── AttachmentManager.vue  # 附件管理
│       │   ├── ImagePreview.vue       # 圖片預覽/放大
│       │   └── StatusBadge.vue        # 狀態標籤
│       │
│       ├── stores/                    # Pinia Stores
│       │   ├── auth.ts               # 認證（多步驟登入）
│       │   ├── metadata.ts           # Metadata 快取
│       │   ├── bpartner.ts           # 業務夥伴
│       │   ├── request.ts            # 諮詢單
│       │   ├── order.ts              # 訂單
│       │   ├── production.ts         # 療程單
│       │   ├── payment.ts            # 收付款
│       │   ├── inout.ts              # 收發貨
│       │   └── appointment.ts        # 資源預約
│       │
│       ├── views/                     # 頁面
│       │   ├── LoginView.vue
│       │   ├── HomeView.vue
│       │   ├── appointment/          # 資源預約
│       │   │   ├── CalendarView.vue
│       │   │   └── AppointmentForm.vue
│       │   ├── consultation/         # 諮詢單
│       │   │   ├── RequestListView.vue
│       │   │   └── RequestFormView.vue
│       │   ├── customer/             # 業務夥伴
│       │   │   ├── CustomerListView.vue
│       │   │   ├── CustomerFormView.vue
│       │   │   └── CustomerDetailView.vue
│       │   ├── order/                # 訂單
│       │   │   ├── OrderListView.vue
│       │   │   └── OrderFormView.vue
│       │   ├── treatment/            # 療程單
│       │   │   ├── ProductionListView.vue
│       │   │   └── ProductionFormView.vue
│       │   ├── payment/              # 收付款
│       │   │   ├── PaymentListView.vue
│       │   │   └── PaymentFormView.vue
│       │   ├── shipment/             # 收發貨
│       │   │   ├── InOutListView.vue
│       │   │   └── InOutFormView.vue
│       │   └── admin/                # 管理
│       │       └── FieldConfigView.vue
│       │
│       └── router/
│           └── index.ts
│
├── osgi-bundle/                       # OSGi Bundle
│   ├── META-INF/
│   │   └── MANIFEST.MF
│   ├── WEB-INF/
│   │   └── web.xml
│   ├── plugin.xml
│   ├── pom.xml
│   └── build.properties
│
└── target/                            # 建構輸出
```

---

## 6. 開發順序

### Phase 0: 基礎架構
1. 專案腳手架（Vite + Vue 3 + TypeScript + PrimeVue）
2. OSGi bundle 結構 + build.sh
3. Auth 模組（多步驟登入，從 skin-ui 移植）
4. API client（Axios + 401 攔截器）
5. Router 骨架（Hash mode）

### Phase 1: 橫切面核心
6. Metadata API（`api/metadata.ts` + `useMetadata` composable）
7. DynamicForm + DynamicField 元件
8. SearchSelector 元件（含 QuickCreate）
9. DocActionBar 元件
10. AttachmentManager 元件（含圖片壓縮）
11. 角色權限（`usePermission` composable + Router guard 整合）

### Phase 2: 業務夥伴（最基礎的 Master Data）
11. `api/bpartner.ts` — 三表聯動 CRUD
12. CustomerListView / CustomerFormView
13. SearchSelector 整合（選客戶時可 QuickCreate）

### Phase 3: 諮詢單 + 資源預約（兩個獨立入口）
12. `api/request.ts` — 諮詢單 CRUD + R_Status 流轉
13. RequestListView / RequestFormView + 附件整合（術前/術後照片）
14. `api/resource.ts` + `api/assignment.ts` — 資源預約
15. CalendarView（週視圖）+ AppointmentForm

### Phase 4: 訂單
16. `api/order.ts`
17. OrderListView / OrderFormView（Header + Lines 同頁）
18. DocAction 整合

### Phase 5: 療程單
19. `api/production.ts`
20. ProductionListView / ProductionFormView
21. BOM 展開 + 耗材管理
22. DocAction 整合

### Phase 6: 收付款 + 收發貨
23. `api/payment.ts` + PaymentFormView
24. `api/inout.ts` + InOutFormView
25. DocAction 整合

---

## 7. 關鍵設計決策

### D1: PrimeVue 而非手刻
醫美表單複雜度（動態欄位、日曆、檔案上傳、資料表格）遠超一般診所。
PrimeVue Unstyled 模式讓我們保有完全的樣式控制，同時不需要重造輪子。

### D2: Composables 而非 Store 放邏輯
`useMetadata`、`useDocAction` 等跨模組邏輯用 Vue Composables 封裝，
而非塞進 Pinia store。Store 只管狀態，Composable 管行為。

### D3: Metadata 快取在 Session 內
AD_Field/AD_Column metadata 在 login session 內不會變化（除非 admin 改了 Window 定義），
因此快取在記憶體中，不需要每次開表單都重新查詢。
切換 Client/Role 時清除快取。

### D4: 客戶端圖片壓縮
醫美照片（手機拍攝）通常 3-10MB。上傳前壓縮至 500KB 以內，
減少網路傳輸和 iDempiere 儲存空間，同時保持足夠的診斷品質。

### D5: R_Request 狀態管理
R_Request 沒有 DocAction，用 `R_Status_ID` + `Processed` 管理生命週期。
前端需要查詢 `R_Status` 表取得可用狀態列表，提供狀態轉換 UI。

### D6: 三表聯動不可分步
業務夥伴建立時，C_Location → C_BPartner → C_BPartner_Location → AD_User
四個 API call 必須在同一個操作中完成。任一失敗需要回滾已建立的記錄。

### D7: DocAction 用 REST PUT 而非 Process
iDempiere REST API 支援在 PUT body 中帶 `doc-action` 欄位觸發 DocAction，
不需要走 Process endpoint。注意 key 是 `doc-action`（小寫+連字號）。

### D8: 角色權限用 AD_SysConfig 而非 AD_Role Window Access
我們的頁面不是 iDempiere 的 AD_Window，無法直接吃 AD_Role 的 Window Access。
改用 AD_SysConfig 定義 `AESTHETICS_ROLE_{roleId}_PAGES` 對照表。
只控制頁面可見性，不限制頁面內操作。操作紀錄依靠 iDempiere 內建的 `CreatedBy` / `UpdatedBy`。

### D9: 漸進式揭露（Progressive Disclosure）
動態欄位可能帶出大量欄位，但 UI 不應一次全部攤開。
依 FieldGroup 分組為可收合面板，預設只展開必填/常用欄位（5-8 個）。
列表頁只顯示 3-5 個關鍵欄位。Mobile-First 單欄排版。

### D10: 欄位設定直接更新 AD_Field（System 角色限定）
不另建覆寫層（SysConfig），直接透過 REST PUT 更新 AD_Field 的 IsDisplayed、SeqNo、FieldGroup。
AD_Field 是 System level（AccessLevel=4），寫入需要 UserLevel 含 'S'。
因此欄位設定頁僅限 System Administrator 角色操作，一般 Client 角色看不到此頁面。
讀取 AD_Field 不受此限制，所有角色都能正常渲染動態表單。

### D11: 資源預約獨立於業務流程
預約不從屬於訂單或諮詢。客戶可能為純諮詢、療程、回診、或臨時需求而預約。
預約與訂單/諮詢之間是可選的關聯，不是強制的前後步驟。

---

## 8. 與 idempiere-skin-ui 的差異

| 面向 | skin-ui（一般診所） | module-ui（醫美） |
|---|---|---|
| 業務領域 | 掛號/看診/藥局/庫存 | 預約/諮詢/訂單/療程/收付款 |
| 表單方式 | 靜態定義 | 動態欄位（AD_Field metadata） |
| 附件 | 無 | AD_Attachment + 圖片壓縮 |
| DocAction | 僅 M_Movement | C_Order, M_Production, C_Payment, M_InOut |
| 資料儲存 | 大量用 AD_SysConfig | 標準 iDempiere Tables |
| UI 元件庫 | 純手刻 CSS | PrimeVue 4 (Unstyled) |
| Bundle Name | org.idempiere.ui.clinic | org.idempiere.ui.aesthetics |
| ContextPath | /ui/ | /aesthetics/ |

### 可復用的部分
- Auth 模組（多步驟登入流程）
- API client 架構（Axios + 401 攔截器）
- build.sh 腳本（改名稱即可）
- OSGi bundle 結構
- OData 工具函數（escapeODataString, toIdempiereDateTime）

---

## 9. 風險與對策

| 風險 | 對策 |
|---|---|
| AD_Field metadata API 回傳格式不確定 | Phase 1 先做 spike 驗證，確認 API 回應結構 |
| PrimeVue bundle size 過大 | 使用 Tree-shaking + 只引入需要的元件 |
| 圖片壓縮品質不夠 | 提供壓縮品質設定（可調整 maxSizeMB） |
| 三表聯動部分失敗 | 實作前端回滾邏輯（DELETE 已建立的記錄） |
| S_ResourceAssignment.IsConfirmed 不可 PUT | 記錄為已知限制，不在 UI 提供確認功能或走 Process |
| AD_Field 寫入需 System 角色 | 欄位設定頁檢查 UserLevel 含 'S'，非 System 角色不顯示此頁面 |
