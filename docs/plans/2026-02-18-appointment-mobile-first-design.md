# 預約模組 Mobile First 設計 — Bottom Sheet + 即時衝突反饋

**日期**: 2026-02-18
**目標用戶**: 忙碌的醫生護士（行動裝置優先）
**核心目標**: 提升行動版預約管理體驗，同時保持 Desktop 功能

---

## 1. 問題陳述

### 當前問題
- ❌ **Mobile 無法右鍵** — 右鍵菜單在行動裝置無法使用
- ❌ **拖曳不精確** — 手指在小螢幕上拖曳預約容易誤觸
- ❌ **複製功能缺失** — 重複預約需要手動新增，浪費時間
- ❌ **衝突反饋慢** — 拖曳完放開才知道衝突，已晚

### 目標狀態
- ✅ **Mobile first UI** — 底部 sheet 菜單，標準 mobile pattern
- ✅ **即時衝突警告** — 拖曳時實時紅色視覺反饋
- ✅ **快速複製** — 日期+服務人員選擇後一鍵複製
- ✅ **Desktop 兼容** — 右鍵菜單、拖曳體驗保留

---

## 2. 設計核心

### 2.1 交互模式

#### Mobile 預約操作流程
```
點擊預約區塊
    ↓
[BottomSheet] 滑出（70% 高度）
    ├─ 預約摘要卡片
    │   服務人員：Alice
    │   時間：14:00 - 15:00
    │   名稱：皮膚檢查
    │
    └─ 操作按鈕
        ├─ [編輯] → AppointmentForm modal
        ├─ [複製] → CopyAssignmentDialog（日期選擇器）
        └─ [刪除] → 確認對話框
```

#### Desktop 預約操作流程
```
右鍵點擊預約
    ↓
[Popup Menu] 跟隨滑鼠
    ├─ 編輯
    ├─ 複製
    └─ 刪除

拖曳改時間
    ↓
實時檢查衝突
    ├─ 無衝突 → 邊框正常，預約半透明
    └─ 有衝突 → 邊框變紅，tooltip 顯示「與 XXX 衝突」

放開滑鼠
    ├─ 無衝突 → updateAssignment()，保存新時間
    └─ 有衝突 → toast 警告，還原位置
```

### 2.2 拖曳衝突即時反饋

**視覺狀態機**：
```
初始状态
  ↓
[拖曳開始] → dragState.dragging = true, opacity = 0.6
  ↓
[每次 mousemove]
  ├─ 計算新時間範圍
  ├─ checkConflict(newRange)
  ├─ 有衝突 → dragState.hasConflict = true
  │   邊框：border: 2px solid #ef4444
  │   提示：tooltip "與 醫生A 衝突"
  └─ 無衝突 → dragState.hasConflict = false
      邊框：border: 1px solid transparent
  ↓
[放開滑鼠]
  ├─ 無衝突 → API updateAssignment() → 重新載入
  └─ 有衝突 → toast 提示 + 還原位置（不呼叫 API）
      ↓
      dragState.dragging = false
```

**Tooltip 內容**：
```
與 「醫生A」衝突 (14:30-15:30)
```

### 2.3 複製預約流程

```
點擊 [複製] 按鈕
    ↓
[CopyAssignmentDialog] 開啟
    ├─ 日期選擇器（預設：今天）
    ├─ 服務人員多選（預設：原預約的服務人員）
    │   可選其他服務人員同時建立
    └─ 按鈕：[取消] [複製]
    ↓
[複製] → API createAssignment()
    │   body: {
    │     S_Resource_ID: selectedResourceIds,
    │     AssignDateFrom: selectedDate + originalTime,
    │     AssignDateTo: selectedDate + originalEndTime,
    │     Name: originalName,
    │     ... (複製其他欄位)
    │   }
    ↓
成功 → toast 提示「預約已複製」
        ↓
        重新載入 assignments
        關閉 CopyAssignmentDialog
```

---

## 3. 元件架構

### 新增元件

#### 3.1 BottomSheet.vue（通用，100 行）
**用途**：可複用的行動底部 sheet 元件

