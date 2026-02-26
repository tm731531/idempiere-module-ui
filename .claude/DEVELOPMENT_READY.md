# 諮詢轉訂單追蹤系統 - 開發環境就緒

**日期**: 2026-02-26 11:45 GMT+8
**分支**: `feature/consultation-order-conversion-tracking`
**狀態**: ✅ 開發環境已就緒，可開始實現

---

## 🎯 項目概述

**目標**: 實現完整的諮詢 → 訂單轉化追蹤系統，包括：
- ✅ 轉化率計算 (咨詢→訂單)
- ✅ 按操作人績效統計
- ✅ 自動記錄轉化活動到諮詢時間軸
- ✅ 儀表板即時更新

**業務定義**:
- **績效評分**: 按「操作人」(createdBy) 統計
- **轉化定義**: 咨詢最終轉化為「訂單」（有訂單才算真正的轉化）

---

## ✅ 已完成的工作

### 1. 環境與規劃
- ✅ 創建功能分支 `feature/consultation-order-conversion-tracking`
- ✅ 撰寫完整的功能規劃文檔 (3 份共 1,000+ 行)
- ✅ 建立字段映射和 API 文檔
- ✅ 開發進度檢查清單

### 2. 核心組件實現
- ✅ **ConversionMetrics.vue** (300+ 行)
  - 轉化率卡片
  - 操作人績效排名表
  - 平均轉化時間
  - 待轉化諮詢統計

### 3. 測試框架
- ✅ **ConversionMetrics.spec.ts** (16 個測試全通過)
  - 轉化率計算 (4 個測試)
  - 平均時間計算 (2 個測試)
  - 待轉化統計 (2 個測試)
  - 績效統計 (4 個測試)
  - 動態更新 (2 個測試)
  - 邊界情況 (2 個測試)

### 4. API 模組
- ✅ **request-conversion.ts** (250+ 行)
  - `listConvertedRequests()` - 查詢已轉化諮詢
  - `appendActivityToRequest()` - 添加活動記錄
  - `recordConversionOrder()` - 記錄訂單轉化
  - `getRequestConversionStatus()` - 查詢轉化狀態
  - `calculateConversionStats()` - 批量統計

---

## 📂 開發結構

```
idempiere-module-ui/
├── .claude/
│   ├── plans/
│   │   └── feature-consultation-order-conversion.md        [功能規劃]
│   ├── field-mapping-conversion.md                         [字段映射]
│   ├── development-checklist.md                            [進度檢查表]
│   └── DEVELOPMENT_READY.md                                [本文件]
│
└── webapp/
    └── src/
        ├── api/
        │   ├── request-conversion.ts                        [新建：API 模組]
        │   ├── request.ts                                   [待修改：擴展 $select]
        │   └── __tests__/
        │       └── request-conversion.spec.ts               [待新建：API 測試]
        │
        ├── components/
        │   ├── ConversionMetrics.vue                       [新建：組件]
        │   └── __tests__/
        │       └── ConversionMetrics.spec.ts               [✅ 完成：16/16 通過]
        │
        └── views/
            └── consultation/
                ├── ConsultationDashboardView.vue           [待修改：使用組件]
                ├── RequestFormView.vue                      [待修改：建立訂單按鈕]
                ├── RequestListView.vue                      [待修改：轉化狀態列]
                └── __tests__/
                    ├── ConsultationDashboardView.spec.ts   [待新建]
                    └── RequestFormView.spec.ts             [待新建]
```

---

## 🚀 快速開始

### 1. 確認環境

```bash
# 確認分支正確
git branch -v
# 應該看到: * feature/consultation-order-conversion-tracking

# 確認沒有未提交改動
git status
# 應該看到: nothing to commit, working tree clean
```

### 2. 驗證測試框架正常運作

```bash
cd /home/tom/idempiere-module-ui/webapp

# 運行現有測試（應全部通過）
npm test -- src/components/__tests__/ConversionMetrics.spec.ts --run

# 預期結果:
# ✓ Test Files  1 passed (1)
# ✓ Tests      16 passed (16)
```

### 3. 查看規劃文檔

```bash
# 查看本次開發的完整規劃
cat .claude/plans/feature-consultation-order-conversion.md

# 查看字段映射和 API 定義
cat .claude/field-mapping-conversion.md

# 查看進度檢查表
cat .claude/development-checklist.md
```

---

## 📋 實現順序（推薦）

### **Phase 1: API 層修改** (1 day)

#### Step 1A: 擴展 request.ts
```bash
# 檔案: webapp/src/api/request.ts
# 修改: 在 listRequests() 和 getRequest() 中添加 Description 字段
# 範例:
#   '$select': '...,Description'  // 添加此欄位
```

**检查清单**:
- [ ] 在 `listRequests()` 的 $select 中加入 `Description`
- [ ] 在 `getRequest()` 的 $select 中加入 `Description`
- [ ] 運行測試確保不破壞現有功能
- [ ] 提交: `git commit -m "api: extend request.ts to include Description field"`

