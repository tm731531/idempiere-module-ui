# 檢查小組 A — 預約系統破壞性測試報告

**測試時間**: 2026-04-18  
**測試帳號**: renewAdmin  
**系統**: https://medicare.tomting.com/aesthetics/#/  
**API Base**: https://medicare.tomting.com/api/v1  
**測試者**: Inspector A (Automated QA Bot)

---

## 總結: 6/14 項目發現問題

| 嚴重程度 | 數量 |
|---------|------|
| 🔴 Critical (嚴重) | 3 |
| 🟡 Medium (中等) | 2 |
| 🟢 PASS (通過) | 9 |

---

## 🔴 嚴重問題 (Severity: Critical)

### BUG-A001: 時段衝突：後端完全沒有防護
**測試項目**: A-005（同時段同服務人員衝突）+ A-009（並行提交）

**問題**: `S_ResourceAssignment` 後端 API 對同一服務人員的時段衝突完全沒有驗證。

**實測證據**:

1. **A-005 同時段雙重預約**:
   - 第一筆：`王醫師 2026-04-27 11:00-12:00` → HTTP 201, id=1000123 ✅
   - 第二筆：`王醫師 2026-04-27 11:00-12:00（完全相同）` → HTTP 201, id=1000124 ✅
   - **結論**: 後端接受了完全相同的時段，可造成一名醫師同時服務兩位客人

2. **A-005 UI 假 PASS**:
   - UI modal 在儲存第二筆後確實關閉，看似成功，但：
   - API 驗證：2026-04-30 日同一時段 id=1000134（A005-衝突測試1）和 id=1000135（A005-衝突測試2）**同時存在於資料庫**
   - **UI 沒有顯示任何錯誤，但實際已建立衝突記錄**

3. **A-009 並行提交（5並行 API 請求）**:
   - 5個同時發出的 POST 請求全數回應 HTTP 201
   - 建立了 5筆完全相同的預約（ids: 1000127, 1000128, 1000129, 1000130, 1000131）
   - **結論**: API 層無任何防護機制

**影響**: 排班表可能顯示同一醫師在同一時間服務多個客人，實際執行時無從分辨，導致客訴和醫療糾紛風險。

---

### BUG-A002: 後端允許 DateTo < DateFrom（時間倒置）
**測試項目**: A-001

**問題**: API 直接接受結束時間早於開始時間的預約。

**實測**:
```
POST /models/S_ResourceAssignment
{
  "Name": "A001-倒置時間",
  "S_Resource_ID": {"id": 1000016},
  "AssignDateFrom": "2026-04-25T18:00:00Z",
  "AssignDateTo": "2026-04-25T17:00:00Z"   ← 早一小時！
}
→ HTTP 201 Created, id=1000118
```

**注意**: UI 層 (`form-modal`) 有驗證，錯誤訊息「結束時間必須晚於開始時間」可正確攔截。但 API 完全不驗證，繞過 UI 可直接建立非法資料。

**影響**: 若有人直接呼叫 API（Postman、爬蟲、腳本），或 UI 有任何 bug 讓驗證失效，就會建立無意義的時間倒置記錄，行事曆計算可能崩潰。

---

### BUG-A003: 後端允許零長度時間（DateFrom == DateTo）
**測試項目**: A-006

**問題**: API 接受開始時間等於結束時間的預約（零時長）。

**實測**:
```
AssignDateFrom: "2026-04-28T02:00:00Z"
AssignDateTo: "2026-04-28T02:00:00Z"   ← 相同！
→ HTTP 201 Created, id=1000125
```

**注意**: UI modal 有驗證，可攔截（Modal 保持開啟）。但 API 不驗證。

**影響**: 同 BUG-A002，繞過 UI 可建立無意義記錄，影響行事曆顯示。

---

## 🟡 中等問題 (Severity: Medium)

### BUG-A004: 500 字元名稱被靜默截斷至 60 字元（無錯誤訊息）
**測試項目**: A-002

**問題**: 輸入 500 字元的名稱，API 靜默截斷至 60 字元並回傳 HTTP 201，不給任何錯誤或警告。

**實測**:
```
Input name: "AAAA...AAA" (500 chars)
→ HTTP 201 Created
→ Saved Name: "AAAA...AAA" (60 chars only!)
```

**結論**: 資料庫欄位 `name` 是 `VARCHAR(60)`。後端直接截斷而非報錯，使用者會以為名稱完整儲存，實際資料已遺失。

**預期行為**: 超過欄位長度應回傳 400 錯誤，或明確提示最大長度。

---

### BUG-A005: 預約詳細頁面（/appointment/:id）完全未實作
**測試項目**: A-007

**問題**: 直接導航到任何預約 ID（包含真實存在的 ID）都顯示「此頁面尚未實作」佔位頁面。

