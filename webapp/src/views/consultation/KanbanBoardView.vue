<template>
  <!-- Mobile fallback: Kanban is desktop-only -->
  <div v-if="isMobile" class="mobile-fallback">
    <p>Kanban 在小螢幕不可用，請使用列表視圖</p>
    <button class="back-btn" @click="router.push({ name: 'consultation-list' })">返回列表</button>
  </div>

  <div v-else class="kanban-page">
    <!-- Header bar -->
    <div class="kanban-header">
      <div class="kanban-title">諮詢看板</div>
      <div class="view-tabs">
        <button class="view-tab" @click="router.push({ name: 'consultation-list' })">📋 列表</button>
        <button class="view-tab" @click="router.push({ name: 'consultation-list', query: { view: 'dashboard' } })">📊 儀表板</button>
        <button class="view-tab active">🗂 看板</button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">載入中...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>

    <!-- Kanban board: horizontal scroll of status columns -->
    <div v-else class="kanban-board" @dragover.prevent @drop.prevent>
      <div
        v-for="col in columns"
        :key="col.statusId ?? 'unset'"
        class="kanban-column"
      >
        <div class="column-header">
          <span class="column-title">{{ col.name }}</span>
          <span class="column-count">{{ countCardsInColumn(col.statusId) }}</span>
        </div>

        <!-- Swimlanes inside each column -->
        <div class="column-lanes">
          <div
            v-for="lane in lanes"
            :key="lane.repId ?? 'unassigned'"
            class="kanban-lane"
            :class="{ 'drop-highlight': dragTarget?.statusId === col.statusId && dragTarget?.repId === lane.repId }"
            @dragover.prevent="dragTarget = { statusId: col.statusId, repId: lane.repId }"
            @dragleave="clearDragTarget"
            @drop.prevent="handleDrop(col.statusId, lane.repId)"
          >
            <div class="lane-label">{{ lane.name }}</div>

            <!-- Cards in this cell -->
            <div
              v-for="card in cardsInCell(col.statusId, lane.repId)"
              :key="card.id"
              class="kanban-card"
              draggable="true"
              @dragstart="handleDragStart(card, col.statusId, lane.repId)"
              @dragend="handleDragEnd"
              @click="goToEdit(card)"
            >
              <div class="card-doc">{{ card.Summary || `#${card.id}` }}</div>
              <div v-if="card._customerName" class="card-customer">{{ card._customerName }}</div>
              <div class="card-footer">
                <span
                  v-if="card._trackingBadge"
                  :class="['tracking-badge', `tracking-badge--${card._trackingBadge.color}`]"
                >{{ card._trackingBadge.text }}</span>
              </div>
            </div>

            <!-- Empty drop zone hint -->
            <div
              v-if="cardsInCell(col.statusId, lane.repId).length === 0"
              class="empty-cell"
            >拖曳至此</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { listRequests, updateRequest, getRequest, type RequestStatus } from '@/api/request'
import { listSalesReps, type SalesRep } from '@/api/bpartner'
import { loadRequestStatuses } from '@/composables/useRequestStatuses'
import { getTrackingBadge } from '@/utils/trackingBadge'

interface KanbanCard {
  id: number
  Summary: string
  _statusId: number | null
  _repId: number | null
  _customerName: string
  _trackingBadge: ReturnType<typeof getTrackingBadge>
  [key: string]: any
}

interface Column {
  statusId: number | null
  name: string
  seqNo: number
}

interface Lane {
  repId: number | null
  name: string
}

interface DragTarget {
  statusId: number | null
  repId: number | null
}

const router = useRouter()

// --- Mobile detection ---
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 1024)

function handleResize() { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

// --- State ---
const loading = ref(false)
const error = ref('')
const cards = ref<KanbanCard[]>([])
const statuses = ref<RequestStatus[]>([])
const salesReps = ref<SalesRep[]>([])

// Drag state
const draggedCard = ref<KanbanCard | null>(null)
const draggedFromStatus = ref<number | null>(null)
const draggedFromRep = ref<number | null>(null)
const dragTarget = ref<DragTarget | null>(null)

// --- Computed columns + lanes ---
const columns = computed<Column[]>(() => {
  const cols: Column[] = statuses.value.map((s: RequestStatus) => ({
    statusId: s.R_Status_ID,
    name: s.Name,
    seqNo: s.SeqNo ?? 0,
  }))
  // Add an "unset" column at the beginning for cards with no status
  const hasUnset = cards.value.some(c => c._statusId === null)
  if (hasUnset) {
    cols.unshift({ statusId: null, name: '未設定狀態', seqNo: -1 })
  }
  return cols
})

const lanes = computed<Lane[]>(() => {
  const result: Lane[] = [{ repId: null, name: '未分配' }]
  for (const rep of salesReps.value) {
    result.push({ repId: rep.id, name: rep.Name })
  }
  return result
})

// --- Helpers ---
function extractStatusId(r: any): number | null {
  const raw = r?.R_Status_ID
  if (raw == null) return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'object' && 'id' in raw) {
    const id = (raw as any).id
    return typeof id === 'number' ? id : null
  }
  return null
}

function extractRepId(r: any): number | null {
  const raw = r?.SalesRep_ID
  if (raw == null) return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'object' && 'id' in raw) {
    const id = (raw as any).id
    return typeof id === 'number' ? id : null
  }
  return null
}

function extractCustomerName(r: any): string {
  const bp = r?.C_BPartner_ID
  if (bp && typeof bp === 'object') return bp.Name || bp.identifier || ''
  return ''
}