```vue
<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div v-if="modelValue" class="sheet-overlay" @click="close">
        <div class="sheet-container" @click.stop>
          <div class="sheet-handle"></div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<style scoped>
.sheet-overlay {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.3);
  z-index: 100;
}
.sheet-container {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: white; border-radius: 12px 12px 0 0;
  max-height: 70vh; overflow-y: auto;
  animation: slideUp 0.3s ease-out;
}
.sheet-handle {
  width: 40px; height: 4px; margin: 8px auto;
  background: #ccc; border-radius: 2px;
}
</style>
```

**Props**：
- `modelValue: boolean` — 開/關

**使用**：
```vue
<BottomSheet v-model="showSheet">
  <AppointmentActionSheet ... />
</BottomSheet>
```

---

#### 3.2 AppointmentActionSheet.vue（預約專用，50 行）
**用途**：預約的操作菜單（編輯、複製、刪除）

```vue
<template>
  <div class="action-sheet">
    <!-- 預約摘要 -->
    <div class="appt-summary">
      <div class="summary-row">
        <span class="label">服務人員</span>
        <span class="value">{{ getResourceName(appt) }}</span>
      </div>
      <div class="summary-row">
        <span class="label">時間</span>
        <span class="value">{{ formatTime(appt) }}</span>
      </div>
      <div class="summary-row">
        <span class="label">名稱</span>
        <span class="value">{{ appt.Name }}</span>
      </div>
    </div>

    <!-- 操作按鈕 -->
    <div class="actions">
      <button class="action-btn" @click="$emit('edit')">編輯</button>
      <button class="action-btn" @click="$emit('copy')">複製</button>
      <button class="action-btn danger" @click="$emit('delete')">刪除</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ appt: any }>()
defineEmits<{
  edit: []
  copy: []
  delete: []
}>()
</script>
```

---

#### 3.3 CopyAssignmentDialog.vue（複製對話框，120 行）
**用途**：選擇日期、服務人員後複製預約

```vue
<template>
  <div class="dialog-overlay" @click.self="$emit('cancel')">
    <div class="dialog-content">
      <h3>複製預約</h3>

      <!-- 日期選擇器 -->
      <div class="form-group">
        <label>選擇日期</label>
        <input v-model="selectedDate" type="date" class="form-input" />
      </div>

      <!-- 服務人員多選 -->
      <div class="form-group">
        <label>選擇服務人員</label>
        <div class="resource-chips">
          <label v-for="res in resources" :key="res.id" class="chip">
            <input
              type="checkbox"
              :checked="selectedResourceIds.has(res.id)"
              @change="toggleResource(res.id)"
            />
            {{ res.Name }}
          </label>
        </div>
      </div>

      <!-- 操作按鈕 -->
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="$emit('cancel')">取消</button>
        <button
          class="btn btn-primary"
          :disabled="saving || selectedResourceIds.size === 0"
          @click="handleCopy"
        >
          {{ saving ? '複製中...' : '複製' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { createAssignment } from '@/api/assignment'

defineProps<{
  sourceAppt: any
  resources: any[]
}>()

defineEmits<{
  success: []
  cancel: []
}>()

const selectedDate = ref(new Date().toISOString().split('T')[0])
const selectedResourceIds = reactive(new Set<number>())
const saving = ref(false)

function toggleResource(id: number) {
  if (selectedResourceIds.has(id)) selectedResourceIds.delete(id)
  else selectedResourceIds.add(id)
}

async function handleCopy() {
  saving.value = true
  try {
    // 為每個選中的服務人員複製一個預約
    for (const resId of selectedResourceIds) {
      await createAssignment({
        S_Resource_ID: resId,
        AssignDateFrom: `${selectedDate.value}T${getTimeString(sourceAppt.AssignDateFrom)}`,
        AssignDateTo: `${selectedDate.value}T${getTimeString(sourceAppt.AssignDateTo)}`,
        Name: sourceAppt.Name,
        // 其他欄位複製...
      })
    }
    emit('success')
  } finally {
    saving.value = false
  }
}
</script>
```

---

### 改動現有元件

#### CalendarView.vue（~1000 → ~850 行）
**新增狀態**：
```typescript
const selectedAppt = ref<any | null>(null)
const showActionSheet = ref(false)
const showCopyDialog = ref(false)

const dragState = reactive({
  dragging: false,
  appointmentId: null as number | null,
  hasConflict: false,
  conflictingNames: [] as string[],
})
```

