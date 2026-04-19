# 預約模組全面升級設計規格

**日期**: 2026-04-19  
**分支**: consultation-overhaul  
**決策**: 方案 A — 一次全改，CalendarView.vue 替換為 FullCalendar

---

## 目標

對標 nczz/idempiere-appointment 完整預約功能：
1. FullCalendar 替換自製行事曆（5 種視圖、拖拉存檔）
2. 7 態預約狀態系統（從 iDempiere AD_Reference 動態載入）
3. 取消語義：狀態改 CXL，不刪除紀錄
4. BPartner 搜尋整合至預約 dialog
5. 狀態顏色圖例顯示在左側 Sidebar

---

## Section 1 — 資料層

### Description JSON 格式

```json
{
  "status": "CFM",
  "group_id": "grp_1745123456",
  "bpartner_id": 1000023,
  "bpartner_name": "王小明",
  "service": "諮詢",
  "notes": "第二次回診",
  "order_id": null
}
```

- `Name` 欄位格式：`"王小明 - 諮詢"`（支援 OData contains 搜尋）
- `IsConfirmed`：status = CFM 時同步寫 true，其餘 false
- 舊資料（無 status 欄位）fallback → 視為 "SCH"（預約中）

### 取消語義

不再 DELETE，改為：
```
PUT /models/S_ResourceAssignment/{id}
{ "Description": JSON.stringify({...desc, status: "CXL"}) }
```

紀錄保留在 DB，時段釋放（衝突偵測排除 CXL/ABS）。

---

## Section 2 — FullCalendar 整合

### 套件安裝

```
@fullcalendar/vue3
@fullcalendar/core
@fullcalendar/daygrid
@fullcalendar/timegrid
@fullcalendar/list
@fullcalendar/interaction
```

### CalendarView.vue 重寫

| 項目 | 規格 |
|------|------|
| 視圖 | 月/週/3日/日/列表（5種） |
| 格線 | 15 分鐘 |
| 時段 | 09:00–18:00（`slotMinTime/MaxTime`） |
| 語言 | zh-tw |
| 現在時間 | `nowIndicator={true}` |
| 事件顏色 | Description.status → AD_Reference 顏色，fallback 資源顏色 |
| 拖拉 | `eventDrop` / `eventResize` → PUT 時間（同 group 同步） |
| 點擊空格 | 開新增 dialog，預填日期時間 |
| 點擊事件 | 開編輯 dialog |

### 左側 Sidebar 更新

- 資源篩選（保留現有邏輯）
- **狀態圖例**（新增）：從 AD_Reference 動態渲染，顏色圓點 + 名稱
- **「顯示已取消」toggle**（新增）：CXL/ABS 預設隱藏
- 服務篩選（保留現有）
- 管理資源 / 管理服務項目按鈕（保留）

---

## Section 3 — 狀態系統

### iDempiere 設定（一次性）

管理員在 iDempiere Application Dictionary 建立：
- `AD_Reference`：Name = `AppointmentStatus`，DisplayType = List
- `AD_Ref_List` 項目：

| Value | Name | Description（顏色） |
|-------|------|---------------------|
| SCH | 預約中 | #FBBF24 |
| CFM | 已確認 | #3B82F6 |
| CHK | 已到場 | #10B981 |
| INP | 進行中 | #F97316 |
| DON | 已完成 | #9CA3AF |
| ABS | 未到 | #EF4444 |
| CXL | 取消 | #D1D5DB |

### 新 composable：`useAppointmentStatuses.ts`

```typescript
// 模組級快取，格式同 useRequestStatuses 模式
interface AppointmentStatus { Value: string; Name: string; color: string }

loadAppointmentStatuses()  // 查 AD_Reference by name → AD_Ref_List
getStatusColor(value: string): string
getStatusName(value: string): string
isTerminalStatus(value: string): boolean  // CXL | ABS
clearAppointmentStatusCache()
```

查詢路徑：
```
GET /models/AD_Reference?$filter=Name eq 'AppointmentStatus'&$select=AD_Reference_ID
→ GET /models/AD_Ref_List?$filter=AD_Reference_ID eq {id}&$select=Value,Name,Description
```

---

## Section 4 — AppointmentForm 升級

### 欄位變更

| 欄位 | 現在 | 升級後 |
|------|------|--------|
| 客戶 | 無 | BPartner 搜尋（debounce，2字觸發） |
| 狀態 | 無 | 下拉選單（從 AD_Reference 載入） |
| 取消 | 刪除按鈕（DELETE） | 「取消預約」按鈕（紅色，PUT status=CXL） |

### BPartner 搜尋 UX

- 單一「客戶」欄位（不分姓名 vs 搜尋，避免 nczz 的混淆問題）
- 輸入 2+ 字 → debounce 300ms → `listBPartners({search})` 
- 選擇後：Name 欄位自動填入 `"BPartner名 - 服務"`, bpartner_id 存入 Description
- 可清除選擇回到自由文字模式

---

## 受影響檔案

| 檔案 | 動作 |
|------|------|
| `webapp/package.json` | 新增 @fullcalendar/* 6 個套件 |
| `webapp/src/views/appointment/CalendarView.vue` | **完整重寫** |
| `webapp/src/views/appointment/AppointmentForm.vue` | 加狀態、BPartner、取消按鈕 |
| `webapp/src/composables/useAppointmentStatuses.ts` | **新建** |
| `webapp/src/composables/useAppointmentDesc.ts` | **新建**（parse/serialize Description JSON） |
| `webapp/src/api/assignment.ts` | 新增 cancelAssignment、更新 updateAssignment payload |
| `webapp/src/api/assignment.ts` | 衝突偵測排除 terminal statuses |
| `i18n/fieldLabels.ts` | 新增狀態相關標籤（如需要） |

---

## 驗收標準

1. 行事曆有月/週/3日/日/列表 5 種視圖
2. 拖拉事件存檔（刷新後位置不跑掉）
3. 左側顯示狀態圖例（顏色 + 名稱，從 AD_Reference 載入）
4. 「顯示已取消」toggle 有效
5. 建立預約可搜尋並選擇客戶（BPartner）
6. 選擇狀態可存檔，行事曆顏色即時更新
7. 取消預約：紀錄保留，時段釋放，行事曆隱藏（或淡色）
8. 諮詢→預約的 consultationId 流程不受影響
