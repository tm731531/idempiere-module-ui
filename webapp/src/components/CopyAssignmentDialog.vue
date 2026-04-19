<template>
  <div class="dialog-overlay" @click.self="$emit('cancel')">
    <div class="dialog-modal">
      <div class="dialog-header">
        <h3 class="dialog-title">複製預約</h3>
        <button class="dialog-close" @click="$emit('cancel')">✕</button>
      </div>

      <div class="dialog-content">
        <!-- Source appointment info -->
        <div class="source-info">
          <div class="info-row">
            <span class="info-label">原預約</span>
            <span class="info-value">{{ sourceAppt.Name }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">原時間</span>
            <span class="info-value">{{ formatSourceTime() }}</span>
          </div>
        </div>

        <!-- Date/Time picker -->
        <div class="form-group">
          <label class="form-label">開始時間 *</label>
          <input
            v-model="selectedStartTime"
            type="datetime-local"
            class="form-input"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">結束時間 *</label>
          <input
            v-model="selectedEndTime"
            type="datetime-local"
            class="form-input"
            required
          />
        </div>

        <!-- Resource/Service person selector (multi-select) -->
        <div class="form-group">
          <label class="form-label">選擇服務人員 *</label>
          <div v-if="resources.length === 0" class="empty-resources">
            無可用服務人員
          </div>
          <div v-else class="resource-checkboxes">
            <label
              v-for="res in resources"
              :key="res.id"
              class="checkbox-item"
            >
              <input
                type="checkbox"
                :checked="selectedResourceIds.has(res.id)"
                @change="toggleResource(res.id)"
              />
              <span class="checkbox-label">{{ res.Name }}</span>
            </label>
          </div>
          <div v-if="selectedResourceIds.size === 0" class="validation-error">
            至少選擇一個服務人員
          </div>
        </div>

        <!-- Optional: Copy additional fields -->
        <div class="form-group">
          <label class="form-label">預約名稱</label>
          <input
            v-model="copyName"
            type="text"
            class="form-input"
            placeholder="留空使用原名稱"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="dialog-actions">
        <button
          class="btn btn-secondary"
          :disabled="saving"
          @click="$emit('cancel')"
        >
          取消
        </button>
        <button
          class="btn btn-primary"
          :disabled="saving || selectedResourceIds.size === 0 || !selectedStartTime || !selectedEndTime"
          @click="handleCopy"
        >
          {{ saving ? '複製中...' : '複製' }}
        </button>
      </div>

      <!-- Error message -->
      <div v-if="errorMsg" class="error-banner">
        {{ errorMsg }}
      </div>

      <!-- Result summary (partial success) -->
      <div
        v-if="resultSummary"
        class="result-summary"
        :class="resultSummary.hasError ? 'summary-partial' : 'summary-ok'"
      >
        {{ resultSummary.text }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { createAssignment, checkConflict } from '@/api/assignment'
import { parseIdempiereDateTime, toIdempiereDateTime } from '@/api/utils'

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  sourceAppt: any
  resources: any[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  success: []
  cancel: []
}>()

// State
const selectedStartTime = ref('')
const selectedEndTime = ref('')
const selectedResourceIds = reactive(new Set<number>())
const copyName = ref('')
const saving = ref(false)
const errorMsg = ref('')
const resultSummary = ref<{ text: string; hasError: boolean } | null>(null)

// Initialize default times based on source appointment
const initializeDefaultTimes = () => {
  try {
    const sourceFrom = parseIdempiereDateTime(props.sourceAppt.AssignDateFrom)
    const sourceTo = parseIdempiereDateTime(props.sourceAppt.AssignDateTo)

    // Set defaults to today at the same time as source
    const today = new Date()
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(),
      sourceFrom.getHours(), sourceFrom.getMinutes())
    const endDate = new Date(startDate.getTime() + (sourceTo.getTime() - sourceFrom.getTime()))

    selectedStartTime.value = toDatetimeLocal(startDate)
    selectedEndTime.value = toDatetimeLocal(endDate)
  } catch (e) {
    // Fallback to now if parsing fails
    const now = new Date()
    selectedStartTime.value = toDatetimeLocal(now)
    selectedEndTime.value = toDatetimeLocal(new Date(now.getTime() + 3600000))
  }
}

// Pre-select the original resource
const originalResourceId = computed(() => {
  const resId = typeof props.sourceAppt.S_Resource_ID === 'object'
    ? props.sourceAppt.S_Resource_ID.id
    : props.sourceAppt.S_Resource_ID
  return resId
})

function toggleResource(resourceId: number) {
  if (selectedResourceIds.has(resourceId)) {
    selectedResourceIds.delete(resourceId)
  } else {
    selectedResourceIds.add(resourceId)
  }
}

function formatSourceTime(): string {
  try {
    const from = parseIdempiereDateTime(props.sourceAppt.AssignDateFrom)
    const to = parseIdempiereDateTime(props.sourceAppt.AssignDateTo)

    const fromStr = from.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    const toStr = to.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })

    return `${fromStr} - ${toStr}`
  } catch {
    return '時間格式錯誤'
  }
}