**新增邏輯**：
```typescript
// 預約點擊 → 開啟 ActionSheet
function onApptClick(appt: any) {
  selectedAppt.value = appt
  showActionSheet.value = true
}

// 拖曳時檢查衝突（每次 mousemove）
function onApptDrag(apptId: number, newStart: Date, newEnd: Date) {
  dragState.dragging = true
  dragState.appointmentId = apptId

  // 檢查衝突
  const conflict = checkConflict(
    { start: newStart, end: newEnd, resourceId: apptResourceId },
    assignments.value,
    apptId // 排除自己
  )

  dragState.hasConflict = conflict.hasConflict
  dragState.conflictingNames = conflict.conflictingNames
}

// 放開時決定是否保存
async function onApptDrop(apptId: number, newStart: Date, newEnd: Date) {
  if (dragState.hasConflict) {
    // 有衝突 → 還原位置 + toast
    showToast('有時間衝突，未儲存', 'warning')
    dragState.dragging = false
    return
  }

  // 無衝突 → 保存
  try {
    await updateAssignment(apptId, {
      AssignDateFrom: toIdempiereDateTime(newStart),
      AssignDateTo: toIdempiereDateTime(newEnd),
    })
    await loadAssignments()
  } catch (e) {
    showToast('更新失敗', 'error')
  } finally {
    dragState.dragging = false
  }
}
```

**新增 Template**：
```vue
<!-- ActionSheet (Mobile) -->
<BottomSheet v-model="showActionSheet">
  <AppointmentActionSheet
    v-if="selectedAppt"
    :appt="selectedAppt"
    @edit="handleEdit"
    @copy="showCopyDialog = true"
    @delete="handleDelete"
  />
</BottomSheet>

<!-- CopyDialog -->
<CopyAssignmentDialog
  v-if="showCopyDialog && selectedAppt"
  :source-appt="selectedAppt"
  :resources="resources"
  @success="onCopySuccess"
  @cancel="showCopyDialog = false"
/>

<!-- 拖曳衝突視覺反饋 -->
<div
  v-for="layout in dayApptLayout"
  :key="layout.appt.id"
  class="appt-block"
  :class="{
    'conflict': dragState.hasConflict && dragState.appointmentId === layout.appt.id,
    'dragging': dragState.dragging && dragState.appointmentId === layout.appt.id,
  }"
>
  <!-- appt 內容 -->

  <!-- 衝突 tooltip -->
  <div v-if="dragState.hasConflict && dragState.appointmentId === layout.appt.id" class="conflict-tooltip">
    與「{{ dragState.conflictingNames.join('」「') }}」衝突
  </div>
</div>
```

**CSS**：
```scss
.appt-block {
  &.dragging {
    opacity: 0.6;
  }

  &.conflict {
    border: 2px solid #ef4444;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
  }
}

.conflict-tooltip {
  position: absolute;
  bottom: 100%; left: 50%;
  transform: translateX(-50%);
  background: #ef4444;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  margin-bottom: 4px;

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: #ef4444;
  }
}
```

---

#### AppointmentForm.vue（無改動）
- 現有邏輯保持不變
- 點擊 ActionSheet 的「編輯」按鈕時開啟

---

### 新增工具函數

#### 3.4 lib/time-overlap.ts（衝突檢查邏輯，~50 行）

```typescript
export interface TimeRange {
  start: Date
  end: Date
  resourceId: number
}

export interface ConflictResult {
  hasConflict: boolean
  conflictingNames: string[]
  conflictingAppts: any[]
}

/**
 * 檢查新時間範圍與現有預約是否衝突
 * 邊界時間不視為衝突（A.end <= B.start 不是衝突）
 */
export function checkConflict(
  newRange: TimeRange,
  existingAppts: any[],
  resourcesMap: Map<number, any>,
  excludeApptId?: number
): ConflictResult {
  const conflicting: any[] = []

  for (const appt of existingAppts) {
    if (excludeApptId && appt.id === excludeApptId) continue

    const apptResId = typeof appt.S_Resource_ID === 'object'
      ? appt.S_Resource_ID.id
      : appt.S_Resource_ID

    // 只檢查同一個服務人員的預約
    if (apptResId !== newRange.resourceId) continue

    const apptStart = parseIdempiereDateTime(appt.AssignDateFrom)
    const apptEnd = parseIdempiereDateTime(appt.AssignDateTo)

    // 重疊檢查：A.start < B.end AND A.end > B.start
    if (newRange.start < apptEnd && newRange.end > apptStart) {
      conflicting.push(appt)
    }
  }

  return {
    hasConflict: conflicting.length > 0,
    conflictingNames: conflicting.map(a => a.Name || '未命名'),
    conflictingAppts: conflicting,
  }
}
```

