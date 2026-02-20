<template>
  <div class="request-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isEdit ? '編輯諮詢' : '新增諮詢' }}</h2>
    </div>

    <div v-if="pageLoading" class="loading-state">載入中...</div>

    <div v-else-if="pageError" class="form-error">{{ pageError }}</div>

    <form v-else @submit.prevent="handleSubmit">
      <!-- Status Selector -->
      <div class="form-group">
        <label>狀態</label>
        <select v-model="selectedStatus" class="status-select" @change="updateLastResultField">
          <option value="">-- 選擇狀態 --</option>
          <option value="待處理">待處理</option>
          <option value="處理中">處理中</option>
          <option value="已完成">已完成</option>
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
        <RequestTimeline :activities="formData.Description || '[]'" />
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
import { parseActivities, stringifyActivities, type Activity } from '@/utils/requestActivity'
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

const showStatusModal = ref(false)
const showTrackingModal = ref(false)
const availableStatuses = ref<Array<{ R_Status_ID: number; Name: string }>>([])

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
      console.log(`🔄 Converted ${key}: object → ${value.id}`)
    } else {
      cleanPayload[key] = value
    }
  }

  console.log('📤 handleSubmit - cleanPayload:', cleanPayload)
  console.log('📤 handleSubmit - R_Status_ID:', cleanPayload.R_Status_ID, 'type:', typeof cleanPayload.R_Status_ID)

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
      console.log('🔄 Updating request', requestId.value, 'with cleanPayload:', cleanPayload)
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
      // Explicitly include LastResult field for status
      if (selectedStatus.value) {
        updatePayload.LastResult = selectedStatus.value
        console.log('📝 Added LastResult to payload:', updatePayload.LastResult)
      }
      console.log('🔄 Final updatePayload (system fields removed):', updatePayload)
      await updateRequest(requestId.value, updatePayload)
      router.push({ name: 'consultation-list' })
    } else {
      cleanPayload.AD_Org_ID = auth.context?.organizationId ?? 0
      console.log('➕ Creating new request with cleanPayload:', cleanPayload)
      await createRequest(cleanPayload as RequestData)
      router.push({ name: 'consultation-list' })
    }
  } catch (e: any) {
    console.error('❌ Submit error:', e)
    console.error('❌ Error response:', e.response?.data)
    console.error('❌ Error status:', e.response?.status)
    console.error('❌ Error message:', e.message)

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

function updateLastResultField() {
  // When user selects a status, update the LastResult field
  formData.value.LastResult = selectedStatus.value
  console.log('📝 Status updated to:', selectedStatus.value)
}

function goBack() {
  router.push({ name: 'consultation-list' })
}

function handleAddActivity(activity: Partial<Activity>) {
  try {
    // Parse existing activities from JSON string in Description field
    // Empty array if no activities yet
    const activities = parseActivities(formData.value.Description || '[]')

    // Add new activity with automatic timestamp and user ID
    activities.push({
      ...activity,
      timestamp: activity.timestamp || new Date().toISOString(),
      createdBy: activity.createdBy || auth.user?.name || 'Unknown',
    })

    // Re-serialize activities back to JSON string for storage
    formData.value.Description = stringifyActivities(activities)
    errorMsg.value = '' // Clear previous errors
    // Note: QuickActionBar modal doesn't auto-close to allow multiple quick actions
  } catch (e) {
    errorMsg.value = '活動記錄新增失敗'
  }
}

function handleUpdateStatus() {
  showStatusModal.value = true
}

function handleSetTracking() {
  showTrackingModal.value = true
}

function handleStatusSelected(statusId: string) {
  console.log('🔄 handleStatusSelected called with status name:', statusId)

  if (formData.value) {
    // Store status name in Result field (text field, not problematic R_Status_ID)
    formData.value.Result = statusId
    console.log('✅ Set Result to:', statusId)
  } else {
    console.error('❌ formData.value is undefined!')
  }

  showStatusModal.value = false
}

function handleTrackingSet(data: { date: string; time: string; description: string }) {
  try {
    const activities = parseActivities(formData.value.Description || '[]')
    // Convert date (YYYY-MM-DD) and time (HH:MM) to iDempiere datetime format
    // Per iDempiere convention: Z suffix indicates local time (not UTC), stored as ISO string
    const isoDateTime = `${data.date}T${data.time}:00Z`

    activities.push({
      type: '預約追蹤',
      actionType: '設定追蹤',
      content: data.description,
      timestamp: isoDateTime,    // ISO datetime in local time with Z suffix
      createdBy: auth.user?.name || 'Unknown',
    })
    formData.value.Description = stringifyActivities(activities)
    errorMsg.value = '' // Clear any previous errors
    showTrackingModal.value = false // Only closes on success
  } catch (e) {
    errorMsg.value = '追蹤預約設定失敗'
    // Modal stays open so user can retry or cancel
  }
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
        console.log('✅ Loaded statuses from SysConfig:', statuses)
        return
      } catch (e) {
        console.error('❌ Failed to parse SysConfig JSON:', e)
      }
    }

    // Fallback: use hardcoded default statuses
    console.warn('⚠️ No SysConfig found, using default statuses')
    const defaultStatuses = [
      { R_Status_ID: 0, Name: '待處理' },
      { R_Status_ID: 1, Name: '處理中' },
      { R_Status_ID: 2, Name: '已完成' },
    ]
    availableStatuses.value = defaultStatuses
    console.log('✅ Using default statuses:', defaultStatuses)
  } catch (e: any) {
    console.error('❌ Failed to load statuses:', e)
    // Final fallback
    availableStatuses.value = [
      { R_Status_ID: 0, Name: '待處理' },
      { R_Status_ID: 1, Name: '處理中' },
      { R_Status_ID: 2, Name: '已完成' },
    ]
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
  console.log('📝 Initialized status selector:', selectedStatus.value)

  if (isEdit.value && requestId.value) {
    await loadAttachments(requestId.value)
  }
})
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
