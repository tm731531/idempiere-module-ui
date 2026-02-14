import { ref, onUnmounted } from 'vue'
import imageCompression from 'browser-image-compression'
import { apiClient } from '@/api/client'
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  type AttachmentEntry,
} from '@/api/attachment'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

function isImageFile(entry: AttachmentEntry): boolean {
  if (entry.contentType && entry.contentType.startsWith('image/')) return true
  const lower = entry.name.toLowerCase()
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))
}

export function useAttachment(tableName: string) {
  const attachments = ref<AttachmentEntry[]>([])
  const uploading = ref(false)
  const error = ref('')
  const thumbnailUrls = ref<Map<string, string>>(new Map())

  function cleanupThumbnails() {
    for (const url of thumbnailUrls.value.values()) {
      URL.revokeObjectURL(url)
    }
    thumbnailUrls.value = new Map()
  }

  async function loadThumbnail(recordId: number, entry: AttachmentEntry) {
    if (!isImageFile(entry)) return
    try {
      const resp = await apiClient.get(
        `/api/v1/models/${tableName}/${recordId}/attachments/${encodeURIComponent(entry.name)}`,
        { responseType: 'blob' },
      )
      const url = URL.createObjectURL(resp.data)
      const updated = new Map(thumbnailUrls.value)
      updated.set(entry.name, url)
      thumbnailUrls.value = updated
    } catch {
      // silently skip thumbnail if fetch fails
    }
  }

  async function loadAttachments(recordId: number): Promise<void> {
    cleanupThumbnails()
    attachments.value = await listAttachments(tableName, recordId)
    const imageEntries = attachments.value.filter(isImageFile)
    await Promise.all(imageEntries.map(entry => loadThumbnail(recordId, entry)))
  }

  async function upload(recordId: number, file: File): Promise<void> {
    uploading.value = true
    error.value = ''
    try {
      let processedFile: File | Blob = file
      if (file.type.startsWith('image/')) {
        processedFile = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1920,
          useWebWorker: false,
        })
      }
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] || '') // strip data:...;base64, prefix
        }
        reader.onerror = reject
        reader.readAsDataURL(processedFile)
      })
      await uploadAttachment(tableName, recordId, file.name, base64)
      await loadAttachments(recordId)
    } catch (e: unknown) {
      const err = e as { message?: string }
      error.value = err.message || '上傳失敗'
    } finally {
      uploading.value = false
    }
  }

  async function remove(recordId: number, fileName: string): Promise<void> {
    const thumbUrl = thumbnailUrls.value.get(fileName)
    if (thumbUrl) {
      URL.revokeObjectURL(thumbUrl)
      const updated = new Map(thumbnailUrls.value)
      updated.delete(fileName)
      thumbnailUrls.value = updated
    }
    await deleteAttachment(tableName, recordId, fileName)
    await loadAttachments(recordId)
  }

  onUnmounted(() => {
    cleanupThumbnails()
  })

  return { attachments, uploading, error, thumbnailUrls, loadAttachments, upload, remove }
}
