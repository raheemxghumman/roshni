import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Camera, FileText, Upload } from 'lucide-react'
import { api } from '../lib/api'
import { announce } from '../lib/announce'
import { navigate } from '../lib/router'
import { ProgressSteps } from './Progress'
import { Button, ErrorNotice, cx } from './ui'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif'
const MAX_MB = 10

const STEPS = [
  { label: 'Uploading the page', detail: 'Straightening and resizing the photo' },
  { label: 'Reading the page', detail: 'Gemini reads every word and describes the figures' },
  { label: 'Building your lesson', detail: 'Organising headings, paragraphs and figures' },
]

export default function UploadPanel() {
  const inputRef = useRef(null)
  const cameraRef = useRef(null)
  const [drag, setDrag] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const previewRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
  }, [])

  const setPreviewUrl = (url) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreview(url)
  }

  const start = async (f) => {
    if (!f) return
    setError(null)
    if (f.size > MAX_MB * 1024 * 1024) {
      setError({ message: `This file is over ${MAX_MB} MB. Please use a smaller photo or a shorter PDF.`, retryable: false })
      return
    }
    setFile(f)
    setPreviewUrl(f.type.startsWith('image/') && !/heic|heif/i.test(f.type) ? URL.createObjectURL(f) : null)
    setBusy(true)
    announce('Reading the page. This takes about 15 seconds.')
    try {
      const lesson = await api.upload(f)
      announce(`Lesson ready: ${lesson.title}`)
      navigate(`/lesson/${lesson.id}`)
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  if (busy) {
    return (
      <div className="space-y-4">
        {file && (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            {preview ? <img src={preview} alt="" className="size-14 rounded-lg object-cover object-top" /> : <FileText className="size-10 text-muted" aria-hidden />}
            <div className="min-w-0">
              <p className="truncate font-semibold">{file.name}</p>
              <p className="text-sm text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          </div>
        )}
        <ProgressSteps steps={STEPS} stepMs={5000} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <motion.div
        animate={drag ? { scale: 1.02, rotateX: 4 } : { scale: 1, rotateX: 0 }}
        style={{ transformPerspective: 900 }}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          start(e.dataTransfer.files?.[0])
        }}
        className={cx(
          'group relative flex flex-col items-center overflow-hidden rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          drag ? 'border-brand bg-brand/5' : 'border-line bg-surface-2/60 hover:border-brand/40',
        )}
      >
        <div className="pointer-events-none absolute -top-16 left-1/2 size-48 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" aria-hidden />
        <motion.span
          className="relative grid size-16 place-items-center rounded-2xl bg-brand text-on-brand shadow-[0_12px_28px_-12px_var(--brand)]"
          animate={{ y: [0, -6, 0], rotateZ: [0, -3, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Upload className="size-7" aria-hidden />
        </motion.span>
        <p className="relative mt-5 font-display text-lg font-semibold">Drop a photo or PDF of any page</p>
        <p className="mt-1 text-sm text-muted">A textbook, a training manual, a safety notice, a worksheet, a medicine leaflet, an Islamiat or Urdu reader page, a form.</p>
        <p className="mt-1 text-sm text-muted">JPG, PNG, HEIC or PDF · up to {MAX_MB} MB · PDFs up to 3 pages</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="primary" icon={Upload} onClick={() => inputRef.current?.click()}>
            Choose a file
          </Button>
          <Button icon={Camera} onClick={() => cameraRef.current?.click()} className="sm:hidden">
            Take a photo
          </Button>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" aria-label="Choose a page photo or PDF" onChange={(e) => start(e.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a photo of a page" onChange={(e) => start(e.target.files?.[0])} />
      </motion.div>
      <ErrorNotice error={error} onRetry={file ? () => start(file) : undefined} />
      <p className="text-xs text-muted">Tip: lay the page flat in good light and fill the frame. Please don&apos;t upload private documents; free AI services may keep inputs.</p>
    </div>
  )
}
