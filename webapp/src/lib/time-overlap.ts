import { parseIdempiereDateTime } from '@/api/utils'

export interface TimeRange {
  start: Date
  end: Date
  resourceId: number
}

export interface ConflictResult {
  hasConflict: boolean
  conflictingNames: string[]
  conflictingAppts: any[]
}

/**
 * 檢查新時間範圍與現有預約是否有時間衝突
 * 邊界時間不視為衝突（A.end <= B.start 不是衝突）
 *
 * @param newRange 新預約的時間範圍和服務人員
 * @param existingAppts 現有的所有預約
 * @param excludeApptId 排除的預約 ID（編輯時用，避免與自己比較）
 * @returns 衝突檢查結果
 */
export function checkConflict(
  newRange: TimeRange,
  existingAppts: any[],
  excludeApptId?: number
): ConflictResult {
  const conflicting: any[] = []

  for (const appt of existingAppts) {
    // 排除指定的預約（編輯自己時）
    if (excludeApptId && appt.id === excludeApptId) {
      continue
    }

    // 解析服務人員 ID（可能是物件或數字）
    const apptResId = typeof appt.S_Resource_ID === 'object'
      ? appt.S_Resource_ID.id
      : appt.S_Resource_ID

    // 只檢查同一個服務人員的預約
    if (apptResId !== newRange.resourceId) {
      continue
    }

    // 解析現有預約的時間
    let apptStart: Date
    let apptEnd: Date

    try {
      apptStart = parseIdempiereDateTime(appt.AssignDateFrom)
      apptEnd = parseIdempiereDateTime(appt.AssignDateTo)
    } catch {
      // 如果日期解析失敗，跳過此預約
      continue
    }

    // 重疊檢查：A.start < B.end AND A.end > B.start
    // 邊界相等時不視為重疊
    if (newRange.start < apptEnd && newRange.end > apptStart) {
      conflicting.push(appt)
    }
  }

  return {
    hasConflict: conflicting.length > 0,
    conflictingNames: conflicting.map(a => a.Name || '未命名預約'),
    conflictingAppts: conflicting,
  }
}

/**
 * 判斷兩個時間範圍是否重疊
 * @param range1 第一個時間範圍
 * @param range2 第二個時間範圍
 * @returns 是否重疊
 */
export function isTimeOverlapping(range1: TimeRange, range2: TimeRange): boolean {
  return range1.start < range2.end && range1.end > range2.start
}

/**
 * 計算時間差（分鐘）
 */
export function getMinutesDiff(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000)
}

/**
 * 格式化時間差為易讀的字串（例如「3小時 15分」）
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0分'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) {
    return `${mins}分`
  }

  if (mins === 0) {
    return `${hours}小時`
  }

  return `${hours}小時 ${mins}分`
}
