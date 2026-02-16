<template>
  <div class="product-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isCreate ? '新增商品' : '商品詳情' }}</h2>
    </div>

    <div v-if="pageLoading" class="loading-state">載入中...</div>

    <div v-else-if="pageError" class="form-error">{{ pageError }}</div>

    <template v-else>
      <!-- Dynamic form from AD metadata -->
      <DynamicForm
        :fieldDefs="visibleFieldDefs"
        :modelValue="formData"
        :disabled="false"
        :fkLabels="fkLabels"
        @update:modelValue="formData = $event"
      />

      <div v-if="mandatoryErrors.length > 0" class="mandatory-errors">
        <span>請填寫必填欄位：</span>{{ mandatoryErrors.join('、') }}
      </div>

      <!-- Create mode -->
      <div v-if="isCreate" class="form-actions">
        <button type="button" class="cancel-btn" @click="goBack">取消</button>
        <button type="button" :disabled="saving || !isValid" @click="handleCreate">
          {{ saving ? '建立中...' : '建立商品' }}
        </button>
      </div>

      <!-- Edit mode -->
      <div v-if="!isCreate" class="form-actions">
        <button type="button" :disabled="saving" @click="handleSave">
          {{ saving ? '儲存中...' : '儲存修改' }}
        </button>
      </div>

      <div v-if="successMsg" class="form-success">{{ successMsg }}</div>
      <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>

      <!-- ===== BOM Section (edit mode + IsBOM=true) ===== -->
      <div v-if="!isCreate && productId && isBOM" class="bom-section">
        <div class="section-title-row">
          <h3 class="section-title">BOM 配方組成</h3>
          <span v-if="isVerified" class="badge verified">已驗證</span>
          <span v-else class="badge unverified">未驗證</span>
        </div>

        <div v-if="bomLoading" class="loading-state">載入 BOM 中...</div>

        <template v-else>
          <!-- BOM lines list -->
          <div v-if="bomLines.length === 0 && !showAddBOMLine" class="empty-lines">
            尚無 BOM 組成項目
          </div>

          <div v-else class="lines-table">
            <div v-for="line in bomLines" :key="line.id">
              <!-- Editing this line -->
              <div v-if="editingBOMLineId === line.id" class="line-edit-form">
                <div class="form-group">
                  <label>組成產品 <span class="required">*</span></label>
                  <SearchSelector
                    :modelValue="editBOMLine.M_Product_ID"
                    tableName="M_Product"
                    displayField="Name"
                    searchField="Name"
                    :filter="bomProductFilter"
                    :initialLabel="editBOMLine.productLabel"
                    @update:modelValue="editBOMLine.M_Product_ID = $event"
                  />
                </div>
                <div class="inline-fields">
                  <div class="form-group">
                    <label>數量</label>
                    <input
                      v-model.number="editBOMLine.QtyBOM"
                      type="number"
                      min="0"
                      step="0.01"
                      class="form-input"
                    />
                  </div>
                  <div class="form-group">
                    <label>組成類型</label>
                    <select class="form-input" v-model="editBOMLine.ComponentType">
                      <option v-for="ct in componentTypes" :key="ct.value" :value="ct.value">
                        {{ ct.name }}
                      </option>
                    </select>
                  </div>
                </div>
                <div class="line-actions">
                  <button type="button" class="cancel-btn" @click="cancelEditBOMLine">取消</button>
                  <button
                    type="button"
                    :disabled="savingBOMLine || !editBOMLine.M_Product_ID"
                    @click="handleUpdateBOMLine"
                  >
                    {{ savingBOMLine ? '儲存中...' : '儲存' }}
                  </button>
                </div>
              </div>

              <!-- Display mode -->
              <div v-else class="line-row clickable" @click="startEditBOMLine(line)">
                <div class="line-info">
                  <span class="line-product">{{ getBOMProductName(line) }}</span>
                  <span class="line-detail">
                    數量: {{ line.QtyBOM ?? 1 }}
                    <template v-if="getComponentTypeLabel(line)">
                      · {{ getComponentTypeLabel(line) }}
                    </template>
                  </span>
                </div>
                <button
                  type="button"
                  class="line-delete-btn"
                  @click.stop="handleDeleteBOMLine(line.id)"
                >
                  刪除
                </button>
              </div>
            </div>
          </div>

          <!-- Add BOM line form -->
          <div class="add-line-section">
            <button
              v-if="!showAddBOMLine"
              type="button"
              class="add-line-btn"
              @click="showAddBOMLine = true"
            >
              新增組成項目
            </button>

            <div v-else class="add-line-form">
              <div class="form-group">
                <label>組成產品 <span class="required">*</span></label>
                <SearchSelector
                  :modelValue="newBOMLine.M_Product_ID"
                  tableName="M_Product"
                  displayField="Name"
                  searchField="Name"
                  :filter="bomProductFilter"
                  @update:modelValue="newBOMLine.M_Product_ID = $event"
                />
              </div>
              <div class="inline-fields">
                <div class="form-group">
                  <label>數量</label>
                  <input
                    v-model.number="newBOMLine.QtyBOM"
                    type="number"
                    min="0"
                    step="0.01"
                    class="form-input"
                  />
                </div>
                <div class="form-group">
                  <label>組成類型</label>
                  <select class="form-input" v-model="newBOMLine.ComponentType">
                    <option v-for="ct in componentTypes" :key="ct.value" :value="ct.value">
                      {{ ct.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="line-actions">
                <button type="button" class="cancel-btn" @click="cancelAddBOMLine">取消</button>
                <button
                  type="button"
                  :disabled="addingBOMLine || !newBOMLine.M_Product_ID"
                  @click="handleAddBOMLine"
                >
                  {{ addingBOMLine ? '新增中...' : '確定新增' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Verify BOM button -->
          <div v-if="bomLines.length > 0" class="bom-verify">
            <button
              type="button"
              class="verify-btn"
              :disabled="verifying"
              @click="handleVerifyBOM"
            >
              {{ verifying ? '驗證中...' : '驗證 BOM' }}
            </button>
          </div>

          <div v-if="bomMsg" :class="['bom-msg', bomMsgType]">{{ bomMsg }}</div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDocumentForm } from '@/composables/useDocumentForm'
import { apiClient } from '@/api/client'
import { getProduct } from '@/api/product'
import { lookupEachUomId, lookupDefaultTaxCategoryId, lookupDefaultProductCategoryId } from '@/api/lookup'
import { getBOMsForProduct, createBOM, getBOMLines, addBOMLine, updateBOMLine, deleteBOMLine, verifyBOM } from '@/api/bom'
import { fetchRefListItems } from '@/api/metadata'
import DynamicForm from '@/components/DynamicForm.vue'
import SearchSelector from '@/components/SearchSelector.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const productId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})

const {
  visibleFieldDefs,
  formData,
  fkLabels,
  pageLoading,
  pageError,
  isCreate,
  isValid,
  mandatoryErrors,
  load,
  getFormPayload,
  getUpdatePayload,
  populateFromRecord,
} = useDocumentForm({
  tabId: 180,
  recordId: productId,
  loadRecord: (id) => getProduct(id),
  excludeColumns: [
    'DocumentNote', 'Help',
    'ShelfWidth', 'ShelfHeight', 'ShelfDepth', 'UnitsPerPallet',
    'M_FreightCategory_ID', 'R_MailText_ID', 'C_RevenueRecognition_ID',
    'IsOwnBox', 'IsDropShip', 'IsKanban', 'IsPhantom', 'IsAutoProduce',
    'M_PartType_ID', 'Classification', 'VersionNo', 'SKU',
    'SalesRep_ID', 'CustomsTariffNumber',
    'LowLevel', 'M_AttributeSetInstance_ID',
    'IsSummary', 'IsInvoicePrintDetails', 'IsPickListPrintDetails', 'IsWebStoreFeatured',
  ],
})

const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// ===== BOM state =====
const isBOM = computed(() => formData.value.IsBOM === true)
const isVerified = computed(() => formData.value.IsVerified === true)

const bomLoading = ref(false)
const bomHeader = ref<any>(null)
const bomLines = ref<any[]>([])

const componentTypes = ref<{ value: string; name: string }[]>([])

const showAddBOMLine = ref(false)
const addingBOMLine = ref(false)
const newBOMLine = reactive({
  M_Product_ID: null as number | null,
  QtyBOM: 1,
  ComponentType: 'CO',
})

const editingBOMLineId = ref<number | null>(null)
const savingBOMLine = ref(false)
const editBOMLine = reactive({
  M_Product_ID: null as number | null,
  QtyBOM: 1,
  ComponentType: 'CO',
  productLabel: '',
})

const verifying = ref(false)
const bomMsg = ref('')
const bomMsgType = ref('success')

const bomProductFilter = computed(() => {
  if (!productId.value) return 'IsActive eq true'
  return `IsActive eq true and M_Product_ID neq ${productId.value}`
})

// ===== BOM helpers =====

function getBOMProductName(line: any): string {
  const p = line.M_Product_ID
  if (p && typeof p === 'object') return p.identifier || p.Name || '未知產品'
  return '未知產品'
}

function getComponentTypeLabel(line: any): string {
  const ct = line.ComponentType
  const val = ct?.id ?? ct ?? ''
  const found = componentTypes.value.find(c => c.value === val)
  return found?.name || ''
}

async function loadBOM() {
  if (!productId.value) return
  bomLoading.value = true
  bomMsg.value = ''
  try {
    const boms = await getBOMsForProduct(productId.value)
    if (boms.length > 0) {
      bomHeader.value = boms[0]
      bomLines.value = await getBOMLines(boms[0].id)
    } else {
      bomHeader.value = null
      bomLines.value = []
    }
  } catch {
    bomHeader.value = null
    bomLines.value = []
  } finally {
    bomLoading.value = false
  }
}

async function loadComponentTypes() {
  try {
    // Dynamically resolve AD_Reference_Value_ID for ComponentType on PP_Product_BOMLine
    const colResp = await apiClient.get('/api/v1/models/AD_Column', {
      params: {
        '$filter': "ColumnName eq 'ComponentType' and AD_Table_ID eq 53019",
        '$select': 'AD_Reference_Value_ID',
        '$top': '1',
      },
    })
    const records = colResp.data.records || []
    const refId = records[0]?.AD_Reference_Value_ID?.id || records[0]?.AD_Reference_Value_ID
    if (refId) {
      componentTypes.value = await fetchRefListItems(refId)
    }
  } catch {
    componentTypes.value = []
  }
}

async function ensureBOMHeader(): Promise<number> {
  if (bomHeader.value) return bomHeader.value.id
  const productName = formData.value.Name || 'BOM'
  const productValue = formData.value.Value || productName
  const created = await createBOM({
    M_Product_ID: productId.value!,
    Value: productValue,
    Name: productName,
  })
  bomHeader.value = created
  return created.id
}

// ===== BOM line CRUD =====

async function handleAddBOMLine() {
  if (!productId.value || !newBOMLine.M_Product_ID) return
  addingBOMLine.value = true
  bomMsg.value = ''
  try {
    const bomId = await ensureBOMHeader()
    const maxLine = bomLines.value.reduce((max: number, l: any) => Math.max(max, l.Line ?? 0), 0)
    await addBOMLine({
      PP_Product_BOM_ID: bomId,
      M_Product_ID: newBOMLine.M_Product_ID,
      QtyBOM: newBOMLine.QtyBOM,
      ComponentType: newBOMLine.ComponentType,
      Line: maxLine + 10,
    })
    cancelAddBOMLine()
    await loadBOM()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    bomMsg.value = err.response?.data?.detail || err.message || '新增 BOM 項目失敗'
    bomMsgType.value = 'error'
  } finally {
    addingBOMLine.value = false
  }
}

function cancelAddBOMLine() {
  showAddBOMLine.value = false
  newBOMLine.M_Product_ID = null
  newBOMLine.QtyBOM = 1
  newBOMLine.ComponentType = 'CO'
}

function startEditBOMLine(line: any) {
  editingBOMLineId.value = line.id
  const prodVal = line.M_Product_ID
  editBOMLine.M_Product_ID = prodVal && typeof prodVal === 'object' ? prodVal.id : (prodVal ?? null)
  editBOMLine.productLabel = prodVal && typeof prodVal === 'object' ? (prodVal.identifier || prodVal.Name || '') : ''
  editBOMLine.QtyBOM = line.QtyBOM ?? 1
  const ctVal = line.ComponentType
  editBOMLine.ComponentType = ctVal?.id ?? ctVal ?? 'CO'
}

function cancelEditBOMLine() {
  editingBOMLineId.value = null
}

async function handleUpdateBOMLine() {
  if (!editingBOMLineId.value) return
  savingBOMLine.value = true
  bomMsg.value = ''
  try {
    await updateBOMLine(editingBOMLineId.value, {
      M_Product_ID: editBOMLine.M_Product_ID,
      QtyBOM: editBOMLine.QtyBOM,
      ComponentType: editBOMLine.ComponentType,
    })
    editingBOMLineId.value = null
    await loadBOM()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    bomMsg.value = err.response?.data?.detail || err.message || '儲存 BOM 項目失敗'
    bomMsgType.value = 'error'
  } finally {
    savingBOMLine.value = false
  }
}

async function handleDeleteBOMLine(lineId: number) {
  bomMsg.value = ''
  try {
    await deleteBOMLine(lineId)
    await loadBOM()
  } catch {
    bomMsg.value = '刪除 BOM 項目失敗'
    bomMsgType.value = 'error'
  }
}

async function handleVerifyBOM() {
  if (!productId.value) return
  verifying.value = true
  bomMsg.value = ''
  try {
    const result = await verifyBOM(productId.value)
    if (result.isError) {
      bomMsg.value = result.summary || 'BOM 驗證失敗'
      bomMsgType.value = 'error'
    } else {
      bomMsg.value = 'BOM 驗證成功'
      bomMsgType.value = 'success'
      const data = await getProduct(productId.value)
      populateFromRecord(data)
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    bomMsg.value = err.response?.data?.detail || err.message || 'BOM 驗證失敗'
    bomMsgType.value = 'error'
  } finally {
    verifying.value = false
  }
}

watch(isBOM, async (newVal) => {
  if (newVal && !isCreate.value && productId.value) {
    await loadBOM()
  }
})

// ===== Product form handlers =====

async function handleCreate() {
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const payload = getFormPayload()
    payload.AD_Org_ID = authStore.context?.organizationId ?? 0
    if (!payload.Value && payload.Name) {
      payload.Value = payload.Name
    }
    const resp = await apiClient.post('/api/v1/models/M_Product', payload)
    router.replace({ name: 'product-detail', params: { id: resp.data.id } })
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    errorMsg.value = err.response?.data?.detail || err.message || '建立商品失敗'
  } finally {
    saving.value = false
  }
}

async function handleSave() {
  if (!productId.value) return
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const payload = getUpdatePayload()
    await apiClient.put(`/api/v1/models/M_Product/${productId.value}`, payload)
    const data = await getProduct(productId.value)
    populateFromRecord(data)
    successMsg.value = '儲存成功'
    setTimeout(() => { successMsg.value = '' }, 3000)
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    errorMsg.value = err.response?.data?.detail || err.message || '儲存失敗'
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push({ name: 'product-list' })
}

onMounted(async () => {
  await load()

  if (isCreate.value) {
    const [uomId, taxCatId, prodCatId] = await Promise.all([
      lookupEachUomId(),
      lookupDefaultTaxCategoryId(),
      lookupDefaultProductCategoryId(),
    ])
    formData.value = {
      ...formData.value,
      C_UOM_ID: formData.value.C_UOM_ID || uomId,
      C_TaxCategory_ID: formData.value.C_TaxCategory_ID || taxCatId,
      M_Product_Category_ID: formData.value.M_Product_Category_ID || prodCatId,
      IsSummary: formData.value.IsSummary ?? false,
      IsInvoicePrintDetails: formData.value.IsInvoicePrintDetails ?? false,
      IsPickListPrintDetails: formData.value.IsPickListPrintDetails ?? false,
      IsWebStoreFeatured: formData.value.IsWebStoreFeatured ?? false,
    }
  } else if (productId.value && isBOM.value) {
    await loadBOM()
  }

  await loadComponentTypes()
})
</script>

<style scoped>
.product-form-page { padding: 1rem; padding-bottom: 5rem; max-width: 600px; margin: 0 auto; }
.form-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.form-header h2 { font-size: 1.25rem; margin: 0; }
.loading-state { text-align: center; padding: 2rem; color: #64748b; }
.form-error { background: #fef2f2; color: var(--color-error); padding: 0.75rem; border-radius: 8px; margin-top: 1rem; font-size: 0.875rem; }
.form-success { background: #f0fdf4; color: #166534; padding: 0.75rem; border-radius: 8px; margin-top: 1rem; font-size: 0.875rem; }
.mandatory-errors { background: #fffbeb; color: #92400e; padding: 0.75rem; border-radius: 8px; margin-top: 1rem; font-size: 0.875rem; }
.form-actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
.form-actions button { flex: 1; padding: 0.75rem; border-radius: 8px; font-size: 1rem; min-height: var(--min-touch); cursor: pointer; background: var(--color-primary); color: white; border: none; }
.form-actions button:hover:not(:disabled) { background: var(--color-primary-hover); }
.form-actions button:disabled { opacity: 0.6; cursor: not-allowed; }
.cancel-btn { background: transparent !important; border: 1px solid var(--color-border) !important; color: var(--color-text) !important; }
.back-btn { padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--color-border); border-radius: 8px; cursor: pointer; min-height: var(--min-touch); }

/* ===== BOM Section ===== */
.bom-section { margin-top: 2rem; }
.section-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--color-border); }
.section-title { font-size: 1.125rem; font-weight: 600; margin: 0; }
.badge { padding: 0.125rem 0.625rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
.badge.verified { background: #dcfce7; color: #166534; }
.badge.unverified { background: #fef3c7; color: #92400e; }

.lines-table { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; }
.line-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8fafc; border: 1px solid var(--color-border); border-radius: 8px; min-height: var(--min-touch); }
.line-row.clickable { cursor: pointer; }
.line-row.clickable:hover { border-color: var(--color-primary); }
.line-info { flex: 1; }
.line-product { display: block; font-weight: 500; font-size: 0.9375rem; }
.line-detail { display: block; font-size: 0.8125rem; color: #64748b; margin-top: 0.125rem; }
.line-delete-btn { padding: 0.25rem 0.75rem; background: transparent; border: 1px solid var(--color-error); color: var(--color-error); border-radius: 6px; font-size: 0.8125rem; cursor: pointer; flex-shrink: 0; margin-left: 0.5rem; }
.line-edit-form { padding: 0.75rem; background: #f8fafc; border: 1px solid var(--color-primary); border-radius: 8px; }

.add-line-section { margin-top: 0.5rem; }
.add-line-btn { width: 100%; padding: 0.75rem; background: transparent; border: 2px dashed var(--color-border); border-radius: 8px; font-size: 0.875rem; color: var(--color-primary); cursor: pointer; min-height: var(--min-touch); }
.add-line-btn:hover { border-color: var(--color-primary); background: rgba(99, 102, 241, 0.04); }
.add-line-form { padding: 0.75rem; background: #f8fafc; border: 1px solid var(--color-border); border-radius: 8px; }

.line-actions { display: flex; gap: 0.75rem; margin-top: 0.75rem; }
.line-actions button { flex: 1; padding: 0.5rem; border-radius: 8px; font-size: 0.875rem; min-height: var(--min-touch); cursor: pointer; background: var(--color-primary); color: white; border: none; }
.line-actions button:disabled { opacity: 0.6; cursor: not-allowed; }

.form-group { margin-bottom: 0.75rem; }
.form-group label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; }
.required { color: var(--color-error); }
.form-input { width: 100%; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 8px; font-size: 1rem; min-height: var(--min-touch); font-family: inherit; box-sizing: border-box; }
.inline-fields { display: flex; gap: 0.75rem; }
.inline-fields .form-group { flex: 1; }
.empty-lines { text-align: center; padding: 1.5rem; color: #94a3b8; font-size: 0.875rem; }

.bom-verify { margin-top: 1rem; }
.verify-btn { width: 100%; padding: 0.75rem; border-radius: 8px; font-size: 0.875rem; min-height: var(--min-touch); cursor: pointer; background: #059669; color: white; border: none; }
.verify-btn:hover:not(:disabled) { background: #047857; }
.verify-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.bom-msg { padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8125rem; margin-top: 0.75rem; }
.bom-msg.success { background: #f0fdf4; color: #166534; }
.bom-msg.error { background: #fef2f2; color: #991b1b; }
</style>
