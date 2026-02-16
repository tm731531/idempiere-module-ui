<template>
  <div class="dimension-page">
    <div class="page-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ pageTitle }}</h2>
    </div>

    <!-- State 1: Table selector -->
    <div v-if="!selectedTable" class="table-selector">
      <div
        v-for="t in dimensionTables"
        :key="t.tableName"
        class="table-card"
        @click="selectTable(t)"
      >
        <div class="table-name">{{ t.label }}</div>
        <div class="table-desc">{{ t.description }}</div>
      </div>
    </div>

    <!-- State 3: Create/Edit with DynamicForm -->
    <template v-else-if="editMode">
      <div v-if="editFormLoading" class="loading-state">載入中...</div>
      <template v-else>
        <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>
        <DynamicForm
          :fieldDefs="editFieldDefs"
          :modelValue="editFormData"
          @update:modelValue="editFormData = $event"
        />
        <div v-if="editMandatoryErrors.length > 0" class="mandatory-banner">
          尚有必填欄位未填: {{ editMandatoryErrors.join('、') }}
        </div>
        <div class="edit-actions">
          <button type="button" class="cancel-btn" @click="cancelEdit">取消</button>
          <button
            type="button"
            class="save-btn"
            :disabled="saving || !editIsValid"
            @click="handleSave"
          >
            {{ saving ? '儲存中...' : '儲存' }}
          </button>
        </div>
      </template>
    </template>

    <!-- State 2: Record list -->
    <template v-else-if="selectedTable">
      <div v-if="loading" class="loading-state">載入中...</div>

      <template v-else>
        <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>

        <div v-if="records.length === 0" class="empty-state">
          尚無資料，請新增
        </div>

        <div v-else class="data-list">
          <div
            v-for="rec in records"
            :key="rec.id"
            class="data-row clickable"
            @click="startEdit(rec.id)"
          >
            <div class="data-info">
              <span class="data-name">{{ rec.name }}</span>
              <span v-if="rec.extra" class="data-extra">{{ rec.extra }}</span>
              <span v-else-if="rec.description" class="data-desc">{{ rec.description }}</span>
            </div>
            <button
              type="button"
              class="delete-btn"
              @click.stop="handleDelete(rec.id)"
            >
              刪除
            </button>
          </div>
        </div>

        <button type="button" class="add-fab" @click="startCreate">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          新增{{ selectedTable.label }}
        </button>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/api/client'
import { lookupDefaultCurrencyId } from '@/api/lookup'
import DynamicForm from '@/components/DynamicForm.vue'
import { useDocumentForm } from '@/composables/useDocumentForm'

interface DimensionTable {
  tableName: string
  label: string
  description: string
  idColumn: string
  tabId: number
  nameField?: string
  displayColumns?: (rec: any) => string
  extraDefaults?: () => Promise<Record<string, any>>
}

const router = useRouter()
const authStore = useAuthStore()

const dimensionTables: DimensionTable[] = [
  {
    tableName: 'C_Activity', label: '活動',
    description: '成本追蹤的活動維度',
    idColumn: 'C_Activity_ID', tabId: 249,
    async extraDefaults() {
      return { IsSummary: false }
    },
  },
  {
    tableName: 'C_Campaign', label: '行銷活動',
    description: '行銷活動與費用追蹤',
    idColumn: 'C_Campaign_ID', tabId: 201,
    displayColumns: (rec: any) => rec.Costs ? `費用: ${Number(rec.Costs).toLocaleString()}` : '',
    async extraDefaults() {
      return { IsSummary: false, Costs: 0 }
    },
  },
  {
    tableName: 'C_Project', label: '專案',
    description: '專案管理與成本追蹤',
    idColumn: 'C_Project_ID', tabId: 157,
    async extraDefaults() {
      const currencyId = await lookupDefaultCurrencyId()
      return { C_Currency_ID: currencyId }
    },
  },
]

