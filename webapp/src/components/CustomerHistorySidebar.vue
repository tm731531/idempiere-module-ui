<template>
  <div class="customer-history-sidebar" :class="{ collapsed: isCollapsed }">
    <!-- Toggle button -->
    <button class="sidebar-toggle" @click="isCollapsed = !isCollapsed" :title="isCollapsed ? '展開客戶歷史' : '收合客戶歷史'">
      <span class="toggle-icon">{{ isCollapsed ? '◀' : '▶' }}</span>
      <span v-if="isCollapsed" class="toggle-label-vertical">客戶歷史</span>
    </button>

    <!-- Sidebar content -->
    <div v-if="!isCollapsed" class="sidebar-content">
      <div class="sidebar-header">
        <h3 class="sidebar-title">客戶歷史</h3>
        <span v-if="customerName" class="customer-name-badge">{{ customerName }}</span>
      </div>

      <div v-if="!customerId" class="no-customer-msg">
        請先選擇客戶以查看歷史記錄
      </div>

      <template v-else>
        <!-- Accordion sections -->
        <div class="accordion-section">
          <button class="accordion-header" @click="toggleSection('consultations')">
            <span>諮詢</span>
            <span class="count-badge" v-if="consultations.length > 0">{{ consultations.length }}</span>
            <span class="accordion-arrow">{{ openSections.consultations ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSections.consultations" class="accordion-body">
            <div v-if="loadingStates.consultations" class="loading-row">載入中...</div>
            <div v-else-if="consultations.length === 0" class="empty-state">該客戶尚無諮詢記錄</div>
            <template v-else>
              <div
                v-for="req in consultations"
                :key="req.id || req.R_Request_ID"
                class="history-row"
                :class="{ 'current-record': isCurrentRecord('consultation', req.id || req.R_Request_ID) }"
                @click="navigateToConsultation(req.id || req.R_Request_ID)"
              >
                <div class="row-main">
                  <span class="row-summary">{{ req.Summary || '(無摘要)' }}</span>
                  <span class="row-status" v-if="req.R_Status_ID?.identifier || req.LastResult">
                    {{ req.R_Status_ID?.identifier || req.LastResult }}
                  </span>
                </div>
                <div class="row-date">{{ formatDate(req.Created) }}</div>
              </div>
            </template>
          </div>
        </div>

        <div class="accordion-section">
          <button class="accordion-header" @click="toggleSection('appointments')">
            <span>預約</span>
            <span class="count-badge" v-if="appointments.length > 0">{{ appointments.length }}</span>
            <span class="accordion-arrow">{{ openSections.appointments ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSections.appointments" class="accordion-body">
            <div v-if="loadingStates.appointments" class="loading-row">載入中...</div>
            <div v-else-if="appointments.length === 0" class="empty-state">該客戶尚無預約記錄</div>
            <template v-else>
              <div
                v-for="appt in appointments"
                :key="appt.id || appt.S_ResourceAssignment_ID"
                class="history-row"
                :class="{ 'current-record': isCurrentRecord('appointment', appt.id || appt.S_ResourceAssignment_ID) }"
                @click="navigateToAppointment(appt.id || appt.S_ResourceAssignment_ID)"
              >
                <div class="row-main">
                  <span class="row-summary">{{ appt.Name || '(無名稱)' }}</span>
                  <span class="row-resource" v-if="appt.S_Resource_ID?.identifier || appt.S_Resource_ID?.Name">
                    {{ appt.S_Resource_ID?.identifier || appt.S_Resource_ID?.Name }}
                  </span>
                </div>
                <div class="row-date">{{ formatDate(appt.AssignDateFrom) }}</div>
              </div>
            </template>
          </div>
        </div>

        <div class="accordion-section">
          <button class="accordion-header" @click="toggleSection('orders')">
            <span>訂單</span>
            <span class="count-badge" v-if="orders.length > 0">{{ orders.length }}</span>
            <span class="accordion-arrow">{{ openSections.orders ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openSections.orders" class="accordion-body">
            <div v-if="loadingStates.orders" class="loading-row">載入中...</div>
            <div v-else-if="orders.length === 0" class="empty-state">該客戶尚無訂單記錄</div>
            <template v-else>
              <div
                v-for="order in orders"
                :key="order.id || order.C_Order_ID"
                class="history-row"
                :class="{ 'current-record': isCurrentRecord('order', order.id || order.C_Order_ID) }"
                @click="navigateToOrder(order.id || order.C_Order_ID)"
              >
                <div class="row-main">
                  <span class="row-summary">{{ order.DocumentNo || '#' + (order.id || order.C_Order_ID) }}</span>
                  <span class="row-amount" v-if="order.GrandTotal != null">
                    {{ formatAmount(order.GrandTotal) }}
                  </span>
                </div>
                <div class="row-meta">
                  <span class="row-date">{{ formatDate(order.DateOrdered) }}</span>
                  <span class="row-doc-status" v-if="order.DocStatus?.id || order.DocStatus">
                    {{ order.DocStatus?.identifier || order.DocStatus }}
                  </span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { listRequests } from '@/api/request'
import { listAssignmentsByCustomer } from '@/api/assignment'
import { listOrders } from '@/api/order'
import { parseIdempiereDateTime } from '@/api/utils'

const props = defineProps<{
  customerId: number | null
  customerName?: string
  currentRecordId?: number
  currentRecordType?: 'consultation' | 'appointment' | 'order'
}>()

const router = useRouter()

const isCollapsed = ref(false)

const openSections = reactive({
  consultations: true,
  appointments: false,
  orders: false,
})

const loadingStates = reactive({
  consultations: false,
  appointments: false,
  orders: false,
})

// Track which sections have been loaded (lazy-load)
const loadedSections = reactive({
  consultations: false,
  appointments: false,
  orders: false,
})

const consultations = ref<any[]>([])
const appointments = ref<any[]>([])
const orders = ref<any[]>([])

function toggleSection(section: 'consultations' | 'appointments' | 'orders') {
  openSections[section] = !openSections[section]
  // Lazy-load on first expand
  if (openSections[section] && !loadedSections[section] && props.customerId) {
    loadSection(section)
  }
}

async function loadSection(section: 'consultations' | 'appointments' | 'orders') {
  if (!props.customerId) return
  loadingStates[section] = true
  try {
    if (section === 'consultations') {
      consultations.value = await listRequests(`C_BPartner_ID eq ${props.customerId}`, 10)
    } else if (section === 'appointments') {
      appointments.value = await listAssignmentsByCustomer(props.customerId, 10)
    } else if (section === 'orders') {
      orders.value = await listOrders(`C_BPartner_ID eq ${props.customerId}`, 10)
    }
    loadedSections[section] = true
  } catch (e) {
    console.warn(`Failed to load ${section} for customer ${props.customerId}:`, e)
  } finally {
    loadingStates[section] = false
  }
}

// When customerId changes, reset and reload open sections
watch(() => props.customerId, (newId) => {
  if (!newId) {
    consultations.value = []
    appointments.value = []
    orders.value = []
    return
  }
  // Reset loaded state
  loadedSections.consultations = false
  loadedSections.appointments = false
  loadedSections.orders = false
  // Reload currently open sections
  if (openSections.consultations) loadSection('consultations')
  if (openSections.appointments) loadSection('appointments')
  if (openSections.orders) loadSection('orders')
}, { immediate: true })

function isCurrentRecord(type: string, id: number | undefined): boolean {
  if (!id || !props.currentRecordId || !props.currentRecordType) return false
  return props.currentRecordType === type && props.currentRecordId === id
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  try {
    const d = parseIdempiereDateTime(dateStr)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return dateStr.substring(0, 10)
  }
}

function formatAmount(amount: number | string): string {
  const n = Number(amount)
  if (Number.isNaN(n)) return String(amount)
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function navigateToConsultation(id: number | undefined) {
  if (!id) return
  router.push({ name: 'consultation-edit', params: { id } })
}

function navigateToAppointment(_id: number | undefined) {
  // Appointments are managed via CalendarView (modal), so navigate to calendar
  router.push({ name: 'appointment-calendar' })
}

function navigateToOrder(id: number | undefined) {
  if (!id) return
  router.push({ name: 'order-detail', params: { id } })
}
</script>

<style scoped>
.customer-history-sidebar {
  display: flex;
  flex-direction: row;
  border-left: 1px solid #e2e8f0;
  background: #f8fafc;
  min-height: 100%;
  transition: width 0.2s ease;
  width: 320px;
  position: relative;
}

.customer-history-sidebar.collapsed {
  width: 40px;
}

.sidebar-toggle {
  position: absolute;
  top: 1rem;
  left: -14px;
  z-index: 5;
  width: 28px;
  height: 28px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  color: #64748b;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 0;
}

.sidebar-toggle:hover {
  background: #f1f5f9;
  color: #1f2937;
}

.toggle-icon {
  line-height: 1;
}

.toggle-label-vertical {
  display: none;
}

.customer-history-sidebar.collapsed .toggle-label-vertical {
  display: block;
  writing-mode: vertical-rl;
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 2rem;
  padding-left: 10px;
}

.sidebar-content {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  max-height: 100%;
}

.sidebar-header {
  margin-bottom: 0.75rem;
}

.sidebar-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #374151;
  margin: 0 0 0.375rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.customer-name-badge {
  display: inline-block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.08);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.no-customer-msg {
  color: #94a3b8;
  font-size: 0.875rem;
  text-align: center;
  padding: 1rem 0;
}

/* Accordion */
.accordion-section {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  overflow: hidden;
  background: white;
}

.accordion-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 0.75rem;
  background: white;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  text-align: left;
}

.accordion-header:hover {
  background: #f9fafb;
}

.count-badge {
  background: #3b82f6;
  color: white;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0 0.375rem;
  min-width: 18px;
  text-align: center;
  line-height: 18px;
}

.accordion-arrow {
  margin-left: auto;
  font-size: 0.625rem;
  color: #94a3b8;
}

.accordion-body {
  border-top: 1px solid #e2e8f0;
  padding: 0.25rem 0;
}

.loading-row {
  padding: 0.75rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
}

.empty-state {
  padding: 0.75rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.8125rem;
}

/* History rows */
.history-row {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.1s;
}

.history-row:last-child {
  border-bottom: none;
}

.history-row:hover {
  background: #f1f5f9;
}

.history-row.current-record {
  background: rgba(59, 130, 246, 0.06);
  border-left: 2px solid #3b82f6;
}

.row-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.125rem;
}

.row-summary {
  font-size: 0.8125rem;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.row-status,
.row-resource,
.row-amount {
  font-size: 0.75rem;
  color: #64748b;
  background: #f1f5f9;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.row-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.row-date {
  font-size: 0.75rem;
  color: #94a3b8;
}

.row-doc-status {
  font-size: 0.75rem;
  color: #64748b;
  background: #f1f5f9;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  white-space: nowrap;
}
</style>
