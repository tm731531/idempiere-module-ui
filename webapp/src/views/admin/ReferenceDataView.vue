<template>
  <div class="ref-data-page">
    <div class="page-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ pageTitle }}</h2>
    </div>

    <!-- State 1: Table selector (when no table selected) -->
    <div v-if="!selectedTable" class="table-selector">
      <div
        v-for="t in managedTables"
        :key="t.tableName"
        class="table-card"
        @click="selectTable(t)"
      >
        <div class="table-name">{{ t.label }}</div>
        <div class="table-desc">{{ t.description }}</div>
      </div>
    </div>

    <!-- State 3: Record editing with DynamicForm -->
    <template v-else-if="editingRecordId">
      <div v-if="editFormLoading" class="loading-state">載入中...</div>
      <template v-else>
        <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>
        <DynamicForm
          :fieldDefs="editFieldDefs"
          :modelValue="editFormData"
          @update:modelValue="editFormData = $event"
        />
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

    <!-- State 2: Data list (when table selected, no record editing) -->
    <template v-else-if="selectedTable">
      <div v-if="loading" class="loading-state">載入中...</div>

      <template v-else>
        <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>

        <!-- Tax mode toggle (only for C_Tax) -->
        <div v-if="selectedTable.customSection === 'tax-mode'" class="tax-mode-section">
          <div class="tax-mode-title">計稅方式</div>
          <div v-if="priceLists.length === 0" class="empty-hint">尚無價目表</div>
          <div v-for="pl in priceLists" :key="pl.id" class="price-list-row">
            <span class="pl-name">{{ pl.name }}</span>
            <div class="tax-mode-toggle">
              <button
                type="button"
                :class="['toggle-btn', { active: !pl.isTaxIncluded }]"
                :disabled="pl.updating"
                @click="setTaxMode(pl, false)"
              >外加</button>
              <button
                type="button"
                :class="['toggle-btn', { active: pl.isTaxIncluded }]"
                :disabled="pl.updating"
                @click="setTaxMode(pl, true)"
              >內扣</button>
            </div>
          </div>
          <p class="hint-text">
            外加：價格未含稅，總計 = 小計 + 稅金<br/>
            內扣：價格已含稅，總計 = 小計
          </p>
        </div>

        <!-- Add form -->
        <div class="add-section">
          <div class="add-form">
            <input
              v-model="newName"
              type="text"
              class="form-input"
              placeholder="名稱（必填）"
            />
            <template v-if="selectedTable.extraFields">
              <input
                v-for="f in selectedTable.extraFields"
                :key="f.key"
                v-model.number="extraFieldValues[f.key]"
                :type="f.type"
                :min="f.min"
                :max="f.max"
                :step="f.step"
                :placeholder="f.label"
                class="form-input extra-input"
              />
            </template>
            <input
              v-if="!selectedTable.extraFields"
              v-model="newDescription"
              type="text"
              class="form-input"
              placeholder="說明（選填）"
            />
            <button
              type="button"
              class="add-btn"
              :disabled="!newName.trim() || adding"
              @click="handleAdd"
            >
              {{ adding ? '新增中...' : '新增' }}
            </button>
          </div>
        </div>

        <!-- Data list -->
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
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/api/client'
import { lookupOrgWarehouse, clearLookupCache, updatePriceListTaxIncluded } from '@/api/lookup'
import DynamicForm from '@/components/DynamicForm.vue'
import { useDocumentForm } from '@/composables/useDocumentForm'

