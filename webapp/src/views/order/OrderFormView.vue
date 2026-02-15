<template>
  <div class="order-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ headerTitle }}</h2>
    </div>

    <div v-if="pageLoading" class="loading-state">載入中...</div>

    <div v-else-if="pageError" class="form-error">{{ pageError }}</div>

    <template v-else>
      <!-- Order Header -->
      <div v-if="!isCreate && order" class="doc-info">
        <span class="doc-docno">{{ order.DocumentNo }}</span>
        <StatusBadge :status="docStatus" />
      </div>

      <!-- IsSOTrx toggle (create mode) / badge (edit mode) -->
      <div class="sotrx-section">
        <label class="sotrx-label">訂單類型</label>
        <div v-if="isCreate" class="sotrx-toggle">
          <button
            type="button"
            :class="['sotrx-btn', { active: isSOTrx }]"
            :disabled="switchingSOTrx"
            @click="setIsSOTrx(true)"
          >銷售訂單</button>
          <button
            type="button"
            :class="['sotrx-btn', { active: !isSOTrx }]"
            :disabled="switchingSOTrx"
            @click="setIsSOTrx(false)"
          >採購訂單</button>
        </div>
        <span v-else :class="['sotrx-badge', isSOTrx ? 'so' : 'po']">
          {{ isSOTrx ? '銷售訂單' : '採購訂單' }}
        </span>
      </div>

      <!-- Dynamic form from AD metadata -->
      <DynamicForm
        :fieldDefs="visibleFieldDefs"
        :modelValue="formData"
        :disabled="readOnly"
        :columnFilters="columnFilters"
        :fkLabels="fkLabels"
        @update:modelValue="formData = $event"
      />

      <!-- Save header button (create mode) -->
      <div v-if="isCreate" class="form-actions">
        <button type="button" class="cancel-btn" @click="goBack">取消</button>
        <button
          type="button"
          :disabled="saving"
          @click="handleCreateOrder"
        >
          {{ saving ? '建立中...' : '建立訂單' }}
        </button>
      </div>

      <!-- Save header button (draft edit mode) -->
      <div v-if="!isCreate && !readOnly" class="form-actions">
        <button
          type="button"
          :disabled="saving"
          @click="handleUpdateOrder"
        >
          {{ saving ? '儲存中...' : '儲存修改' }}
        </button>
      </div>

      <!-- Order Lines (only when order exists) -->
      <div v-if="!isCreate && orderId" class="form-section">
        <div class="section-title-row">
          <h3 class="section-title">訂單明細</h3>
          <div v-if="order" class="order-totals">
            <span class="order-subtotal">
              {{ isTaxIncluded ? '含稅小計' : '小計' }} ${{ formatAmount(order.TotalLines) }}
            </span>
            <span v-if="!isTaxIncluded && order.GrandTotal !== order.TotalLines" class="order-tax">
              稅金 ${{ formatAmount(order.GrandTotal - order.TotalLines) }}
            </span>
            <span class="order-total">
              總計 ${{ formatAmount(order.GrandTotal) }}
            </span>
          </div>
        </div>

        <div v-if="lines.length === 0 && !linesLoading" class="empty-lines">
          尚無明細
        </div>

        <div v-if="linesLoading" class="loading-state">載入明細中...</div>

        <div v-else class="lines-table">
          <div v-for="line in lines" :key="line.id">
            <!-- Editing this line -->
            <div v-if="editingLineId === line.id" class="line-edit-form">
              <div class="form-group">
                <label>產品</label>
                <select
                  v-if="!productsLoading && priceListProducts.length > 0"
                  class="form-input"
                  :value="editLine.M_Product_ID ?? ''"
                  @change="onEditProductSelect"
                >
                  <option value="">-- 請選擇產品 --</option>
                  <option
                    v-for="p in priceListProducts"
                    :key="p.productId"
                    :value="p.productId"
                  >
                    {{ p.productName }} (${{ p.priceStd }})
                  </option>
                </select>
                <div v-else-if="productsLoading" class="loading-state">載入產品中...</div>
                <div v-else class="line-product">{{ getProductName(line) }}</div>
              </div>
              <div class="inline-fields">
                <div class="form-group">
                  <label>數量</label>
                  <input
                    v-model.number="editLine.QtyOrdered"
                    type="number"
                    min="1"
                    class="form-input"
                  />
                </div>
                <div class="form-group">
                  <label>單價</label>
                  <input
                    v-model.number="editLine.PriceEntered"
                    type="number"
                    min="0"
                    step="0.01"
                    class="form-input"
                  />
                </div>
              </div>
              <div v-if="taxOptions.length > 0" class="form-group">
                <label>稅率</label>
                <select class="form-input" v-model.number="editLine.C_Tax_ID">
                  <option
                    v-for="tax in taxOptions"
                    :key="tax.id"
                    :value="tax.id"
                  >
                    {{ tax.name }} ({{ tax.rate }}%)
                  </option>
                </select>
              </div>
              <div class="add-line-actions">
                <button type="button" class="cancel-btn" @click="cancelEditLine">取消</button>
                <button
                  type="button"
                  :disabled="savingLine || !editLine.M_Product_ID"
                  @click="handleUpdateLine"
                >
                  {{ savingLine ? '儲存中...' : '儲存' }}
                </button>
              </div>
            </div>
            <!-- Display mode -->
            <div v-else class="line-row" :class="{ clickable: !readOnly }" @click="!readOnly && startEditLine(line)">
              <div class="line-info">
                <span class="line-product">{{ getProductName(line) }}</span>
                <span class="line-detail">
                  {{ line.QtyOrdered }} x ${{ formatAmount(line.PriceEntered) }}
                  = ${{ formatAmount(line.LineNetAmt) }}
                </span>
              </div>
              <button
                v-if="!readOnly"
                type="button"
                class="line-delete-btn"
                @click.stop="handleDeleteLine(line.id)"
              >
                刪除
              </button>
            </div>
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
              <select
                v-if="!productsLoading && priceListProducts.length > 0"
                class="form-input"
                :value="newLine.M_Product_ID ?? ''"
                @change="onProductSelect"
              >
                <option value="">-- 請選擇產品 --</option>
                <option
                  v-for="p in priceListProducts"
                  :key="p.productId"
                  :value="p.productId"
                >
                  {{ p.productName }} (${{ p.priceStd }})
                </option>
              </select>
              <div v-else-if="productsLoading" class="loading-state">載入產品中...</div>
              <div v-else class="empty-lines">此價目表尚無產品</div>
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
            <div v-if="taxOptions.length > 0" class="form-group">
              <label>稅率</label>
              <div class="selector-row">
                <select
                  class="form-input"
                  v-model.number="newLine.C_Tax_ID"
                >
                  <option
                    v-for="tax in taxOptions"
                    :key="tax.id"
                    :value="tax.id"
                  >
                    {{ tax.name }} ({{ tax.rate }}%)
                  </option>
                </select>
                <button type="button" class="inline-add-btn" @click="showCreateTax = true" title="新增稅率">+</button>
              </div>
              <div v-if="showCreateTax" class="inline-create-form">
                <div class="inline-fields">
                  <input v-model="newTaxName" class="form-input" placeholder="稅率名稱" />
                  <input v-model.number="newTaxRate" type="number" min="0" max="100" step="0.01" class="form-input" placeholder="稅率 (%)" />
                </div>
                <div class="inline-create-actions">
                  <button type="button" class="cancel-btn" @click="cancelCreateTax">取消</button>
                  <button type="button" :disabled="creatingTax || !newTaxName.trim()" @click="handleCreateTax">
                    {{ creatingTax ? '...' : '建立' }}
                  </button>
                </div>
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
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDocumentForm } from '@/composables/useDocumentForm'
import {
  lookupBPartnerOrderInfo,
  lookupDocTypeInfo,
  lookupPriceListInfo,
  lookupOrgWarehouse,
  lookupDefaultSODocTypeId,
  lookupSalesPriceListId,
  lookupPurchasePriceListId,
  lookupProductsOnPriceList,
  lookupTaxes,
  createTax,
  clearLookupCache,
  type PriceListProduct,
  type TaxOption,
} from '@/api/lookup'
import DynamicForm from '@/components/DynamicForm.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import DocActionBar from '@/components/DocActionBar.vue'
import { apiClient } from '@/api/client'
import {
  getOrder,
  getOrderLines,
  createOrder,
  updateOrder,
  addOrderLine,
  updateOrderLine,
  deleteOrderLine,
} from '@/api/order'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const orderId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})

