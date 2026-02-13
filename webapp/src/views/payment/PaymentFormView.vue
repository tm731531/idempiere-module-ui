<template>
  <div class="payment-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isCreate ? '新增收款' : '收款明細' }}</h2>
    </div>

    <div v-if="pageLoading" class="loading-state">載入中...</div>

    <div v-else-if="pageError" class="form-error">{{ pageError }}</div>

    <template v-else>
      <!-- Payment Header -->
      <div class="form-section">
        <div v-if="!isCreate && payment" class="payment-info">
          <span class="payment-docno">{{ payment.DocumentNo }}</span>
          <StatusBadge :status="docStatus" />
        </div>

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

        <div class="inline-fields">
          <div class="form-group">
            <label>金額 <span class="required">*</span></label>
            <input
              v-model.number="form.PayAmt"
              type="number"
              min="0"
              step="0.01"
              class="form-input"
              placeholder="0"
              :disabled="readOnly"
            />
          </div>
          <div class="form-group">
            <label>付款方式 <span class="required">*</span></label>
            <select
              v-model="form.TenderType"
              class="form-input"
              :disabled="readOnly"
            >
              <option v-for="t in TENDER_TYPES" :key="t.value" :value="t.value">
                {{ t.label }}
              </option>
            </select>
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

      <!-- Save button (create mode) -->
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
          :disabled="saving || !form.C_BPartner_ID || !form.PayAmt"
          @click="handleCreatePayment"
        >
          {{ saving ? '建立中...' : '建立收款' }}
        </button>
      </div>

      <!-- View mode: payment details -->
      <div v-if="!isCreate && payment" class="form-section">
        <div class="detail-row">
          <span class="detail-label">交易日期</span>
          <span class="detail-value">{{ formatDate(payment.DateTrx) }}</span>
        </div>
      </div>

      <!-- Error message -->
      <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>

      <!-- DocActionBar (view mode, payment exists) -->
      <div v-if="!isCreate && paymentId" class="action-section">
        <DocActionBar
          :docStatus="docStatus"
          tableName="C_Payment"
          :recordId="paymentId"
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
import {
  getPayment,
  createPayment,
  TENDER_TYPES,
} from '@/api/payment'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const paymentId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})
const isCreate = computed(() => paymentId.value === null)

// Payment data
const payment = ref<any>(null)
const docStatus = ref('DR')
const readOnly = computed(() => docStatus.value !== 'DR' && !isCreate.value)

// Form state
const form = reactive({
  C_BPartner_ID: null as number | null,
  PayAmt: 0,
  TenderType: 'X',
  Description: '',
})

// Page state
const pageLoading = ref(false)
const pageError = ref('')
const saving = ref(false)
const errorMsg = ref('')

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function loadPayment() {
  if (!paymentId.value) return
  pageLoading.value = true
  pageError.value = ''
  try {
    const data = await getPayment(paymentId.value)
    payment.value = data

    // Extract DocStatus (may be object)
    if (data.DocStatus && typeof data.DocStatus === 'object') {
      docStatus.value = data.DocStatus.id || 'DR'
    } else {
      docStatus.value = data.DocStatus || 'DR'
    }

    // Populate form
    form.C_BPartner_ID = data.C_BPartner_ID?.id ?? null
    form.PayAmt = data.PayAmt || 0

    let tenderCode = data.TenderType
    if (tenderCode && typeof tenderCode === 'object') {
      tenderCode = tenderCode.id
    }
    form.TenderType = tenderCode || 'X'

    form.Description = data.Description || ''
  } catch {
    pageError.value = '載入收款失敗'
  } finally {
    pageLoading.value = false
  }
}

async function handleCreatePayment() {
  if (!form.C_BPartner_ID) {
    errorMsg.value = '請選擇客戶'
    return
  }
  if (!form.PayAmt) {
    errorMsg.value = '請輸入金額'
    return
  }

  saving.value = true
  errorMsg.value = ''
  try {
    const orgId = authStore.context?.organizationId ?? 0
    const result = await createPayment({
      C_BPartner_ID: form.C_BPartner_ID,
      PayAmt: form.PayAmt,
      TenderType: form.TenderType,
      AD_Org_ID: orgId,
      Description: form.Description,
    })
    // Navigate to the newly created payment
    router.replace({ name: 'payment-detail', params: { id: result.id } })
  } catch (e: unknown) {
    const err = e as { message?: string }
    errorMsg.value = err.message || '建立收款失敗'
  } finally {
    saving.value = false
  }
}

async function onCompleted() {
  // Refresh payment to get updated DocStatus
  if (!paymentId.value) return
  try {
    const data = await getPayment(paymentId.value)
    payment.value = data
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
  router.push({ name: 'payment-list' })
}

onMounted(() => {
  if (!isCreate.value) {
    loadPayment()
  }
})
</script>

<style scoped>
.payment-form-page {
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

.payment-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.payment-docno {
  font-size: 1.125rem;
  font-weight: 600;
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

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
}

.detail-label {
  font-size: 0.875rem;
  color: #64748b;
}

.detail-value {
  font-size: 0.875rem;
  font-weight: 500;
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