interface ExtraField {
  key: string
  label: string
  type: 'number' | 'text'
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

interface ManagedTable {
  tableName: string
  label: string
  description: string
  idColumn: string
  tabId: number                  // AD_Tab_ID for DynamicForm metadata
  nameField?: string             // default 'Name'
  extraFields?: ExtraField[]
  displayColumns?: (rec: any) => string
  customSection?: 'tax-mode'
  extraDefaults?: () => Promise<Record<string, any>>
}

// R_RequestType needs R_StatusCategory_ID — find or create one
async function getStatusCategoryId(orgId: number): Promise<number> {
  const resp = await apiClient.get('/api/v1/models/R_StatusCategory', {
    params: { '$filter': 'IsActive eq true', '$select': 'R_StatusCategory_ID', '$top': '1' },
  })
  const records = resp.data.records || []
  if (records.length > 0) return records[0].id
  const createResp = await apiClient.post('/api/v1/models/R_StatusCategory', {
    AD_Org_ID: orgId, Name: 'Default', IsDefault: true,
  })
  return createResp.data.id
}

const router = useRouter()
const authStore = useAuthStore()

const managedTables: ManagedTable[] = [
  {
    tableName: 'R_RequestType', label: '諮詢類型',
    description: '設定諮詢單可選擇的類型，例如「初診諮詢」「回診追蹤」',
    idColumn: 'R_RequestType_ID', tabId: 437,
    async extraDefaults() {
      const orgId = authStore.context?.organizationId ?? 0
      const catId = await getStatusCategoryId(orgId)
      return {
        R_StatusCategory_ID: catId, ConfidentialType: 'C', DueDateTolerance: 7,
        IsDefault: false, IsSelfService: true, IsEMailWhenDue: false,
        IsEMailWhenOverdue: false, IsAutoChangeRequest: false,
        IsConfidentialInfo: false, IsIndexed: false,
      }
    },
  },
  { tableName: 'R_Category', label: '諮詢分類', description: '諮詢記錄的分類標籤', idColumn: 'R_Category_ID', tabId: 706 },
  { tableName: 'R_Group', label: '諮詢群組', description: '諮詢記錄的群組分類', idColumn: 'R_Group_ID', tabId: 705 },
  {
    tableName: 'C_BP_Group', label: '客戶群組',
    description: '客戶的分群管理，例如「VIP」「一般」',
    idColumn: 'C_BP_Group_ID', tabId: 322,
    async extraDefaults() {
      return { IsDefault: false, IsConfidentialInfo: false }
    },
  },
  {
    tableName: 'C_Tax', label: '稅率',
    description: '管理稅率，例如「營業稅 5%」',
    idColumn: 'C_Tax_ID', tabId: 174,
    customSection: 'tax-mode',
    extraFields: [
      { key: 'Rate', label: '稅率 (%)', type: 'number', min: 0, max: 100, step: 0.01 },
    ],
    displayColumns: (rec: any) => `${rec.Rate ?? 0}%`,
    async extraDefaults() {
      const catResp = await apiClient.get('/api/v1/models/C_TaxCategory', {
        params: { '$filter': 'IsActive eq true', '$select': 'C_TaxCategory_ID', '$orderby': 'IsDefault desc', '$top': '1' },
      })
      const catId = (catResp.data.records || [])[0]?.id
      if (!catId) throw new Error('找不到稅務類別')
      return {
        C_TaxCategory_ID: catId, SOPOType: 'B', IsDocumentLevel: true,
        IsSummary: false, IsDefault: false, IsSalesTax: false,
        RequiresTaxCertificate: false, ValidFrom: '1970-01-01T00:00:00Z',
      }
    },
  },
  {
    tableName: 'S_Resource', label: '服務人員',
    description: '預約可選擇的服務人員（醫師、美容師等）',
    idColumn: 'S_Resource_ID', tabId: 414,
    async extraDefaults() {
      const orgId = authStore.context?.organizationId ?? 0
      const whId = await lookupOrgWarehouse(orgId)
      if (!whId) throw new Error('找不到倉庫')
      const typeResp = await apiClient.get('/api/v1/models/S_ResourceType', {
        params: { '$filter': 'IsActive eq true', '$select': 'S_ResourceType_ID', '$orderby': 'Name asc', '$top': '1' },
      })
      const typeId = (typeResp.data.records || [])[0]?.id
      if (!typeId) throw new Error('找不到資源類型')
      return {
        S_ResourceType_ID: typeId, M_Warehouse_ID: whId,
        IsAvailable: true, PercentUtilization: 100,
      }
    },
  },
  {
    tableName: 'M_Locator', label: '儲位',
    description: '倉庫儲位管理（儲位名稱/編號）',
    idColumn: 'M_Locator_ID', tabId: 178,
    nameField: 'Value',
    async extraDefaults() {
      const orgId = authStore.context?.organizationId ?? 0
      const whId = await lookupOrgWarehouse(orgId)
      if (!whId) throw new Error('找不到倉庫')
      return {
        M_Warehouse_ID: whId, X: '0', Y: '0', Z: '0',
        IsDefault: false, PriorityNo: 50,
      }
    },
  },
]

// ========== State 2: List mode ==========
const selectedTable = ref<ManagedTable | null>(null)
const records = ref<{ id: number; name: string; description: string; extra?: string; Rate?: number }[]>([])
const loading = ref(false)
const adding = ref(false)
const errorMsg = ref('')
const newName = ref('')
const newDescription = ref('')
const extraFieldValues = reactive<Record<string, any>>({})

interface PriceListItem { id: number; name: string; isTaxIncluded: boolean; updating: boolean }
const priceLists = ref<PriceListItem[]>([])

// ========== State 3: Edit mode (DynamicForm) ==========
const editingRecordId = ref<number | null>(null)
const saving = ref(false)

// useDocumentForm returns reactive refs — we hold them here
let docForm: ReturnType<typeof useDocumentForm> | null = null
const editFieldDefs = ref<any[]>([])
const editFormData = ref<Record<string, any>>({})
const editFormLoading = ref(false)
const editIsValid = ref(true)

const pageTitle = computed(() => {
  if (editingRecordId.value && selectedTable.value) {
    return `編輯${selectedTable.value.label}`
  }
  return selectedTable.value ? selectedTable.value.label : '基礎資料管理'
})

// ========== List mode functions ==========

async function selectTable(t: ManagedTable) {
  selectedTable.value = t
  for (const key of Object.keys(extraFieldValues)) delete extraFieldValues[key]
  if (t.extraFields) {
    for (const f of t.extraFields) extraFieldValues[f.key] = f.type === 'number' ? 0 : ''
  }
  await loadRecords()
  if (t.customSection === 'tax-mode') {
    await loadPriceLists()
  }
}

async function loadRecords() {
  if (!selectedTable.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const t = selectedTable.value
    const nameField = t.nameField || 'Name'
    const selectFields = [t.idColumn, nameField]
    if (!t.extraFields) selectFields.push('Description')
    if (t.extraFields) {
      for (const f of t.extraFields) selectFields.push(f.key)
    }
    let filter = 'IsActive eq true'
    if (t.tableName === 'C_Tax') filter += ' and IsSummary eq false'

    const resp = await apiClient.get(`/api/v1/models/${t.tableName}`, {
      params: {
        '$filter': filter,
        '$select': selectFields.join(','),
        '$orderby': nameField,
      },
    })
    records.value = (resp.data.records || []).map((r: any) => ({
      id: r.id,
      name: r[nameField] || '',
      description: r.Description || '',
      extra: t.displayColumns ? t.displayColumns(r) : undefined,
      Rate: r.Rate,
    }))
  } catch {
    errorMsg.value = '載入資料失敗'
  } finally {
    loading.value = false
  }
}

async function loadPriceLists() {
  try {
    const resp = await apiClient.get('/api/v1/models/M_PriceList', {
      params: {
        '$filter': 'IsActive eq true',
        '$select': 'M_PriceList_ID,Name,IsTaxIncluded,IsSOPriceList',
        '$orderby': 'IsSOPriceList desc, Name asc',
        '$top': '50',
      },
    })
    priceLists.value = (resp.data.records || []).map((r: any) => ({
      id: r.id,
      name: r.Name || `#${r.id}`,
      isTaxIncluded: r.IsTaxIncluded === true,
      updating: false,
    }))
  } catch { /* silent */ }
}

async function setTaxMode(pl: PriceListItem, included: boolean) {
  if (pl.isTaxIncluded === included) return
  pl.updating = true
  errorMsg.value = ''
  try {
    await updatePriceListTaxIncluded(pl.id, included)
    pl.isTaxIncluded = included
  } catch {
    errorMsg.value = '切換計稅方式失敗'
  } finally {
    pl.updating = false
  }
}

async function handleAdd() {
  if (!selectedTable.value || !newName.value.trim()) return
  adding.value = true
  errorMsg.value = ''
  try {
    const t = selectedTable.value
    const orgId = authStore.context?.organizationId ?? 0
    const name = newName.value.trim()
    const nameField = t.nameField || 'Name'
    const payload: Record<string, any> = {
      AD_Org_ID: orgId,
      [nameField]: name,
    }
    if (t.tableName === 'C_BP_Group' || t.tableName === 'S_Resource') {
      payload.Value = name
    }
    if (t.nameField === 'Value') {
      // M_Locator uses Value as name
    } else if (t.tableName === 'S_Resource') {
      payload.Name = name
    }
    if (t.extraFields) {
      for (const f of t.extraFields) {
        payload[f.key] = extraFieldValues[f.key] ?? (f.type === 'number' ? 0 : '')
      }
    }
    if (t.tableName === 'C_Tax') {
      payload.IsTaxExempt = (payload.Rate === 0)
    }
    if (!t.extraFields && newDescription.value.trim()) {
      payload.Description = newDescription.value.trim()
    }
    if (t.extraDefaults) {
      const extras = await t.extraDefaults()
      Object.assign(payload, extras)
    }
    await apiClient.post(`/api/v1/models/${t.tableName}`, payload)
    newName.value = ''
    newDescription.value = ''
    if (t.extraFields) {
      for (const f of t.extraFields) extraFieldValues[f.key] = f.type === 'number' ? 0 : ''
    }
    if (t.tableName === 'C_Tax') clearLookupCache()
    await loadRecords()
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '新增失敗'
  } finally {
    adding.value = false
  }
}

async function handleDelete(id: number) {
  if (!selectedTable.value) return
  errorMsg.value = ''
  try {
    await apiClient.delete(`/api/v1/models/${selectedTable.value.tableName}/${id}`)
    if (selectedTable.value.tableName === 'C_Tax') clearLookupCache()
    await loadRecords()
  } catch {
    errorMsg.value = '刪除失敗，可能有關聯資料'
  }
}

// ========== Edit mode functions (DynamicForm) ==========

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

