<template>
  <div class="inout-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isCreate ? '新增出貨/收貨' : '出貨/收貨明細' }}</h2>
    </div>

    <div v-if="pageLoading" class="loading-state">載入中...</div>

    <div v-else-if="pageError" class="form-error">{{ pageError }}</div>

    <template v-else>
      <div v-if="!isCreate && recordData" class="doc-info">
        <span class="doc-docno">{{ recordData.DocumentNo }}</span>
        <StatusBadge :status="docStatus" />
      </div>

      <!-- Dynamic form from AD metadata -->
      <DynamicForm
        :fieldDefs="visibleFieldDefs"
        :modelValue="formData"
        :disabled="readOnly"
        :columnFilters="columnFilters"
        @update:modelValue="formData = $event"
      />

      <div v-if="isCreate" class="form-actions">
        <button type="button" class="cancel-btn" @click="goBack">取消</button>
        <button type="button" :disabled="saving" @click="handleCreateInOut">
          {{ saving ? '建立中...' : '建立單據' }}
        </button>
      </div>

      <!-- InOut Lines -->
      <div v-if="!isCreate && inoutId" class="form-section">
        <h3 class="section-title">明細項目</h3>

        <div v-if="lines.length === 0 && !linesLoading" class="empty-lines">尚無明細</div>
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
            <button v-if="!readOnly" type="button" class="line-delete-btn" @click="handleDeleteLine(line.id)">刪除</button>
          </div>
        </div>

        <div v-if="!readOnly" class="add-line-section">
          <button v-if="!showAddLine" type="button" class="add-line-btn" @click="showAddLine = true">新增明細</button>

          <div v-else class="add-line-form">
            <div class="form-group">
              <label>產品 <span class="required">*</span></label>
              <SearchSelector v-model="newLine.M_Product_ID" tableName="M_Product" displayField="Name" searchField="Name" :quickCreate="true" :quickCreateDefaults="{ ProductType: 'I', IsPurchased: true, IsSold: true }" />
            </div>
            <div class="inline-fields">
              <div class="form-group">
                <label>數量</label>
                <input v-model.number="newLine.MovementQty" type="number" min="1" class="form-input" />
              </div>
              <div class="form-group">
                <label>儲位 <span class="required">*</span></label>
                <div class="selector-row">
                  <select v-model="newLine.M_Locator_ID" class="form-input">
                    <option :value="0">-- 請選擇 --</option>
                    <option v-for="loc in locators" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
                  </select>
                  <button type="button" class="inline-add-btn" @click="showCreateLocator = true" title="新增儲位">+</button>
                </div>
                <div v-if="showCreateLocator" class="inline-create-form">
                  <input v-model="newLocatorValue" class="form-input" placeholder="儲位名稱" @keyup.enter="handleCreateLocator" />
                  <div class="inline-create-actions">
                    <button type="button" class="cancel-btn" @click="showCreateLocator = false; newLocatorValue = ''">取消</button>
                    <button type="button" :disabled="creatingLocator || !newLocatorValue.trim()" @click="handleCreateLocator">
                      {{ creatingLocator ? '...' : '建立' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>備註</label>
              <input v-model="newLine.Description" type="text" class="form-input" placeholder="選填..." />
            </div>
            <div class="add-line-actions">
              <button type="button" class="cancel-btn" @click="cancelAddLine">取消</button>
              <button type="button" :disabled="addingLine || !newLine.M_Product_ID || !newLine.M_Locator_ID" @click="handleAddLine">
                {{ addingLine ? '新增中...' : '確定新增' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>

      <div v-if="!isCreate && inoutId" class="action-section">
        <DocActionBar :docStatus="docStatus" tableName="M_InOut" :recordId="inoutId" @completed="onCompleted" @error="onDocActionError" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDocumentForm } from '@/composables/useDocumentForm'
import DynamicForm from '@/components/DynamicForm.vue'
import SearchSelector from '@/components/SearchSelector.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import DocActionBar from '@/components/DocActionBar.vue'
import { lookupLocators, createLocator } from '@/api/lookup'
import { getInOut, getInOutLines, createInOut, addInOutLine, deleteInOutLine } from '@/api/inout'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const inoutId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})

const {
  visibleFieldDefs,
  formData,
  recordData,
  pageLoading,
  pageError,
  readOnly,
  isCreate,
  docStatus,
  load,
  getFormPayload,
} = useDocumentForm({
  tabId: 257,  // M_InOut
  recordId: inoutId,
  loadRecord: (id) => getInOut(id),
})

// Dynamic columnFilters: C_BPartner_ID filter depends on IsSOTrx
const columnFilters = computed(() => ({
  C_BPartner_ID: formData.value.IsSOTrx === false
    ? 'IsVendor eq true'
    : 'IsCustomer eq true',
}))

// --- Locators (for add-line form) ---
const locators = ref<{ id: number; name: string }[]>([])

async function loadLocatorsForWarehouse(whId: number) {
  if (!whId) { locators.value = []; return }
  locators.value = await lookupLocators(whId)
  if (locators.value.length === 1 && locators.value[0]) {
    newLine.M_Locator_ID = locators.value[0].id
  }
}

// Reload locators when M_Warehouse_ID changes in formData
watch(
  () => formData.value.M_Warehouse_ID,
  (newWhId) => {
    if (newWhId) {
      loadLocatorsForWarehouse(newWhId)
    } else {
      locators.value = []
    }
  },
)

// --- Lines management ---
const lines = ref<any[]>([])
const linesLoading = ref(false)

const saving = ref(false)
const errorMsg = ref('')

const showAddLine = ref(false)
const addingLine = ref(false)
const newLine = reactive({
  M_Product_ID: null as number | null,
  MovementQty: 1,
  M_Locator_ID: 0,
  Description: '',
})

function getProductName(line: any): string {
  if (line.M_Product_ID && typeof line.M_Product_ID === 'object') {
    return line.M_Product_ID.identifier || '未知產品'
  }
  return '未知產品'
}

async function loadLines() {
  if (!inoutId.value) return
  linesLoading.value = true
  try { lines.value = await getInOutLines(inoutId.value) }
  catch { lines.value = [] }
  finally { linesLoading.value = false }
}

async function handleCreateInOut() {
  const payload = getFormPayload()

  if (!payload.C_BPartner_ID) {
    errorMsg.value = payload.IsSOTrx === false ? '請選擇供應商' : '請選擇客戶'
    return
  }
  if (!payload.M_Warehouse_ID) {
    errorMsg.value = '請選擇倉庫'
    return
  }

  saving.value = true
  errorMsg.value = ''
  try {
    const orgId = authStore.context?.organizationId ?? 0
    payload.AD_Org_ID = orgId
    const result = await createInOut(payload as any)
    router.replace({ name: 'shipment-detail', params: { id: result.id } })
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '建立單據失敗'
  } finally {
    saving.value = false
  }
}

async function handleAddLine() {
  if (!inoutId.value || !newLine.M_Product_ID || !newLine.M_Locator_ID) return
  addingLine.value = true
  errorMsg.value = ''
  try {
    await addInOutLine(inoutId.value, {
      M_Product_ID: newLine.M_Product_ID,
      MovementQty: newLine.MovementQty,
      M_Locator_ID: newLine.M_Locator_ID,
      Description: newLine.Description,
    })
    cancelAddLine()
    await loadLines()
  } catch { errorMsg.value = '新增明細失敗' }
  finally { addingLine.value = false }
}

function cancelAddLine() {
  showAddLine.value = false
  newLine.M_Product_ID = null
  newLine.MovementQty = 1
  newLine.M_Locator_ID = (locators.value.length === 1 && locators.value[0]) ? locators.value[0].id : 0
  newLine.Description = ''
}

// Locator creation
const showCreateLocator = ref(false)
const newLocatorValue = ref('')
const creatingLocator = ref(false)

async function handleCreateLocator() {
  const whId = formData.value.M_Warehouse_ID
  if (!whId || !newLocatorValue.value.trim()) return
  creatingLocator.value = true
  try {
    const created = await createLocator(whId, newLocatorValue.value.trim())
    await loadLocatorsForWarehouse(whId)
    newLine.M_Locator_ID = created.id
    showCreateLocator.value = false
    newLocatorValue.value = ''
  } catch {
    errorMsg.value = '新增儲位失敗'
  } finally {
    creatingLocator.value = false
  }
}

async function handleDeleteLine(lineId: number) {
  if (!inoutId.value) return
  errorMsg.value = ''
  try { await deleteInOutLine(lineId); await loadLines() }
  catch { errorMsg.value = '刪除明細失敗' }
}

async function onCompleted() {
  if (!inoutId.value) return
  try {
    const data = await getInOut(inoutId.value)
    if (data.DocStatus && typeof data.DocStatus === 'object') docStatus.value = data.DocStatus.id || 'CO'
    else docStatus.value = data.DocStatus || 'CO'
  } catch { docStatus.value = 'CO' }
}

function onDocActionError(message: string) { errorMsg.value = message }
function goBack() { router.push({ name: 'shipment-list' }) }

onMounted(async () => {
  await load()
  if (!isCreate.value && inoutId.value) {
    await loadLines()
  }
})
</script>

<style scoped>
.inout-form-page { padding: 1rem; padding-bottom: 5rem; max-width: 600px; margin: 0 auto; }
.form-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.form-header h2 { font-size: 1.25rem; margin: 0; }
.loading-state { text-align: center; padding: 2rem; color: #64748b; }
.form-error { background: #fef2f2; color: var(--color-error); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.875rem; }
.form-section { margin-bottom: 1.5rem; }
.doc-info { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.doc-docno { font-size: 1.125rem; font-weight: 600; }
.section-title { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border); }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; }
.required { color: var(--color-error); }
.form-input { width: 100%; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 8px; font-size: 1rem; min-height: var(--min-touch); font-family: inherit; }
.form-input:disabled { opacity: 0.6; cursor: not-allowed; background: #f8fafc; }
.inline-fields { display: flex; gap: 0.75rem; }
.inline-fields .form-group { flex: 1; }
.form-actions { display: flex; gap: 0.75rem; margin-top: 1rem; margin-bottom: 1.5rem; }
.form-actions button { flex: 1; padding: 0.75rem; border-radius: 8px; font-size: 1rem; min-height: var(--min-touch); cursor: pointer; background: var(--color-primary); color: white; border: none; }
.form-actions button:hover:not(:disabled) { background: var(--color-primary-hover); }
.form-actions button:disabled { opacity: 0.6; cursor: not-allowed; }
.cancel-btn { background: transparent !important; border: 1px solid var(--color-border) !important; color: var(--color-text) !important; }
.empty-lines { text-align: center; padding: 1rem; color: #94a3b8; font-size: 0.875rem; }
.lines-table { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.line-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8fafc; border: 1px solid var(--color-border); border-radius: 8px; min-height: var(--min-touch); }
.line-info { flex: 1; }
.line-product { display: block; font-weight: 500; font-size: 0.9375rem; }
.line-detail { display: block; font-size: 0.8125rem; color: #64748b; margin-top: 0.125rem; }
.line-delete-btn { padding: 0.25rem 0.75rem; background: transparent; border: 1px solid var(--color-error); color: var(--color-error); border-radius: 6px; font-size: 0.8125rem; cursor: pointer; flex-shrink: 0; margin-left: 0.5rem; }
.add-line-section { margin-top: 0.5rem; }
.add-line-btn { width: 100%; padding: 0.75rem; background: transparent; border: 2px dashed var(--color-border); border-radius: 8px; font-size: 0.875rem; color: var(--color-primary); cursor: pointer; min-height: var(--min-touch); }
.add-line-btn:hover { border-color: var(--color-primary); background: rgba(99, 102, 241, 0.04); }
.add-line-form { padding: 1rem; background: #f8fafc; border: 1px solid var(--color-border); border-radius: 8px; }
.add-line-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
.add-line-actions button { flex: 1; padding: 0.5rem; border-radius: 8px; font-size: 0.875rem; min-height: var(--min-touch); cursor: pointer; background: var(--color-primary); color: white; border: none; }
.add-line-actions button:hover:not(:disabled) { background: var(--color-primary-hover); }
.add-line-actions button:disabled { opacity: 0.6; cursor: not-allowed; }
.action-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.back-btn { padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--color-border); border-radius: 8px; cursor: pointer; min-height: var(--min-touch); }
.selector-row { display: flex; gap: 0.5rem; align-items: center; }
.selector-row select { flex: 1; }
.inline-add-btn { width: 44px; height: 44px; min-height: var(--min-touch); border: 1px solid var(--color-primary); background: transparent; color: var(--color-primary); border-radius: 8px; font-size: 1.25rem; font-weight: 600; cursor: pointer; flex-shrink: 0; }
.inline-add-btn:hover { background: var(--color-primary); color: white; }
.inline-create-form { margin-top: 0.5rem; padding: 0.5rem; background: white; border: 1px dashed var(--color-primary); border-radius: 8px; }
.inline-create-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.inline-create-actions button { flex: 1; padding: 0.5rem; border-radius: 8px; font-size: 0.875rem; min-height: var(--min-touch); cursor: pointer; background: var(--color-primary); color: white; border: none; }
.inline-create-actions button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
