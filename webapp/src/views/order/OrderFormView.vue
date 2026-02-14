<template>
  <div class="order-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isCreate ? '新增訂單' : '訂單明細' }}</h2>
    </div>

    <div v-if="pageLoading" class="loading-state">載入中...</div>

    <div v-else-if="pageError" class="form-error">{{ pageError }}</div>

    <template v-else>
      <!-- Order Header -->
      <div class="form-section">
        <div v-if="!isCreate && order" class="doc-info">
          <span class="doc-docno">{{ order.DocumentNo }}</span>
          <StatusBadge :status="docStatus" />
        </div>

        <!-- 基本資訊 -->
        <h3 class="section-title">基本資訊</h3>

        <div class="form-group">
          <label>客戶 <span class="required">*</span></label>
          <SearchSelector
            v-model="form.C_BPartner_ID"
            tableName="C_BPartner"
            displayField="Name"
            searchField="Name"
            filter="IsCustomer eq true"
            :disabled="readOnly"
          />
        </div>

        <div class="form-group">
          <label>倉庫 <span class="required">*</span></label>
          <select v-model="form.M_Warehouse_ID" class="form-input" :disabled="readOnly">
            <option :value="0">-- 請選擇 --</option>
            <option v-for="wh in warehouses" :key="wh.id" :value="wh.id">
              {{ wh.name }}
            </option>
          </select>
        </div>

        <div class="inline-fields">
          <div class="form-group">
            <label>訂單日期</label>
            <input
              v-model="form.DateOrdered"
              type="date"
              class="form-input"
              :disabled="readOnly"
            />
          </div>
          <div class="form-group">
            <label>預計交貨日</label>
            <input
              v-model="form.DatePromised"
              type="date"
              class="form-input"
              :disabled="readOnly"
            />
          </div>
        </div>
      </div>

      <!-- 備註 -->
      <div class="form-section">
        <h3 class="section-title">備註</h3>
        <div class="form-group">
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
        <button type="button" class="cancel-btn" @click="goBack">取消</button>
        <button
          type="button"
          :disabled="saving || !form.C_BPartner_ID || !form.M_Warehouse_ID"
          @click="handleCreateOrder"
        >
          {{ saving ? '建立中...' : '建立訂單' }}
        </button>
      </div>

      <!-- Order Lines (only when order exists) -->
      <div v-if="!isCreate && orderId" class="form-section">
        <h3 class="section-title">訂單明細</h3>

        <div v-if="lines.length === 0 && !linesLoading" class="empty-lines">
          尚無明細
        </div>

        <div v-if="linesLoading" class="loading-state">載入明細中...</div>

        <div v-else class="lines-table">
          <div v-for="line in lines" :key="line.id" class="line-row">
            <div class="line-info">
              <span class="line-product">{{ getProductName(line) }}</span>
              <span class="line-detail">
                {{ line.QtyOrdered }} x ${{ formatAmount(line.PriceEntered) }}
                = ${{ formatAmount(line.QtyOrdered * line.PriceEntered) }}
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
            新增明細
          </button>

          <div v-else class="add-line-form">
            <div class="form-group">
              <label>產品 <span class="required">*</span></label>
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
                  v-model.number="newLine.QtyOrdered"
                  type="number"
                  min="1"
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label>單價</label>
                <input
                  v-model.number="newLine.PriceEntered"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-input"
                />
              </div>
            </div>
            <div class="add-line-actions">
              <button type="button" class="cancel-btn" @click="cancelAddLine">取消</button>
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

      <!-- DocActionBar (view/edit mode, order exists) -->
      <div v-if="!isCreate && orderId" class="action-section">
        <DocActionBar
          :docStatus="docStatus"
          tableName="C_Order"
          :recordId="orderId"
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
import { lookupWarehouses } from '@/api/lookup'
import {
  getOrder,
  getOrderLines,
  createOrder,
  addOrderLine,
  deleteOrderLine,
} from '@/api/order'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const orderId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})
const isCreate = computed(() => orderId.value === null)

// Order data
const order = ref<any>(null)
const lines = ref<any[]>([])
const docStatus = ref('DR')
const readOnly = computed(() => docStatus.value !== 'DR' && !isCreate.value)

// Warehouses
const warehouses = ref<{ id: number; name: string }[]>([])

// Form state
const form = reactive({
  C_BPartner_ID: null as number | null,
  M_Warehouse_ID: 0,
  DateOrdered: toDateString(new Date()),
  DatePromised: toDateString(new Date()),
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
  QtyOrdered: 1,
  PriceEntered: 0,
})

