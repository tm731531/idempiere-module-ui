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
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDocumentForm } from '@/composables/useDocumentForm'
import { apiClient } from '@/api/client'
import { getProduct } from '@/api/product'
import { lookupEachUomId, lookupDefaultTaxCategoryId, lookupDefaultProductCategoryId } from '@/api/lookup'
import DynamicForm from '@/components/DynamicForm.vue'

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
  tabId: 180,  // Product window, Product tab
  recordId: productId,
  loadRecord: (id) => getProduct(id),
  excludeColumns: [
    // Detailed/advanced fields not needed in simplified UI
    'DocumentNote', 'Help',
    'ShelfWidth', 'ShelfHeight', 'ShelfDepth', 'UnitsPerPallet',
    'M_FreightCategory_ID', 'R_MailText_ID', 'C_RevenueRecognition_ID',
    'IsOwnBox', 'IsDropShip', 'IsKanban', 'IsPhantom', 'IsAutoProduce',
    'M_PartType_ID', 'Classification', 'VersionNo', 'SKU',
    'SalesRep_ID', 'CustomsTariffNumber',
    'LowLevel', 'M_AttributeSetInstance_ID',
    // Default to false, hide from form
    'IsSummary', 'IsInvoicePrintDetails', 'IsPickListPrintDetails', 'IsWebStoreFeatured',
  ],
})

const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

async function handleCreate() {
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const payload = getFormPayload()
    payload.AD_Org_ID = authStore.context?.organizationId ?? 0
    // Auto-fill Value (Search Key) from Name if not provided
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
    // Reload to sync with server
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

  // Apply defaults for create mode (dynamically queried, never hardcoded)
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
  }
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
</style>
