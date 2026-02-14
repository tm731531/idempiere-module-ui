<template>
  <div class="payment-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isCreate ? '新增收款' : '收款明細' }}</h2>
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

      <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>

      <div v-if="isCreate" class="form-actions">
        <button type="button" class="cancel-btn" @click="goBack">取消</button>
        <button type="button" :disabled="submitting" @click="handleCreatePayment">
          {{ submitting ? '建立中...' : '建立收款' }}
        </button>
      </div>

      <div v-if="!isCreate && paymentId" class="action-section">
        <DocActionBar :docStatus="docStatus" tableName="C_Payment" :recordId="paymentId" @completed="onCompleted" @error="onDocActionError" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDocumentForm } from '@/composables/useDocumentForm'
import DynamicForm from '@/components/DynamicForm.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import DocActionBar from '@/components/DocActionBar.vue'
import { getPayment, createPayment, type PaymentData } from '@/api/payment'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const paymentId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})

const columnFilters = { C_BPartner_ID: 'IsCustomer eq true' }

const {
  visibleFieldDefs,
  formData,
  recordData,
  docStatus,
  pageLoading,
  pageError,
  readOnly,
  isCreate,
  load,
  getFormPayload,
} = useDocumentForm({
  tabId: 330,  // C_Payment
  recordId: paymentId,
  loadRecord: (id) => getPayment(id),
  excludeColumns: ['C_DocType_ID', 'C_BankAccount_ID', 'C_Currency_ID', 'DateAcct', 'IsReceipt'],
  columnFilters,
})

const submitting = ref(false)
const errorMsg = ref('')

async function handleCreatePayment() {
  const payload = getFormPayload()

  if (!payload.C_BPartner_ID) { errorMsg.value = '請選擇客戶'; return }
  if (!payload.PayAmt) { errorMsg.value = '請輸入金額'; return }

  payload.AD_Org_ID = authStore.context?.organizationId ?? 0

  submitting.value = true
  errorMsg.value = ''
  try {
    const result = await createPayment(payload as PaymentData)
    router.replace({ name: 'payment-detail', params: { id: result.id } })
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '建立收款失敗'
  } finally {
    submitting.value = false
  }
}

async function onCompleted() {
  if (!paymentId.value) return
  await load()
}

function onDocActionError(message: string) { errorMsg.value = message }
function goBack() { router.push({ name: 'payment-list' }) }

onMounted(() => load())
</script>

<style scoped>
.payment-form-page { padding: 1rem; padding-bottom: 5rem; max-width: 600px; margin: 0 auto; }
.form-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.form-header h2 { font-size: 1.25rem; margin: 0; }
.loading-state { text-align: center; padding: 2rem; color: #64748b; }
.form-error { background: #fef2f2; color: var(--color-error); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.875rem; }
.doc-info { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.doc-docno { font-size: 1.125rem; font-weight: 600; }
.form-actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
.form-actions button { flex: 1; padding: 0.75rem; border-radius: 8px; font-size: 1rem; min-height: var(--min-touch); cursor: pointer; background: var(--color-primary); color: white; border: none; }
.form-actions button:hover:not(:disabled) { background: var(--color-primary-hover); }
.form-actions button:disabled { opacity: 0.6; cursor: not-allowed; }
.cancel-btn { background: transparent !important; border: 1px solid var(--color-border) !important; color: var(--color-text) !important; }
.action-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.back-btn { padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--color-border); border-radius: 8px; cursor: pointer; min-height: var(--min-touch); }
</style>
