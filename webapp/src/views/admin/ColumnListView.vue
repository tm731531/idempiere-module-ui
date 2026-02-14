<template>
  <div class="column-list-page">
    <!-- Table info -->
    <div class="table-info">
      <span class="table-badge">{{ tableName }}</span>
      <span class="col-count" v-if="!loading">{{ columns.length }} columns</span>
    </div>

    <!-- Filter -->
    <div class="filter-bar">
      <input
        v-model="filterText"
        type="text"
        class="filter-input"
        placeholder="篩選欄位..."
      />
      <label class="filter-toggle">
        <input type="checkbox" v-model="mandatoryOnly" />
        僅必填
      </label>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">載入中...</div>

    <!-- Column list -->
    <div v-else-if="filteredColumns.length > 0" class="column-list">
      <div
        v-for="col in filteredColumns"
        :key="col.id"
        class="column-card"
        :class="{ 'is-key': col.isKey, 'is-mandatory': col.isMandatory }"
        @click="expandColumn(col.id)"
      >
        <div class="col-header">
          <div class="col-main">
            <span class="col-name">{{ col.columnName }}</span>
            <span class="col-label">{{ col.name }}</span>
          </div>
          <div class="col-badges">
            <span v-if="col.isKey" class="badge badge-key">PK</span>
            <span v-if="col.isMandatory" class="badge badge-mandatory">必填</span>
            <span v-if="!col.isUpdateable" class="badge badge-readonly">唯讀</span>
            <span class="badge badge-type">{{ col.referenceType }}</span>
          </div>
        </div>

        <!-- Expanded detail -->
        <div v-if="expandedId === col.id" class="col-detail" @click.stop>
          <div class="detail-top">
            <button class="btn-close" @click="expandedId = null">&#10005; 收合</button>
          </div>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Reference Type</span>
              <span class="detail-value">{{ col.referenceType }} ({{ col.referenceId }})</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Field Length</span>
              <span class="detail-value">{{ col.fieldLength }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Default Value</span>
              <span class="detail-value">{{ col.defaultValue || '(none)' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Validation Rule</span>
              <span class="detail-value">{{ col.validationRule || '(none)' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">IsMandatory</span>
              <span class="detail-value">{{ col.isMandatory ? 'Yes' : 'No' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">IsUpdateable</span>
              <span class="detail-value">{{ col.isUpdateable ? 'Yes' : 'No' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">IsKey</span>
              <span class="detail-value">{{ col.isKey ? 'Yes' : 'No' }}</span>
            </div>
          </div>

          <!-- Edit controls -->
          <div class="edit-section">
            <h4>修改設定</h4>
            <div class="edit-row">
              <label>
                <input type="checkbox" v-model="editForm.isMandatory" /> IsMandatory
              </label>
              <label>
                <input type="checkbox" v-model="editForm.isUpdateable" /> IsUpdateable
              </label>
            </div>
            <div class="edit-row">
              <label class="edit-label">DefaultValue</label>
              <input v-model="editForm.defaultValue" type="text" class="edit-input" placeholder="(空)" />
            </div>
            <div class="edit-actions">
              <button class="btn-save" :disabled="saving" @click.stop="handleSave(col)">
                {{ saving ? '儲存中...' : '儲存' }}
              </button>
              <span v-if="saveMsg" :class="saveMsg.startsWith('✓') ? 'save-ok' : 'save-err'">{{ saveMsg }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      {{ filterText ? '沒有符合的欄位' : '此 Table 沒有欄位' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getTableColumns, updateColumn, type ColumnInfo } from '@/api/dictionary'

const route = useRoute()
const tableId = computed(() => Number(route.params.tableId) || 0)
const tableName = computed(() => (route.query.name as string) || `Table #${tableId.value}`)

const columns = ref<ColumnInfo[]>([])
const loading = ref(false)
const filterText = ref('')
const mandatoryOnly = ref(false)
const expandedId = ref<number | null>(null)

const editForm = reactive({ isMandatory: false, isUpdateable: false, defaultValue: '' })
const saving = ref(false)
const saveMsg = ref('')

const filteredColumns = computed(() => {
  let list = columns.value
  if (mandatoryOnly.value) {
    list = list.filter(c => c.isMandatory)
  }
  if (filterText.value.trim()) {
    const q = filterText.value.trim().toLowerCase()
    list = list.filter(c =>
      c.columnName.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    )
  }
  return list
})

function expandColumn(colId: number) {
  if (expandedId.value === colId) return
  expandedId.value = colId
  const col = columns.value.find(c => c.id === colId)
  if (col) {
    editForm.isMandatory = col.isMandatory
    editForm.isUpdateable = col.isUpdateable
    editForm.defaultValue = col.defaultValue
  }
  saveMsg.value = ''
}

async function handleSave(col: ColumnInfo) {
  saving.value = true
  saveMsg.value = ''
  try {
    await updateColumn(col.id, {
      IsMandatory: editForm.isMandatory,
      IsUpdateable: editForm.isUpdateable,
      DefaultValue: editForm.defaultValue || null,
    })
    // Update local state
    col.isMandatory = editForm.isMandatory
    col.isUpdateable = editForm.isUpdateable
    col.defaultValue = editForm.defaultValue
    saveMsg.value = '✓ 已儲存'
  } catch (e: any) {
    saveMsg.value = e.message || '儲存失敗'
  } finally {
    saving.value = false
  }
}

async function loadColumns() {
  if (!tableId.value) return
  loading.value = true
  try {
    columns.value = await getTableColumns(tableId.value)
  } catch {
    columns.value = []
  } finally {
    loading.value = false
  }
}

watch(tableId, loadColumns)
onMounted(loadColumns)
</script>

<style scoped>
.column-list-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
}

.table-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.table-badge {
  font-family: monospace;
  font-size: 1rem;
  font-weight: 700;
  background: #f1f5f9;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
}

.col-count {
  font-size: 0.8125rem;
  color: #64748b;
}

.filter-bar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.filter-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  min-height: var(--min-touch);
}

.filter-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.filter-toggle {
  font-size: 0.8125rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
  cursor: pointer;
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.column-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.column-card {
  padding: 0.625rem 0.75rem;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.column-card:hover {
  border-color: var(--color-primary);
}

.column-card.is-key {
  border-left: 3px solid #f59e0b;
}

.column-card.is-mandatory:not(.is-key) {
  border-left: 3px solid var(--color-primary);
}

.col-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.col-main {
  min-width: 0;
}

.col-name {
  font-family: monospace;
  font-size: 0.875rem;
  font-weight: 600;
  display: block;
}

.col-label {
  font-size: 0.75rem;
  color: #64748b;
}

.col-badges {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.0625rem 0.375rem;
  border-radius: 4px;
  white-space: nowrap;
}

.badge-key {
  background: #fef3c7;
  color: #92400e;
}

.badge-mandatory {
  background: #fee2e2;
  color: #991b1b;
}

.badge-readonly {
  background: #f1f5f9;
  color: #475569;
}

.badge-type {
  background: #e0e7ff;
  color: #3730a3;
}

/* Expanded detail */
.detail-top {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.btn-close {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: #f8fafc;
  cursor: pointer;
  font-size: 0.75rem;
  color: #64748b;
}

.btn-close:hover {
  background: #fee2e2;
  color: var(--color-error);
  border-color: var(--color-error);
}

.col-detail {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f1f5f9;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

@media (max-width: 480px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

.detail-item {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 0.6875rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.detail-value {
  font-size: 0.8125rem;
  font-family: monospace;
  word-break: break-all;
}

/* Edit section */
.edit-section {
  border-top: 1px solid #e2e8f0;
  padding-top: 0.75rem;
}

.edit-section h4 {
  font-size: 0.8125rem;
  margin: 0 0 0.5rem;
  color: var(--color-text);
}

.edit-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.8125rem;
}

.edit-label {
  font-size: 0.8125rem;
  min-width: 80px;
  flex-shrink: 0;
}

.edit-input {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-family: monospace;
}

.edit-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.btn-save {
  padding: 0.375rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  cursor: pointer;
  min-height: var(--min-touch);
}

.btn-save:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-ok {
  font-size: 0.8125rem;
  color: var(--color-success);
}

.save-err {
  font-size: 0.8125rem;
  color: var(--color-error);
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
}
</style>
