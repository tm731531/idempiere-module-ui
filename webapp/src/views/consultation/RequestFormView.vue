<template>
  <div class="request-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isEdit ? '編輯諮詢' : '新增諮詢' }}</h2>
    </div>

    <div v-if="pageLoading" class="loading-state">載入中...</div>

    <div v-else-if="pageError" class="form-error">{{ pageError }}</div>

    <form v-else @submit.prevent="handleSubmit">
      <!-- Status Selector (dynamically loaded from SysConfig) -->
      <div class="form-group">
        <label>狀態</label>
        <select v-model="selectedStatus" @change="updateStatusField" class="status-select">
          <option value="">-- 選擇狀態 --</option>
          <option v-for="status in statusOptions" :key="status" :value="status">
            {{ status }}
          </option>
        </select>
      </div>

      <!-- Dynamic form from AD metadata -->
      <DynamicForm
        :fieldDefs="visibleFieldDefs"
        :modelValue="formData"
        :disabled="readOnly"
        :columnFilters="columnFilters"
        :highlightColumns="highlightColumns"
        @update:modelValue="formData = $event"
      />

      <!-- Activity Timeline Section -->
      <div v-if="isEdit" class="timeline-section">
        <h3>活動記錄</h3>
        <div v-if="notesLoading" class="notes-loading">載入活動中...</div>
        <RequestTimeline v-else :activities="notesAsJson" />
      </div>

      <!-- Attachment section (custom, not from metadata) -->
      <div v-if="isEdit" class="form-group attachment-section">
        <label>附件 / 照片</label>
        <div v-if="attachments.length > 0" class="attachment-list">
          <div
            v-for="att in attachments"
            :key="att.name"
            class="attachment-item"
          >
            <img
              v-if="thumbnailUrls.get(att.name)"
              :src="thumbnailUrls.get(att.name)"
              class="attachment-thumb"
            />
            <span class="attachment-name">{{ att.name }}</span>
            <button
              type="button"
              class="attachment-delete"
              @click="handleRemoveAttachment(att.name)"
            >
              刪除
            </button>
          </div>
        </div>
        <div v-else class="attachment-empty">尚無附件</div>
        <input
          type="file"
          accept="image/*"
          class="file-input"
          @change="handleFileSelect"
        />
        <div v-if="uploading" class="upload-status">上傳中...</div>
        <div v-if="attachError" class="field-error">{{ attachError }}</div>
      </div>

      <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>

      <div class="form-actions">
        <button type="button" class="cancel-btn" @click="goBack">取消</button>
        <button
          v-if="isEdit && formData.C_BPartner_ID"
          type="button"
          class="create-order-btn"
          @click="onCreateOrder"
          :disabled="submitting"
        >
          ✏️ 建立訂單
        </button>
        <button type="submit" :disabled="submitting">
          {{ submitting ? '儲存中...' : '儲存' }}
        </button>
      </div>
    </form>

    <!-- Quick Action Bar (sticky bottom) -->
    <div v-if="isEdit && requestId" class="quick-actions-wrapper">
      <QuickActionBar
        :request-id="requestId!"
        :current-status="getStatusName(formData.R_Status_ID)"
        :disabled="submitting || !isEdit"
        @add-activity="handleAddActivity"
        @update-status="handleUpdateStatus"
        @set-tracking="handleSetTracking"
      />
    </div>

    <!-- Status Update Modal -->
    <StatusUpdateModal
      v-if="showStatusModal"
      :request-id="requestId || 0"
      :current-status-id="getCurrentStatusId()"
      :statuses="availableStatuses"
      @status-selected="handleStatusSelected"
      @close="showStatusModal = false"
    />

    <!-- Tracking Date Modal -->
    <TrackingDateModal
      v-if="showTrackingModal"
      :request-id="requestId || 0"
      @tracking-set="handleTrackingSet"
      @close="showTrackingModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAttachment } from '@/composables/useAttachment'