// ========== State 2: List mode ==========
const selectedTable = ref<DimensionTable | null>(null)
const records = ref<{ id: number; name: string; description: string; extra?: string }[]>([])
const loading = ref(false)
const errorMsg = ref('')

// ========== State 3: Edit/Create mode ==========
const editingRecordId = ref<number | null>(null)
const isCreating = ref(false)
const saving = ref(false)

let docForm: ReturnType<typeof useDocumentForm> | null = null
const editFieldDefs = ref<any[]>([])
const editFormData = ref<Record<string, any>>({})
const editFormLoading = ref(false)
const editIsValid = ref(true)
const editMandatoryErrors = ref<string[]>([])

const editMode = computed(() => editingRecordId.value !== null || isCreating.value)

const pageTitle = computed(() => {
  if (isCreating.value && selectedTable.value) {
    return `新增${selectedTable.value.label}`
  }
  if (editingRecordId.value && selectedTable.value) {
    return `編輯${selectedTable.value.label}`
  }
  return selectedTable.value ? selectedTable.value.label : '行銷設定'
})

// ========== List mode functions ==========

async function selectTable(t: DimensionTable) {
  selectedTable.value = t
  await loadRecords()
}

async function loadRecords() {
  if (!selectedTable.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const t = selectedTable.value
    const nameField = t.nameField || 'Name'
    const selectFields = [t.idColumn, nameField, 'Description']
    if (t.displayColumns) {
      // Add Costs for Campaign
      if (t.tableName === 'C_Campaign') selectFields.push('Costs')
    }

    const resp = await apiClient.get(`/api/v1/models/${t.tableName}`, {
      params: {
        '$filter': 'IsActive eq true',
        '$select': selectFields.join(','),
        '$orderby': nameField,
      },
    })
    records.value = (resp.data.records || []).map((r: any) => ({
      id: r.id,
      name: r[nameField] || '',
      description: r.Description || '',
      extra: t.displayColumns ? t.displayColumns(r) : undefined,
    }))
  } catch {
    errorMsg.value = '載入資料失敗'
  } finally {
    loading.value = false
  }
}

async function handleDelete(id: number) {
  if (!selectedTable.value) return
  errorMsg.value = ''
  try {
    await apiClient.delete(`/api/v1/models/${selectedTable.value.tableName}/${id}`)
    await loadRecords()
  } catch {
    errorMsg.value = '刪除失敗，可能有關聯資料'
  }
}

// ========== Create mode functions ==========

async function startCreate() {
  if (!selectedTable.value) return
  isCreating.value = true
  editFormLoading.value = true
  errorMsg.value = ''

  const t = selectedTable.value
  try {
    docForm = useDocumentForm({
      tabId: t.tabId,
      recordId: computed(() => null),
    })

    await docForm.load()

    // Merge extra defaults
    if (t.extraDefaults) {
      const extras = await t.extraDefaults()
      for (const [key, value] of Object.entries(extras)) {
        if (docForm.formData.value[key] === null || docForm.formData.value[key] === undefined) {
          docForm.formData.value[key] = value
        }
      }
    }

    editFieldDefs.value = docForm.visibleFieldDefs.value
    editFormData.value = { ...docForm.formData.value }
    editIsValid.value = docForm.isValid.value
    editMandatoryErrors.value = docForm.mandatoryErrors.value

    if (docForm.pageError.value) {
      errorMsg.value = docForm.pageError.value
    }
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '載入失敗'
  } finally {
    editFormLoading.value = false
  }
}

// ========== Edit mode functions ==========

