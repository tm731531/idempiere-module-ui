# 功能規劃：諮詢轉訂單追蹤系統

**分支**: `feature/consultation-order-conversion-tracking`
**開始日期**: 2026-02-26
**目標**: 實現咨詢 → 訂單轉化追蹤 + 按操作人績效統計

---

## 📊 核心功能設計

### 目標 KPI
- **轉化率**: (有訂單的諮詢數 / 總諮詢數) × 100%
- **績效排名**: 按 createdBy 用戶分組，統計：
  - 此用戶操作的諮詢數
  - 此用戶轉化的訂單數
  - 轉化率及平均響應時間

### 數據流架構
```
咨詢 (R_Request.Description = JSON 活動)
  ↓ [快速操作："建立訂單"]
訂單 (C_Order)
  ↓ [訂單建立成功回調]
自動在咨詢添加活動: { actionType: '轉化訂單', linkedOrderId, createdBy }
  ↓
儀表板統計 & 績效排名
```

---

## 🗂️ 文件修改清單

### A. API 層 (request.ts)
**新增方法**:
- `listConvertedRequests(dateFrom?, dateTo?)` — 查詢所有有訂單轉化的咨詢
- `appendActivityToRequest(requestId, activity)` — 添加活動記錄
- `getRequestConversionStats(requestId)` — 查詢單個咨詢的轉化狀態

**修改方法**:
- `listRequests()` — 擴展 $select 以包含 Description 欄位

### B. 組件層

#### 1. ConsultationDashboardView.vue (124 → 500+ 行)
**新增**:
- 轉化率卡片
- 操作人績效排名表（動態計算）
- 平均轉化時間指標
- 轉化漏斗圖表

**修改**:
- 數據獲取邏輯：從簡單統計 → 複雜活動解析
- 添加日期範圍篩選

#### 2. RequestFormView.vue (776 行)
**新增**:
- 快速操作欄："建立訂單" 按鈕
- 轉化成功的 Toast 提示
- 活動時間軸自動刷新

#### 3. RequestListView.vue (366 行)
**新增**:
- 列表欄位："轉化狀態"（已轉化/待轉化）
- 快速篩選："只看已轉化" / "待轉化"

#### 4. 新建 ConversionMetrics.vue (組件)
**用途**: 可複用的轉化率卡片 + 績效表格
- 接收 `requests` 陣列作為 prop
- 計算並返回轉化統計
- 支援日期範圍篩選

### C. 測試層

#### 1. unit tests
- `request.ts` 單元測試（新方法）
- `ConversionMetrics.spec.ts` （計算邏輯）
- `ConsultationDashboardView.spec.ts` （數據綁定）

#### 2. integration tests
- 咨詢 → 訂單 → 活動更新的完整流程
- 績效統計的準確性驗證

#### 3. e2e tests
- UI 上"建立訂單"按鈕的端到端測試

---

## 🗄️ 數據庫變更

### 無表擴展（符合約束）
- R_Request 表：保持不變，只使用 Description 欄位存活動 JSON
- C_Order 表：保持不變

### 可選優化
- 在 AD_Table 中為 R_Request.Description 添加註解："活動時間軸 JSON，記錄所有咨詢互動"

---

## 📋 字段映射

### Activity JSON 結構（新增欄位）

```typescript
interface RequestActivity {
  timestamp: string              // ISO datetime, e.g., "2026-02-26T14:30:00Z"
  type: 'Activity' | 'StatusChange' | 'Created'
  actionType: string            // e.g., "PhoneCall", "Message", "ConversionOrder"
  content: string               // 活動描述，max 500 chars
  createdBy: number             // AD_User_ID

  // 新增：轉化相關欄位
  linkedOrderId?: number        // C_Order_ID（當 actionType = '轉化訂單'）
  linkedOrderNo?: string        // 訂單號（便於顯示）
}
```

### 活動類型定義

| actionType | 中文 | 何時產生 | createdBy | 備註 |
|-----------|------|--------|---------|------|
| PhoneCall | 來電 | 快速操作：記錄打電話 | 當前用戶 | - |
| Message | 發訊息 | 快速操作：記錄訊息 | 當前用戶 | - |
| StatusChange | 狀態改變 | 更新 R_Status_ID | 當前用戶 | - |
| TrackingDate | 預約追蹤 | 快速操作：設定追蹤日期 | 當前用戶 | - |
| **ConversionOrder** | **轉化訂單** | **訂單建立成功回調** | **訂單建立者** | **新增** |

---

## ✅ 開發檢查清單

### Phase 1: API 層 (Day 1)
- [ ] 修改 request.ts：新增 3 個查詢方法
- [ ] 寫單元測試（request.ts）
- [ ] 測試數據格式（假資料模擬轉化活動）

### Phase 2: 組件層 (Day 2-3)
- [ ] 新建 ConversionMetrics.vue（計算邏輯）
- [ ] 重構 ConsultationDashboardView.vue（轉化率 + 績效表）
- [ ] 修改 RequestFormView.vue（快速操作："建立訂單"）
- [ ] 修改 RequestListView.vue（轉化狀態列）

### Phase 3: 訂單流程集成 (Day 3-4)
- [ ] 修改訂單建立成功回調
- [ ] 自動記錄轉化活動到咨詢
- [ ] 前端 Toast 提示

### Phase 4: 測試 (Day 4-5)
- [ ] 單元測試：ConversionMetrics 計算邏輯
- [ ] 集成測試：咨詢 → 訂單 → 活動更新
- [ ] e2e 測試：UI 完整流程
- [ ] 數據驗證：儀表板數據準確性

### Phase 5: 文檔 & 部署 (Day 5)
- [ ] 更新 CLAUDE.md（新 API + 組件）
- [ ] 更新 CONSULTATION_MODULE.md（新功能說明）
- [ ] 測試報告
- [ ] PR 準備

---

## 🚀 開始命令

```bash
# 確認在新分支
git branch -v

# 建立功能分支的工作目錄結構
mkdir -p webapp/src/components/__tests__
mkdir -p .claude/plans

# 運行測試框架
npm test -- src/components/__tests__/ConversionMetrics.spec.ts --run
npm test -- src/api/__tests__/request.spec.ts --run
```

---

## 📌 關鍵注意事項

1. **向後相容性**: 現有的咨詢必須支援新格式
   - 檢查 `Description` 欄位是否為有效 JSON
   - 若為空或字符串，自動轉換為新格式

2. **性能考慮**: 活動解析發生在前端
   - 每個諮詢 JSON 預期 < 50KB
   - 儀表板只加載最近 90 天的數據

3. **權限控制**: 誰能看到績效排名？
   - 建議：Manager+ 角色可見
   - 自己的績效所有人可見

4. **數據完整性**: 轉化活動必須記錄
   - 訂單建立失敗時，不記錄
   - 確保 linkedOrderId 有效

---

**最後更新**: 2026-02-26
**負責人**: Claude
**審核人**: Tom