import { useDocumentForm } from '@/composables/useDocumentForm'
import DynamicForm from '@/components/DynamicForm.vue'
import RequestTimeline from '@/components/RequestTimeline.vue'
import QuickActionBar from '@/components/QuickActionBar.vue'
import StatusUpdateModal from '@/components/StatusUpdateModal.vue'
import TrackingDateModal from '@/components/TrackingDateModal.vue'
import { type Activity } from '@/utils/requestActivity'
import { listNotesForRecord, createNote, getRRequestTableId, type AdNote } from '@/api/adNote'
import {
  getRequest,
  createRequest,
  updateRequest,
  updateRequestStatus,
  listRequestStatuses,
  type RequestData,
} from '@/api/request'
import { getSysConfig } from '@/api/sysconfig'

// Fallback statuses when API returns empty
// These IDs must match actual R_Status records in the database
const FALLBACK_STATUSES = [
  { R_Status_ID: 100, Name: 'Open', SeqNo: 1 },
  { R_Status_ID: 101, Name: 'Waiting on customer', SeqNo: 2 },
  { R_Status_ID: 102, Name: 'Closed', SeqNo: 3 },
]

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const requestId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})
const isEdit = computed(() => requestId.value !== null)

const preloadedData = (route as any).state?.preloadedData

const {
  visibleFieldDefs,
  formData,
  pageLoading,
  pageError,
  readOnly,
  isCreate,
  load,
  getFormPayload,
  getUpdatePayload,
  populateFromRecord,
  docStatus,
  loadFields,
  initDefaults,
} = useDocumentForm({
  tabId: 344,  // R_Request
  recordId: requestId,
  loadRecord: (id) => getRequest(id),
  columnFilters: { C_BPartner_ID: 'IsCustomer eq true' },
})

const columnFilters = { C_BPartner_ID: 'IsCustomer eq true' }
const highlightColumns = ['C_BPartner_ID']

const submitting = ref(false)
const errorMsg = ref('')
const selectedStatus = ref('')
const statusOptions = ref<string[]>([])  // 動態加載的狀態選項

const showStatusModal = ref(false)
const showTrackingModal = ref(false)
const availableStatuses = ref<Array<{ R_Status_ID: number; Name: string }>>([])

// Activity timeline backed by AD_Note
const notes = ref<AdNote[]>([])
const notesLoading = ref(false)

/**
 * Convert AD_Note records to the JSON string format that RequestTimeline expects.
 * AD_Note.Description holds the activity type; TextMsg holds the content.
 * For call logs the TextMsg may be a JSON string — we extract the summary if so.
 */
const notesAsJson = computed(() => {
  const activities: Activity[] = notes.value.map((note) => {
    let content = note.TextMsg || ''
    let actionType = note.Description || 'NOTE'

    // Attempt to parse call log JSON (e.g. { summary, duration, result })
    try {
      const parsed = JSON.parse(note.TextMsg)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        content = parsed.summary || parsed.result || note.TextMsg
        if (parsed.duration) {
          content = `${content} (${parsed.duration})`
        }
      }
    } catch {
      // TextMsg is plain text — use as-is
    }

    const createdBy =
      typeof note.CreatedBy === 'object' && note.CreatedBy !== null
        ? note.CreatedBy.identifier
        : String(note.CreatedBy)

    return {
      timestamp: note.Created,
      type: actionType,
      actionType,
      content,
      createdBy,
    }
  })
  return JSON.stringify(activities)
})

async function loadNotes(): Promise<void> {
  if (!requestId.value) return
  notesLoading.value = true
  try {
    notes.value = await listNotesForRecord('R_Request', requestId.value)
  } catch (e) {
    console.warn('Failed to load activity notes:', e)
    notes.value = []
  } finally {
    notesLoading.value = false
  }
}

const {
  attachments,
  uploading,
  error: attachError,
  thumbnailUrls,
  loadAttachments,
  upload,
  remove,
} = useAttachment('R_Request')