async function startEdit(recId: number) {
  if (!selectedTable.value) return
  editingRecordId.value = recId
  editFormLoading.value = true
  errorMsg.value = ''

  const t = selectedTable.value
  try {
    docForm = useDocumentForm({
      tabId: t.tabId,
      recordId: computed(() => editingRecordId.value),
      loadRecord: (id: number) =>
        apiClient.get(`/api/v1/models/${t.tableName}/${id}`).then(r => r.data),
    })

    await docForm.load()

    editFieldDefs.value = docForm.visibleFieldDefs.value
    editFormData.value = { ...docForm.formData.value }
    editIsValid.value = docForm.isValid.value
    editMandatoryErrors.value = docForm.mandatoryErrors.value

    if (docForm.pageError.value) {
      errorMsg.value = docForm.pageError.value
    }
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '載入失敗'
  } finally {
    editFormLoading.value = false
  }
}

async function handleSave() {
  if (!selectedTable.value || !docForm) return

  // Sync form data back to docForm
  docForm.formData.value = editFormData.value
  // Re-check validity after sync
  editMandatoryErrors.value = docForm.mandatoryErrors.value
  editIsValid.value = docForm.isValid.value
  if (!docForm.isValid.value) return

  saving.value = true
  errorMsg.value = ''

  try {
    const t = selectedTable.value
    const orgId = authStore.context?.organizationId ?? 0

    if (isCreating.value) {
      // Create mode
      const payload = docForm.getFormPayload()
      payload.AD_Org_ID = orgId
      // Auto-fill Value from Name if missing
      if (!payload.Value && payload.Name) {
        payload.Value = payload.Name
      }
      await apiClient.post(`/api/v1/models/${t.tableName}`, payload)
    } else if (editingRecordId.value) {
      // Edit mode
      const payload = docForm.getUpdatePayload()
      await apiClient.put(
        `/api/v1/models/${t.tableName}/${editingRecordId.value}`,
        payload,
      )
    }

    cancelEdit()
    await loadRecords()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    errorMsg.value = err.response?.data?.detail || err.message || '儲存失敗'
  } finally {
    saving.value = false
  }
}

function cancelEdit() {
  editingRecordId.value = null
  isCreating.value = false
  docForm = null
  editFieldDefs.value = []
  editFormData.value = {}
  editMandatoryErrors.value = []
}

function goBack() {
  if (editMode.value) {
    cancelEdit()
  } else if (selectedTable.value) {
    selectedTable.value = null
    records.value = []
  } else {
    router.push({ name: 'home' })
  }
}
</script>

<style scoped>
.dimension-page {
  padding: 1rem;
  padding-bottom: 5rem;
  max-width: 600px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header h2 {
  font-size: 1.25rem;
  margin: 0;
}

.back-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
}

.table-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.table-card {
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  min-height: var(--min-touch);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.table-card:hover {
  border-color: var(--color-primary);
}

.table-name {
  font-size: 1rem;
  font-weight: 600;
}

.table-desc {
  font-size: 0.8125rem;
  color: #64748b;
  margin-top: 0.125rem;
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

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
}

.data-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.data-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  min-height: var(--min-touch);
}

.data-row.clickable {
  cursor: pointer;
}

.data-row.clickable:hover {
  border-color: var(--color-primary);
}

.data-info {
  flex: 1;
}

.data-name {
  display: inline;
  font-size: 0.9375rem;
  font-weight: 500;
}

.data-extra {
  display: inline;
  font-size: 0.875rem;
  color: #64748b;
  margin-left: 0.5rem;
}

.data-desc {
  display: block;
  font-size: 0.8125rem;
  color: #64748b;
  margin-top: 0.125rem;
}

.delete-btn {
  padding: 0.25rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-error);
  color: var(--color-error);
  border-radius: 6px;
  font-size: 0.8125rem;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 0.75rem;
}

.add-fab {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 24px;
  font-size: 1rem;
  min-height: var(--min-touch);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.add-fab:hover {
  background: var(--color-primary-hover);
}

.mandatory-banner {
  background: #fffbeb;
  color: #92400e;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-top: 0.75rem;
}

.edit-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.cancel-btn {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.9375rem;
  cursor: pointer;
  min-height: var(--min-touch);
}

.save-btn {
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  cursor: pointer;
  min-height: var(--min-touch);
}

.save-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
