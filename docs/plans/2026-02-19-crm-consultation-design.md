# Design: CRM 諮詢模組系統

**Date**: 2026-02-19
**Status**: Approved
**Scope**: Consultation (R_Request) module redesign as CRM system

---

## Context

目前諮詢(consultation)模組是簡單的記錄功能。需要升級為完整 CRM 系統，支持：
- 前台追蹤客戶全旅程（記錄所有互動、預約追蹤）
- 老闆瞭解營運狀況（諮詢量、轉化率、客戶旅程洞察）
- 識別流失/沉默客戶的風險指標

**核心約束**：
- 不擴充 R_Request 表（plugin 通用性）
- 用現有表欄位實現所有功能
- Mobile first 設計

---

## Solution Architecture

### 核心策略

**活動時間軸** - JSON 格式存在 R_Request 的 Text 欄位

```typescript
interface RequestActivity {
  timestamp: string        // ISO datetime
  type: string            // "客戶訊息" | "前台行動" | "狀態改變"
  actionType: string      // "打電話" | "發訊息" | "預約" | "備註"
  content: string         // 活動描述
  createdBy: number       // AD_User_ID
}

// 存儲方式: R_Request.Description = JSON.stringify(activities[])
```

**不新建表** - 直接使用 iDempiere 現有表：
- `R_Request` - 核心資料（含 R_Status_ID、C_BPartner_ID、Created、Processed）
- `R_Status` - 狀態清單（待處理 → 討論中 → 等待回應 → 已指派 → 已完成）

---

## Feature Design

### 1. 前台介面 - 諮詢詳情頁

**頁面結構**（Mobile First）：

```
┌─ Header ─────────────────────────────────────┐
│ [返回] 諮詢詳情                               │
├──────────────────────────────────────────────┤
│ 客戶: [名稱]    |  狀態: [下拉]              │
├──────────────────────────────────────────────┤
│ 表單區                                       │
│ ├─ Summary (文本)                           │
│ ├─ R_RequestType_ID (下拉)                  │
│ ├─ R_Status_ID (下拉)                       │
│ └─ Created / Modified (時間)                │
├──────────────────────────────────────────────┤
│ 活動時間軸（JSON 解析）                      │
│ ├─ [2026-02-19 10:30] 前台：打電話詢問      │
│ ├─ [2026-02-19 14:00] 客戶訊息：已確認      │
│ └─ [2026-02-19 15:30] 狀態改變：已指派      │
├──────────────────────────────────────────────┤
│ Sticky Bottom Bar                           │
│ ├─ [記錄打電話]                             │
│ ├─ [發訊息]                                 │
│ ├─ [更新狀態]                               │
│ └─ [指派給...] [預約追蹤]                   │
└──────────────────────────────────────────────┘
```

**快速操作功能**：

| 操作 | 說明 | 結果 |
|------|------|------|
| 記錄打電話 | 前台記錄電話內容 | 添加活動到JSON時間軸 + 更新 Modified |
| 發訊息 | 記錄文字往來 | 添加活動到JSON時間軸 |
| 更新狀態 | 改變 R_Status_ID | 自動添加「狀態改變」活動 |
| 指派給 | 設定指派人員（存在備註or新欄位） | 標記為「已指派」狀態 |
| 預約追蹤 | 選擇追蹤日期 | 自動添加「預約追蹤」活動 |

**狀態流程**：
```
待處理 → 討論中 → 等待回應 → 已指派 → 已完成
```

---

### 2. 老闆 Dashboard

**數據源**：前端 fetch 最近 30/90 天的諮詢記錄，在瀏覽器計算統計

**指標卡片**：

| 指標 | 計算方式 | 說明 |
|------|---------|------|
| 本月諮詢數 | COUNT(requests where Created >= 本月1日) | 營運量 |
| 轉化率 | COUNT(requests → orders) / COUNT(requests) | 諮詢轉訂單比例 |
| 平均回應時間 | AVG(第一個活動時間 - Created) | 效率指標 |
| 未完成數 | COUNT(where Status != 已完成) | 待處理工作量 |
| 沉默諮詢 | COUNT(where Status=等待回應 AND LastActivity > 7天) | 風險：可能流失 |
| 流失客戶 | COUNT(unique customers where 90天無新諮詢) | 風險：需重新接觸 |

**視圖**：