// Order data (for DocumentNo display and totals reload)
const order = ref<any>(null)

const {
  visibleFieldDefs,
  formData,
  fkLabels,
  docStatus,
  pageLoading,
  pageError,
  isCreate,
  readOnly,
  load,
  getFormPayload,
  getUpdatePayload,
} = useDocumentForm({
  tabId: 186,  // C_Order
  recordId: orderId,
  loadRecord: async (id) => {
    const data = await getOrder(id)
    order.value = data
    return data
  },
})

// View-specific column filters — reactive based on IsSOTrx
const columnFilters = computed(() => ({
  C_BPartner_ID: isSOTrx.value ? 'IsCustomer eq true' : 'IsVendor eq true',
}))

// ========== Callouts (mirrors iDempiere CalloutOrder) ==========

const isSOTrx = computed(() => formData.value.IsSOTrx ?? true)
const switchingSOTrx = ref(false)

const headerTitle = computed(() => {
  if (!isCreate.value) return '訂單明細'
  return isSOTrx.value ? '新增銷售訂單' : '新增採購訂單'
})

/** Toggle IsSOTrx with cascade: DocType, PriceList, PaymentTerm, etc. */
async function setIsSOTrx(value: boolean) {
  if (formData.value.IsSOTrx === value) return
  switchingSOTrx.value = true
  try {
    const updates: Record<string, any> = { IsSOTrx: value }
    const clientId = authStore.context?.clientId ?? 0

    // 1. Reset DocType (SOO ↔ POO)
    const docTypeId = await lookupDefaultSODocTypeId(value, clientId)
    if (docTypeId) {
      updates.C_DocTypeTarget_ID = docTypeId
      // Inline apply docType callout defaults
      try {
        const info = await lookupDocTypeInfo(docTypeId)
        const sub = info.docSubTypeSO || ''
        if (sub === 'WP') {
          updates.DeliveryRule = 'F'; updates.InvoiceRule = 'I'; updates.PaymentRule = 'B'  // B=Cash
        } else if (sub === 'PR') {
          updates.DeliveryRule = 'R'; updates.InvoiceRule = 'I'; updates.PaymentRule = 'P'  // P=On Credit
        } else if (sub === 'WI') {
          updates.InvoiceRule = 'I'; updates.PaymentRule = 'P'; updates.DeliveryRule = 'A'  // P=On Credit
        } else {
          updates.DeliveryRule = 'A'; updates.InvoiceRule = 'D'; updates.PaymentRule = 'P'  // P=On Credit
        }
      } catch { /* use form defaults */ }
    }

    // 2. If BP is selected → re-apply SO/PO corresponding fields
    const bpId = formData.value.C_BPartner_ID
    if (bpId) {
      try {
        const bpInfo = await lookupBPartnerOrderInfo(bpId)
        const pl = value ? bpInfo.priceListId : bpInfo.poPriceListId
        if (pl) updates.M_PriceList_ID = pl
        const pt = value ? bpInfo.paymentTermId : bpInfo.poPaymentTermId
        if (pt) updates.C_PaymentTerm_ID = pt
        const pr = value ? bpInfo.paymentRule : bpInfo.paymentRulePO
        if (pr) updates.PaymentRule = pr
      } catch { /* use defaults */ }
    }

    // 3. Fallback price list if not set by BP
    if (!updates.M_PriceList_ID) {
      try {
        updates.M_PriceList_ID = value
          ? await lookupSalesPriceListId()
          : await lookupPurchasePriceListId()
      } catch { /* skip */ }
    }

    // 4. SalesRep — clear for PO (server falls back to current user)
    if (!value) updates.SalesRep_ID = null

    formData.value = { ...formData.value, ...updates }
  } finally {
    switchingSOTrx.value = false
  }
}

