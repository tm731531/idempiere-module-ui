/**
 * 日曆視圖的全局配置
 * 包括業務時間、UI 尺寸、顏色方案等
 */

export const CALENDAR_CONFIG = {
  // ========== 業務時間 ==========
  // 業務時間是指在時間 grid 視圖上主要顯示的時段
  // GRID_START_HOUR = 0 表示時間 grid 從 00:00 開始顯示所有 24 小時
  // 但實際醫療診所會在 BUSINESS_START_HOUR 到 BUSINESS_END_HOUR 之間運作
  BUSINESS_START_HOUR: 9,
  BUSINESS_END_HOUR: 18,

  // ========== UI 尺寸 ==========
  GRID_START_HOUR: 0,        // 時間 grid 從 00:00 開始
  SLOT_HEIGHT: 44,           // 每個 30 分鐘 slot 的像素高度
  LABEL_WIDTH: 52,           // 左側時間標籤列的寬度
  SLOT_MINUTES: 30,          // 時段粒度（30 分鐘為一個 slot）

  // ========== 顏色方案 ==========
  // 服務人員顏色（循環使用）
  COLORS: [
    '#6366f1', // Indigo — 專業感
    '#f59e0b', // Amber — 溫暖感
    '#10b981', // Emerald — 健康感
    '#ef4444', // Red — 警告/衝突用
    '#8b5cf6', // Violet — 創意感
    '#06b6d4', // Cyan — 清爽感
    '#f97316', // Orange — 活力感
    '#ec4899', // Pink — 友好感
  ],

  // ========== 衝突視覺反饋 ==========
  CONFLICT_COLOR: '#ef4444',
  CONFLICT_OPACITY: 0.6,

  // ========== 動畫時間 ==========
  TRANSITION_DURATION: '0.3s',

  // ========== Mobile vs Desktop 斷點 ==========
  MOBILE_BREAKPOINT: 640, // px（Tailwind sm breakpoint）
} as const

/**
 * 根據資源 ID 取得顏色（穩定的對應）
 * @param resourceId 服務人員 ID
 * @param allResources 所有服務人員列表
 * @returns 16 進位顏色代碼
 */
export function getResourceColor(resourceId: number, allResources: any[]): string {
  const idx = allResources.findIndex(r => r.id === resourceId)
  const colorIdx = Math.max(0, idx) % CALENDAR_CONFIG.COLORS.length
  return CALENDAR_CONFIG.COLORS[colorIdx]!
}