async function handleSubmit() {
  errorMsg.value = ''
  // For updates, use getUpdatePayload() to include all non-system fields
  // For creates, use getFormPayload() to only include updateable fields
  let rawPayload = isEdit.value ? getUpdatePayload() : getFormPayload()

  // Clean payload: convert expanded objects to their IDs
  // This prevents sending nested objects like { id: 100, Name: 'Open' } instead of just 100
  const cleanPayload: Record<string, any> = {}
  for (const [key, value] of Object.entries(rawPayload)) {
    if (value === null || value === undefined) {
      continue
    }
    // If value is an object with 'id' property, extract the ID
    if (typeof value === 'object' && !Array.isArray(value) && 'id' in value) {
      cleanPayload[key] = value.id
    } else {
      cleanPayload[key] = value
    }
  }

  if (!cleanPayload.R_RequestType_ID) {
    errorMsg.value = '請選擇諮詢類型'
    return
  }
  if (!cleanPayload.Summary || !String(cleanPayload.Summary).trim()) {
    errorMsg.value = '請輸入摘要'
    return
  }

  submitting.value = true
  try {
    if (isEdit.value && requestId.value) {
      // Create payload with only updateable fields
      const updatePayload = { ...cleanPayload }
      // Remove non-updateable system fields
      delete updatePayload.R_Status_ID
      delete updatePayload.DateLastAction
      delete updatePayload.DateCreated
      delete updatePayload.CreatedBy
      delete updatePayload.Updated
      delete updatePayload.UpdatedBy
      delete updatePayload.Processed
      // Ensure LastResult (status) is included if changed
      if (selectedStatus.value) {
        updatePayload.LastResult = selectedStatus.value
      }
      await updateRequest(requestId.value, updatePayload)
      router.push({ name: 'consultation-list' })
    } else {
      cleanPayload.AD_Org_ID = auth.context?.organizationId ?? 0
      await createRequest(cleanPayload as RequestData)
      router.push({ name: 'consultation-list' })
    }
  } catch (e: any) {
    // Try to extract API error message
    const apiError = e.response?.data?.error || e.response?.data?.message || e.message || '未知錯誤'
    errorMsg.value = isEdit.value ? `更新諮詢失敗: ${apiError}` : `建立諮詢失敗: ${apiError}`
  } finally {
    submitting.value = false
  }
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !requestId.value) return
  await upload(requestId.value, file)
  target.value = ''
}

async function handleRemoveAttachment(fileName: string) {
  if (!requestId.value) return
  await remove(requestId.value, fileName)
}

function goBack() {
  router.push({ name: 'consultation-list' })
}

async function handleAddActivity(activity: Partial<Activity>) {
  if (!requestId.value) {
    errorMsg.value = '無法新增活動：諮詢 ID 不存在'
    return
  }

  errorMsg.value = ''
  try {
    const tableId = await getRRequestTableId()
    const activityType = activity.type || activity.actionType || 'NOTE'

    // For call-type activities, store structured data as JSON in TextMsg
    let textMsg: string
    const isCallLike = activityType === 'CALL' || activity.actionType === '電話'
    if (isCallLike && activity.content) {
      textMsg = JSON.stringify({ summary: activity.content })
    } else {
      textMsg = activity.content || ''
    }

    await createNote({
      AD_Table_ID: tableId,
      Record_ID: requestId.value,
      Description: activityType,
      TextMsg: textMsg,
      AD_Org_ID: auth.context?.organizationId ?? 0,
    })

    // Refresh timeline
    await loadNotes()
  } catch (e: any) {
    const apiError = e.response?.data?.error || e.response?.data?.message || e.message || '未知錯誤'
    errorMsg.value = `新增活動失敗: ${apiError}`
  }
}

function handleUpdateStatus() {
  showStatusModal.value = true
}

function handleSetTracking() {
  showTrackingModal.value = true
}

