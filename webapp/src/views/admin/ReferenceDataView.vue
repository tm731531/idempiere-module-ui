<template>
  <div class="ref-data-page">
    <div class="page-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ pageTitle }}</h2>
    </div>

    <!-- Table selector (when no table selected) -->
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

    <!-- Data list (when table selected) -->
    <template v-else>
      <div v-if="loading" class="loading-state">載入中...</div>

      <template v-else>
        <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>

        <!-- Add form -->
        <div class="add-section">
          <div class="add-form">
            <input
              v-model="newName"
              type="text"
              class="form-input"
              placeholder="名稱（必填）"
            />
            <input
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
            class="data-row"
          >
            <div class="data-info">
              <span class="data-name">{{ rec.name }}</span>
              <span v-if="rec.description" class="data-desc">{{ rec.description }}</span>
            </div>
            <button
              type="button"
              class="delete-btn"
              @click="handleDelete(rec.id)"
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
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/api/client'

interface ManagedTable {
  tableName: string
  label: string
  description: string
  idColumn: string
  extraDefaults?: () => Promise<Record<string, any>>
}

// R_RequestType needs R_StatusCategory_ID — find or create one
async function getStatusCategoryId(orgId: number): Promise<number> {
  const resp = await apiClient.get('/api/v1/models/R_StatusCategory', {
    params: { '$filter': 'IsActive eq true', '$select': 'R_StatusCategory_ID', '$top': '1' },
  })
  const records = resp.data.records || []
  if (records.length > 0) return records[0].id
  // Create a default one
  const createResp = await apiClient.post('/api/v1/models/R_StatusCategory', {
    AD_Org_ID: orgId, Name: 'Default', IsDefault: true,
  })
  return createResp.data.id
}

const managedTables: ManagedTable[] = [
  {
    tableName: 'R_RequestType', label: '諮詢類型',
    description: '設定諮詢單可選擇的類型，例如「初診諮詢」「回診追蹤」', idColumn: 'R_RequestType_ID',
    async extraDefaults() {
      const orgId = authStore.context?.organizationId ?? 0
      const catId = await getStatusCategoryId(orgId)
      return {
        R_StatusCategory_ID: catId,
        ConfidentialType: 'C',
        DueDateTolerance: 7,
        IsDefault: false,
        IsSelfService: true,
        IsEMailWhenDue: false,
        IsEMailWhenOverdue: false,
        IsAutoChangeRequest: false,
        IsConfidentialInfo: false,
        IsIndexed: false,
      }
    },
  },
  { tableName: 'R_Category', label: '諮詢分類', description: '諮詢記錄的分類標籤', idColumn: 'R_Category_ID' },
  { tableName: 'R_Group', label: '諮詢群組', description: '諮詢記錄的群組分類', idColumn: 'R_Group_ID' },
  {
    tableName: 'C_BP_Group', label: '客戶群組',
    description: '客戶的分群管理，例如「VIP」「一般」', idColumn: 'C_BP_Group_ID',
    async extraDefaults() {
      return { IsDefault: false, IsConfidentialInfo: false }
    },
  },
]

const router = useRouter()
const authStore = useAuthStore()

const selectedTable = ref<ManagedTable | null>(null)
const records = ref<{ id: number; name: string; description: string }[]>([])
const loading = ref(false)
const adding = ref(false)
const errorMsg = ref('')
const newName = ref('')
const newDescription = ref('')

const pageTitle = computed(() =>
  selectedTable.value ? selectedTable.value.label : '基礎資料管理'
)

async function selectTable(t: ManagedTable) {
  selectedTable.value = t
  await loadRecords()
}

async function loadRecords() {
  if (!selectedTable.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const t = selectedTable.value
    const resp = await apiClient.get(`/api/v1/models/${t.tableName}`, {
      params: {
        '$filter': 'IsActive eq true',
        '$select': `${t.idColumn},Name,Description`,
        '$orderby': 'Name',
      },
    })
    records.value = (resp.data.records || []).map((r: any) => ({
      id: r.id,
      name: r.Name || '',
      description: r.Description || '',
    }))
  } catch {
    errorMsg.value = '載入資料失敗'
  } finally {
    loading.value = false
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
    const payload: Record<string, any> = {
      AD_Org_ID: orgId,
      Name: name,
    }
    // C_BP_Group requires Value
    if (t.tableName === 'C_BP_Group') {
      payload.Value = name
    }
    if (newDescription.value.trim()) {
      payload.Description = newDescription.value.trim()
    }
    // Merge table-specific mandatory defaults
    if (t.extraDefaults) {
      const extras = await t.extraDefaults()
      Object.assign(payload, extras)
    }
    await apiClient.post(`/api/v1/models/${t.tableName}`, payload)
    newName.value = ''
    newDescription.value = ''
    await loadRecords()
  } catch {
    errorMsg.value = '新增失敗'
  } finally {
    adding.value = false
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

function goBack() {
  if (selectedTable.value) {
    selectedTable.value = null
    records.value = []
  } else {
    router.push({ name: 'home' })
  }
}
</script>

<style scoped>
.ref-data-page {
  padding: 1rem;
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

.data-info {
  flex: 1;
}

.data-name {
  display: block;
  font-size: 0.9375rem;
  font-weight: 500;
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
</style>
