import { ref, computed, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMetadata } from './useMetadata'
import { resolveDefaultValue, type FieldDefinition } from '@/api/metadata'

export interface DocumentFormOptions {
  tabId: number
  recordId?: Ref<number | null>
  loadRecord?: (id: number) => Promise<Record<string, any>>
  excludeColumns?: string[]
  columnFilters?: Record<string, string>
}

const SYSTEM_COLUMNS = new Set([
  'Created', 'CreatedBy', 'Updated', 'UpdatedBy', 'IsActive',
  'AD_Client_ID', 'AD_Org_ID', 'Processed', 'Processing', 'Posted',
  'ProcessedOn', 'IsApproved', 'IsGenerated', 'IsSelfService',
  'IsSelected', 'IsTransferred', 'IsInvoiced', 'IsDelivered',
  'IsCreditApproved', 'IsPrinted', 'SendEMail', 'DocumentNo',
  'IsCreated',
])

export function useDocumentForm(options: DocumentFormOptions) {
  const authStore = useAuthStore()
  const { fieldDefs, loading: metaLoading, error: metaError, loadFields } = useMetadata()

  const formData = ref<Record<string, any>>({})
  const recordData = ref<Record<string, any> | null>(null)
  // FK identifier labels extracted from record load — used by SearchSelector for initial display
  const fkLabels = ref<Record<string, string>>({})
  const pageLoading = ref(false)
  const pageError = ref('')
  const docStatus = ref('DR')

  const isCreate = computed(() => !options.recordId?.value)
  const readOnly = computed(() => docStatus.value !== 'DR' && !isCreate.value)

  const excludeSet = computed(() => {
    const s = new Set(SYSTEM_COLUMNS)
    if (options.excludeColumns) {
      for (const c of options.excludeColumns) s.add(c)
    }
    return s
  })

  // Filter field definitions for rendering
  const visibleFieldDefs = computed<FieldDefinition[]>(() => {
    return fieldDefs.value.filter(d => {
      if (excludeSet.value.has(d.column.columnName)) return false
      if (d.column.referenceId === 13) return false  // ID
      if (d.column.referenceId === 28) return false  // Button
      if (!d.field.isDisplayed) return false
      // Create mode: skip non-updateable, non-mandatory fields
      if (isCreate.value && !d.column.isUpdateable && !d.column.isMandatory) return false
      return true
    })
  })

  // Mandatory validation
  const mandatoryErrors = computed<string[]>(() => {
    const errors: string[] = []
    for (const def of visibleFieldDefs.value) {
      if (def.column.isMandatory) {
        const val = formData.value[def.column.columnName]
        if (val === null || val === undefined || val === '') {
          errors.push(def.field.name)
        }
      }
    }
    return errors
  })

  const isValid = computed(() => mandatoryErrors.value.length === 0)

  // Initialize form with defaults from metadata
  function initDefaults() {
    const data: Record<string, any> = {}
    const ctx = {
      organizationId: authStore.context?.organizationId ?? 0,
      warehouseId: authStore.context?.warehouseId ?? 0,
      clientId: authStore.context?.clientId ?? 0,
    }
    for (const def of fieldDefs.value) {
      if (def.column.defaultValue) {
        const resolved = resolveDefaultValue(def.column.defaultValue, ctx, def.column.referenceId)
        if (resolved !== undefined) {
          data[def.column.columnName] = resolved
        }
      }
    }
    formData.value = data
  }

  // Populate form from existing record
  function populateFromRecord(record: Record<string, any>) {
    const data: Record<string, any> = {}
    const labels: Record<string, string> = {}
    for (const def of fieldDefs.value) {
      const cn = def.column.columnName
      const rawVal = record[cn]
      // iDempiere REST returns FK and List fields as {id, identifier} objects
      if (rawVal !== null && rawVal !== undefined && typeof rawVal === 'object' && 'id' in rawVal) {
        data[cn] = rawVal.id
        if (rawVal.identifier) labels[cn] = rawVal.identifier
      } else {
        data[cn] = rawVal ?? null
      }
    }
    fkLabels.value = labels
    // Also include hidden boolean/context columns (e.g. IsSOTrx) that AD_Val_Rule may reference.
    // These are not in fieldDefs (IsDisplayed=false) but are needed for validation rule context.
    for (const [key, rawVal] of Object.entries(record)) {
      if (key in data) continue  // already handled above
      if (typeof rawVal === 'boolean') {
        data[key] = rawVal
      }
    }
    // Extract DocStatus
    const ds = record.DocStatus
    if (ds && typeof ds === 'object') {
      docStatus.value = ds.id || 'DR'
    } else {
      docStatus.value = ds || 'DR'
    }
    formData.value = data
    recordData.value = record
  }

  // Load metadata + optional record
  async function load() {
    pageLoading.value = true
    pageError.value = ''
    try {
      await loadFields(options.tabId)

      if (!isCreate.value && options.recordId?.value && options.loadRecord) {
        const record = await options.loadRecord(options.recordId.value)
        populateFromRecord(record)
      } else {
        initDefaults()
      }
    } catch (e: any) {
      pageError.value = e.message || '載入失敗'
    } finally {
      pageLoading.value = false
    }
  }

  // Build a set of updateable column names from metadata
  const updateableColumns = computed(() => {
    const s = new Set<string>()
    for (const def of fieldDefs.value) {
      if (def.column.isUpdateable && !SYSTEM_COLUMNS.has(def.column.columnName)) {
        s.add(def.column.columnName)
      }
    }
    return s
  })

  // Extract payload for API submission (create mode)
  // Only includes updateable, non-system columns with non-null values
  function getFormPayload(): Record<string, any> {
    const payload: Record<string, any> = {}
    const allowed = updateableColumns.value
    for (const [key, value] of Object.entries(formData.value)) {
      if (value !== null && value !== undefined && value !== '') {
        if (allowed.has(key)) {
          payload[key] = value
        }
      }
    }
    return payload
  }

  // Extract payload for update (PUT) — includes all non-system, non-null values
  // to preserve mandatory fields that are not updateable (e.g. C_Currency_ID)
  function getUpdatePayload(): Record<string, any> {
    const payload: Record<string, any> = {}
    for (const def of fieldDefs.value) {
      const cn = def.column.columnName
      if (SYSTEM_COLUMNS.has(cn)) continue
      const value = formData.value[cn]
      if (value !== null && value !== undefined && value !== '') {
        payload[cn] = value
      }
    }
    return payload
  }

  return {
    fieldDefs,
    visibleFieldDefs,
    metaLoading,
    metaError,
    formData,
    recordData,
    fkLabels,
    docStatus,
    pageLoading,
    pageError,
    isCreate,
    readOnly,
    mandatoryErrors,
    isValid,
    load,
    initDefaults,
    populateFromRecord,
    getFormPayload,
    getUpdatePayload,
  }
}