---

#### 3.5 constants/calendar.ts（業務時間常數，~20 行）

```typescript
export const CALENDAR_CONFIG = {
  // 業務時間（時格視圖的可見範圍）
  BUSINESS_START_HOUR: 9,
  BUSINESS_END_HOUR: 18,

  // UI 尺寸
  GRID_START_HOUR: 0,        // 時格實際從 00:00 開始
  SLOT_HEIGHT: 44,           // 每個 30 分鐘 slot 的像素高度
  LABEL_WIDTH: 52,           // 時間標籤列寬
  SLOT_MINUTES: 30,          // 時段粒度

  // 顏色方案
  COLORS: [
    '#6366f1', // Indigo
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#ec4899', // Pink
  ],

  // 衝突顏色
  CONFLICT_COLOR: '#ef4444',

  // 動畫
  TRANSITION_DURATION: '0.3s',
}
```

---

## 4. 資料流

### 4.1 預約操作流程圖

```
CalendarView
├─ assignments (預約列表)
├─ resources (服務人員列表)
├─ selectedAppt (當前選中的預約)
└─ showActionSheet (是否顯示 ActionSheet)
    │
    └─ AppointmentActionSheet
        ├─ @edit → AppointmentForm (modal)
        ├─ @copy → showCopyDialog = true
        │          CopyAssignmentDialog
        │          ├─ selectedDate
        │          ├─ selectedResourceIds
        │          └─ @success → loadAssignments()
        │
        └─ @delete → deleteAssignment() → loadAssignments()
```

### 4.2 拖曳衝突檢查流程圖

```
onMouseDown(appt)
  ↓
dragState.dragging = true, appointmentId = appt.id
  ↓
onMouseMove(newPosition)
  ↓
計算 newStart, newEnd
  ↓
checkConflict(newRange, assignments, resourcesMap)
  ├─ 有衝突 → dragState.hasConflict = true, conflictingNames = [...]
  │   預約視覺：border: 2px solid red, tooltip 顯示
  └─ 無衝突 → dragState.hasConflict = false
      預約視覺：border: normal
  ↓
onMouseUp
  ├─ hasConflict → toast 警告，還原位置
  └─ !hasConflict → updateAssignment(newStart, newEnd)
      ↓
      loadAssignments()
      ↓
      dragState.dragging = false
```

---

## 5. 實作優先級

### Phase 1：Mobile First 核心（3.5 小時）— **必須**

| # | 工作項 | 檔案 | 工時 | 複雜度 |
|---|--------|------|------|--------|
| 1 | BottomSheet.vue | `components/BottomSheet.vue` | 1h | 低 |
| 2 | AppointmentActionSheet.vue | `components/AppointmentActionSheet.vue` | 0.5h | 低 |
| 3 | 拖曳衝突即時反饋 | `views/appointment/CalendarView.vue` | 1h | 中 |
| 4 | time-overlap.ts | `lib/time-overlap.ts` | 0.5h | 低 |
| 5 | constants/calendar.ts | `constants/calendar.ts` | 0.5h | 低 |

### Phase 2：複製功能（1.5 小時）— **推薦**

| # | 工作項 | 檔案 | 工時 | 複雜度 |
|---|--------|------|------|--------|
| 6 | CopyAssignmentDialog.vue | `components/CopyAssignmentDialog.vue` | 1.5h | 中 |

### Phase 3：Desktop 優化（1 小時）— **可選**

