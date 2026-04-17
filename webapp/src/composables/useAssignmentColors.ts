/**
 * useAssignmentColors — module-level reactive cache for resource and assignment colors.
 *
 * Priority when resolving a color for an appointment block:
 *   1. Per-assignment override (ASSIGNMENT_COLORS in AD_SysConfig)
 *   2. Per-resource default (RESOURCE_COLORS in AD_SysConfig)
 *   3. Hardcoded fallback: #3b82f6 (blue-500)
 *
 * Saves are debounced 500 ms to avoid hammering AD_SysConfig on rapid edits.
 * Color persistence failures are non-blocking — errors are logged, not thrown.
 */

import { ref } from 'vue'
import {
  getResourceColors,
  setResourceColors,
  getAssignmentColors,
  setAssignmentColor as _setAssignmentColor,
} from '@/api/sysconfig'

// ========== Default fallback color ==========
export const DEFAULT_APPT_COLOR = '#3b82f6'

// ========== Module-level reactive state ==========
const resourceColors = ref<Record<number, string>>({})
const assignmentColors = ref<Record<number, string>>({})
const loaded = ref(false)
const loading = ref(false)

// ========== Debounced save for resource colors ==========
let resourceSaveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleResourceColorSave() {
  if (resourceSaveTimer !== null) clearTimeout(resourceSaveTimer)
  resourceSaveTimer = setTimeout(async () => {
    try {
      await setResourceColors({ ...resourceColors.value })
    } catch (e) {
      console.error('[useAssignmentColors] Failed to persist resource colors:', e)
    }
  }, 500)
}

// ========== Load ==========
/**
 * Load both color maps from AD_SysConfig.
 * Idempotent — only fetches once per module lifecycle.
 */
async function load(): Promise<void> {
  if (loaded.value || loading.value) return
  loading.value = true
  try {
    const [rc, ac] = await Promise.all([getResourceColors(), getAssignmentColors()])
    resourceColors.value = rc
    assignmentColors.value = ac
    loaded.value = true
  } catch (e) {
    console.error('[useAssignmentColors] Failed to load color maps:', e)
  } finally {
    loading.value = false
  }
}

// ========== Resolve ==========
/**
 * Resolve the display color for an appointment block.
 * @param assignmentId  The S_ResourceAssignment_ID (or 0 / undefined if unknown)
 * @param resourceId    The S_Resource_ID
 * @returns  Hex color string
 */
function resolveAssignmentColor(assignmentId: number | undefined | null, resourceId: number): string {
  if (assignmentId !== undefined && assignmentId !== null && assignmentId !== 0) {
    const override = assignmentColors.value[assignmentId]
    if (override) return override
  }
  const resColor = resourceColors.value[resourceId]
  if (resColor) return resColor
  return DEFAULT_APPT_COLOR
}

// ========== Setters ==========
/**
 * Update the color for a resource and schedule a debounced save.
 */
function setResourceColor(resourceId: number, color: string): void {
  resourceColors.value = { ...resourceColors.value, [resourceId]: color }
  scheduleResourceColorSave()
}

/**
 * Remove a resource color override (revert to system default).
 */
function clearResourceColor(resourceId: number): void {
  const next = { ...resourceColors.value }
  delete next[resourceId]
  resourceColors.value = next
  scheduleResourceColorSave()
}

/**
 * Set or clear a per-assignment color override.
 * Non-blocking: fires-and-forgets, catches errors silently.
 */
async function setAssignmentColorOverride(assignmentId: number, color: string | null): Promise<void> {
  // Optimistic local update
  if (color === null) {
    const next = { ...assignmentColors.value }
    delete next[assignmentId]
    assignmentColors.value = next
  } else {
    assignmentColors.value = { ...assignmentColors.value, [assignmentId]: color }
  }
  // Persist (non-blocking)
  try {
    await _setAssignmentColor(assignmentId, color)
  } catch (e) {
    console.error('[useAssignmentColors] Failed to persist assignment color override:', e)
  }
}

// ========== Cache management ==========
/**
 * Clear all in-memory color state and cancel any pending debounced save.
 * Call on logout / context switch to prevent cross-tenant color leaks.
 */
export function clearAssignmentColors(): void {
  if (resourceSaveTimer !== null) {
    clearTimeout(resourceSaveTimer)
    resourceSaveTimer = null
  }
  resourceColors.value = {}
  assignmentColors.value = {}
  loaded.value = false
}

/**
 * If a debounced resource-color save is pending, flush it immediately.
 * Components should call this on `onBeforeUnmount` to avoid losing the last pick.
 */
export async function flushPendingSave(): Promise<void> {
  if (resourceSaveTimer !== null) {
    clearTimeout(resourceSaveTimer)
    resourceSaveTimer = null
    try {
      await setResourceColors({ ...resourceColors.value })
    } catch (e) {
      console.error('[useAssignmentColors] Failed to flush pending resource color save:', e)
    }
  }
}

// ========== Exported composable ==========
export function useAssignmentColors() {
  return {
    /** Reactive map: resourceId → hex color */
    resourceColors,
    /** Reactive map: assignmentId → hex color */
    assignmentColors,
    /** Whether the initial load has completed */
    loaded,
    /** Load color maps (idempotent) */
    load,
    /** Resolve final color for an appointment block */
    resolveAssignmentColor,
    /** Set a resource-level default color */
    setResourceColor,
    /** Remove a resource-level color override */
    clearResourceColor,
    /** Set or clear a per-assignment color override */
    setAssignmentColorOverride,
  }
}