function toKanbanCard(r: any): KanbanCard {
  return {
    ...r,
    id: r.id ?? r.R_Request_ID,
    Summary: r.Summary || '',
    _statusId: extractStatusId(r),
    _repId: extractRepId(r),
    _customerName: extractCustomerName(r),
    _trackingBadge: getTrackingBadge(r.DateNextAction),
  }
}

function cardsInCell(statusId: number | null, repId: number | null): KanbanCard[] {
  return cards.value.filter(c => c._statusId === statusId && c._repId === repId)
}

function countCardsInColumn(statusId: number | null): number {
  return cards.value.filter(c => c._statusId === statusId).length
}

// --- Data loading ---
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [rawRequests, statusRows, repList] = await Promise.all([
      listRequests(undefined, 500),
      loadRequestStatuses(),
      listSalesReps(),
    ])
    statuses.value = statusRows
    salesReps.value = repList
    cards.value = rawRequests.map(toKanbanCard)
  } catch (e: any) {
    error.value = e?.message || '載入失敗'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// --- Navigation ---
function goToEdit(card: KanbanCard) {
  router.push({ name: 'consultation-edit', params: { id: card.id } })
}

// --- Drag and Drop ---
function handleDragStart(card: KanbanCard, statusId: number | null, repId: number | null) {
  draggedCard.value = card
  draggedFromStatus.value = statusId
  draggedFromRep.value = repId
}

function handleDragEnd() {
  draggedCard.value = null
  draggedFromStatus.value = null
  draggedFromRep.value = null
  dragTarget.value = null
}

function clearDragTarget(e: DragEvent) {
  // Only clear if we're leaving the lane itself (not entering a child element)
  const related = e.relatedTarget as HTMLElement | null
  if (!related || !(e.currentTarget as HTMLElement)?.contains(related)) {
    dragTarget.value = null
  }
}

async function handleDrop(targetStatusId: number | null, targetRepId: number | null) {
  dragTarget.value = null
  const card = draggedCard.value
  if (!card) return

  const sameStatus = card._statusId === targetStatusId
  const sameRep = card._repId === targetRepId
  if (sameStatus && sameRep) return  // no-op

  // Build update payload
  const payload: Record<string, any> = {}
  if (!sameStatus) payload.R_Status_ID = targetStatusId
  if (!sameRep) payload.SalesRep_ID = targetRepId

  // Optimistic update
  const prevStatusId = card._statusId
  const prevRepId = card._repId
  card._statusId = targetStatusId
  card._repId = targetRepId

  try {
    await updateRequest(card.id, payload)
    // Sync timestamps by refreshing the single record
    const fresh = await getRequest(card.id)
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) {
      cards.value[idx] = toKanbanCard(fresh)
    }
  } catch (e: any) {
    // Rollback optimistic update
    card._statusId = prevStatusId
    card._repId = prevRepId
    alert(`更新失敗：${e?.message || '未知錯誤'}`)
  }
}
</script>

<style scoped>
.mobile-fallback {
  padding: 2rem;
  text-align: center;
  color: #64748b;
}

.back-btn {
  margin-top: 1rem;
  padding: 0.625rem 1.25rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9375rem;
}

.kanban-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  padding: 1rem;
  box-sizing: border-box;
}

.kanban-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.kanban-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
}

.view-tabs {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}

.view-tab {
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 0.875rem;
  color: #64748b;
  transition: all 0.15s;
}

.view-tab:hover:not(.active) {
  background: #f1f5f9;
}

.view-tab.active {
  background: var(--color-primary, #6366f1);
  color: white;
  border-color: var(--color-primary, #6366f1);
}

.loading-state,
.error-state {
  text-align: center;
  padding: 3rem;
  color: #64748b;
}

.error-state {
  color: #dc2626;
}

/* Kanban board: horizontal scroll */
.kanban-board {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  padding-bottom: 0.5rem;
  align-items: flex-start;
}

.kanban-column {
  flex: 0 0 240px;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  max-height: 100%;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 1;
}

.column-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: #334155;
}

.column-count {
  font-size: 0.75rem;
  background: #e2e8f0;
  color: #64748b;
  border-radius: 10px;
  padding: 0.1rem 0.5rem;
  font-weight: 600;
}

/* Swimlanes inside a column */
.column-lanes {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  flex: 1;
}

.kanban-lane {
  border-bottom: 1px solid #e2e8f0;
  padding: 0.5rem;
  min-height: 80px;
  transition: background 0.1s;
}

.kanban-lane:last-child {
  border-bottom: none;
}

.kanban-lane.drop-highlight {
  background: #e0e7ff;
  outline: 2px dashed var(--color-primary, #6366f1);
  outline-offset: -2px;
}

.lane-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 0.375rem;
}

/* Cards */
.kanban-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.5rem 0.625rem;
  margin-bottom: 0.375rem;
  cursor: grab;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.kanban-card:hover {
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
}

.kanban-card:active {
  cursor: grabbing;
}

.card-doc {
  font-weight: 600;
  font-size: 0.8125rem;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-customer {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer {
  margin-top: 0.25rem;
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

/* Tracking badges */
.tracking-badge {
  display: inline-block;
  padding: 0.1rem 0.375rem;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
}

.tracking-badge--red {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.tracking-badge--orange {
  background: #fff7ed;
  color: #ea580c;
  border: 1px solid #fed7aa;
}

.tracking-badge--yellow {
  background: #fefce8;
  color: #ca8a04;
  border: 1px solid #fef08a;
}

.tracking-badge--gray {
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.empty-cell {
  font-size: 0.75rem;
  color: #cbd5e1;
  text-align: center;
  padding: 0.5rem 0;
  pointer-events: none;
}
</style>