function updateStatusField() {
  // When status dropdown changes, sync to formData.LastResult
  if (formData.value) {
    formData.value.LastResult = selectedStatus.value
  }
}

function handleStatusSelected(statusName: string) {
  if (formData.value) {
    formData.value.LastResult = statusName
    selectedStatus.value = statusName
  }
  showStatusModal.value = false
}

function handleTrackingSet(data: { date: string; time: string; description: string }) {
  // TODO: Tracking feature temporarily disabled until we find a proper field for storage
  errorMsg.value = '追蹤預約功能暫時不可用'
  showTrackingModal.value = false
}

function getStatusName(status: any): string {
  if (!status) return ''

  // Status is now stored as a string name in Result field (e.g., "waiting", "open", "closed")
  if (typeof status === 'string') {
    return status
  }

  // Legacy support: if it's an object with Name
  if (typeof status === 'object' && status.Name) {
    return status.Name
  }

  return ''
}

function getCurrentStatusId(): number {
  const status = formData.value.R_Status_ID
  if (status && typeof status === 'object' && status.id) {
    return typeof status.id === 'number' ? status.id : Number(status.id)
  }
  if (typeof status === 'string') {
    return Number(status)
  }
  if (typeof status === 'number') {
    return status
  }
  return 0
}

async function loadAvailableStatuses() {
  try {
    // Load statuses from SysConfig (MobileSettingConfig)
    const configValue = await getSysConfig('MobileSettingConfig')

    if (configValue) {
      try {
        const statuses = JSON.parse(configValue)
        availableStatuses.value = statuses
        statusOptions.value = statuses.map((s: any) => s.Name)
        return
      } catch {
        // continue to fallback
      }
    }

    // Fallback: use hardcoded default statuses
    const defaultStatuses = [
      { R_Status_ID: 0, Name: '待處理' },
      { R_Status_ID: 1, Name: '處理中' },
      { R_Status_ID: 2, Name: '已完成' },
    ]
    availableStatuses.value = defaultStatuses
    statusOptions.value = defaultStatuses.map(s => s.Name)
  } catch {
    // Final fallback
    const fallbackStatuses = [
      { R_Status_ID: 0, Name: '待處理' },
      { R_Status_ID: 1, Name: '處理中' },
      { R_Status_ID: 2, Name: '已完成' },
    ]
    availableStatuses.value = fallbackStatuses
    statusOptions.value = fallbackStatuses.map(s => s.Name)
  }
}

onMounted(async () => {
  // Load metadata (required for field definitions)
  pageLoading.value = true
  pageError.value = ''
  try {
    await loadFields(344)  // Load metadata for R_Request tab

    // If preloaded data exists, use it; otherwise fetch from API
    if (preloadedData) {
      populateFromRecord(preloadedData)
    } else if (!isCreate.value && requestId.value) {
      const record = await getRequest(requestId.value)
      populateFromRecord(record)
    } else {
      // New record: initialize with defaults
      initDefaults()
    }
  } catch (e: any) {
    pageError.value = e.message || '載入失敗'
  } finally {
    pageLoading.value = false
  }

  await loadAvailableStatuses()

  // Initialize status selector from LastResult field
  selectedStatus.value = formData.value.LastResult || ''

  if (isEdit.value && requestId.value) {
    await Promise.all([
      loadAttachments(requestId.value),
      loadNotes(),
    ])
  }
})

// 建立訂單功能
function onCreateOrder() {
  if (!formData.value.C_BPartner_ID) {
    alert('請先選擇客戶')
    return
  }

  // 跳轉到訂單建立頁，帶入客戶 ID 和相關諮詢 ID
  router.push({
    name: 'order-create',
    params: { customerId: formData.value.C_BPartner_ID },
    query: { relatedConsultationId: requestId.value },
  })
}
</script>

<style scoped>
.request-form-page {
  padding: 1rem;
  padding-bottom: 30rem;
  max-width: 600px;
  margin: 0 auto;
}

