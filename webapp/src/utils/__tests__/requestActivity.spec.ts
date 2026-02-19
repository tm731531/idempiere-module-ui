import { describe, it, expect } from 'vitest'
import {
  parseActivities,
  stringifyActivities,
  addActivity,
  isActivityJSON,
  getLastActivityTime,
  getActivitiesByType,
  hasConflict,
} from '../requestActivity'

describe('requestActivity utilities', () => {
  it('parses valid activity JSON', () => {
    const json = stringifyActivities([
      { timestamp: '2026-02-19T10:30:00Z', type: '前台行動', actionType: '打電話', content: 'test', createdBy: 'John' },
    ])
    const result = parseActivities(json)
    expect(result).toHaveLength(1)
    expect(result[0].actionType).toBe('打電話')
  })

  it('returns empty array for invalid JSON', () => {
    expect(parseActivities('invalid')).toEqual([])
    expect(parseActivities('')).toEqual([])
  })

  it('adds activity to existing list', () => {
    const existing = stringifyActivities([])
    const result = addActivity(existing, {
      type: '前台行動',
      actionType: '打電話',
      content: 'test',
      createdBy: 'John',
    })
    const parsed = parseActivities(result)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].type).toBe('前台行動')
  })

  it('checks if string is valid activity JSON', () => {
    expect(isActivityJSON('[]')).toBe(true)
    expect(isActivityJSON(stringifyActivities([]))).toBe(true)
    expect(isActivityJSON('invalid')).toBe(false)
    expect(isActivityJSON('null')).toBe(false)
  })

  it('gets last activity timestamp', () => {
    const now = new Date().toISOString()
    const json = stringifyActivities([
      { timestamp: '2026-02-19T10:00:00Z', type: '前台行動', actionType: '打電話', content: 'first', createdBy: 'John' },
      { timestamp: now, type: '前台行動', actionType: '發訊息', content: 'latest', createdBy: 'John' },
    ])
    const lastTime = getLastActivityTime(json)
    expect(lastTime).toBe(now)
  })

  it('filters activities by type', () => {
    const json = stringifyActivities([
      { timestamp: '2026-02-19T10:00:00Z', type: '前台行動', actionType: '打電話', content: 'call', createdBy: 'John' },
      { timestamp: '2026-02-19T11:00:00Z', type: '狀態改變', actionType: '已指派', content: 'assigned', createdBy: 'John' },
      { timestamp: '2026-02-19T12:00:00Z', type: '前台行動', actionType: '發訊息', content: 'msg', createdBy: 'John' },
    ])
    const frontendActions = getActivitiesByType(json, '前台行動')
    expect(frontendActions).toHaveLength(2)
    expect(frontendActions[0].actionType).toBe('打電話')
  })

  it('detects activity conflicts (overlapping timestamps)', () => {
    // 同一個人在同一時間有兩個活動 = 衝突
    const conflict = hasConflict([
      { timestamp: '2026-02-19T10:00:00Z', type: '前台行動', actionType: '打電話', content: 'call', createdBy: 'John' },
      { timestamp: '2026-02-19T10:00:00Z', type: '前台行動', actionType: '發訊息', content: 'msg', createdBy: 'John' },
    ])
    expect(conflict).toBe(true)

    // 不同時間 = 無衝突
    const noConflict = hasConflict([
      { timestamp: '2026-02-19T10:00:00Z', type: '前台行動', actionType: '打電話', content: 'call', createdBy: 'John' },
      { timestamp: '2026-02-19T11:00:00Z', type: '前台行動', actionType: '發訊息', content: 'msg', createdBy: 'John' },
    ])
    expect(noConflict).toBe(false)
  })
})
