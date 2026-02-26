# 字段映射文檔：諮詢轉訂單追蹤系統

**版本**: 1.0
**日期**: 2026-02-26
**分支**: feature/consultation-order-conversion-tracking

---

## 📋 完整字段對應表

### R_Request (咨詢表) - 活動時間軸 JSON

| 欄位名 | iDempiere 欄位 | 類型 | 說明 |
|--------|---------------|------|------|
| 活動列表 | R_Request.**Description** | CLOB | JSON 陣列，存儲所有活動 |
| 客戶 | C_BPartner_ID | FK | 咨詢客戶 |
| 狀態 | R_Status_ID | FK | 咨詢狀態（待處理→已完成） |
| 創建時間 | Created | DateTime | 咨詢建立時間（用於計算響應時間） |
| 最後修改 | Updated | DateTime | 最後活動的時間 |

### 活動時間軸 JSON 結構

```json
[
  {
    "timestamp": "2026-02-26T10:30:00Z",
    "type": "Activity",
    "actionType": "PhoneCall",
    "content": "客戶詢問療程費用",
    "createdBy": 1000,
    "id": "act-001"
  },
  {
    "timestamp": "2026-02-26T14:30:00Z",
    "type": "StatusChange",
    "actionType": "ConversionOrder",
    "content": "轉化為訂單 #ORD-2026-0001，客戶已確認方案",
    "createdBy": 1001,
    "linkedOrderId": 1000001,
    "linkedOrderNo": "ORD-2026-0001",
    "id": "act-002"
  }
]
```

### C_Order (訂單表)

| 欄位名 | 類型 | 說明 | 備註 |
|--------|------|------|------|
| C_Order_ID | PK | 訂單 ID | 用於 linkedOrderId |
| DocumentNo | String | 訂單號 | 用於 linkedOrderNo |
| C_BPartner_ID | FK | 客戶 | 與 R_Request.C_BPartner_ID 關聯 |
| DateOrdered | DateTime | 下單日期 | 用於計算轉化時間 |
| GrandTotal | Decimal | 訂單總額 | 可選：用於績效統計 |

---

## 🔄 數據流詳細說明

### 1. 建立咨詢時

```
POST /api/v1/models/R_Request
{
  "C_BPartner_ID": 1000,
  "R_RequestType_ID": 10,
  "R_Status_ID": 100,
  "Summary": "客戶咨詢療程方案",
  "Description": "[]"  // 或 JSON.stringify([])
}

✓ 響應: R_Request_ID = 5000
✓ 活動時間軸初始化為空陣列
```

### 2. 執行快速操作時（如：記錄打電話）

```
PUT /api/v1/models/R_Request/5000
{
  "Description": "[{
    \"timestamp\": \"2026-02-26T10:30:00Z\",
    \"type\": \"Activity\",
    \"actionType\": \"PhoneCall\",
    \"content\": \"客戶詢問療程費用\",
    \"createdBy\": 1001,
    \"id\": \"act-001\"
  }]"
}

✓ 響應: Description 已更新
✓ 前端自動刷新活動列表
```

### 3. 建立訂單成功時

```
POST /api/v1/models/C_Order
{
  "C_BPartner_ID": 1000,
  "DocumentNo": "ORD-2026-0001",
  ...
}

✓ 響應: C_Order_ID = 1000001

// 立即回調：在咨詢中記錄轉化活動
PUT /api/v1/models/R_Request/5000
{
  "Description": "[
    {...前面的活動...},
    {
      \"timestamp\": \"2026-02-26T14:30:00Z\",
      \"type\": \"StatusChange\",
      \"actionType\": \"ConversionOrder\",
      \"content\": \"轉化為訂單 #ORD-2026-0001，客戶已確認方案\",
      \"createdBy\": 1001,
      \"linkedOrderId\": 1000001,
      \"linkedOrderNo\": \"ORD-2026-0001\",
      \"id\": \"act-002\"
    }
  ]"
}

✓ 咨詢已記錄訂單轉化
✓ 儀表板即時更新轉化率
```

---

## 📊 儀表板統計計算

### 轉化率計算

```javascript
// 輸入: allRequests[] = 所有咨詢 (30-90天)
// 輸出: conversionRate (%)

function calculateConversionRate(requests) {
  const converted = requests.filter(req => {
    const activities = JSON.parse(req.Description || '[]')
    return activities.some(a => a.actionType === 'ConversionOrder')
  })

  const rate = (converted.length / requests.length) * 100
  return `${rate.toFixed(1)}%`
}
```

### 按操作人績效統計

