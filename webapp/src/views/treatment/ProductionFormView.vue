<template>
  <div class="production-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isCreate ? '新增療程' : '療程明細' }}</h2>
    </div>

    <div v-if="pageLoading" class="loading-state">載入中...</div>

    <div v-else-if="pageError" class="form-error">{{ pageError }}</div>

    <template v-else>
      <!-- Production Header -->
      <div class="form-section">
        <div v-if="!isCreate && production" class="production-info">
          <span class="production-docno">{{ production.DocumentNo }}</span>
          <StatusBadge :status="docStatus" />
        </div>

        <div class="form-group">
          <label>療程項目 <span class="required">*</span></label>
          <SearchSelector
            v-model="form.M_Product_ID"
            tableName="M_Product"
            displayField="Name"
            searchField="Name"
            :disabled="readOnly"
          />
        </div>

        <div class="inline-fields">
          <div class="form-group">
            <label>數量 <span class="required">*</span></label>
            <input
              v-model.number="form.ProductionQty"
              type="number"
              min="1"
              class="form-input"
              :disabled="readOnly"
            />
          </div>
          <div class="form-group">
            <label>日期</label>
            <input
              v-model="form.MovementDateStr"
              type="date"
              class="form-input"
              :disabled="readOnly"
            />
          </div>
        </div>

        <div class="form-group">
          <label>備註</label>
          <textarea
            v-model="form.Description"
            rows="2"
            class="form-textarea"
            placeholder="選填備註..."
            :disabled="readOnly"
          ></textarea>
        </div>
      </div>

      <!-- Save header button (create mode) -->
      <div v-if="isCreate" class="form-actions">
        <button
          type="button"
          class="cancel-btn"
          @click="goBack"
        >
          取消
        </button>
        <button
          type="button"
          :disabled="saving || !form.M_Product_ID"
          @click="handleCreateProduction"
        >
          {{ saving ? '建立中...' : '建立療程' }}
        </button>
      </div>

      <!-- Production Lines (only when production exists) -->
      <div v-if="!isCreate && productionId" class="form-section">
        <h3 class="section-title">耗材明細</h3>

        <div v-if="lines.length === 0 && !linesLoading" class="empty-lines">
          尚無耗材
        </div>

        <div v-if="linesLoading" class="loading-state">載入明細中...</div>

        <div v-else class="lines-table">
          <div v-for="line in lines" :key="line.id" class="line-row">
            <div class="line-info">
              <span class="line-product">{{ getProductName(line) }}</span>
              <span class="line-detail">
                數量: {{ line.MovementQty }}
                <template v-if="line.Description"> | {{ line.Description }}</template>
              </span>
            </div>
            <button
              v-if="!readOnly"
              type="button"
              class="line-delete-btn"
              @click="handleDeleteLine(line.id)"
            >
              刪除
            </button>
          </div>
        </div>

        <!-- Add line form -->
        <div v-if="!readOnly" class="add-line-section">
          <button
            v-if="!showAddLine"
            type="button"
            class="add-line-btn"
            @click="showAddLine = true"
          >
            新增耗材
          </button>

          <div v-else class="add-line-form">
            <div class="form-group">
              <label>耗材產品 <span class="required">*</span></label>
              <SearchSelector
                v-model="newLine.M_Product_ID"
                tableName="M_Product"
                displayField="Name"
                searchField="Name"
              />
            </div>
            <div class="inline-fields">
              <div class="form-group">
                <label>數量</label>
                <input
                  v-model.number="newLine.MovementQty"
                  type="number"
                  min="1"
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label>備註</label>
                <input
                  v-model="newLine.Description"
                  type="text"
                  class="form-input"
                  placeholder="選填..."
                />
              </div>
            </div>
            <div class="add-line-actions">
              <button
                type="button"
                class="cancel-btn"
                @click="cancelAddLine"
              >
                取消
              </button>
              <button
                type="button"
                :disabled="addingLine || !newLine.M_Product_ID"
                @click="handleAddLine"
              >
                {{ addingLine ? '新增中...' : '確定新增' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Error message -->
      <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>

      <!-- DocActionBar (view/edit mode, production exists) -->
      <div v-if="!isCreate && productionId" class="action-section">
        <DocActionBar
          :docStatus="docStatus"
          tableName="M_Production"
          :recordId="productionId"
          @completed="onCompleted"
          @error="onDocActionError"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SearchSelector from '@/components/SearchSelector.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import DocActionBar from '@/components/DocActionBar.vue'
import { toDateString } from '@/api/utils'
import {
  getProduction,
  getProductionLines,
  createProduction,
  addProductionLine,
  deleteProductionLine,
} from '@/api/production'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const productionId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})
const isCreate = computed(() => productionId.value === null)

// Production data
const production = ref<any>(null)
const lines = ref<any[]>([])
const docStatus = ref('DR')
const readOnly = computed(() => docStatus.value !== 'DR' && !isCreate.value)

// Form state
const form = reactive({
  M_Product_ID: null as number | null,
  ProductionQty: 1,
  MovementDateStr: toDateString(new Date()),
  Description: '',
})

// Page state
const pageLoading = ref(false)
const pageError = ref('')
const saving = ref(false)
const errorMsg = ref('')
const linesLoading = ref(false)

// Add line state
const showAddLine = ref(false)
const addingLine = ref(false)
const newLine = reactive({
  M_Product_ID: null as number | null,
  MovementQty: 1,
  Description: '',
})

function getProductName(line: any): string {
  if (line.M_Product_ID && typeof line.M_Product_ID === 'object') {
    return line.M_Product_ID.identifier || '未知產品'
  }
  return '未知產品'
}

