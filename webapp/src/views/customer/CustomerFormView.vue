<template>
  <div class="customer-form-page">
    <div class="form-header">
      <button class="back-btn" @click="goBack">返回</button>
      <h2>{{ isEdit ? '編輯客戶' : '新增客戶' }}</h2>
    </div>

    <div v-if="loadingDetail" class="loading-state">載入中...</div>

    <template v-else>
      <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>姓名 <span class="required">*</span></label>
          <input v-model="form.name" type="text" required />
          <span v-if="nameError" class="field-error">{{ nameError }}</span>
        </div>

        <div class="form-group">
          <label>身分證/統編</label>
          <input v-model="form.taxId" type="text" />
        </div>

        <div class="form-group">
          <label>電話</label>
          <input v-model="form.phone" type="tel" />
        </div>

        <div class="form-group">
          <label>Email</label>
          <input v-model="form.email" type="email" />
        </div>

        <div class="form-group">
          <label>地址</label>
          <input v-model="form.address" type="text" />
        </div>

        <div class="form-group">
          <label>城市</label>
          <input v-model="form.city" type="text" />
        </div>

        <div class="form-actions">
          <button type="button" class="cancel-btn" @click="goBack">取消</button>
          <button type="submit" :disabled="submitting">
            {{ submitting ? '儲存中...' : '儲存' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { createCustomer, getCustomerDetail, updateCustomer } from '@/api/bpartner'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const editId = computed(() => Number(route.params.id) || 0)
const isEdit = computed(() => editId.value > 0)

const form = reactive({
  name: '',
  taxId: '',
  phone: '',
  email: '',
  address: '',
  city: '',
})

const submitting = ref(false)
const loadingDetail = ref(false)
const errorMsg = ref('')
const nameError = ref('')

onMounted(async () => {
  if (isEdit.value) {
    loadingDetail.value = true
    try {
      const data = await getCustomerDetail(editId.value)
      form.name = data.Name || ''
      form.taxId = data.TaxID || ''
      // Phone/Email are on AD_User (contact), not C_BPartner - skip for now
    } catch {
      errorMsg.value = '載入客戶資料失敗'
    } finally {
      loadingDetail.value = false
    }
  }
})

function validate(): boolean {
  nameError.value = ''
  if (!form.name.trim()) {
    nameError.value = '姓名為必填欄位'
    return false
  }
  return true
}

async function handleSubmit() {
  errorMsg.value = ''
  if (!validate()) return

  submitting.value = true
  try {
    if (isEdit.value) {
      await updateCustomer(editId.value, {
        name: form.name.trim(),
        taxId: form.taxId.trim() || undefined,
      })
      router.push({ name: 'customer-detail', params: { id: editId.value } })
    } else {
      const orgId = authStore.context?.organizationId ?? 0
      const result = await createCustomer(
        {
          name: form.name.trim(),
          taxId: form.taxId.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          city: form.city.trim() || undefined,
        },
        orgId,
      )
      router.push({ name: 'customer-detail', params: { id: result.bpartnerId } })
    }
  } catch {
    errorMsg.value = isEdit.value ? '更新客戶失敗' : '建立客戶失敗，請稍後再試'
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.back()
}
</script>

<style scoped>
.customer-form-page {
  padding: 1rem;
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

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1rem;
  min-height: var(--min-touch);
}

.field-error {
  display: block;
  color: var(--color-error);
  font-size: 0.8125rem;
  margin-top: 0.25rem;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.form-actions button {
  flex: 1;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 1rem;
  min-height: var(--min-touch);
  cursor: pointer;
}

.form-actions button[type="submit"] {
  background: var(--color-primary);
  color: white;
  border: none;
}

.form-actions button[type="submit"]:hover {
  background: var(--color-primary-hover);
}

.form-actions button[type="submit"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--color-border);
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
