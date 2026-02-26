# 諮詢轉訂單追蹤系統 - 開發進度檢查清單

**分支**: `feature/consultation-order-conversion-tracking`
**狀態**: 🟡 進行中
**開始日期**: 2026-02-26
**目標完成日期**: 2026-03-02

---

## 📋 整體進度

```
[████████░░░░░░░░░░░░] 40% Complete
```

| Phase | 進度 | 預計 | 狀態 |
|-------|------|------|------|
| Phase 1: API 層 | 50% | 1 day | 🟡 進行中 |
| Phase 2: 組件層 | 25% | 2 days | 🟡 進行中 |
| Phase 3: 訂單集成 | 0% | 1 day | ⏳ 待開始 |
| Phase 4: 測試 | 50% | 2 days | 🟡 進行中 |
| Phase 5: 文檔 | 0% | 1 day | ⏳ 待開始 |

---

## ✅ 已完成

- [x] 創建功能分支 `feature/consultation-order-conversion-tracking`
- [x] 撰寫功能規劃文檔 (`.claude/plans/feature-consultation-order-conversion.md`)
- [x] 撰寫字段映射文檔 (`.claude/field-mapping-conversion.md`)
- [x] 建立 ConversionMetrics.vue 組件 (500+ 行)
- [x] 建立 ConversionMetrics.spec.ts 測試 (380+ 行，10+ 測試用例)
- [x] 建立 request-conversion.ts API 模組 (250+ 行)
- [x] 建立開發任務清單 (TodoWrite)

---

## 🔄 進行中 (In Progress)

### A. API 層 - request.ts 擴展

**檔案**: `webapp/src/api/request.ts`

**需要的修改**:
```typescript
// 1. 在原有方法中擴展 $select 字段
export async function listRequests(filter?: string): Promise<any[]> {
  const params: Record<string, string> = {
    '$select': 'R_Request_ID,Summary,R_Status_ID,C_BPartner_ID,Created,Processed,LastResult,Description', // ← 添加 Description
    // ... 其他字段
  }
}

// 2. 類似地擴展 getRequest() 等方法
```

**狀態**: ⏳ 待開始

---

## ⏳ 待開始 (Todo)

### Phase 2A: 重構 ConsultationDashboardView.vue

**檔案**: `webapp/src/views/consultation/ConsultationDashboardView.vue`

**變更量**: 124 → 400+ 行

**主要改動**:
```vue
<template>
  <!-- 1. 移除舊的統計邏輯 -->
  <!-- 2. 使用 ConversionMetrics 組件 -->
  <ConversionMetrics
    :requests="allRequests"
    :operatorNames="operatorNames"
    :dateFrom="dateRange.from"
    :dateTo="dateRange.to"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ConversionMetrics from '@/components/ConversionMetrics.vue'
import { listRequests } from '@/api/request'

const allRequests = ref([])
const operatorNames = ref({})
const dateRange = ref({
  from: new Date(Date.now() - 90*24*60*60*1000).toISOString(),
  to: new Date().toISOString(),
})

async function loadData() {
  // 查詢諮詢 + 獲取用戶名稱
  allRequests.value = await listRequests()
  // TODO: 加載操作人名稱（需要 AD_User 查詢）
}

onMounted(() => {
  loadData()
})
</script>
```

**檢查清單**:
- [ ] 移除舊的統計計算代碼
- [ ] 導入 ConversionMetrics 組件
- [ ] 綁定 :requests, :operatorNames props
- [ ] 添加日期範圍篩選
- [ ] 添加分頁/載入狀態

---

### Phase 2B: 修改 RequestFormView.vue

**檔案**: `webapp/src/views/consultation/RequestFormView.vue`

**變更量**: +30 ~ +50 行

**主要改動**:
```vue
<!-- 快速操作欄添加新按鈕 -->
<div class="quick-actions">
  <button @click="onRecordPhoneCall">📞 記錄打電話</button>
  <button @click="onSendMessage">💬 發訊息</button>
  <button @click="onUpdateStatus">📋 更新狀態</button>
  <button @click="onSetTrackingDate">📅 預約追蹤</button>
  <!-- 新增按鈕 -->
  <button @click="onCreateOrder" class="highlight">✏️ 建立訂單</button>
</div>

<script setup>
async function onCreateOrder() {
  // 1. 驗證客戶已選擇
  // 2. 跳轉到訂單建立頁面 (帶入 C_BPartner_ID)
  // 3. 訂單建立成功後，回調更新諮詢
  router.push({
    name: 'order-create',
    params: { customerId: currentRequest.value.C_BPartner_ID },
    query: { relatedConsultationId: currentRequest.value.R_Request_ID }
  })
}
</script>
```

**檢查清單**:
- [ ] 添加"建立訂單"按鈕
- [ ] 實現按鈕點擊邏輯
- [ ] 跳轉到訂單頁面，帶入客戶 ID
- [ ] 檢查權限（只有特定角色可建立訂單）

---

### Phase 2C: 修改 RequestListView.vue

**檔案**: `webapp/src/views/consultation/RequestListView.vue`

**變更量**: +15 ~ +25 行

