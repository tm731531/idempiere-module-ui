# Lessons Learned - Appointment Copy Feature

## 1. DateTime Double Conversion Bug (2026-02-19)

### Problem
複製預約時時間出現 8 小時偏移（例如 8am 變成 4pm），初期錯誤歸咎於 Jetty WAB 緩存問題。

### Root Cause
**API 層 (`assignment.ts`) 中的二次日期轉換**

```typescript
// ❌ 錯誤做法 - 被修正
export async function createAssignment(data: AssignmentData): Promise<any> {
  const payload = {
    ...data,
    AssignDateFrom: toIdempiereDateTime(new Date(data.AssignDateFrom)),  // 第二次轉換！
    AssignDateTo: toIdempiereDateTime(new Date(data.AssignDateTo)),
  }
}
```

**轉換流程問題：**
1. UI 層（CopyDialog）已用 `toIdempiereDateTime()` 產生 `"2026-02-19T08:00:00Z"`（fake-Z 格式）
2. 傳給 `createAssignment()` 後又做 `new Date("2026-02-19T08:00:00Z")`
3. JavaScript 解析 Z 後綴為**真正的 UTC**（不是 fake-Z）
4. 08:00 UTC = 00:00 本地（UTC+8）
5. 再呼叫 `toIdempiereDateTime()` 轉換 00:00 → `"2026-02-19T00:00:00Z"`
6. **結果**：時間向後移 8 小時 ❌

### Solution
移除 API 層的轉換。**調用方負責正確格式化**：

```typescript
// ✅ 正確做法
export async function createAssignment(data: AssignmentData): Promise<any> {
  // AssignDateFrom/To should already be in iDempiere format (fake-Z format)
  // from the caller (CopyDialog uses toIdempiereDateTime already)
  const resp = await apiClient.post('/api/v1/models/S_ResourceAssignment', data)
  return resp.data
}
```

**確保所有調用方都正確格式化：**
- ✅ `CopyAssignmentDialog.vue`: 直接用 `toIdempiereDateTime()`
- ✅ `AppointmentForm.vue`: 直接用 `toIdempiereDateTime()`

### Key Lessons

1. **不要怪基礎設施（緩存、伺服器）**
   - 當功能不工作時，先檢查自己的程式邏輯
   - 反覆清除緩存仍無效 = 問題在代碼
   - 用戶說「你這樣很不負責任」時要認真反思

2. **日期轉換時的多層陷阱**
   - 當數據在多個層級轉換時，確保每層的假設一致
   - `parseIdempiereDateTime()` 返回**本地時間 Date 物件**
   - `toIdempiereDateTime()` 將本地 Date 格式化為 fake-Z 字符串
   - 不要在中間插入額外的 `new Date()` 轉換！

3. **規律性偏移 = 時區問題**
   - 總是 8 小時偏移（GMT+8）不是巧合
   - 立即檢查日期轉換邏輯中的時區處理
   - 不要先怪 Jetty、不要先怪 API

### Testing
```bash
# 測試方法：複製預約到不同日期
1. 選擇 18 號 8:00-9:00 的預約
2. 複製到 19 號
3. 確認複製後的時間仍是 8:00-9:00（不是 4:00-5:00）
```

### Files Changed
- `src/api/assignment.ts`: 移除 `createAssignment()` 中的二次轉換
- `src/components/CopyAssignmentDialog.vue`: 確保正確使用 `toIdempiereDateTime()`
- `src/views/appointment/AppointmentForm.vue`: 確保正確使用 `toIdempiereDateTime()`

---

## Prevention Checklist

### 未來項目中的日期轉換
- [ ] 明確定義每層的日期格式
  - UI → API: 使用 iDempiere fake-Z 格式
  - API → 伺服器: 確認期望的格式
- [ ] **不要在轉換流程中重複使用 `new Date(dateString)`**
- [ ] 編寫單元測試驗證時間準確性
- [ ] 在 code review 時特別檢查日期相關代碼

### 除錯流程改進
1. **不要立即怪基礎設施**（緩存、伺服器、網絡）
2. **先檢查邏輯**（數據轉換、類型轉換、狀態管理）
3. **加入詳細日誌**（但要給使用者看友善的訊息，不要技術代碼）
4. **用戶反饋很重要**（「還是四點」、「你這樣很不負責任」都是線索）
