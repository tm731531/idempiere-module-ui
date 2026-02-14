<template>
  <div class="field-config-page">
    <header class="page-header">
      <h1>欄位設定</h1>
      <button class="btn-back" @click="router.push('/')">返回首頁</button>
    </header>

    <!-- Access denied -->
    <div v-if="accessDenied" class="error-box">
      無權限存取此頁面
    </div>

    <template v-else>
      <!-- Window / Tab selection -->
      <div class="selector-row">
        <div class="selector-group">
          <label>Window</label>
          <select v-model="selectedWindowId" :disabled="windowsLoading" @change="onWindowChange">
            <option :value="0">-- 請選擇 --</option>
            <option v-for="w in windows" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
          <span v-if="windowsLoading" class="spinner">載入中...</span>
        </div>
        <div class="selector-group">
          <label>Tab</label>
          <select v-model="selectedTabId" :disabled="!selectedWindowId || tabsLoading" @change="onTabChange">
            <option :value="0">-- 請選擇 --</option>
            <option v-for="t in tabs" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
          <span v-if="tabsLoading" class="spinner">載入中...</span>
        </div>
      </div>

      <!-- Fields list -->
      <div v-if="fieldsLoading" class="loading-box">載入欄位中...</div>
      <div v-else-if="fieldsError" class="error-box">{{ fieldsError }}</div>

      <div v-else-if="fields.length > 0" class="fields-section">
        <div class="fields-header">
          <span class="col-seq">順序</span>
          <span class="col-name">欄位名稱</span>
          <span class="col-displayed">顯示</span>
          <span class="col-group">群組</span>
          <span class="col-actions">移動</span>
        </div>
        <div
          v-for="(field, idx) in fields"
          :key="field.id"
          class="field-row"
        >
          <span class="col-seq">
            <input
              type="number"
              :value="field.seqNo"
              min="0"
              step="10"
              class="seq-input"
              @change="updateSeqNo(idx, ($event.target as HTMLInputElement).value)"
            />
          </span>
          <span class="col-name">{{ field.name }}</span>
          <span class="col-displayed">
            <input type="checkbox" v-model="field.isDisplayed" @change="markDirty(idx)" />
          </span>
          <span class="col-group">
            <input
              type="text"
              v-model="field.fieldGroup"
              class="group-input"
              @change="markDirty(idx)"
            />
          </span>
          <span class="col-actions">
            <button class="btn-move" :disabled="idx === 0" @click="moveUp(idx)">&#9650;</button>
            <button class="btn-move" :disabled="idx === fields.length - 1" @click="moveDown(idx)">&#9660;</button>
          </span>
        </div>

        <div class="save-row">
          <button class="btn-save" :disabled="saving || dirtySet.size === 0" @click="handleSave">
            {{ saving ? '儲存中...' : '儲存' }}
          </button>
          <span v-if="saveSuccess" class="save-success">已儲存</span>
          <span v-if="saveError" class="save-error">{{ saveError }}</span>
        </div>
      </div>

      <div v-else-if="selectedTabId > 0 && !fieldsLoading" class="empty-box">
        此 Tab 沒有欄位
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '@/api/client'
import { clearMetadataCache } from '@/composables/useMetadata'

const router = useRouter()

const accessDenied = ref(false)

// Window / Tab selection
interface WindowItem { id: number; name: string }
interface TabItem { id: number; name: string }

const windows = ref<WindowItem[]>([])
const windowsLoading = ref(false)
const selectedWindowId = ref(0)

const tabs = ref<TabItem[]>([])
const tabsLoading = ref(false)
const selectedTabId = ref(0)

// Fields
interface EditableField {
  id: number
  name: string
  seqNo: number
  isDisplayed: boolean
  fieldGroup: string
}

const fields = ref<EditableField[]>([])
const fieldsLoading = ref(false)
const fieldsError = ref('')
const dirtySet = reactive(new Set<number>())

// Save state
const saving = ref(false)
const saveSuccess = ref(false)
const saveError = ref('')

// Load windows on mount
onMounted(async () => {
  await loadWindows()
})

async function loadWindows() {
  windowsLoading.value = true
  try {
    const resp = await apiClient.get('/api/v1/models/AD_Window', {
      params: {
        '$filter': 'IsActive eq true',
        '$select': 'AD_Window_ID,Name',
        '$orderby': 'Name',
        '$top': 500,
      },
    })
    windows.value = (resp.data.records || []).map((r: any) => ({
      id: r.id,
      name: r.Name,
    }))
  } catch {
    // silently fail
  } finally {
    windowsLoading.value = false
  }
}

async function onWindowChange() {
  selectedTabId.value = 0
  tabs.value = []
  fields.value = []
  dirtySet.clear()
  saveSuccess.value = false
  saveError.value = ''

  if (!selectedWindowId.value) return

  tabsLoading.value = true
  try {
    const resp = await apiClient.get('/api/v1/models/AD_Tab', {
      params: {
        '$filter': `AD_Window_ID eq ${selectedWindowId.value} and IsActive eq true`,
        '$select': 'AD_Tab_ID,Name',
        '$orderby': 'SeqNo',
        '$top': 100,
      },
    })
    tabs.value = (resp.data.records || []).map((r: any) => ({
      id: r.id,
      name: r.Name,
    }))
  } catch {
    // silently fail
  } finally {
    tabsLoading.value = false
  }
}