.form-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.form-header h2 {
  font-size: 1.25rem;
  margin: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
  font-size: 1rem;
  line-height: 1.5;
}

.form-error {
  background: #fef2f2;
  color: var(--color-error);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 1.25rem;
  display: block;
}

.form-group label {
  display: block;
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #1f2937;
  line-height: 1.4;
}

.field-error {
  display: block;
  color: var(--color-error);
  font-size: 0.875rem;
  margin-top: 0.375rem;
  line-height: 1.4;
}

.attachment-section {
  margin-top: 1.5rem;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-bottom: 0.75rem;
}

.attachment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  min-height: 56px;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.attachment-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.attachment-name {
  font-size: 0.9375rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 100px;
  line-height: 1.4;
}

.attachment-delete {
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-error);
  color: var(--color-error);
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  flex-shrink: 0;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
}

.attachment-delete:active {
  background: rgba(220, 38, 38, 0.05);
}

.attachment-empty {
  color: #94a3b8;
  font-size: 0.9375rem;
  margin-bottom: 0.75rem;
  line-height: 1.4;
  padding: 0.75rem;
  text-align: center;
  background: #f9fafb;
  border-radius: 6px;
}

.file-input {
  font-size: 0.9375rem;
  cursor: pointer;
  padding: 0.5rem;
  width: 100%;
}

.upload-status {
  font-size: 0.9375rem;
  color: var(--color-primary);
  margin-top: 0.5rem;
  font-weight: 500;
  line-height: 1.4;
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.5rem;
  position: sticky;
  bottom: 0;
  background: white;
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  z-index: 10;
}

.form-actions button {
  width: 100%;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  font-size: 1rem;
  min-height: 44px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
  line-height: 1.4;
}

.form-actions button[type="submit"] {
  background: var(--color-primary);
  color: white;
  border: none;
}

.form-actions button[type="submit"]:hover {
  background: var(--color-primary-hover);
}

.form-actions button[type="submit"]:active {
  transform: scale(0.98);
}

.form-actions button[type="submit"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  background: white;
  border: 1px solid var(--color-border);
  color: #1f2937;
}

.cancel-btn:hover {
  background: #f9fafb;
}

.cancel-btn:active {
  background: #f3f4f6;
}

.back-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 0.9375rem;
}

.back-btn:active {
  background: #f9fafb;
}

.create-order-btn {
  background: #3b82f6;
  color: white;
  border: 1px solid #2563eb;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9375rem;
  min-height: 44px;
  transition: all 0.2s;
}

.create-order-btn:hover:not(:disabled) {
  background: #2563eb;
  border-color: #1d4ed8;
}

.create-order-btn:active:not(:disabled) {
  background: #1d4ed8;
}

.create-order-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.timeline-section {
  margin-top: 2rem;
  margin-bottom: 8rem;
  padding: 1.25rem 0;
  border-top: 1px solid var(--color-border);
}

.timeline-section h3 {
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.notes-loading {
  text-align: center;
  padding: 1.5rem;
  color: #94a3b8;
  font-size: 0.9375rem;
}

/* Mobile-first responsive design */
@media (max-width: 640px) {
  .request-form-page {
    padding: 1rem;
  }

  .form-header {
    gap: 0.75rem;
  }

  .form-header h2 {
    font-size: 1.125rem;
  }

  .form-actions {
    margin-bottom: 8rem;
  }

  .attachment-item {
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .attachment-name {
    flex: 1;
    min-width: 80px;
  }

  .timeline-section {
    max-height: 300px;
    overflow-y: auto;
    padding: 1rem 0;
    margin-bottom: 8rem;
  }
}

@media (min-width: 641px) {
  .request-form-page {
    padding: 2rem;
  }

  .form-actions {
    flex-direction: row;
    gap: 1rem;
  }

  .form-actions button {
    flex: 1;
    width: auto;
  }

  .timeline-section {
    max-height: 400px;
    overflow-y: auto;
  }
}
</style>
