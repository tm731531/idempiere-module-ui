<script setup lang="ts">
import { computed, ref } from 'vue'
import { calculateStats } from '@/utils/dashboardStats'

interface Props {
  requests: any[]
}

const props = defineProps<Props>()

// 展開狀態
const expandedSections = ref<Set<string>>(new Set([
  'metrics',      // 預設展開關鍵指標
  'status',       // 預設展開狀態分布
]))

const stats = computed(() => {
  return calculateStats(props.requests)
})

const statusItems = computed(() => {
  return Object.entries(stats.value.statusDistribution).map(([status, count]) => ({
    status,
    count,
  }))
})

const hasWarnings = computed(() => {
  return stats.value.silentCount > 0 || stats.value.lostCustomerCount > 0
})

// 切換展開/折疊
const toggleSection = (sectionId: string) => {
  if (expandedSections.value.has(sectionId)) {
    expandedSections.value.delete(sectionId)
  } else {
    expandedSections.value.add(sectionId)
  }
}

const isExpanded = (sectionId: string) => {
  return expandedSections.value.has(sectionId)
}
</script>

<template>
  <div class="consultation-dashboard">
    <!-- Metrics Section -->
    <section class="metrics-section collapsible" @click="toggleSection('metrics')">
      <h2 class="section-title">
        <span class="toggle-icon">{{ isExpanded('metrics') ? '▼' : '▶' }}</span>
        關鍵指標
      </h2>
      <div v-if="isExpanded('metrics')" class="metrics-grid">
        <!-- 本月諮詢數 -->
        <div class="metric-card">
          <div class="metric-label">本月諮詢數</div>
          <div class="metric-value">{{ stats.totalThisMonth }}</div>
          <div class="metric-unit">筆</div>
        </div>

        <!-- 轉化率 -->
        <div class="metric-card">
          <div class="metric-label">轉化率</div>
          <div class="metric-value">{{ stats.conversionRate }}</div>
          <div class="metric-unit">已完成</div>
        </div>

        <!-- 平均回應時間 -->
        <div class="metric-card">
          <div class="metric-label">平均回應時間</div>
          <div class="metric-value">{{ stats.avgResponseTime }}</div>
          <div class="metric-unit">小時</div>
        </div>

        <!-- 未完成數 -->
        <div class="metric-card">
          <div class="metric-label">未完成數</div>
          <div class="metric-value">{{ stats.pendingCount }}</div>
          <div class="metric-unit">筆</div>
        </div>

        <!-- 沉默諮詢 -->
        <div class="metric-card warning">
          <div class="metric-label">沉默諮詢</div>
          <div class="metric-value">{{ stats.silentCount }}</div>
          <div class="metric-unit">筆</div>
        </div>

        <!-- 流失客戶 -->
        <div class="metric-card warning">
          <div class="metric-label">流失客戶</div>
          <div class="metric-value">{{ stats.lostCustomerCount }}</div>
          <div class="metric-unit">筆</div>
        </div>
      </div>
    </section>

    <!-- Status Distribution Section -->
    <section class="status-section collapsible" @click="toggleSection('status')">
      <h2 class="section-title">
        <span class="toggle-icon">{{ isExpanded('status') ? '▼' : '▶' }}</span>
        狀態分布
      </h2>
      <div v-if="isExpanded('status')">
        <div v-if="statusItems.length > 0" class="status-list">
          <div v-for="item in statusItems" :key="item.status" class="status-item">
            <span class="status-name">{{ item.status }}</span>
            <span class="status-count">{{ item.count }}</span>
          </div>
        </div>
        <div v-else class="empty-state">暫無資料</div>
      </div>
    </section>

    <!-- Top Customers Section -->
    <section v-if="stats.topCustomers.length > 0" class="customers-section collapsible" @click="toggleSection('customers')">
      <h2 class="section-title">
        <span class="toggle-icon">{{ isExpanded('customers') ? '▼' : '▶' }}</span>
        活躍客戶排行
      </h2>
      <div v-if="isExpanded('customers')">
        <div class="customers-list">
          <div v-for="(customer, index) in stats.topCustomers" :key="customer.customerId" class="customer-item">
            <span class="customer-rank">{{ index + 1 }}</span>
            <span class="customer-name">{{ customer.name }}</span>
            <span class="customer-count">{{ customer.count }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Warning Section -->
    <section class="warning-section collapsible" @click="toggleSection('warnings')">
      <h2 class="section-title">
        <span class="toggle-icon">{{ isExpanded('warnings') ? '▼' : '▶' }}</span>
        預警清單
      </h2>
      <div v-if="isExpanded('warnings')">
        <div v-if="hasWarnings" class="warning-list">
          <div v-if="stats.silentCount > 0" class="warning-item silent">
            <span class="warning-icon">⏱️</span>
            <span class="warning-text">有 {{ stats.silentCount }} 筆諮詢超過 7 天未回應</span>
          </div>
          <div v-if="stats.lostCustomerCount > 0" class="warning-item lost">
            <span class="warning-icon">📉</span>
            <span class="warning-text">有 {{ stats.lostCustomerCount }} 個客戶 90 天無新諮詢</span>
          </div>
        </div>
        <div v-else class="empty-state">暫無警告</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.consultation-dashboard {
  padding: 16px;
  background: var(--color-background, #fafafa);
  border-radius: 8px;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-primary, #1f2937);
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--color-primary, #3b82f6);
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-icon {
  font-size: 0.75rem;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

/* 可折疊區塊 */
.collapsible {
  cursor: pointer;
  user-select: none;
}

.collapsible:hover .section-title {
  opacity: 0.8;
}

/* Metrics Section */
.metrics-section {
  margin-bottom: 32px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.metric-card {
  background: #fff;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.metric-card:hover {
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
  transform: translateY(-2px);
}

.metric-card.warning {
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.2);
}

.metric-card.warning:hover {
  border-color: var(--color-error, #ef4444);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
}

.metric-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-primary, #3b82f6);
  line-height: 1;
  margin-bottom: 4px;
}

.metric-card.warning .metric-value {
  color: var(--color-error, #ef4444);
}

.metric-unit {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #9ca3af);
}

/* Status Section */
.status-section {
  margin-bottom: 32px;
}

.status-list {
  background: #fff;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border, #f3f4f6);
  transition: background 0.2s ease;
}

.status-item:last-child {
  border-bottom: none;
}

.status-item:hover {
  background: var(--color-bg-light, #f9fafb);
}

.status-name {
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
}

.status-count {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary, #3b82f6);
  min-width: 40px;
  text-align: right;
}

/* Customers Section */
.customers-section {
  margin-bottom: 32px;
}

.customers-list {
  background: #fff;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;
}

.customer-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border, #f3f4f6);
  transition: background 0.2s ease;
  gap: 12px;
}

.customer-item:last-child {
  border-bottom: none;
}

.customer-item:hover {
  background: var(--color-bg-light, #f9fafb);
}

.customer-rank {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--color-primary, #3b82f6);
  color: #fff;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.customer-name {
  flex: 1;
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
}

.customer-count {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-primary, #3b82f6);
  min-width: 40px;
  text-align: right;
}

/* Warning Section */
.warning-section {
  margin-bottom: 16px;
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warning-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  border-left: 4px solid;
}

.warning-item.silent {
  background: rgba(234, 179, 8, 0.05);
  border-left-color: #eab308;
  color: #92400e;
}

.warning-item.lost {
  background: rgba(239, 68, 68, 0.05);
  border-left-color: #ef4444;
  color: #7f1d1d;
}

.warning-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.warning-text {
  font-weight: 500;
  font-size: 0.938rem;
}

/* Empty State */
.empty-state {
  padding: 32px 16px;
  text-align: center;
  color: var(--color-text-secondary, #9ca3af);
  font-size: 0.938rem;
}

/* Responsive */
@media (max-width: 768px) {
  .consultation-dashboard {
    padding: 12px;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .metric-card {
    padding: 12px;
  }

  .metric-value {
    font-size: 1.5rem;
  }

  .metric-label {
    font-size: 0.7rem;
  }

  .metric-unit {
    font-size: 0.65rem;
  }

  .section-title {
    font-size: 0.938rem;
    margin-bottom: 12px;
  }
}

@media (max-width: 480px) {
  .consultation-dashboard {
    padding: 8px;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .metric-card {
    padding: 10px;
  }

  .metric-value {
    font-size: 1.25rem;
  }

  .metric-label {
    font-size: 0.65rem;
  }

  .status-item,
  .customer-item {
    padding: 10px 12px;
  }

  .customer-rank {
    width: 28px;
    height: 28px;
    font-size: 0.75rem;
  }
}
</style>
