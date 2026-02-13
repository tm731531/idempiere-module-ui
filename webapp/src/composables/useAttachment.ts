import { ref } from 'vue'
import imageCompression from 'browser-image-compression'
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  type AttachmentEntry,
} from '@/api/attachment'

export function useAttachment(tableName: string) {
  const attachments = ref<AttachmentEntry[]>([])
  const uploading = ref(false)
  const error = ref('')

  async function loadAttachments(recordId: number): Promise<void> {
    attachments.value = await listAttachments(tableName, recordId)
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
    await deleteAttachment(tableName, recordId, fileName)
    await loadAttachments(recordId)
  }

  return { attachments, uploading, error, loadAttachments, upload, remove }
}