function getProductName(line: any): string {
  if (line.M_Product_ID && typeof line.M_Product_ID === 'object') {
    return line.M_Product_ID.identifier || '未知產品'
  }
  return '未知產品'
}

function formatAmount(val: any): string {
  if (val === null || val === undefined) return '0'
  return Number(val).toLocaleString()
}

async function loadWarehouses() {
  const orgId = authStore.context?.organizationId ?? 0
  warehouses.value = await lookupWarehouses(orgId)
  // Pre-select from context or first available
  const contextWh = authStore.context?.warehouseId
  if (contextWh && warehouses.value.some(w => w.id === contextWh)) {
    form.M_Warehouse_ID = contextWh
  } else if (warehouses.value.length === 1 && warehouses.value[0]) {
    form.M_Warehouse_ID = warehouses.value[0].id
  }
}

async function loadOrder() {
  if (!orderId.value) return
  pageLoading.value = true
  pageError.value = ''
  try {
    const data = await getOrder(orderId.value)
    order.value = data

    if (data.DocStatus && typeof data.DocStatus === 'object') {
      docStatus.value = data.DocStatus.id || 'DR'
    } else {
      docStatus.value = data.DocStatus || 'DR'
    }

    form.C_BPartner_ID = data.C_BPartner_ID?.id ?? null
    form.M_Warehouse_ID = data.M_Warehouse_ID?.id ?? data.M_Warehouse_ID ?? 0
    form.Description = data.Description || ''
    if (data.DateOrdered) form.DateOrdered = toDateString(new Date(data.DateOrdered))
    if (data.DatePromised) form.DatePromised = toDateString(new Date(data.DatePromised))

    await loadLines()
  } catch {
    pageError.value = '載入訂單失敗'
  } finally {
    pageLoading.value = false
  }
}

async function loadLines() {
  if (!orderId.value) return
  linesLoading.value = true
  try {
    lines.value = await getOrderLines(orderId.value)
  } catch {
    lines.value = []
  } finally {
    linesLoading.value = false
  }
}

async function handleCreateOrder() {
  if (!form.C_BPartner_ID) {
    errorMsg.value = '請選擇客戶'
    return
  }
  if (!form.M_Warehouse_ID) {
    errorMsg.value = '請選擇倉庫'
    return
  }

  saving.value = true
  errorMsg.value = ''
  try {
    const orgId = authStore.context?.organizationId ?? 0
    const username = authStore.user?.name || ''
    const result = await createOrder({
      C_BPartner_ID: form.C_BPartner_ID,
      AD_Org_ID: orgId,
      M_Warehouse_ID: form.M_Warehouse_ID,
      Description: form.Description,
      username,
    })
    router.replace({ name: 'order-detail', params: { id: result.id } })
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '建立訂單失敗'
  } finally {
    saving.value = false
  }
}

async function handleAddLine() {
  if (!orderId.value || !newLine.M_Product_ID) return

  addingLine.value = true
  errorMsg.value = ''
  try {
    await addOrderLine(orderId.value, {
      M_Product_ID: newLine.M_Product_ID,
      QtyOrdered: newLine.QtyOrdered,
      PriceEntered: newLine.PriceEntered,
    })
    cancelAddLine()
    await loadLines()
    const data = await getOrder(orderId.value)
    order.value = data
  } catch {
    errorMsg.value = '新增明細失敗'
  } finally {
    addingLine.value = false
  }
}

function cancelAddLine() {
  showAddLine.value = false
  newLine.M_Product_ID = null
  newLine.QtyOrdered = 1
  newLine.PriceEntered = 0
}

async function handleDeleteLine(lineId: number) {
  if (!orderId.value) return
  errorMsg.value = ''
  try {
    await deleteOrderLine(lineId)
    await loadLines()
    const data = await getOrder(orderId.value)
    order.value = data
  } catch {
    errorMsg.value = '刪除明細失敗'
  }
}

async function onCompleted() {
  if (!orderId.value) return
  try {
    const data = await getOrder(orderId.value)
    order.value = data
    if (data.DocStatus && typeof data.DocStatus === 'object') {
      docStatus.value = data.DocStatus.id || 'CO'
    } else {
      docStatus.value = data.DocStatus || 'CO'
    }
  } catch {
    docStatus.value = 'CO'
  }
}

function onDocActionError(message: string) {
  errorMsg.value = message
}

function goBack() {
  router.push({ name: 'order-list' })
}

onMounted(async () => {
  if (isCreate.value) {
    await loadWarehouses()
  } else {
    await Promise.all([loadWarehouses(), loadOrder()])
  }
})
</script>

<style scoped>
.order-form-page {
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

.doc-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.doc-docno {
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
