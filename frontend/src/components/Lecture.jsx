import { useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX, ClipboardList, FileAudio, ListChecks, ShieldCheck, TriangleAlert, Upload } from 'lucide-react'
import { api, apiUrl } from '../lib/api'
import { announce, formatTime, shortModel } from '../lib/announce'
import { ProgressSteps } from './Progress'
import { statusInfo } from './FactGuard'
import { Button, Card, CardHeader, Drawer, ErrorNotice, Pill, cx } from './ui'

const STEPS = [
  { label: 'Uploading the recording' },
  { label: 'Transcribing with Whisper', detail: 'Turning speech into timestamped text' },
  { label: 'Writing a short summary', detail: 'Key points, key terms and homework' },
  { label: 'Fact Guard checks the summary', detail: 'Every point must be something the teacher actually said' },
]

export function LectureUpload({ lessonId, onDone }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('auto')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    announce('Making captions. This takes about 10 seconds.')
    try {
      const lecture = await api.uploadLecture(file, language, lessonId)
      announce('Captions ready')
      onDone(lecture)
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  if (busy) return <ProgressSteps steps={STEPS} stepMs={2500} title="Making captions" />
  return (
    <Card>
      <CardHeader icon={FileAudio} title="Add a lecture recording" subtitle="Deaf and hard-of-hearing learners get a transcript and a checked summary." />
      <div className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="lec-file" className="mb-1.5 block text-sm font-semibold">
              Recording
            </label>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-11 w-full items-center gap-2 rounded-xl border border-dashed border-line bg-surface-2 px-3 text-left text-sm hover:border-brand"
            >
              <Upload className="size-4 shrink-0 text-muted" aria-hidden />
              <span className="truncate">{file ? file.name : 'Choose an MP3, M4A, WAV or WEBM file'}</span>
            </button>
            <input id="lec-file" ref={inputRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label htmlFor="lec-lang" className="mb-1.5 block text-sm font-semibold">
              Language spoken
            </label>
            <select id="lec-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className="h-11 rounded-xl border border-line bg-surface px-3 text-sm">
              <option value="auto">Detect automatically</option>
              <option value="en">English</option>
              <option value="ur">Urdu</option>
            </select>
          </div>
          <Button variant="primary" onClick={submit} disabled={!file}>
            Make captions
          </Button>
        </div>
        <ErrorNotice error={error} onRetry={submit} />
        <p className="text-xs text-muted">Up to about 10 minutes (24 MB). For mixed Urdu and English lectures, choosing the main language improves accuracy.</p>
      </div>
    </Card>
  )
}

const CLAIM = {
  supported: { icon: CircleCheck, cls: 'text-ok', label: 'Said in the lecture' },
  changed: { icon: TriangleAlert, cls: 'text-warn', label: 'Partly different' },
  unsupported: { icon: CircleX, cls: 'text-bad', label: 'Not said in the lecture' },
}

export function LectureView({ lecture }) {
  const audioRef = useRef(null)
  const listRef = useRef(null)
  const [time, setTime] = useState(0)
  const [open, setOpen] = useState(false)
  const active = lecture.segments.reduce((acc, s, i) => (s.start <= time + 0.15 ? i : acc), -1)

  useEffect(() => {
    if (active < 0) return
    const el = document.getElementById(`seg-${active}`)
    const box = listRef.current
    if (el && box) box.scrollTo({ top: el.offsetTop - box.offsetTop - box.clientHeight / 3, behavior: 'smooth' })
  }, [active])

  const seek = (t) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = t
    a.play().catch(() => {})
  }

  const fg = lecture.factguard || {}
  const info = statusInfo(fg)
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader
          icon={FileAudio}
          title="Transcript"
          subtitle={`${formatTime(lecture.duration)} · ${lecture.language} · ${lecture.segments.length} captions · ${shortModel(lecture.models?.speech_to_text)}`}
        />
        <div className="border-b border-line bg-surface-2 px-5 py-3">
          <audio ref={audioRef} controls preload="metadata" src={apiUrl(lecture.audio_url)} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} className="w-full">
            Your browser can&apos;t play this audio.
          </audio>
        </div>
        <ol ref={listRef} className="max-h-[65vh] space-y-1 overflow-y-auto p-3" aria-label="Captions">
          {lecture.segments.map((s, i) => (
            <li key={i} id={`seg-${i}`}>
              <button
                type="button"
                onClick={() => seek(s.start)}
                className={cx('flex w-full gap-4 rounded-xl px-3 py-2.5 text-left transition', active === i ? 'bg-highlight' : 'hover:bg-surface-2')}
                aria-current={active === i ? 'true' : undefined}
              >
                <span className="w-12 shrink-0 pt-1 font-mono text-xs tabular-nums text-muted">{formatTime(s.start)}</span>
                <span className="reading">{s.text}</span>
              </button>
            </li>
          ))}
        </ol>
      </Card>

      <aside className="space-y-4" aria-label="Lecture summary">
        <Card>
          <CardHeader icon={ClipboardList} title="Summary" subtitle="Key points from the lecture" />
          <div className="p-5">
            <div className={cx('mb-4 flex items-center gap-3 rounded-xl p-3', fg.status === 'green' ? 'bg-ok-soft text-ok' : fg.status === 'amber' ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-muted')}>
              <ShieldCheck className="size-6 shrink-0" aria-hidden />
              <p className="text-sm font-semibold">
                {fg.total ? `Fact Guard: ${fg.kept} of ${fg.total} points were actually said in the lecture` : info.label}
              </p>
            </div>
            <ul className="reading space-y-2.5">
              {(lecture.summary || []).map((b, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            {fg.rounds?.length > 1 && (
              <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
                The first summary had {fg.rounds[0].total - fg.rounds[0].kept} point(s) the teacher didn&apos;t say. Fact Guard flagged them and they were fixed.
              </p>
            )}
            {fg.claims?.length > 0 && (
              <Button className="mt-4 w-full" icon={ListChecks} onClick={() => setOpen(true)}>
                See how each point was checked
              </Button>
            )}
          </div>
        </Card>
        {lecture.key_terms?.length > 0 && (
          <Card className="p-5">
            <h2 className="font-semibold">Key terms</h2>
            <dl className="mt-3 space-y-2.5">
              {lecture.key_terms.map((t) => (
                <div key={t.term}>
                  <dt className="font-semibold">{t.term}</dt>
                  <dd className="text-sm text-muted">{t.meaning}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
        {lecture.actions?.length > 0 && (
          <Card className="p-5">
            <h2 className="font-semibold">Homework and reminders</h2>
            <ul className="mt-3 space-y-2">
              {lecture.actions.map((a) => (
                <li key={a} className="flex gap-2 text-[15px]">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </aside>

      <Drawer open={open} onClose={() => setOpen(false)} title="Fact Guard · summary check">
        <p className="mb-4 rounded-xl bg-surface-2 p-4 text-sm">
          A summary may leave things out, but every point must be something the teacher said. Summary by <b>{shortModel(fg.rewriter_model)}</b>, checked by{' '}
          <b>{shortModel(fg.checker_model)}</b>.
        </p>
        <ul className="divide-y divide-line">
          {(fg.claims || []).map((c) => {
            const s = CLAIM[c.status] || CLAIM.unsupported
            return (
              <li key={c.id} className="flex gap-3 py-3">
                <s.icon className={cx('mt-0.5 size-5 shrink-0', s.cls)} aria-hidden />
                <div>
                  <p>{c.claim}</p>
                  <p className={cx('mt-1 text-xs font-semibold uppercase tracking-wide', s.cls)}>{s.label}</p>
                  {c.evidence && <p className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">Teacher said: “{c.evidence}”</p>}
                  {c.note && c.status !== 'supported' && <p className="mt-1 text-sm text-muted">{c.note}</p>}
                </div>
              </li>
            )
          })}
        </ul>
        {fg.rounds?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Rounds</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {fg.rounds.map((r) => (
                <li key={r.round}>
                  <Pill tone={r.status === 'green' ? 'ok' : 'warn'}>
                    Round {r.round}: {r.kept}/{r.total}
                  </Pill>{' '}
                  <span className="text-muted">{r.action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Drawer>
    </div>
  )
}