// --- CalloutOrder.bPartner: C_BPartner_ID changes ---
watch(() => formData.value.C_BPartner_ID, async (newBpId) => {
  if (!newBpId || !isCreate.value) return
  try {
    const info = await lookupBPartnerOrderInfo(newBpId)
    const updates: Record<string, any> = {
      Bill_BPartner_ID: newBpId,
    }
    // Locations
    if (info.shipLocationId) updates.C_BPartner_Location_ID = info.shipLocationId
    if (info.billLocationId) updates.Bill_Location_ID = info.billLocationId
    else if (info.shipLocationId) updates.Bill_Location_ID = info.shipLocationId
    // Contacts
    if (info.userId) updates.AD_User_ID = info.userId
    if (info.billUserId) updates.Bill_User_ID = info.billUserId
    // Price list: SO → M_PriceList_ID, PO → PO_PriceList_ID
    const pl = isSOTrx.value ? info.priceListId : info.poPriceListId
    if (pl) updates.M_PriceList_ID = pl
    // Payment: SO → PaymentRule/Term, PO → PO variants
    const pt = isSOTrx.value ? info.paymentTermId : info.poPaymentTermId
    if (pt) updates.C_PaymentTerm_ID = pt
    const pr = isSOTrx.value ? info.paymentRule : info.paymentRulePO
    if (pr) updates.PaymentRule = pr
    // SalesRep (SO only)
    if (isSOTrx.value && info.salesRepId) updates.SalesRep_ID = info.salesRepId
    // Business rules from BP
    if (info.invoiceRule) updates.InvoiceRule = info.invoiceRule
    if (info.deliveryRule) updates.DeliveryRule = info.deliveryRule
    if (info.freightCostRule) updates.FreightCostRule = info.freightCostRule
    if (info.deliveryViaRule) updates.DeliveryViaRule = info.deliveryViaRule
    if (info.poReference) updates.POReference = info.poReference
    if (info.soDescription) updates.Description = info.soDescription
    formData.value = { ...formData.value, ...updates }
  } catch { /* silent — user can still fill manually */ }
})

