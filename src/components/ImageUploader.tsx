'use client'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'

interface Props {
  userId: string
  onInsert: (url: string) => void
}

const SAFE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

async function prepareImage(file: File): Promise<{ blob: Blob; ext: string; type: string } | null> {
  const safeExt = SAFE_TYPES[file.type]
  // small, web-friendly images (and animated GIFs) go up untouched
  if (safeExt && (file.size <= 1.5 * 1024 * 1024 || file.type === 'image/gif')) {
    return { blob: file, ext: safeExt, type: file.type }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); img.src = url })
    const scale = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ? { blob, ext: 'jpg', type: 'image/jpeg' } : null
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function ImageUploader({ userId, onInsert }: Props) {
  const { t } = useApp()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleFile(file: File) {
    const heic = /\.(heic|heif)$/i.test(file.name)
    if (!file.type.startsWith('image/') && !heic) { setError(t.imagesOnly); return }
    if (file.size > 25 * 1024 * 1024) { setError(t.maxFileSize); return }

    setError(null)
    setUploading(true)

    try {
      // Phone photos are often HEIC (browsers can't show them) or huge –
      // re-encode to a JPEG every browser can display.
      const prepared = await prepareImage(file)
      if (!prepared) { setError(t.imageFormatError); return }
      if (prepared.blob.size > 5 * 1024 * 1024) { setError(t.maxFileSize); return }
      const path = `${userId}/${Date.now()}.${prepared.ext}`

      const { error: upErr } = await supabase.storage
        .from('images')
        .upload(path, prepared.blob, { cacheControl: '3600', upsert: false, contentType: prepared.type })

      if (upErr) { setError(upErr.message); return }

      const { data } = supabase.storage.from('images').getPublicUrl(path)
      onInsert(data.publicUrl)
    } catch (e) {
      console.error('[ImageUploader] upload failed:', e)
      setError(t.loadError)
    } finally {
      setUploading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // reset so same file can be re-uploaded
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" onChange={handleChange} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
        title={t.uploadImage}
      >
        {uploading ? (
          <>
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            {t.uploading}
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t.uploadImage}
          </>
        )}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
