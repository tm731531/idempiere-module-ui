<template>
  <div class="request-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isEdit ? '編輯諮詢' : '新增諮詢' }}</h2>
    </div>

    <div v-if="pageLoading" class="loading-state">載入中...</div>

    <div v-else-if="pageError" class="form-error">{{ pageError }}</div>

    <form v-else @submit.prevent="handleSubmit">
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
  listRequestStatuses,
  type RequestData,
} from '@/api/request'

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
  const payload = getFormPayload()

  if (!payload.R_RequestType_ID) {
    errorMsg.value = '請選擇諮詢類型'
    return
  }
  if (!payload.Summary || !String(payload.Summary).trim()) {
    errorMsg.value = '請輸入摘要'
    return
  }

  submitting.value = true
  try {
    if (isEdit.value && requestId.value) {
      await updateRequest(requestId.value, payload)
      router.push({ name: 'consultation-list' })
    } else {
      payload.AD_Org_ID = auth.context?.organizationId ?? 0
      await createRequest(payload as RequestData)
      router.push({ name: 'consultation-list' })
    }
  } catch {
    errorMsg.value = isEdit.value ? '更新諮詢失敗' : '建立諮詢失敗'
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

function handleStatusSelected(statusId: number) {
  formData.value.R_Status_ID = statusId
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

function getStatusName(status: { id?: string | number; identifier?: string; Name?: string } | string | number | null | undefined): string {
  if (status && typeof status === 'object') {
    return status.identifier || status.Name || String(status.id) || '待處理'
  }
  return '待處理'
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
    // Fetch actual statuses from API instead of hardcoded values
    availableStatuses.value = await listRequestStatuses()
  } catch {
    // Fallback if API call fails
    availableStatuses.value = []
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
  if (isEdit.value && requestId.value) {
    await loadAttachments(requestId.value)
  }
})
</script>

<style scoped>
.request-form-page {
  padding: 1rem;
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
  margin-bottom: 8rem;
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