// --- CalloutOrder.docType: C_DocTypeTarget_ID changes ---
watch(() => formData.value.C_DocTypeTarget_ID, async (newDocTypeId) => {
  if (!newDocTypeId || !isCreate.value) return
  try {
    const info = await lookupDocTypeInfo(newDocTypeId)
    const sub = info.docSubTypeSO || ''
    const updates: Record<string, any> = {
      IsSOTrx: info.isSOTrx,
    }
    // Set defaults based on DocSubTypeSO (Standard/POS/Prepay/OnCredit)
    if (sub === 'WP') {
      // POS Order
      updates.DeliveryRule = 'F'   // Force
      updates.InvoiceRule = 'I'    // Immediate
      updates.PaymentRule = 'B'    // B=Cash
    } else if (sub === 'PR') {
      // Prepay Order
      updates.DeliveryRule = 'R'   // After Payment
      updates.InvoiceRule = 'I'    // Immediate
      updates.PaymentRule = 'P'    // P=On Credit
    } else if (sub === 'WI') {
      // On Credit Order
      updates.InvoiceRule = 'I'    // Immediate
      updates.PaymentRule = 'P'    // P=On Credit
      updates.DeliveryRule = 'A'   // Availability
    } else {
      // Standard / Warehouse / blank
      updates.DeliveryRule = 'A'   // Availability
      updates.InvoiceRule = 'D'    // After Delivery
      updates.PaymentRule = 'P'    // P=On Credit
    }
    // Re-apply BP overrides if BPartner is set and not POS/Prepay
    const bpId = formData.value.C_BPartner_ID
    if (bpId && sub !== 'WP' && sub !== 'PR') {
      try {
        const bpInfo = await lookupBPartnerOrderInfo(bpId)
        const soTrx = updates.IsSOTrx ?? isSOTrx.value
        const pr = soTrx ? bpInfo.paymentRule : bpInfo.paymentRulePO
        if (pr) updates.PaymentRule = pr
        const pt = soTrx ? bpInfo.paymentTermId : bpInfo.poPaymentTermId
        if (pt) updates.C_PaymentTerm_ID = pt
        if (bpInfo.invoiceRule) updates.InvoiceRule = bpInfo.invoiceRule
        if (bpInfo.deliveryRule) updates.DeliveryRule = bpInfo.deliveryRule
        if (bpInfo.freightCostRule) updates.FreightCostRule = bpInfo.freightCostRule
        if (bpInfo.deliveryViaRule) updates.DeliveryViaRule = bpInfo.deliveryViaRule
      } catch { /* use defaults */ }
    }
    formData.value = { ...formData.value, ...updates }
  } catch { /* silent */ }
})