async function onTabChange() {
  fields.value = []
  dirtySet.clear()
  saveSuccess.value = false
  saveError.value = ''

  if (!selectedTabId.value) return

  fieldsLoading.value = true
  fieldsError.value = ''
  try {
    const resp = await apiClient.get('/api/v1/models/AD_Field', {
      params: {
        '$filter': `AD_Tab_ID eq ${selectedTabId.value} and IsActive eq true`,
        '$select': 'AD_Field_ID,Name,SeqNo,IsDisplayed,FieldGroup',
        '$orderby': 'SeqNo',
        '$top': 200,
      },
    })
    fields.value = (resp.data.records || []).map((r: any) => ({
      id: r.id,
      name: r.Name,
      seqNo: r.SeqNo || 0,
      isDisplayed: r.IsDisplayed === true || r.IsDisplayed === 'Y',
      fieldGroup: r.FieldGroup || '',
    }))
  } catch (e: any) {
    fieldsError.value = e.message || '載入欄位失敗'
  } finally {
    fieldsLoading.value = false
  }
}

function updateSeqNo(idx: number, value: string) {
  fields.value[idx]!.seqNo = parseInt(value, 10) || 0
  markDirty(idx)
}

function markDirty(idx: number) {
  dirtySet.add(fields.value[idx]!.id)
}

function moveUp(idx: number) {
  if (idx <= 0) return
  const arr = fields.value
  const current = arr[idx]!
  const prev = arr[idx - 1]!
  // Swap seqNo values
  const tmpSeq = current.seqNo
  current.seqNo = prev.seqNo
  prev.seqNo = tmpSeq
  // Swap positions
  arr[idx] = prev
  arr[idx - 1] = current
  dirtySet.add(arr[idx]!.id)
  dirtySet.add(arr[idx - 1]!.id)
}

function moveDown(idx: number) {
  if (idx >= fields.value.length - 1) return
  const arr = fields.value
  const current = arr[idx]!
  const next = arr[idx + 1]!
  // Swap seqNo values
  const tmpSeq = current.seqNo
  current.seqNo = next.seqNo
  next.seqNo = tmpSeq
  // Swap positions
  arr[idx] = next
  arr[idx + 1] = current
  dirtySet.add(arr[idx]!.id)
  dirtySet.add(arr[idx + 1]!.id)
}

async function handleSave() {
  saving.value = true
  saveSuccess.value = false
  saveError.value = ''

  try {
    const updates = fields.value.filter(f => dirtySet.has(f.id))
    await Promise.all(
      updates.map(f =>
        apiClient.put(`/api/v1/models/AD_Field/${f.id}`, {
          SeqNo: f.seqNo,
          IsDisplayed: f.isDisplayed,
          FieldGroup: f.fieldGroup || null,
        })
      )
    )
    dirtySet.clear()
    clearMetadataCache()
    saveSuccess.value = true
  } catch (e: any) {
    saveError.value = e.message || '儲存失敗'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.field-config-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.25rem;
  margin: 0;
}

.btn-back {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  min-height: var(--min-touch);
}

.btn-back:hover {
  background: #f1f5f9;
}

.selector-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.selector-group {
  flex: 1;
  min-width: 200px;
}

.selector-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.selector-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  min-height: var(--min-touch);
  background: white;
}

.spinner {
  font-size: 0.75rem;
  color: #64748b;
  margin-left: 0.25rem;
}

.loading-box,
.empty-box {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

.error-box {
  text-align: center;
  padding: 1rem;
  background: #fef2f2;
  color: var(--color-error);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.fields-section {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow-x: auto;
}

.fields-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  border-bottom: 1px solid var(--color-border);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
}

.field-row:last-of-type {
  border-bottom: none;
}

.col-seq {
  width: 70px;
  flex-shrink: 0;
}

.col-name {
  flex: 1;
  min-width: 120px;
  font-size: 0.875rem;
}

.col-displayed {
  width: 50px;
  flex-shrink: 0;
  text-align: center;
}

.col-group {
  width: 140px;
  flex-shrink: 0;
}

.col-actions {
  width: 70px;
  flex-shrink: 0;
  display: flex;
  gap: 0.25rem;
}

.seq-input {
  width: 60px;
  padding: 0.25rem 0.375rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.8125rem;
  text-align: center;
}

.group-input {
  width: 100%;
  padding: 0.25rem 0.375rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.8125rem;
}

.btn-move {
  padding: 0.125rem 0.375rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
}

.btn-move:hover:not(:disabled) {
  background: #f1f5f9;
}

.btn-move:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.btn-save {
  padding: 0.5rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  min-height: var(--min-touch);
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-success {
  color: var(--color-success);
  font-size: 0.875rem;
}

.save-error {
  color: var(--color-error);
  font-size: 0.875rem;
}
</style>