**主要改動**:
```vue
<!-- 列表中添加轉化狀態列 -->
<table>
  <thead>
    <tr>
      <th>諮詢號</th>
      <th>客戶名稱</th>
      <th>狀態</th>
      <!-- 新增列 -->
      <th>轉化狀態</th>
      <th>訂單號</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="req in requests">
      <td>{{ req.DocumentNo }}</td>
      <td>{{ req.C_BPartner_ID?.Name }}</td>
      <td><StatusBadge :status="req.R_Status_ID" /></td>
      <!-- 新增單元格 -->
      <td>
        <ConversionStatusBadge
          :converted="isConverted(req)"
          :orderId="getOrderId(req)"
        />
      </td>
      <td>{{ getOrderNo(req) || '-' }}</td>
    </tr>
  </tbody>
</table>

<script>
function isConverted(req) {
  const activities = JSON.parse(req.Description || '[]')
  return activities.some(a => a.actionType === 'ConversionOrder')
}

function getOrderId(req) {
  const activities = JSON.parse(req.Description || '[]')
  const conv = activities.find(a => a.actionType === 'ConversionOrder')
  return conv?.linkedOrderId
}
</script>
```

**檢查清單**:
- [ ] 添加轉化狀態列
- [ ] 實現狀態判斷邏輯
- [ ] 添加訂單號列
- [ ] 添加快速篩選："已轉化" / "待轉化"

---

### Phase 3: 訂單建立成功回調

**檔案**: `webapp/src/views/order/OrderFormView.vue`

**變更量**: +20 ~ +30 行

**主要邏輯**:
```typescript
async function onOrderCreateSuccess(newOrderId: number) {
  // 1. 檢查是否來自咨詢
  const relatedConsultationId = route.query.relatedConsultationId
  if (!relatedConsultationId) return // 非來自咨詢，直接返回

  // 2. 獲取訂單號
  const order = await getOrder(newOrderId)

  // 3. 在咨詢中記錄轉化活動
  await recordConversionOrder(
    Number(relatedConsultationId),
    newOrderId,
    order.DocumentNo,
    currentUserId,
    `轉化為訂單 #${order.DocumentNo}，客戶已確認方案`
  )

  // 4. 提示用戶
  toast.success(`訂單 #${order.DocumentNo} 已建立，相關諮詢已更新`)

  // 5. 可選：返回咨詢頁面
  router.push({
    name: 'consultation-detail',
    params: { id: relatedConsultationId }
  })
}
```

**檢查清單**:
- [ ] 導入 recordConversionOrder()
- [ ] 在訂單建立成功時調用回調
- [ ] 驗證活動記錄成功
- [ ] 添加錯誤處理和重試邏輯

---

## 🧪 測試進度

| 測試類型 | 覆蓋率 | 狀態 |
|---------|--------|------|
| ConversionMetrics.spec.ts | 100% | ✅ 10/10 測試通過 |
| request-conversion.spec.ts | 0% | ⏳ 待開始 |
| RequestFormView.spec.ts | 0% | ⏳ 待開始 |
| 集成測試 (Consultation → Order) | 0% | ⏳ 待開始 |
| e2e 測試 | 0% | ⏳ 待開始 |

### 運行測試命令

```bash
# 單獨運行 ConversionMetrics 測試
npm test -- src/components/__tests__/ConversionMetrics.spec.ts --run

# 運行所有測試
npm test

# 監視模式
npm test -- --watch
```

---

## 📊 預期成果

### 完成後能做的事

1. ✅ **看到轉化率**: 仪表板显示 "66.7%" 转化率
2. ✅ **按操作人排名**: 表格显示谁转化了多少订单
3. ✅ **追踪平均转化时间**: 平均 4.3 天从咨询到订单
4. ✅ **一鍵建立訂單**: 在諮詢詳情頁點擊"建立訂單"快速創建
5. ✅ **自動記錄轉化**: 訂單成功後，自動在諮詢活動中添加記錄
6. ✅ **待轉化告警**: 識別超過 7 天未轉化的諮詢

---

## 🚀 下一步行動

**立即開始**:

```bash
# 確認在正確分支
git branch -v
# 應該看到: * feature/consultation-order-conversion-tracking

# 運行現有測試，確保環境正常
npm test -- src/components/__tests__/ConversionMetrics.spec.ts --run

# 檢查 API 層的現有狀態
grep -n "Description" webapp/src/api/request.ts
```

**今天的目標** (Day 1):
1. ✅ 完成 Phase 1A: 擴展 request.ts (新增 Description 字段)
2. ✅ 完成 Phase 1B: 撰寫 request-conversion.spec.ts 測試
3. ⏳ 開始 Phase 2A: 重構 ConsultationDashboardView.vue

---

## 📝 文檔清單

已建立的文檔:
- ✅ `.claude/plans/feature-consultation-order-conversion.md` - 功能規劃 (300+ 行)
- ✅ `.claude/field-mapping-conversion.md` - 字段映射 (400+ 行)
- ✅ `.claude/development-checklist.md` - 本文件
- ✅ `webapp/src/components/ConversionMetrics.vue` - 組件 (300+ 行)
- ✅ `webapp/src/components/__tests__/ConversionMetrics.spec.ts` - 測試 (380+ 行)
- ✅ `webapp/src/api/request-conversion.ts` - API 模組 (250+ 行)

待建立:
- ⏳ `webapp/src/api/__tests__/request-conversion.spec.ts` - API 測試
- ⏳ `webapp/src/views/consultation/__tests__/ConsultationDashboardView.spec.ts`
- ⏳ 更新 `CLAUDE.md`
- ⏳ 更新 `CONSULTATION_MODULE.md`
- ⏳ 最終測試報告

---

## 🔗 相關連結

- **當前分支**: `feature/consultation-order-conversion-tracking`
- **計劃文檔**: `.claude/plans/feature-consultation-order-conversion.md`
- **字段映射**: `.claude/field-mapping-conversion.md`
- **原始需求**: MEMORY.md 中的 SimpleEC OMS 章節

---

**最後更新**: 2026-02-26 15:30
**下次更新**: 每個 Phase 完成後