// --- CalloutOrder.priceList: M_PriceList_ID changes ---
const isTaxIncluded = ref(false)

watch(() => formData.value.M_PriceList_ID, async (newPriceListId) => {
  if (!newPriceListId) return
  // Reload available products for the new price list
  loadPriceListProducts(newPriceListId)
  try {
    const info = await lookupPriceListInfo(newPriceListId)
    isTaxIncluded.value = info.isTaxIncluded
    if (!isCreate.value) return
    const updates: Record<string, any> = {}
    if (info.currencyId) updates.C_Currency_ID = info.currencyId
    if (Object.keys(updates).length > 0) {
      formData.value = { ...formData.value, ...updates }
    }
  } catch { /* silent */ }
})

// --- CalloutOrder.organization: AD_Org_ID changes ---
watch(() => formData.value.AD_Org_ID, async (newOrgId) => {
  if (!newOrgId || !isCreate.value) return
  // Set default warehouse if not already set
  if (formData.value.M_Warehouse_ID) return
  try {
    const whId = await lookupOrgWarehouse(newOrgId)
    if (whId) {
      formData.value = { ...formData.value, M_Warehouse_ID: whId }
    }
  } catch { /* silent */ }
})

// --- CalloutEngine.dateAcct: DateOrdered changes ---
watch(() => formData.value.DateOrdered, (newDate) => {
  if (!newDate || !isCreate.value) return
  formData.value = { ...formData.value, DateAcct: newDate }
})

// Page state
const saving = ref(false)
const errorMsg = ref('')
const linesLoading = ref(false)

// Lines state
const lines = ref<any[]>([])
const showAddLine = ref(false)
const addingLine = ref(false)
const newLine = reactive({
  M_Product_ID: null as number | null,
  C_Tax_ID: null as number | null,
  QtyOrdered: 1,
  PriceEntered: 0,
})

// Tax options
const taxOptions = ref<TaxOption[]>([])

async function loadTaxOptions() {
  try {
    const taxes = await lookupTaxes()
    taxOptions.value = taxes
    // Set default tax
    const defaultTax = taxes.find(t => t.isDefault)
    if (defaultTax && !newLine.C_Tax_ID) {
      newLine.C_Tax_ID = defaultTax.id
    }
  } catch { /* silent */ }
}

// Tax quick-create
const showCreateTax = ref(false)
const newTaxName = ref('')
const newTaxRate = ref(5)
const creatingTax = ref(false)