| # | 工作項 | 檔案 | 工時 | 複雜度 |
|---|--------|------|------|--------|
| 7 | 右鍵菜單 | `views/appointment/CalendarView.vue` | 1h | 低 |

**總工時**：Phase 1 + 2 + 3 = **6 小時**

---

## 6. 測試策略

### 單元測試

**lib/time-overlap.ts**：
```typescript
describe('checkConflict', () => {
  it('應該檢測重疊的時間範圍', () => {
    const existing = [
      {
        id: 1,
        AssignDateFrom: '2026-02-18T14:00:00Z',
        AssignDateTo: '2026-02-18T15:00:00Z',
        S_Resource_ID: { id: 1 }
      }
    ]

    const result = checkConflict(
      { start: new Date('2026-02-18T14:30'), end: new Date('2026-02-18T15:30'), resourceId: 1 },
      existing,
      new Map()
    )

    expect(result.hasConflict).toBe(true)
    expect(result.conflictingNames).toContain('existing-appt-name')
  })

  it('邊界時間不應該視為衝突', () => {
    const existing = [...]

    const result = checkConflict(
      { start: new Date('2026-02-18T15:00'), end: new Date('2026-02-18T16:00'), resourceId: 1 },
      existing,
      new Map()
    )

    expect(result.hasConflict).toBe(false)
  })
})
```

### 集成測試

**CalendarView.vue**：
- ✅ 點擊預約 → ActionSheet 出現
- ✅ 點擊「編輯」 → AppointmentForm 開啟
- ✅ 點擊「複製」 → CopyAssignmentDialog 開啟
- ✅ 拖曳無衝突預約 → 更新成功
- ✅ 拖曳有衝突預約 → 邊框變紅，放開時還原位置
- ✅ 複製預約 → 新預約建立成功

### 手動測試

**Mobile**（iPhone / Android）：
- 點擊預約 → sheet 滑出
- 點擊「複製」 → 日期選擇器可用
- 拖曳預約改時間 → 即時視覺反饋

**Desktop**（Chrome / Safari）：
- 右鍵點擊預約 → menu 出現
- 拖曳預約 → 衝突即時反饋

---

## 7. 成功指標

| 指標 | 目標 | 驗收標準 |
|------|------|--------|
| **Mobile 易用性** | ActionSheet 是否自然 | 用戶無需教學即可操作 |
| **衝突可見性** | 即時反饋是否有效 | 紅色邊框 + tooltip 清晰可見 |
| **複製效率** | 複製是否快速 | 5 秒內完成複製 |
| **Desktop 兼容** | 右鍵菜單是否可用 | 所有操作都可通過右鍵完成 |
| **效能** | 拖曳是否流暢 | 60fps，無卡頓 |
| **可測試性** | 衝突邏輯是否獨立 | time-overlap.ts 可單獨測試 |

---

## 8. 風險和緩解

| 風險 | 影響 | 緩解方案 |
|------|------|--------|
| Mobile 拖曳體驗差 | 用戶會改用 Desktop | 可選：對 Mobile 禁用拖曳，只允許時間 picker |
| 複製後衝突 | 複製出錯誤預約 | 複製時也檢查衝突，提示用戶 |
| BottomSheet 被鍵盤遮蓋 | Mobile 表單輸入困難 | 使用 position: fixed + 足夠的 z-index |
| 舊瀏覽器不支援 Teleport | Mobile 版本不相容 | 降級為普通 div（不 Teleport）|

---

## 附錄：檔案更新清單

**新增**：
- `webapp/src/components/BottomSheet.vue`
- `webapp/src/components/AppointmentActionSheet.vue`
- `webapp/src/components/CopyAssignmentDialog.vue`
- `webapp/src/lib/time-overlap.ts`
- `webapp/src/constants/calendar.ts`

**修改**：
- `webapp/src/views/appointment/CalendarView.vue` (~150 行新增，~50 行重構)

**保持不變**：
- `webapp/src/views/appointment/AppointmentForm.vue`

**預計測試新增**：
- `webapp/src/lib/__tests__/time-overlap.test.ts` (~100 行)
- `webapp/src/components/__tests__/BottomSheet.test.ts` (~80 行)
- `webapp/src/components/__tests__/AppointmentActionSheet.test.ts` (~100 行)