**測試 1**: `/appointment/99999999` → 顯示 "此頁面尚未實作"  
**測試 2**: `/appointment/1000116`（真實存在的預約）→ 顯示 "此頁面尚未實作"

**影響**:
- 所有預約操作（查看/編輯/刪除）只能透過行事曆 Modal
- 無法分享或書籤特定預約連結
- 無法從其他頁面直接跳轉到特定預約

---

## 🟢 通過 (OK)

### A-001: UI 驗證倒置時間
- UI Modal 顯示「結束時間必須晚於開始時間」錯誤訊息，正確攔截
- **截圖**: /tmp/inspector_A/A001_ui_reversed.png

### A-003: UI 驗證空白名稱
- 送出空白名稱時 Modal 保持開啟，顯示驗證錯誤
- 後端也有資料庫層防護（NOT NULL constraint）

### A-004: XSS/SQL Injection 安全
- XSS payload `<script>alert('XSS')</script>` 儲存至資料庫後，Vue 模板自動 escape HTML，未觸發 alert
- SQL Injection `'; DROP TABLE appointments; --` 被 ORM 防護，資料庫正常
- **但注意**: 後端仍接受這些字串（不拒絕），只是 Vue 前端安全地顯示

### A-006: UI 驗證零長度時間
- Modal 保持開啟，有驗證攔截

### A-008: 瀏覽器返回鍵
- 行事曆頁面是 Modal 模式，不走路由跳轉
- 無法測試「填寫到一半按返回」的情境（因為 form 是 Modal，返回鍵不觸發離頁）
- 這是設計選擇，非 Bug

### A-010a: API 拒絕無服務人員
- 後端正確以資料庫 NOT NULL constraint 拒絕
- 錯誤: `null value in column "s_resource_id" violates not-null constraint`

### A-010c: API 拒絕不存在的外鍵 ID
- `S_Resource_ID=99999999` → HTTP 500: `Foreign ID 99999999 not found in S_Resource_ID`

### A-011: 重複刪除
- 第一次刪除: HTTP 200 {"msg":"Deleted"}
- 第二次刪除: HTTP 404 {"title":"Record not found"}
- 正確行為

### A-012: 月視圖/週視圖/日視圖/年視圖
- 四種視圖切換均正常
- 月視圖、週視圖、日視圖、年視圖都能顯示內容，無崩潰
- **截圖**: /tmp/inspector_A/A012_month_view.png, A012_week_view.png

### A-013: 服務人員 Chip 全部取消
- 提供「取消全選」按鈕，一鍵取消所有服務人員
- 取消後行事曆顯示空白（正確行為），無崩潰

---

## 詳細測試記錄

### A-001: 結束時間早於開始時間
- **預期**: API 應拒絕 DateTo < DateFrom；UI 應顯示錯誤
- **實際**:
  - API: 接受（HTTP 201），id=1000118（已清除）
  - UI: 正確拒絕，顯示「結束時間必須晚於開始時間」
- **結論**: API FAIL（嚴重），UI PASS
- **截圖**: /tmp/inspector_A/A001_ui_reversed.png

### A-002: 超長名稱（500字元）
- **預期**: 應有明確錯誤訊息或截斷提示
- **實際**: HTTP 201，名稱被靜默截斷至 60 字元，無任何警告
- **結論**: WARNING — 靜默截斷是使用者體驗問題
- **截圖**: (API test, no UI screenshot)

### A-003: 空白名稱
- **預期**: 應拒絕空白名稱
- **實際**:
  - API: HTTP 500，資料庫 NOT NULL 錯誤（粗暴但有效）
  - UI: 正確驗證，Modal 保持開啟
- **結論**: PASS（雖然錯誤訊息不友善）

### A-004: XSS/SQL Injection
- **預期**: 安全儲存，前端不執行惡意程式碼
- **實際**:
  - 後端：接受並儲存原始字串（不過濾）
  - 前端：Vue 自動 escape，XSS 未執行（`window.__xss_fired = false`）
- **結論**: PASS（前端安全），但後端無 input sanitization（可接受，因為 Vue 防護了前端）

### A-005: 同時段同服務人員衝突
- **預期**: 第二個衝突預約應被拒絕
- **實際**:
  - API: 兩筆都 HTTP 201 成功（id=1000123, 1000124），FAIL
  - UI: Modal 看似關閉成功，但實際建立了 2 筆衝突記錄（id=1000134, 1000135），UI 無任何錯誤提示，FAIL
- **結論**: FAIL — 嚴重！系統允許雙重預約
- **截圖**: /tmp/inspector_A/A005_ui_after_second.png

