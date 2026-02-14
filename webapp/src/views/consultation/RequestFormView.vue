<template>
  <div class="request-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isEdit ? '編輯諮詢' : '新增諮詢' }}</h2>
    </div>

    <div v-if="pageLoading" class="loading-state">載入中...</div>

    <div v-else-if="pageError" class="form-error">{{ pageError }}</div>

    <form v-else @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>客戶</label>
        <SearchSelector
          v-model="form.C_BPartner_ID"
          tableName="C_BPartner"
          displayField="Name"
          searchField="Name"
          filter="IsCustomer eq true"
        />
      </div>

      <div class="form-group">
        <label>諮詢類型 <span class="required">*</span></label>
        <div class="select-with-add">
          <select v-model="form.R_RequestType_ID" required class="form-select">
            <option value="">-- 請選擇 --</option>
            <option
              v-for="rt in requestTypes"
              :key="rt.id"
              :value="rt.id"
            >
              {{ rt.Name }}
            </option>
          </select>
          <button type="button" class="btn-add-type" @click="showAddType = true">+</button>
        </div>
        <!-- Inline add request type -->
        <div v-if="showAddType" class="add-type-row">
          <input
            v-model="newTypeName"
            type="text"
            class="add-type-input"
            placeholder="輸入新類型名稱"
            @keyup.enter="handleAddType"
          />
          <button type="button" class="btn-confirm-add" :disabled="addingType" @click="handleAddType">
            {{ addingType ? '...' : '新增' }}
          </button>
          <button type="button" class="btn-cancel-add" @click="showAddType = false; newTypeName = ''">取消</button>
        </div>
        <div v-if="addTypeError" class="field-error">{{ addTypeError }}</div>
      </div>

      <div v-if="isEdit" class="form-group">
        <label>狀態</label>
        <select v-model="form.R_Status_ID" class="form-select">
          <option value="">-- 請選擇 --</option>
          <option
            v-for="s in statuses"
            :key="s.id"
            :value="s.id"
          >
            {{ s.Name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>摘要 <span class="required">*</span></label>
        <textarea
          v-model="form.Summary"
          required
          rows="4"
          class="form-textarea"
          placeholder="請輸入諮詢摘要..."
        ></textarea>
      </div>

      <!-- Attachment section -->
      <div v-if="isEdit" class="form-group">
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/api/client'
import { useAttachment } from '@/composables/useAttachment'
import SearchSelector from '@/components/SearchSelector.vue'
import {
  getRequest,
  createRequest,
  updateRequest,
  listRequestTypes,
  listRequestStatuses,
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

const form = reactive({
  C_BPartner_ID: null as number | null,
  R_RequestType_ID: '' as number | string,
  R_Status_ID: '' as number | string,
  Summary: '',
})

const requestTypes = ref<any[]>([])
const statuses = ref<any[]>([])
const pageLoading = ref(false)
const pageError = ref('')
const submitting = ref(false)
const errorMsg = ref('')

// Add request type inline
const showAddType = ref(false)
const newTypeName = ref('')
const addingType = ref(false)
const addTypeError = ref('')

const {
  attachments,
  uploading,
  error: attachError,
  thumbnailUrls,
  loadAttachments,
  upload,
  remove,
} = useAttachment('R_Request')

async function loadData() {
  pageLoading.value = true
  pageError.value = ''
  try {
    const [types] = await Promise.all([
      listRequestTypes(),
      isEdit.value ? loadExisting() : Promise.resolve(),
    ])
    requestTypes.value = types

    if (isEdit.value) {
      const statusList = await listRequestStatuses()
      statuses.value = statusList
    }
  } catch {
    pageError.value = '載入資料失敗'
  } finally {
    pageLoading.value = false
  }
}

async function loadExisting() {
  if (!requestId.value) return
  const data = await getRequest(requestId.value)

  form.C_BPartner_ID = data.C_BPartner_ID?.id ?? null
  form.R_RequestType_ID = data.R_RequestType_ID?.id ?? ''
  form.R_Status_ID = data.R_Status_ID?.id ?? ''
  form.Summary = data.Summary || ''

  await loadAttachments(requestId.value)
}

async function handleSubmit() {
  errorMsg.value = ''

  if (!form.R_RequestType_ID) {
    errorMsg.value = '請選擇諮詢類型'
    return
  }
  if (!form.Summary.trim()) {
    errorMsg.value = '請輸入摘要'
    return
  }

  submitting.value = true
  try {
    const orgId = authStore.context?.organizationId ?? 0

    if (isEdit.value && requestId.value) {
      const payload: Record<string, any> = {
        Summary: form.Summary.trim(),
        R_RequestType_ID: Number(form.R_RequestType_ID),
      }
      if (form.C_BPartner_ID !== null) {
        payload.C_BPartner_ID = form.C_BPartner_ID
      }
      if (form.R_Status_ID) {
        payload.R_Status_ID = Number(form.R_Status_ID)
      }
      await updateRequest(requestId.value, payload)
      router.push({ name: 'consultation-list' })
    } else {
      const payload: Record<string, any> = {
        R_RequestType_ID: Number(form.R_RequestType_ID),
        Summary: form.Summary.trim(),
        AD_Org_ID: orgId,
      }
      if (form.C_BPartner_ID !== null) {
        payload.C_BPartner_ID = form.C_BPartner_ID
      }
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

async function handleAddType() {
  const name = newTypeName.value.trim()
  if (!name) return
  addingType.value = true
  addTypeError.value = ''
  try {
    const orgId = authStore.context?.organizationId ?? 0
    const resp = await apiClient.post('/api/v1/models/R_RequestType', {
      Name: name,
      AD_Org_ID: orgId,
    })
    const newId = resp.data.id
    requestTypes.value.push({ id: newId, Name: name })
    form.R_RequestType_ID = newId
    showAddType.value = false
    newTypeName.value = ''
  } catch {
    addTypeError.value = '新增類型失敗'
  } finally {
    addingType.value = false
  }
}

function goBack() {
  router.push({ name: 'consultation-list' })
}

onMounted(() => {
  loadData()
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

.required {
  color: var(--color-error);
}

.select-with-add {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.select-with-add .form-select {
  flex: 1;
}

.btn-add-type {
  width: 44px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  background: white;
  color: var(--color-primary);
  font-size: 1.25rem;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-add-type:hover {
  background: var(--color-primary);
  color: white;
}

.add-type-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.add-type-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  min-height: var(--min-touch);
}

.btn-confirm-add {
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  min-height: var(--min-touch);
}

.btn-confirm-add:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-cancel-add {
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  min-height: var(--min-touch);
}

.form-select,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1rem;
  min-height: var(--min-touch);
  font-family: inherit;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.field-error {
  display: block;
  color: var(--color-error);
  font-size: 0.8125rem;
  margin-top: 0.25rem;
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