async function handleCopy() {
  errorMsg.value = ''
  resultSummary.value = null

  if (selectedResourceIds.size === 0) {
    errorMsg.value = '請至少選擇一個服務人員'
    return
  }
  if (!selectedStartTime.value || !selectedEndTime.value) {
    errorMsg.value = '請選擇開始和結束時間'
    return
  }

  const startDate = new Date(selectedStartTime.value)
  const endDate = new Date(selectedEndTime.value)
  if (startDate >= endDate) {
    errorMsg.value = '結束時間必須晚於開始時間'
    return
  }

  saving.value = true

  try {
    const resourceIdList = [...selectedResourceIds]
    const sourceResId = typeof props.sourceAppt.S_Resource_ID === 'object'
      ? props.sourceAppt.S_Resource_ID.id
      : props.sourceAppt.S_Resource_ID

    // Step A: check conflicts for all resources in parallel
    const conflictChecks = await Promise.allSettled(
      resourceIdList.map(async (resourceId) => {
        const excludeId = resourceId === sourceResId ? props.sourceAppt.id : undefined
        const hasConflict = await checkConflict(resourceId, startDate, endDate, excludeId)
        return { resourceId, hasConflict }
      }),
    )

    const conflictIds = new Set<number>()
    const checkFailIds = new Set<number>()
    conflictChecks.forEach((r, idx) => {
      if (r.status === 'rejected') {
        checkFailIds.add(resourceIdList[idx]!)
      } else if (r.value.hasConflict) {
        conflictIds.add(r.value.resourceId)
      }
    })

    const eligibleIds = resourceIdList.filter(id => !conflictIds.has(id) && !checkFailIds.has(id))

    if (eligibleIds.length === 0) {
      const names = resourceIdList
        .map(id => props.resources.find(r => r.id === id)?.Name ?? `#${id}`)
        .join('、')
      errorMsg.value = `所有選擇的服務人員（${names}）在此時段均有衝突，無法複製`
      return
    }

    // Step B: create for eligible resources in parallel
    const basePayload: Record<string, unknown> = {
      AssignDateFrom: toIdempiereDateTime(startDate),
      AssignDateTo: toIdempiereDateTime(endDate),
      Name: copyName.value || props.sourceAppt.Name,
      AD_Org_ID: props.sourceAppt.AD_Org_ID,
    }
    if (props.sourceAppt.Description) basePayload.Description = props.sourceAppt.Description

    const createResults = await Promise.allSettled(
      eligibleIds.map(async (resourceId) => {
        await createAssignment({ ...basePayload, S_Resource_ID: resourceId } as any)
        return resourceId
      }),
    )

    const succeeded = createResults
      .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
      .map(r => r.value)
    const createFailIds = createResults
      .filter(r => r.status === 'rejected')
      .map((_, i) => eligibleIds[i]!)
    const allFailedIds = [...conflictIds, ...checkFailIds, ...createFailIds]

    const successCount = succeeded.length
    const failCount = allFailedIds.length

    if (failCount === 0) {
      resultSummary.value = { text: `${successCount} 筆預約已複製`, hasError: false }
      setTimeout(() => emit('success'), 800)
    } else {
      const failedNames = allFailedIds
        .map(id => props.resources.find(r => r.id === id)?.Name ?? `#${id}`)
        .join('、')
      const conflictNote = conflictIds.size > 0 ? '（時段衝突）' : ''
      resultSummary.value = {
        text: `${successCount} 成功、${failCount} 失敗 ${conflictNote}：${failedNames}`,
        hasError: true,
      }
      if (successCount > 0) {
        setTimeout(() => emit('success'), 2000)
      }
    }
  } catch {
    errorMsg.value = '複製時發生錯誤，請重試'
  } finally {
    saving.value = false
  }
}

// Initialize on component mount
onMounted(() => {
  initializeDefaultTimes()
  // Pre-select the original resource by default
  if (!selectedResourceIds.has(originalResourceId.value)) {
    selectedResourceIds.add(originalResourceId.value)
  }
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 16px;
}

.dialog-modal {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.dialog-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.dialog-close:hover {
  background-color: #f3f4f6;
}

.dialog-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Source info */
.source-info {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.info-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.info-value {
  font-size: 14px;
  color: #111827;
  font-weight: 600;
}

/* Form groups */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.form-input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

/* Resource checkboxes */
.resource-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
}

.checkbox-item:hover {
  background-color: #f3f4f6;
}

.checkbox-item input[type='checkbox'] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #4f46e5;
}

.checkbox-label {
  font-size: 14px;
  color: #111827;
}

.empty-resources {
  padding: 16px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
  background: #f9fafb;
  border-radius: 6px;
}

/* Validation */
.validation-error {
  font-size: 13px;
  color: #dc2626;
  padding: 4px 0;
}

/* Actions */
.dialog-actions {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
  justify-content: flex-end;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.btn-primary {
  background: #4f46e5;
  color: white;
}

.btn.btn-primary:hover:not(:disabled) {
  background: #4338ca;
}

.btn.btn-secondary {
  background: #e5e7eb;
  color: #111827;
}

.btn.btn-secondary:hover:not(:disabled) {
  background: #d1d5db;
}

/* Error banner */
.error-banner {
  padding: 12px 16px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 13px;
  border-top: 1px solid #fecaca;
  text-align: center;
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .dialog-overlay {
    padding: 8px;
  }

  .dialog-modal {
    max-height: calc(100vh - 16px);
  }

  .dialog-content {
    padding: 16px;
  }

  .dialog-actions {
    padding: 12px 16px;
    gap: 8px;
  }

  .btn {
    flex: 1;
    min-height: 44px;
  }
}

.result-summary {
  margin: 0.75rem 1rem 0;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
}
.summary-ok {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.summary-partial {
  background: #fef9c3;
  color: #713f12;
  border: 1px solid #fde047;
}
</style>