### A-006: 零長度時間（DateFrom == DateTo）
- **預期**: 應拒絕無意義的零時長預約
- **實際**:
  - API: HTTP 201 接受（id=1000125，已清除），FAIL
  - UI: Modal 保持開啟，有驗證，PASS
- **結論**: API FAIL，UI PASS

### A-007: 導航到不存在的預約 URL
- **預期**: 404 頁面或友善錯誤訊息
- **實際**: 顯示「此頁面尚未實作」佔位頁面（不管是存在還是不存在的 ID 都如此）
- **結論**: MEDIUM — 預約詳細頁面完全未實作
- **截圖**: /tmp/inspector_A/A007_nonexistent_appt.png

### A-008: 瀏覽器返回鍵測試
- **預期**: 返回鍵不應留下殘留資料
- **實際**: 行事曆預約是 Modal 模式，不使用路由跳轉；返回鍵從行事曆頁離開，無殘留問題
- **結論**: PASS（Modal 設計迴避了此問題）

### A-009: 快速連點儲存（重複提交）
- **UI**: Modal 送出後 Modal 元件消失，按鈕從 DOM 移除，後續點擊無效
- **API（並行）**: 5個並行 POST 全數成功，建立 5 筆相同記錄
- **結論**: UI PASS（防護有效），API FAIL（無法防止並行重複提交）
- **截圖**: /tmp/inspector_A/A009_rapid_submit.png

### A-010: API 直接建立非法預約
- a) 倒置時間：HTTP 201 接受 → FAIL
- b) 無 S_Resource_ID：HTTP 500（DB NOT NULL）→ PASS
- c) 不存在的 S_Resource_ID=99999999：HTTP 500 → PASS

### A-011: 刪除後立即再次刪除
- **實際**: 第一次 HTTP 200，第二次 HTTP 404
- **結論**: PASS

### A-012: 月視圖/週視圖顯示
- 日/週/月/年 四種視圖均正常切換
- **結論**: PASS
- **截圖**: /tmp/inspector_A/A012_month_view.png, A012_week_view.png, A012_day_view.png

### A-013: 服務人員 Chip 全部取消
- 3 個服務人員 Chip 均可個別取消，也有「取消全選」一鍵操作
- 取消後行事曆正常顯示空白，無崩潰
- **結論**: PASS
- **截圖**: /tmp/inspector_A/A013_all_deselected.png

### A-014: 非工作時間時槽
- **實際**: API 接受午夜 00:00-00:30 的預約（HTTP 201）
- **結論**: 系統無工作時間限制，可建立任意時間的預約（包含深夜/凌晨）
- **嚴重程度**: 低（屬設計選擇，非 Bug；但缺乏工作時間限制可能造成混亂）

---

## 附加發現

### 資料庫錯誤訊息外洩
後端在部分錯誤情況直接回傳 PostgreSQL 錯誤訊息：
```json
{
  "title": "Save error",
  "status": 500,
  "detail": "Database Error.: DBExecuteError:ERROR: null value in column \"name\" of relation \"s_resourceassignment\" violates not-null constraint\n  詳細：Failing row contains (...)"
}
```
這將資料表結構、欄位名稱、甚至部分資料列內容暴露給 API 呼叫者。

### API 錯誤一律返回 500
不管是驗證錯誤（應為 400）還是外鍵錯誤（應為 422），後端都回傳 HTTP 500。  
正確做法：業務驗證錯誤應返回 400/422，伺服器錯誤才返回 500。

### 行事曆截圖

- 初始行事曆：/tmp/inspector_A/A012_initial.png
- 月視圖：/tmp/inspector_A/A012_month_view.png
- 週視圖：/tmp/inspector_A/A012_week_view.png
- 日視圖：/tmp/inspector_A/A012_day_view.png
- Chip 取消前：/tmp/inspector_A/A013_before_deselect.png
- Chip 取消後：/tmp/inspector_A/A013_all_deselected.png

---

## 建議修復優先順序

1. **[P0-緊急]** 後端加入時段衝突偵測（`S_ResourceAssignment` 在 INSERT/UPDATE 前驗證同一資源的時段是否重疊）
2. **[P0-緊急]** 後端加入時間順序驗證（`AssignDateTo > AssignDateFrom`）
3. **[P0-緊急]** 後端加入零時長驗證（`AssignDateTo != AssignDateFrom`）
4. **[P1-高]** 超長名稱應回傳 400 而非靜默截斷
5. **[P1-高]** 業務驗證錯誤應返回 400/422 而非 500
6. **[P2-中]** 實作預約詳細頁面（`/appointment/:id`）
7. **[P3-低]** 後端錯誤訊息不應暴露資料庫結構

---

*報告由 Inspector A (Automated QA Bot) 生成*  
*測試時間: 2026-04-18 16:20-16:35 UTC+8*