async function handleCreateTax() {
  if (!newTaxName.value.trim()) return
  creatingTax.value = true
  errorMsg.value = ''
  try {
    const created = await createTax({
      name: newTaxName.value.trim(),
      rate: newTaxRate.value,
    })
    clearLookupCache()
    await loadTaxOptions()
    newLine.C_Tax_ID = created.id
    cancelCreateTax()
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '新增稅率失敗'
  } finally {
    creatingTax.value = false
  }
}

function cancelCreateTax() {
  showCreateTax.value = false
  newTaxName.value = ''
  newTaxRate.value = 5
}

// Price list products — filtered by order's M_PriceList_ID
const priceListProducts = ref<PriceListProduct[]>([])
const productsLoading = ref(false)

async function loadPriceListProducts(priceListId: number) {
  productsLoading.value = true
  try {
    priceListProducts.value = await lookupProductsOnPriceList(priceListId)
  } catch {
    priceListProducts.value = []
  } finally {
    productsLoading.value = false
  }
}

function onProductSelect(event: Event) {
  const productId = parseInt((event.target as HTMLSelectElement).value, 10)
  if (!productId) {
    newLine.M_Product_ID = null
    newLine.PriceEntered = 0
    return
  }
  newLine.M_Product_ID = productId
  // Auto-fill price from price list
  const product = priceListProducts.value.find(p => p.productId === productId)
  if (product) {
    newLine.PriceEntered = product.priceStd
  }
}

function getProductName(line: any): string {
  const p = line.M_Product_ID
  if (p && typeof p === 'object') {
    // $expand returns full record with Name; non-expanded returns {id, identifier}
    return p.identifier || p.Name || '未知產品'
  }
  return '未知產品'
}