```javascript
// 輸入: allRequests[]
// 輸出: operatorPerformance[]

function calculateOperatorPerformance(requests) {
  const operatorMap = new Map()

  // 掃描所有活動
  requests.forEach(req => {
    const activities = JSON.parse(req.Description || '[]')
    activities.forEach(act => {
      const opId = act.createdBy
      if (!operatorMap.has(opId)) {
        operatorMap.set(opId, {
          operatorId: opId,
          consultationsUpdated: new Set(),  // 此用戶操作過的咨詢
          conversionsCreated: new Set(),    // 此用戶建立的訂單轉化
          totalResponseTime: 0,
          responseCount: 0
        })
      }

      // 計算：此用戶操作了多少咨詢
      operatorMap.get(opId).consultationsUpdated.add(req.R_Request_ID)

      // 計算：此用戶轉化了多少訂單
      if (act.actionType === 'ConversionOrder') {
        operatorMap.get(opId).conversionsCreated.add(req.R_Request_ID)
      }

      // 計算：響應時間 (咨詢建立 → 首次活動)
      const firstActivity = activities[0]
      if (firstActivity) {
        const responseTime = new Date(firstActivity.timestamp) - new Date(req.Created)
        operatorMap.get(opId).totalResponseTime += responseTime
        operatorMap.get(opId).responseCount++
      }
    })
  })

  // 轉換為結果陣列
  return Array.from(operatorMap.values()).map(op => ({
    operatorId: op.operatorId,
    consultationsUpdated: op.consultationsUpdated.size,
    conversionsCreated: op.conversionsCreated.size,
    conversionRate: op.consultationsUpdated.size > 0
      ? `${((op.conversionsCreated.size / op.consultationsUpdated.size) * 100).toFixed(1)}%`
      : '0%',
    avgResponseTime: op.responseCount > 0
      ? formatDuration(op.totalResponseTime / op.responseCount)
      : '-'
  }))
}
```

### 平均轉化時間

```javascript
// 輸入: allRequests[]
// 輸出: avgTimeToConversion (天)

function calculateAvgConversionTime(requests) {
  const convertedRequests = requests
    .filter(req => {
      const activities = JSON.parse(req.Description || '[]')
      return activities.some(a => a.actionType === 'ConversionOrder')
    })
    .map(req => {
      const activities = JSON.parse(req.Description || '[]')
      const conversionActivity = activities.find(a => a.actionType === 'ConversionOrder')
      const timeToConversion = new Date(conversionActivity.timestamp) - new Date(req.Created)
      return timeToConversion / (1000 * 60 * 60 * 24)  // 轉換為天數
    })

  if (convertedRequests.length === 0) return '-'

  const avg = convertedRequests.reduce((a, b) => a + b, 0) / convertedRequests.length
  return `${avg.toFixed(1)} 天`
}
```

---

## 🔍 驗證規則

### 數據完整性檢查

| 檢查項 | 規則 | 說明 |
|--------|------|------|
| **Activity timestamp** | ISO 8601 format | "2026-02-26T14:30:00Z" |
| **createdBy** | AD_User_ID exists | 必須是有效用戶 |
| **linkedOrderId** | C_Order_ID exists | 當 actionType='ConversionOrder' |
| **Description** | Valid JSON | 必須是可解析的 JSON |
| **actionType** | 預定義列表 | 只允許已定義的類型 |

### 測試數據範例

```json
{
  "R_Request_ID": 5000,
  "C_BPartner_ID": 1000,
  "R_Status_ID": 102,
  "Summary": "諮詢隆鼻療程",
  "Created": "2026-02-20T09:00:00Z",
  "Description": "[
    {
      \"timestamp\": \"2026-02-20T09:30:00Z\",
      \"type\": \"Activity\",
      \"actionType\": \"PhoneCall\",
      \"content\": \"首次通話，介紹療程\",
      \"createdBy\": 1001,
      \"id\": \"act-001\"
    },
    {
      \"timestamp\": \"2026-02-22T14:00:00Z\",
      \"type\": \"Activity\",
      \"actionType\": \"Message\",
      \"content\": \"客戶發訊息表示有興趣\",
      \"createdBy\": 1002,
      \"id\": \"act-002\"
    },
    {
      \"timestamp\": \"2026-02-24T16:30:00Z\",
      \"type\": \"StatusChange\",
      \"actionType\": \"ConversionOrder\",
      \"content\": \"轉化為訂單 #ORD-2026-0042，療程已確認\",
      \"createdBy\": 1002,
      \"linkedOrderId\": 1000042,
      \"linkedOrderNo\": \"ORD-2026-0042\",
      \"id\": \"act-003\"
    }
  ]"
}
```

---

## 🛠️ API 查詢示例

### 查詢有轉化的咨詢（30天內）

```javascript
// 查詢所有 30 天內建立的咨詢
const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString()

GET /api/v1/models/R_Request
?$filter=Created ge datetime'${thirtyDaysAgo}'
&$select=R_Request_ID,Summary,C_BPartner_ID,Created,Description,R_Status_ID
&$expand=C_BPartner_ID,R_Status_ID
&$orderby=Created desc
&$top=500
```

### 查詢特定客戶的咨詢歷史

```javascript
GET /api/v1/models/R_Request
?$filter=C_BPartner_ID eq 1000
&$select=R_Request_ID,Summary,Created,Description
&$orderby=Created desc
```

### 查詢特定操作人的績效

```javascript
// 前端過濾：掃描所有活動，找出 createdBy = 1001 的
const operatorActivities = allActivities
  .filter(a => a.createdBy === 1001)
```

---

## 📝 備註

- **JSON 存儲**: iDempiere CLOB 欄位支援最大 2GB，每個咨詢的 JSON 預期 < 1MB
- **時區**: 所有時間戳使用 UTC (Z 後綴)
- **向後相容**: 現有空的 Description 欄位將被轉換為 `[]`
- **活動 ID**: 自動生成為 `act-{序號}` 或 UUID

---

**最後更新**: 2026-02-26
**維護人**: Claude & Tom