async function loadProduction() {
  if (!productionId.value) return
  pageLoading.value = true
  pageError.value = ''
  try {
    const data = await getProduction(productionId.value)
    production.value = data

    // Extract DocStatus (may be object)
    if (data.DocStatus && typeof data.DocStatus === 'object') {
      docStatus.value = data.DocStatus.id || 'DR'
    } else {
      docStatus.value = data.DocStatus || 'DR'
    }

    // Populate form
    form.M_Product_ID = data.M_Product_ID?.id ?? null
    form.ProductionQty = data.ProductionQty || 1
    form.Description = data.Description || ''
    if (data.MovementDate) {
      const d = new Date(data.MovementDate)
      form.MovementDateStr = toDateString(d)
    }

    // Load lines
    await loadLines()
  } catch {
    pageError.value = '載入療程失敗'
  } finally {
    pageLoading.value = false
  }
}

async function loadLines() {
  if (!productionId.value) return
  linesLoading.value = true
  try {
    lines.value = await getProductionLines(productionId.value)
  } catch {
    lines.value = []
  } finally {
    linesLoading.value = false
  }
}

async function handleCreateProduction() {
  if (!form.M_Product_ID) {
    errorMsg.value = '請選擇療程項目'
    return
  }

  saving.value = true
  errorMsg.value = ''
  try {
    const orgId = authStore.context?.organizationId ?? 0
    const movementDate = form.MovementDateStr
      ? new Date(form.MovementDateStr + 'T00:00:00')
      : new Date()

    const result = await createProduction({
      M_Product_ID: form.M_Product_ID,
      ProductionQty: form.ProductionQty,
      MovementDate: movementDate,
      AD_Org_ID: orgId,
      Description: form.Description,
    })
    // Navigate to the newly created production
    router.replace({ name: 'treatment-detail', params: { id: result.id } })
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '建立療程失敗'
  } finally {
    saving.value = false
  }
}

async function handleAddLine() {
  if (!productionId.value || !newLine.M_Product_ID) return

  addingLine.value = true
  errorMsg.value = ''
  try {
    await addProductionLine(productionId.value, {
      M_Product_ID: newLine.M_Product_ID,
      MovementQty: newLine.MovementQty,
      Description: newLine.Description,
    })
    // Reset form and refresh lines
    cancelAddLine()
    await loadLines()
  } catch {
    errorMsg.value = '新增耗材失敗'
  } finally {
    addingLine.value = false
  }
}

function cancelAddLine() {
  showAddLine.value = false
  newLine.M_Product_ID = null
  newLine.MovementQty = 1
  newLine.Description = ''
}

async function handleDeleteLine(lineId: number) {
  if (!productionId.value) return
  errorMsg.value = ''
  try {
    await deleteProductionLine(lineId)
    await loadLines()
  } catch {
    errorMsg.value = '刪除耗材失敗'
  }
}

async function onCompleted() {
  // Refresh production to get updated DocStatus
  if (!productionId.value) return
  try {
    const data = await getProduction(productionId.value)
    production.value = data
    if (data.DocStatus && typeof data.DocStatus === 'object') {
      docStatus.value = data.DocStatus.id || 'CO'
    } else {
      docStatus.value = data.DocStatus || 'CO'
    }
  } catch {
    // At minimum update the status
    docStatus.value = 'CO'
  }
}

function onDocActionError(message: string) {
  errorMsg.value = message
}

function goBack() {
  router.push({ name: 'treatment-list' })
}

onMounted(() => {
  if (!isCreate.value) {
    loadProduction()
  }
})
</script>

<style scoped>
.production-form-page {
  padding: 1rem;
  padding-bottom: 5rem;
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

.form-section {
  margin-bottom: 1.5rem;
}

.production-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.production-docno {
  font-size: 1.125rem;
  font-weight: 600;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
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

.form-textarea,
.form-input {
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
}

.form-textarea:disabled,
.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #f8fafc;
}

.inline-fields {
  display: flex;
  gap: 0.75rem;
}

.inline-fields .form-group {
  flex: 1;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  margin-bottom: 1.5rem;
}

.form-actions button {
  flex: 1;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 1rem;
  min-height: var(--min-touch);
  cursor: pointer;
  background: var(--color-primary);
  color: white;
  border: none;
}

.form-actions button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.form-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  background: transparent !important;
  border: 1px solid var(--color-border) !important;
  color: var(--color-text) !important;
}

.empty-lines {
  text-align: center;
  padding: 1rem;
  color: #94a3b8;
  font-size: 0.875rem;
}

.lines-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.line-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  min-height: var(--min-touch);
}

.line-info {
  flex: 1;
}

.line-product {
  display: block;
  font-weight: 500;
  font-size: 0.9375rem;
}

.line-detail {
  display: block;
  font-size: 0.8125rem;
  color: #64748b;
  margin-top: 0.125rem;
}

.line-delete-btn {
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

.add-line-section {
  margin-top: 0.5rem;
}

.add-line-btn {
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--color-primary);
  cursor: pointer;
  min-height: var(--min-touch);
}

.add-line-btn:hover {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.04);
}

.add-line-form {
  padding: 1rem;
  background: #f8fafc;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.add-line-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.add-line-actions button {
  flex: 1;
  padding: 0.5rem;
  border-radius: 8px;
  font-size: 0.875rem;
  min-height: var(--min-touch);
  cursor: pointer;
  background: var(--color-primary);
  color: white;
  border: none;
}

.add-line-actions button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.add-line-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
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
