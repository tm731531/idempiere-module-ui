<template>
  <div class="payment-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isCreate ? (isReceipt ? '新增收款' : '新增付款') : (isReceipt ? '收款明細' : '付款明細') }}</h2>
    </div>

    <div v-if="pageLoading" class="loading-state">載入中...</div>

    <div v-else-if="pageError" class="form-error">{{ pageError }}</div>

    <template v-else>
      <div v-if="!isCreate && recordData" class="doc-info">
        <span class="doc-docno">{{ recordData.DocumentNo }}</span>
        <StatusBadge :status="docStatus" />
        <span class="doc-key-field">{{ isReceipt ? '客戶' : '供應商' }}: {{ getHeaderBPartnerName() }}</span>
      </div>

      <!-- AR/AP toggle -->
      <div v-if="isCreate" class="type-toggle">
        <button type="button" :class="['toggle-btn', { active: isReceipt }]" @click="setReceiptType(true)">收款 (AR)</button>
        <button type="button" :class="['toggle-btn', { active: !isReceipt }]" @click="setReceiptType(false)">付款 (AP)</button>
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
          {{ submitting ? '建立中...' : (isReceipt ? '建立收款' : '建立付款') }}
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
})

const isReceipt = computed(() => formData.value.IsReceipt !== false)

const columnFilters = computed<Record<string, string>>(() => {
  const ar = isReceipt.value
  const excludeClosed = "DocStatus neq 'CL' and DocStatus neq 'VO'"
  return {
    C_BPartner_ID: ar ? 'IsCustomer eq true' : 'IsVendor eq true',
    C_Order_ID: ar
      ? `IsSOTrx eq true and ${excludeClosed}`
      : `IsSOTrx eq false and ${excludeClosed}`,
    C_Invoice_ID: ar
      ? `IsSOTrx eq true and ${excludeClosed}`
      : `IsSOTrx eq false and ${excludeClosed}`,
  }
})

function setReceiptType(receipt: boolean) {
  formData.value = { ...formData.value, IsReceipt: receipt }
}

const submitting = ref(false)
const errorMsg = ref('')

function getHeaderBPartnerName(): string {
  const fallback = isReceipt.value ? '未指定客戶' : '未指定供應商'
  if (!recordData.value) return fallback
  const bp = recordData.value.C_BPartner_ID
  if (bp && typeof bp === 'object') return bp.identifier || bp.Name || fallback
  return fallback
}

async function handleCreatePayment() {
  const payload = getFormPayload()

  if (!payload.C_BPartner_ID) { errorMsg.value = '請選擇客戶'; return }
  if (!payload.PayAmt) { errorMsg.value = '請輸入金額'; return }

  payload.AD_Org_ID = authStore.context?.organizationId ?? 0
  payload.IsReceipt = isReceipt.value

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
.doc-info { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
.doc-docno { font-size: 1.125rem; font-weight: 600; }
.doc-key-field { font-size: 0.875rem; color: #64748b; background: #f1f5f9; padding: 0.125rem 0.5rem; border-radius: 4px; }
.form-actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
.form-actions button { flex: 1; padding: 0.75rem; border-radius: 8px; font-size: 1rem; min-height: var(--min-touch); cursor: pointer; background: var(--color-primary); color: white; border: none; }
.form-actions button:hover:not(:disabled) { background: var(--color-primary-hover); }
.form-actions button:disabled { opacity: 0.6; cursor: not-allowed; }
.cancel-btn { background: transparent !important; border: 1px solid var(--color-border) !important; color: var(--color-text) !important; }
.action-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.back-btn { padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--color-border); border-radius: 8px; cursor: pointer; min-height: var(--min-touch); }
.type-toggle { display: flex; gap: 0; margin-bottom: 1rem; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
.toggle-btn { flex: 1; padding: 0.625rem; font-size: 0.9375rem; border: none; background: transparent; cursor: pointer; min-height: var(--min-touch); color: var(--color-text); transition: background 0.15s, color 0.15s; }
.toggle-btn.active { background: var(--color-primary); color: white; font-weight: 600; }
.toggle-btn:not(.active):hover { background: rgba(99, 102, 241, 0.06); }
</style>