function formatAmount(val: any): string {
  if (val === null || val === undefined) return '0'
  return Number(val).toLocaleString()
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

/** Reload lines + order header (totals) after line changes */
async function reloadOrderAndLines() {
  if (!orderId.value) return
  // Fetch lines and header in parallel — both use cache-busting timestamps
  const [, headerResp] = await Promise.all([
    loadLines(),
    apiClient.get(`/api/v1/models/C_Order/${orderId.value}`, {
      params: { '$expand': 'C_BPartner_ID,C_DocType_ID', '_t': Date.now() },
    }),
  ])
  order.value = headerResp.data
  // Sync server-calculated totals back to formData so DynamicForm fields update
  const totals = headerResp.data
  formData.value = {
    ...formData.value,
    TotalLines: totals.TotalLines ?? 0,
    GrandTotal: totals.GrandTotal ?? 0,
  }
}

async function handleCreateOrder() {
  const payload = getFormPayload()

  // Inject IsSOTrx (hidden field, not in getFormPayload)
  payload.IsSOTrx = formData.value.IsSOTrx ?? true

  if (!payload.C_BPartner_ID) {
    errorMsg.value = isSOTrx.value ? '請選擇客戶' : '請選擇供應商'
    return
  }
  if (!payload.M_Warehouse_ID) {
    errorMsg.value = '請選擇倉庫'
    return
  }

  saving.value = true
  errorMsg.value = ''
  try {
    payload.AD_Org_ID = authStore.context?.organizationId ?? 0
    payload.username = authStore.user?.name || ''
    const result = await createOrder(payload as any)
    router.replace({ name: 'order-detail', params: { id: result.id } })
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '建立訂單失敗'
  } finally {
    saving.value = false
  }
}

async function handleUpdateOrder() {
  if (!orderId.value) return
  const payload = getUpdatePayload()

  saving.value = true
  errorMsg.value = ''
  try {
    await updateOrder(orderId.value, payload)
    const data = await getOrder(orderId.value)
    order.value = data
    errorMsg.value = ''
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    errorMsg.value = err.response?.data?.detail || err.message || '儲存失敗'
  } finally {
    saving.value = false
  }
}

async function handleAddLine() {
  if (!orderId.value || !newLine.M_Product_ID) return

  addingLine.value = true
  errorMsg.value = ''
  try {
    const selectedProduct = priceListProducts.value.find(p => p.productId === newLine.M_Product_ID)
    await addOrderLine(orderId.value, {
      M_Product_ID: newLine.M_Product_ID,
      C_UOM_ID: selectedProduct?.uomId || undefined,
      C_Tax_ID: newLine.C_Tax_ID || undefined,
      QtyOrdered: newLine.QtyOrdered,
      PriceEntered: newLine.PriceEntered,
    })
    cancelAddLine()
    await reloadOrderAndLines()
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
  // Reset to default tax
  const defaultTax = taxOptions.value.find(t => t.isDefault)
  newLine.C_Tax_ID = defaultTax?.id ?? null
}

// Line editing state
const editingLineId = ref<number | null>(null)
const savingLine = ref(false)
const editLine = reactive({
  M_Product_ID: null as number | null,
  QtyOrdered: 1,
  PriceEntered: 0,
  C_Tax_ID: null as number | null,
})

function startEditLine(line: any) {
  editingLineId.value = line.id
  const prodVal = line.M_Product_ID
  editLine.M_Product_ID = prodVal && typeof prodVal === 'object' ? prodVal.id : (prodVal ?? null)
  editLine.QtyOrdered = line.QtyOrdered ?? 1
  editLine.PriceEntered = line.PriceEntered ?? 0
  const taxVal = line.C_Tax_ID
  editLine.C_Tax_ID = taxVal && typeof taxVal === 'object' ? taxVal.id : (taxVal ?? null)
}

function onEditProductSelect(event: Event) {
  const productId = parseInt((event.target as HTMLSelectElement).value, 10)
  if (!productId) {
    editLine.M_Product_ID = null
    return
  }
  editLine.M_Product_ID = productId
  // Auto-fill price from price list
  const product = priceListProducts.value.find(p => p.productId === productId)
  if (product) {
    editLine.PriceEntered = product.priceStd
  }
}

function cancelEditLine() {
  editingLineId.value = null
}

async function handleUpdateLine() {
  if (!orderId.value || !editingLineId.value) return
  savingLine.value = true
  errorMsg.value = ''
  try {
    const payload: Record<string, any> = {
      QtyOrdered: editLine.QtyOrdered,
      QtyEntered: editLine.QtyOrdered,
      PriceEntered: editLine.PriceEntered,
      PriceActual: editLine.PriceEntered,
      C_Tax_ID: editLine.C_Tax_ID,
    }
    if (editLine.M_Product_ID) {
      payload.M_Product_ID = editLine.M_Product_ID
      const selectedProduct = priceListProducts.value.find(p => p.productId === editLine.M_Product_ID)
      if (selectedProduct?.uomId) payload.C_UOM_ID = selectedProduct.uomId
    }
    await updateOrderLine(editingLineId.value, payload)
    editingLineId.value = null
    await reloadOrderAndLines()
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '儲存明細失敗'
  } finally {
    savingLine.value = false
  }
}

async function handleDeleteLine(lineId: number) {
  if (!orderId.value) return
  errorMsg.value = ''
  try {
    await deleteOrderLine(lineId)
    await reloadOrderAndLines()
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

// After metadata defaults are loaded, apply initial callout chain for create mode.
// Vue watchers don't fire for the initial value set by initDefaults(), so we
// need to manually trigger the same logic that watchers would do.
async function applyInitialCallouts() {
  const updates: Record<string, any> = {}

  // 1. Set default C_DocTypeTarget_ID (iDempiere computes this via callout, not AD_Column default)
  if (!formData.value.C_DocTypeTarget_ID) {
    const soTrx = formData.value.IsSOTrx ?? true
    const clientId = authStore.context?.clientId ?? 0
    const docTypeId = await lookupDefaultSODocTypeId(soTrx, clientId)
    if (docTypeId) {
      updates.C_DocTypeTarget_ID = docTypeId
      // Apply docType callout inline
      try {
        const info = await lookupDocTypeInfo(docTypeId)
        const sub = info.docSubTypeSO || ''
        updates.IsSOTrx = info.isSOTrx
        if (sub === 'WP') {
          updates.DeliveryRule = 'F'; updates.InvoiceRule = 'I'; updates.PaymentRule = 'B'  // B=Cash
        } else if (sub === 'PR') {
          updates.DeliveryRule = 'R'; updates.InvoiceRule = 'I'; updates.PaymentRule = 'P'  // P=On Credit
        } else if (sub === 'WI') {
          updates.InvoiceRule = 'I'; updates.PaymentRule = 'P'; updates.DeliveryRule = 'A'  // P=On Credit
        } else {
          updates.DeliveryRule = 'A'; updates.InvoiceRule = 'D'; updates.PaymentRule = 'P'  // P=On Credit
        }
      } catch { /* use form defaults */ }
    }
  }

  // 2. Set default warehouse from org if not already set
  if (!formData.value.M_Warehouse_ID) {
    const orgId = formData.value.AD_Org_ID || authStore.context?.organizationId
    if (orgId) {
      try {
        const whId = await lookupOrgWarehouse(orgId)
        if (whId) updates.M_Warehouse_ID = whId
      } catch { /* skip */ }
    }
  }

  // 3. Set default price list → currency if not set
  if (!formData.value.M_PriceList_ID && updates.M_PriceList_ID) {
    // Will be handled by watcher when M_PriceList_ID changes
  }

  if (Object.keys(updates).length > 0) {
    formData.value = { ...formData.value, ...updates }
  }
}

onMounted(async () => {
  await load()
  if (isCreate.value) {
    await applyInitialCallouts()
  } else if (orderId.value) {
    // Load lines, products, taxes, and price list info in parallel
    const plId = formData.value.M_PriceList_ID
    await Promise.all([
      loadLines(),
      plId ? loadPriceListProducts(plId) : Promise.resolve(),
      loadTaxOptions(),
      plId ? lookupPriceListInfo(plId).then(info => {
        isTaxIncluded.value = info.isTaxIncluded
      }).catch(() => {}) : Promise.resolve(),
    ])
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

.form-section {
  margin-top: 1.5rem;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.order-totals {
  text-align: right;
}

.order-subtotal {
  font-size: 0.8125rem;
  color: #64748b;
  display: block;
}

.order-tax {
  font-size: 0.8125rem;
  color: #64748b;
  display: block;
}

.order-total {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-primary);
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

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1rem;
  min-height: var(--min-touch);
  font-family: inherit;
}

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

.line-row.clickable {
  cursor: pointer;
}

.line-row.clickable:hover {
  border-color: var(--color-primary);
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

.line-edit-form {
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
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

.sotrx-section {
  margin-bottom: 1rem;
}

.sotrx-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
}

.sotrx-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.sotrx-btn {
  flex: 1;
  padding: 0.625rem;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  min-height: 36px;
  transition: background 0.15s, color 0.15s;
}

.sotrx-btn.active {
  background: var(--color-primary);
  color: #fff;
}

.sotrx-btn:not(.active):hover {
  background: rgba(99, 102, 241, 0.06);
}

.sotrx-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sotrx-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
}

.sotrx-badge.so {
  background: #eff6ff;
  color: #2563eb;
}

.sotrx-badge.po {
  background: #fefce8;
  color: #ca8a04;
}

.selector-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.selector-row .form-input {
  flex: 1;
}

.inline-add-btn {
  width: 44px;
  height: 44px;
  min-height: var(--min-touch);
  border: 1px solid var(--color-primary);
  background: transparent;
  color: var(--color-primary);
  border-radius: 8px;
  font-size: 1.25rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.inline-add-btn:hover {
  background: var(--color-primary);
  color: white;
}

.inline-create-form {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #f0f4ff;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
}

.inline-create-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.inline-create-actions button {
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

.inline-create-actions button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.inline-create-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