```
┌─ 指標卡片區 ─────────────────────────────────┐
│ [本月: 24]  [轉化: 12%]  [回應時間: 2h]     │
│ [未完成: 8] [沉默: 3]    [流失: 5]          │
├───────────────────────────────────────────────┤
│ 狀態分布 (Pie)                               │
│  ├─ 待處理: 3                                │
│  ├─ 討論中: 5                                │
│  ├─ 等待回應: 3                              │
│  ├─ 已指派: 8                                │
│  └─ 已完成: 5                                │
├───────────────────────────────────────────────┤
│ 活躍客戶排行 (Top 10 by 諮詢次數)            │
│  1. 客戶A: 12次  2. 客戶B: 8次  ...          │
├───────────────────────────────────────────────┤
│ 預警清單                                     │
│ ├─ 沉默諮詢 (3件)                           │
│ │  └─ 諮詢-001: 討論中 > 7天無回應          │
│ ├─ 流失客戶 (5件)                           │
│ │  └─ 客戶X: 90天無新諮詢                   │
│ └─ 今日待追蹤 (2件)                         │
└───────────────────────────────────────────────┘
```

---

## Technical Implementation

### Data Storage

**活動時間軸存儲位置**：
- 欄位：`R_Request.Description` （或其他 Memo/Text 欄位）
- 格式：JSON array
- 容量評估：
  - 單條活動 ~100-200 bytes
  - 假設平均 50 條活動 = 5-10 KB
  - iDempiere Text 欄位通常支持 4000-65000 字符 → 可容納

**示例**：
```json
[
  {
    "timestamp": "2026-02-19T10:30:00Z",
    "type": "前台行動",
    "actionType": "打電話",
    "content": "客戶確認療程時間，預計下週一",
    "createdBy": 1000123
  },
  {
    "timestamp": "2026-02-19T14:00:00Z",
    "type": "狀態改變",
    "actionType": "已指派",
    "content": "已指派給銷售周小姐",
    "createdBy": 1000124
  }
]
```

### Frontend Architecture

**新增組件**：

| 組件 | 職責 |
|------|------|
| `RequestTimeline.vue` | 解析 JSON + 呈現時間軸卡片 |
| `QuickActionBar.vue` | Sticky 底部操作欄 |
| `ConsultationDashboard.vue` | 老闆面板 + 統計計算 |

**改動檔案**：

| 檔案 | 改動 |
|------|------|
| `RequestFormView.vue` | 新增時間軸組件 + 快速操作欄 |
| `RequestListView.vue` | 無改動（保持現狀） |
| `HomeView.vue` | 新增 Dashboard 導航 |

### Dashboard 統計邏輯

**前端計算步驟**：
1. Fetch 最近 30-90 天的 R_Request 記錄（帶 expand R_Status, C_BPartner, Created）
2. 在瀏覽器計算：
   - 按 Status 分組
   - 按 Customer 計數
   - 比對活動時間軸（JSON）算回應時間、沉默期
3. 定時 refresh（每 5-10 分鐘 fetch 一次）

**偽代碼**：
```typescript
// 計算沉默諮詢
const silentRequests = requests.filter(r => {
  if (r.R_Status_ID?.id !== '等待回應') return false
  const activities = JSON.parse(r.Description || '[]')
  const lastActivity = activities[activities.length - 1]?.timestamp
  const daysSilent = (Date.now() - new Date(lastActivity)) / (1000*86400)
  return daysSilent > 7
})

// 計算流失客戶
const lostCustomers = new Set()
requests.forEach(r => {
  const daysSinceCreated = (Date.now() - new Date(r.Created)) / (1000*86400)
  if (daysSinceCreated > 90) lostCustomers.add(r.C_BPartner_ID)
})
```

---

## Phase Rollout

### Phase 1: Core (Week 1)
- ✅ RequestFormView 時間軸 UI
- ✅ 快速操作欄（記錄打電話、發訊息、更新狀態）
- ✅ JSON 時間軸存儲

### Phase 2: Dashboard (Week 2)
- ✅ ConsultationDashboard 組件
- ✅ 統計計算邏輯
- ✅ 預警清單

### Phase 3: Polish (Week 3)
- ✅ Mobile 適配優化
- ✅ 定時 refresh 實作
- ✅ 錯誤處理 + 文檔

---

## Success Criteria

- ✅ 前台可記錄所有互動（打電話、訊息、預約等）
- ✅ 時間軸完整呈現諮詢全旅程
- ✅ Dashboard 實時反映諮詢狀態 + 識別流失/沉默客戶
- ✅ Mobile 友善（快速操作 sticky 底部）
- ✅ 無新建表，現有欄位支撐

---

## Open Questions / Future Work

1. **指派人員存儲**：目前無專用欄位，是存在備註還是需要簡單的 Many-to-One？
2. **諮詢轉訂單追蹤**：需要 R_Request ↔ C_Order 的 link table？
3. **客戶通知**：前台記錄「發訊息」時，是否同步推送給客戶？
4. **權限控制**：Dashboard 是否只給管理員看，還是所有前台都能看？

