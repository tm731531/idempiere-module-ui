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
        :promoteMandatory="promoteMandatory"
        @update:modelValue="formData = $event"
      />

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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAttachment } from '@/composables/useAttachment'
import { useDocumentForm } from '@/composables/useDocumentForm'
import DynamicForm from '@/components/DynamicForm.vue'
import {
  getRequest,
  createRequest,
  updateRequest,
  type RequestData,
} from '@/api/request'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const requestId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})
const isEdit = computed(() => requestId.value !== null)

const {
  visibleFieldDefs,
  formData,
  pageLoading,
  pageError,
  readOnly,
  isCreate,
  load,
  getFormPayload,
} = useDocumentForm({
  tabId: 344,  // R_Request
  recordId: requestId,
  loadRecord: (id) => getRequest(id),
  columnFilters: { C_BPartner_ID: 'IsCustomer eq true' },
})

const columnFilters = { C_BPartner_ID: 'IsCustomer eq true' }
const promoteMandatory = ['C_BPartner_ID']

const submitting = ref(false)
const errorMsg = ref('')

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
  if (!payload.C_BPartner_ID) {
    errorMsg.value = '請選擇諮詢客戶'
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
      payload.AD_Org_ID = authStore.context?.organizationId ?? 0
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

onMounted(async () => {
  await load()
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
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.form-error {
  background: #fef2f2;
  color: var(--color-error);
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.field-error {
  display: block;
  color: var(--color-error);
  font-size: 0.8125rem;
  margin-top: 0.25rem;
}

.attachment-section {
  margin-top: 1rem;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.attachment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  min-height: var(--min-touch);
}

.attachment-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.attachment-name {
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.attachment-delete {
  padding: 0.25rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-error);
  color: var(--color-error);
  border-radius: 6px;
  font-size: 0.8125rem;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.attachment-empty {
  color: #94a3b8;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.file-input {
  font-size: 0.875rem;
}

.upload-status {
  font-size: 0.875rem;
  color: var(--color-primary);
  margin-top: 0.25rem;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.form-actions button {
  flex: 1;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 1rem;
  min-height: var(--min-touch);
  cursor: pointer;
}

.form-actions button[type="submit"] {
  background: var(--color-primary);
  color: white;
  border: none;
}

.form-actions button[type="submit"]:hover {
  background: var(--color-primary-hover);
}

.form-actions button[type="submit"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--color-border);
}

.back-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
}
</style>
