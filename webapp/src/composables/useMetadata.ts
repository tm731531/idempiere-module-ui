import { ref } from 'vue'
import { fetchFieldDefinitions, type FieldDefinition } from '@/api/metadata'

const cache = new Map<number, FieldDefinition[]>()

export function clearMetadataCache(): void { cache.clear() }

export function useMetadata() {
  const fieldDefs = ref<FieldDefinition[]>([])
  const loading = ref(false)
  const error = ref('')

  async function loadFields(tabId: number): Promise<void> {
    if (cache.has(tabId)) { fieldDefs.value = cache.get(tabId)!; return }
    loading.value = true; error.value = ''
    try {
      const defs = await fetchFieldDefinitions(tabId)
      cache.set(tabId, defs); fieldDefs.value = defs
    } catch (e: any) { error.value = e.message || '載入欄位定義失敗' }
    finally { loading.value = false }
  }

  function groupedFields(): Map<string, FieldDefinition[]> {
    const groups = new Map<string, FieldDefinition[]>()
    for (const def of fieldDefs.value) {
      const g = def.field.fieldGroup || '其他'
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g)!.push(def)
    }
    return groups
  }

  return { fieldDefs, loading, error, loadFields, groupedFields }
}