#### Step 1B: 撰寫 API 單元測試
```bash
# 新建: webapp/src/api/__tests__/request-conversion.spec.ts
# 測試 request-conversion.ts 中的 6 個方法
# 預期: ~15 個測試用例
```

**检查清单**:
- [ ] 新建 request-conversion.spec.ts
- [ ] 測試 listConvertedRequests()
- [ ] 測試 appendActivityToRequest()
- [ ] 測試 recordConversionOrder()
- [ ] 測試 calculateConversionStats()
- [ ] 運行測試: `npm test -- src/api/__tests__/request-conversion.spec.ts --run`

---

### **Phase 2: 組件層實現** (2 days)

#### Step 2A: 重構 ConsultationDashboardView.vue
```bash
# 檔案: webapp/src/views/consultation/ConsultationDashboardView.vue
# 改變: 124 → 400+ 行
# 新增:
#   - 導入 ConversionMetrics 組件
#   - 移除舊的統計計算代碼
#   - 添加日期範圍篩選
#   - 綁定 operatorNames prop（需要查詢用戶名稱）
```

**参考代码**:
```vue
<template>
  <ConversionMetrics
    :requests="allRequests"
    :operatorNames="operatorNames"
    :dateFrom="dateRange.from"
    :dateTo="dateRange.to"
  />
</template>

<script setup>
import ConversionMetrics from '@/components/ConversionMetrics.vue'
import { listRequests } from '@/api/request'

const allRequests = ref([])
const operatorNames = ref({})

async function loadData() {
  allRequests.value = await listRequests()
  // TODO: 加載 AD_User 名稱，填充 operatorNames
}

onMounted(() => loadData())
</script>
```

**检查清单**:
- [ ] 移除舊統計代碼
- [ ] 導入並使用 ConversionMetrics 組件
- [ ] 實現日期範圍篩選
- [ ] 查詢並填充 operatorNames（考慮用 AD_User API）
- [ ] 運行測試: `npm test -- src/views/consultation/__tests__/ConsultationDashboardView.spec.ts --run`

#### Step 2B: 修改 RequestFormView.vue
```bash
# 檔案: webapp/src/views/consultation/RequestFormView.vue
# 新增: 「建立訂單」快速操作按鈕
# 行數: +30 ~ +50
```

**参考代码**:
```vue
<button @click="onCreateOrder" class="btn-primary">
  ✏️ 建立訂單
</button>

<script>
async function onCreateOrder() {
  if (!currentRequest.value.C_BPartner_ID) {
    toast.error('請先選擇客戶')
    return
  }

  // 跳轉到訂單建立頁，帶入客戶和諮詢 ID
  router.push({
    name: 'order-create',
    params: { customerId: currentRequest.value.C_BPartner_ID },
    query: { relatedConsultationId: currentRequest.value.R_Request_ID }
  })
}
</script>
```

**检查清单**:
- [ ] 添加「建立訂單」按鈕到快速操作欄
- [ ] 驗證客戶已選擇
- [ ] 跳轉邏輯正確（帶入必要參數）
- [ ] 提交: `git commit -m "feat: add create-order button to request form"`

#### Step 2C: 修改 RequestListView.vue
```bash
# 檔案: webapp/src/views/consultation/RequestListView.vue
# 新增: 轉化狀態列 + 訂單號列
# 行數: +15 ~ +25
```

**参考代码**:
```vue
<table>
  <thead>
    <tr>
      <th>諮詢號</th>
      <th>客戶名稱</th>
      <th>狀態</th>
      <th>轉化狀態</th>  <!-- 新增 -->
      <th>訂單號</th>    <!-- 新增 -->
    </tr>
  </thead>
  <tbody>
    <tr v-for="req in requests">
      ...
      <td>
        <span v-if="isConverted(req)" class="badge-success">已轉化</span>
        <span v-else class="badge-warning">待轉化</span>
      </td>
      <td>{{ getOrderNo(req) || '-' }}</td>
    </tr>
  </tbody>
</table>
```

**检查清单**:
- [ ] 添加轉化狀態列
- [ ] 添加訂單號列
- [ ] 實現 isConverted() 和 getOrderNo() 邏輯
- [ ] 可選：添加篩選按鈕（只顯示已轉化/待轉化）

---

### **Phase 3: 訂單流程集成** (1 day)

#### Step 3A: 修改訂單建立流程
```bash
# 檔案: webapp/src/views/order/OrderFormView.vue
# 新增: 訂單建立成功回調
# 邏輯: 自動記錄轉化活動到相關諮詢
```

