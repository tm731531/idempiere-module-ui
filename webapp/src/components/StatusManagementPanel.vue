<template>
  <div class="status-management-panel">
    <div v-if="loading" class="loading-state">載入中...</div>

    <template v-else>
      <div v-if="error" class="form-error">{{ error }}</div>

      <!-- Status list -->
      <div class="status-list">
        <div v-if="statuses.length === 0" class="empty-state">
          <p>尚無狀態，請新增</p>
        </div>

        <div v-else class="status-items">
          <div v-for="(status, idx) in statuses" :key="idx" class="status-item">
            <div v-if="editingIdx === idx" class="status-edit">
              <input
                v-model="editingName"
                type="text"
                class="status-input"
                placeholder="狀態名稱"
              />
              <button class="save-btn" @click="saveEdit(idx)">✓</button>
              <button class="cancel-btn" @click="cancelEdit">✗</button>
            </div>
            <div v-else class="status-display">
              <span class="status-name">{{ status.Name }}</span>
              <div class="status-actions">
                <button class="edit-btn" @click="startEdit(idx, status.Name)">編輯</button>
                <button class="delete-btn" @click="handleDelete(idx)">刪除</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add new status -->
      <div class="add-status-section">
        <div class="add-form">
          <input
            v-model="newStatusName"
            type="text"
            class="status-input"
            placeholder="輸入新狀態名稱"
            @keyup.enter="handleAdd"
          />
          <button class="add-btn" @click="handleAdd" :disabled="!newStatusName.trim()">
            ➕ 新增狀態
          </button>
        </div>
      </div>

      <!-- Save status -->
      <div class="save-section">
        <button
          class="save-all-btn"
          @click="handleSaveAll"
          :disabled="saving || !hasChanges"
        >
          {{ saving ? '儲存中...' : '💾 儲存設定' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getSysConfig, updateSysConfig } from '@/api/sysconfig'
import { useToast } from '@/composables/useToast'

interface Status {
  R_Status_ID?: number
  Name: string
}

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const toast = useToast()

const statuses = ref<Status[]>([])
const originalStatuses = ref<Status[]>([])
const newStatusName = ref('')

const editingIdx = ref<number | null>(null)
const editingName = ref('')

const hasChanges = computed(() => {
  return JSON.stringify(statuses.value) !== JSON.stringify(originalStatuses.value) || newStatusName.value.trim() !== ''
})

async function loadStatuses() {
  loading.value = true
  error.value = ''
  try {
    const configValue = await getSysConfig('MobileSettingConfig')
    if (configValue) {
      statuses.value = JSON.parse(configValue)
      originalStatuses.value = JSON.parse(JSON.stringify(statuses.value))
    } else {
      statuses.value = [
        { R_Status_ID: 0, Name: '待處理' },
        { R_Status_ID: 1, Name: '處理中' },
        { R_Status_ID: 2, Name: '已完成' },
      ]
    }
  } catch (e) {
    console.error('❌ Failed to load statuses:', e)
    error.value = '載入狀態失敗'
  } finally {
    loading.value = false
  }
}

function startEdit(idx: number, name: string) {
  editingIdx.value = idx
  editingName.value = name
}

function cancelEdit() {
  editingIdx.value = null
  editingName.value = ''
}

function saveEdit(idx: number) {
  const status = statuses.value[idx]
  if (editingName.value.trim() && status) {
    status.Name = editingName.value.trim()
    editingIdx.value = null
    editingName.value = ''
  }
}

function handleAdd() {
  if (newStatusName.value.trim()) {
    statuses.value.push({
      R_Status_ID: statuses.value.length,
      Name: newStatusName.value.trim(),
    })
    newStatusName.value = ''
  }
}

function handleDelete(idx: number) {
  const statusName = statuses.value[idx]?.Name || ''
  if (confirm(`確定要刪除「${statusName}」嗎？`)) {
    statuses.value.splice(idx, 1)
  }
}

async function handleSaveAll() {
  saving.value = true
  error.value = ''
  try {
    const json = JSON.stringify(statuses.value)
    const success = await updateSysConfig('MobileSettingConfig', json)
    if (success) {
      originalStatuses.value = JSON.parse(JSON.stringify(statuses.value))
      toast.add({ severity: 'success', summary: '狀態設定已儲存', detail: '重新整理頁面會看到新狀態。', life: 4000 })
    } else {
      error.value = '儲存失敗，請重試'
    }
  } catch (e) {
    console.error('❌ Failed to save statuses:', e)
    error.value = '儲存失敗'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadStatuses()
})
</script>

<style scoped>
.status-management-panel {
  padding: 1rem;
}

.status-list {
  margin-bottom: 2rem;
}

.empty-state {
  text-align: center;
  color: #999;
  padding: 2rem;
}

.status-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.status-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.status-display,
.status-edit {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.status-name {
  flex: 1;
  font-weight: 500;
}

.status-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.95rem;
}

.status-actions {
  display: flex;
  gap: 0.5rem;
}

.edit-btn,
.delete-btn,
.save-btn,
.cancel-btn {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-btn {
  background: #3b82f6;
  color: white;
}

.delete-btn {
  background: #ef4444;
  color: white;
}

.save-btn {
  background: #10b981;
  color: white;
}

.cancel-btn {
  background: #9ca3af;
  color: white;
}

.edit-btn:hover {
  opacity: 0.8;
}

.delete-btn:hover {
  opacity: 0.8;
}

.add-status-section {
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f0fdf4;
  border-radius: 8px;
  border: 1px solid #bbf7d0;
}

.add-form {
  display: flex;
  gap: 0.75rem;
}

.add-form .status-input {
  flex: 1;
}

.add-btn {
  padding: 0.5rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover:not(:disabled) {
  opacity: 0.8;
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-section {
  display: flex;
  justify-content: center;
}

.save-all-btn {
  padding: 0.75rem 2rem;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.save-all-btn:hover:not(:disabled) {
  opacity: 0.8;
}

.save-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.form-error {
  padding: 1rem;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 8px;
  margin-bottom: 1rem;
}
</style>