    // Sync reactive state from docForm
    editFieldDefs.value = docForm.visibleFieldDefs.value
    editFormData.value = { ...docForm.formData.value }
    editIsValid.value = docForm.isValid.value

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
  if (!selectedTable.value || !editingRecordId.value || !docForm) return
  // Sync form data back to docForm
  docForm.formData.value = editFormData.value
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = docForm.getUpdatePayload()
    await apiClient.put(
      `/api/v1/models/${selectedTable.value.tableName}/${editingRecordId.value}`,
      payload,
    )
    if (selectedTable.value.tableName === 'C_Tax') clearLookupCache()
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
  docForm = null
  editFieldDefs.value = []
  editFormData.value = {}
}

function goBack() {
  if (editingRecordId.value) {
    cancelEdit()
  } else if (selectedTable.value) {
    selectedTable.value = null
    records.value = []
    priceLists.value = []
  } else {
    router.push({ name: 'home' })
  }
}
</script>

<style scoped>
.ref-data-page {
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

/* Tax mode section */
.tax-mode-section {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.tax-mode-title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.empty-hint {
  font-size: 0.8125rem;
  color: #94a3b8;
}

.price-list-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  min-height: var(--min-touch);
}

.pl-name {
  font-size: 0.875rem;
  font-weight: 500;
}

.tax-mode-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.toggle-btn {
  padding: 0.375rem 0.75rem;
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  cursor: pointer;
  min-height: 36px;
  color: var(--color-text);
}

.toggle-btn.active {
  background: var(--color-primary);
  color: white;
}

.toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint-text {
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0.5rem 0 0;
  line-height: 1.5;
}

/* Add form */
.add-section {
  margin-bottom: 1rem;
}

.add-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.form-input {
  flex: 1;
  min-width: 120px;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  min-height: var(--min-touch);
}

.extra-input {
  max-width: 120px;
  min-width: 80px;
  flex: 0 1 auto;
}

.add-btn {
  padding: 0.625rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  min-height: var(--min-touch);
  white-space: nowrap;
}

.add-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.add-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

/* Edit mode actions */
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