**参考代码**:
```typescript
import { recordConversionOrder } from '@/api/request-conversion'

async function onOrderCreateSuccess(newOrderId: number) {
  // 檢查是否來自諮詢
  const consultationId = route.query.relatedConsultationId
  if (!consultationId) return

  try {
    // 獲取訂單信息
    const order = await getOrder(newOrderId)

    // 在諮詢中記錄轉化
    await recordConversionOrder(
      Number(consultationId),
      newOrderId,
      order.DocumentNo,
      currentUserId,
      `轉化為訂單 #${order.DocumentNo}`
    )

    // 提示用戶
    toast.success(`訂單 #${order.DocumentNo} 已建立，相關諮詢已更新`)
  } catch (error) {
    console.error('記錄轉化失敗:', error)
    // 訂單已建立，只是記錄失敗，不影響主流程
    toast.warn('訂單已建立，但諮詢更新失敗（可手動補記）')
  }
}
```

**检查清单**:
- [ ] 導入 recordConversionOrder()
- [ ] 在訂單建立成功後調用回調
- [ ] 驗證活動正確記錄（檢查諮詢的 Description JSON）
- [ ] 添加錯誤處理

---

### **Phase 4: 測試與驗證** (2 days)

#### Step 4A: 單元測試
```bash
# 運行所有單元測試
npm test -- run

# 預期通過率: 100%
```

#### Step 4B: 集成測試
```bash
# 手動測試: 完整流程
# 1. 建立諮詢 → R_Request_ID = 5000
# 2. 記錄活動（打電話、訊息等）
# 3. 點擊「建立訂單」按鈕
# 4. 在訂單頁輸入商品、金額等
# 5. 點擊「完成」建立訂單
# 6. 驗證：
#    - 訂單建立成功
#    - 諮詢 5000 的 Description 中有「轉化訂單」活動
#    - 儀表板轉化率從 0% → 50% (或其他比例)
```

#### Step 4C: 數據驗證
```bash
# 檢查 ConversionMetrics 的計算準確性
# 1. 查詢 R_Request 表
# 2. 手動計算轉化率
# 3. 與儀表板對比
# 4. 檢查績效排名是否正確
```

---

### **Phase 5: 文檔與部署** (1 day)

#### Step 5A: 更新文檔
```bash
# 1. 更新 CLAUDE.md
#    - 添加 ConversionMetrics.vue 組件說明
#    - 添加 request-conversion.ts API 說明

# 2. 更新 CONSULTATION_MODULE.md
#    - 添加轉化追蹤功能說明
#    - 更新儀表板部分

# 3. 生成測試報告
#    npm test -- run > test-report.txt
```

#### Step 5B: 代碼審查準備
```bash
# 清理分支
git status  # 確認無未提交改動

# 檢查提交歷史
git log --oneline feature/consultation-order-conversion-tracking ^main

# 準備 PR
# 標題: "feat: implement consultation-to-order conversion tracking"
# 描述: 參考 .claude/plans/feature-consultation-order-conversion.md
```

---

## 🔧 有用的命令

### 開發過程中

```bash
# 確認在正確分支
git branch -v

# 檢查文件改動
git status

# 運行單個測試
npm test -- src/components/__tests__/ConversionMetrics.spec.ts --run

# 運行所有測試
npm test

# 監視模式（自動重新運行）
npm test -- --watch

# 查看提交歷史
git log --oneline -10

# 對比改動
git diff --stat
```

### 完成 Phase 後

```bash
# 提交工作
git add <files>
git commit -m "feat/fix: description"

# 查看分支狀態
git log --oneline feature/consultation-order-conversion-tracking ^main
```

---

## 📊 預期交付物

完成本項目後將有：

1. ✅ **新組件**: ConversionMetrics.vue (300+ 行，完全測試覆蓋)
2. ✅ **新 API**: request-conversion.ts (250+ 行，6 個方法)
3. ✅ **修改組件**:
   - ConsultationDashboardView.vue (重構，使用新組件)
   - RequestFormView.vue (新增建立訂單按鈕)
   - RequestListView.vue (新增轉化狀態列)
4. ✅ **測試**: 40+ 個單元測試 + 集成測試
5. ✅ **文檔**: 完整的開發文檔和 API 說明

---

## ⚠️ 注意事項

1. **不擴展表結構**: 所有新功能都通過現有字段實現（主要用 R_Request.Description）
2. **向後相容**: 現有的諮詢數據不會受影響
3. **性能考慮**: JSON 活動列表預期 < 50KB/咨詢，前端負責解析
4. **權限控制**: 仪表板/績效排名可能需要限制訪問（Manager+）
5. **時區**: 所有時間戳使用 UTC，iDempiere 自動轉換

---

## 🎓 學習資源

在 `.claude/` 目錄中找到：
- `plans/feature-consultation-order-conversion.md` - 完整功能規劃
- `field-mapping-conversion.md` - 字段映射和 API 文檔
- `development-checklist.md` - 逐步實現檢查表

---

## ✉️ 聯繫與支持

**當前分支**: `feature/consultation-order-conversion-tracking`
**主要文件**: `.claude/development-checklist.md`
**測試狀態**: ✅ 16/16 測試通過

有任何問題或需要澄清，請參考相關文檔或聯繫開發團隊。

---

**開發就緒時間**: 2026-02-26 11:45 GMT+8
**下一步**: 開始 Phase 1A - 擴展 request.ts API
