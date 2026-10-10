// YouTube link -> study notes that Fact Guard checked against the video's captions.
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { CircleCheck, Download, Link2, MonitorPlay, Pause, Play, Search, ShieldCheck, TriangleAlert } from 'lucide-react'
import { api } from '../lib/api'
import { announce, formatTime, shortModel } from '../lib/announce'
import { useSettings } from '../lib/settings'
import { useSpeech } from '../lib/speech'
import { ProgressSteps } from './Progress'
import { Button, Card, CardHeader, ErrorNotice, Pill, Segmented, cx } from './ui'
import { EASE } from './motion'

const STEPS = [
  { label: 'Reading the video’s captions', detail: 'Only what is actually said in the video' },
  { label: 'Writing study notes', detail: 'Short points with timestamps' },
  { label: 'Fact Guard checks every note', detail: 'A different AI must find each note in the captions' },
]
const YT_RE = /(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i

export function VideoAdd({ lessonId, onDone, compact = false }) {
  const [url, setUrl] = useState('')
  const [language, setLanguage] = useState('auto')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e?.preventDefault()
    const value = url.trim()
    if (!value) return setError({ message: 'Paste a YouTube link first.', retryable: false })
    if (!YT_RE.test(value) && !/^[A-Za-z0-9_-]{11}$/.test(value)) return setError({ message: 'That doesn’t look like a YouTube link. Copy it from the Share button on YouTube.', retryable: false })
    setBusy(true)
    setError(null)
    announce('Making notes from the video. This takes about 15 seconds.')
    try {
      const video = await api.makeVideo(value, { language, lessonId })
      announce(`Notes ready: ${video.factguard.kept} of ${video.factguard.total} confirmed by the video.`)
      setUrl('')
      onDone(video)
    } catch (err) {
      setError(err)
    }
    setBusy(false)
  }

  if (busy) return <ProgressSteps steps={STEPS} stepMs={4000} title="Making notes from the video" />
  return (
    <Card>
      {!compact && <CardHeader icon={MonitorPlay} tone="teal" title="Learn from a YouTube video" subtitle="Paste a link. Roshni turns the video’s captions into short study notes, and Fact Guard checks every note against what was said." />}
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="yt-url" className="mb-1.5 block text-sm font-semibold">
              YouTube link
            </label>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 focus-within:border-brand">
              <Link2 className="size-4 shrink-0 text-muted" aria-hidden />
              <input
                id="yt-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://www.youtube.com/watch?v=…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold" id="yt-lang-label">
              Captions language
            </p>
            <Segmented id="yt-lang" label="Captions language" value={language} onChange={setLanguage} options={[{ value: 'auto', label: 'Auto' }, { value: 'en', label: 'English' }, { value: 'ur', label: 'Urdu' }]} />
          </div>
        </div>
        <ErrorNotice error={error} onRetry={error?.retryable ? submit : undefined} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" icon={MonitorPlay}>
            Make notes
          </Button>
          <p className="text-xs text-muted">Works with videos that have captions. Notes cover up to the first hour.</p>
        </div>
      </form>
    </Card>
  )
}

function Player({ videoId, start, nonce }) {
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&cc_load_policy=1&start=${Math.floor(start || 0)}${nonce ? '&autoplay=1' : ''}`
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-ink">
      <iframe key={`${videoId}-${start}-${nonce}`} src={src} title="YouTube video player" className="absolute inset-0 size-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  )
}

function notesText(video) {
  const lines = [`${video.title}${video.author ? ` (${video.author})` : ''}`, video.url, '']
  for (const sec of video.notes) {
    lines.push(`${sec.heading} [${formatTime(sec.start)}]`)
    for (const n of sec.notes) lines.push(`- ${n.text} [${formatTime(n.start)}]${n.status === 'supported' ? '' : ' (not confirmed by the video)'}`)
    lines.push('')
  }
  if (video.key_terms?.length) {
    lines.push('Key terms')
    for (const t of video.key_terms) lines.push(`- ${t.term}: ${t.meaning}`)
  }
  lines.push('', 'Notes made by Roshni and checked by Fact Guard against the video’s captions.')
  return lines.join('\n')
}

export function VideoView({ video, relevance, jump }) {
  const { settings } = useSettings()
  const speech = useSpeech()
  const [at, setAt] = useState({ t: jump?.t || 0, nonce: jump?.t ? 1 : 0 })
  const [showQuotes, setShowQuotes] = useState(false)
  const [query, setQuery] = useState('')
  const fg = video.factguard
  const flat = useMemo(() => video.notes.flatMap((s) => s.notes), [video])
  const key = `video-${video.id}`
  const reading = speech.key === key && speech.status === 'playing'

  useEffect(() => {
    if (jump?.t != null) setAt((a) => ({ t: jump.t, nonce: a.nonce + 1 }))
  }, [jump?.t, jump?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const seek = (t) => {
    setAt((a) => ({ t, nonce: a.nonce + 1 }))
    announce(`Video jumps to ${formatTime(t)}`)
    document.getElementById(`player-${video.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const download = () => {
    const blob = new Blob([notesText(video)], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${video.title.replace(/[^\w\- ]+/g, '').slice(0, 60) || 'video'}-notes.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const q = query.trim().toLowerCase()
  const lines = q ? video.segments.filter((s) => s.text.toLowerCase().includes(q)) : video.segments

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <div id={`player-${video.id}`} className="scroll-mt-40">
          <Player videoId={video.video_id} start={at.t} nonce={at.nonce} />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold leading-tight">{video.title}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {video.author && <Pill>{video.author}</Pill>}
            <Pill>{formatTime(video.duration)}</Pill>
            <Pill tone={video.generated_captions ? 'warn' : 'teal'}>{video.language_name || video.language} captions{video.generated_captions ? ' · auto-generated' : ' · made by people'}</Pill>
            <Pill tone={fg.status === 'green' ? 'ok' : fg.status === 'unavailable' ? 'info' : 'warn'} icon={ShieldCheck}>
              {fg.status === 'unavailable' ? 'Fact Guard was busy' : `${fg.kept}/${fg.total} notes confirmed by the video`}
            </Pill>
          </div>
        </div>
        {relevance && relevance.related === false && (
          <p className="flex items-start gap-2 rounded-2xl bg-warn-soft px-4 py-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
            This video doesn’t seem to be about this page: it uses few of the page’s words. You can keep it, but check it’s the right video.
          </p>
        )}
        {video.truncated && <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">This is a long video. The notes cover the first {formatTime(video.covered_until)}.</p>}
        {video.generated_captions && <p className="text-sm text-muted">Auto-generated captions can mishear words. Fact Guard checks the notes against them, so a mistake in the captions can still reach the notes: rewatch anything that looks wrong.</p>}

        <Card>
          <CardHeader
            icon={MonitorPlay}
            tone="teal"
            title="Study notes"
            subtitle="Tap a time to jump the video there"
            action={
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" icon={reading ? Pause : Play} onClick={() => (reading ? speech.stop() : speech.play(flat.map((n) => n.text), { rate: settings.rate, key }))}>
                  {reading ? 'Stop' : 'Read aloud'}
                </Button>
                <Button size="sm" variant="ghost" icon={Download} onClick={download} aria-label="Download notes as a text file" />
              </div>
            }
          />
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5">
            <span className="text-xs text-muted">Notes by {shortModel(video.models?.notes)} · checked by {shortModel(video.models?.checker) || 'Fact Guard'}</span>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={showQuotes} onChange={(e) => setShowQuotes(e.target.checked)} className="accent-[var(--brand)]" />
              Show proof from the captions
            </label>
          </div>
          <div className="space-y-6 p-5">
            {video.notes.map((sec, si) => (
              <motion.section key={si} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: si * 0.06, ease: EASE }} aria-labelledby={`vn-${video.id}-${si}`}>
                <div className="flex items-center gap-2">
                  <h3 id={`vn-${video.id}-${si}`} className="flex-1 font-semibold">
                    {sec.heading}
                  </h3>
                  <button type="button" onClick={() => seek(sec.start)} className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs font-semibold text-brand hover:bg-brand/10" aria-label={`Play from ${formatTime(sec.start)}`}>
                    ▶ {formatTime(sec.start)}
                  </button>
                </div>
                <ul className="mt-2 space-y-2">
                  {sec.notes.map((n, ni) => {
                    const ok = n.status === 'supported'
                    return (
                      <li key={ni} className={cx('flex items-start gap-3 rounded-xl px-3 py-2', !ok && 'bg-warn-soft')}>
                        {ok ? <CircleCheck className="mt-1 size-4 shrink-0 text-ok" aria-label="Confirmed by the video" /> : <TriangleAlert className="mt-1 size-4 shrink-0 text-warn" aria-label="Not confirmed by the video" />}
                        <div className="min-w-0 flex-1">
                          <p className="reading text-[16px]">{n.text}</p>
                          {!ok && <p className="mt-1 text-xs text-warn">Not confirmed by the video{n.note ? `: ${n.note}` : ''}. Rewatch this part.</p>}
                          {ok && showQuotes && n.evidence && <p className="mt-1 border-l-2 border-teal pl-2 text-xs italic text-muted">“{n.evidence}”</p>}
                        </div>
                        <button type="button" onClick={() => seek(n.start)} className="shrink-0 font-mono text-xs font-semibold text-brand hover:underline" aria-label={`Play from ${formatTime(n.start)}`}>
                          {formatTime(n.start)}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </motion.section>
            ))}
            {video.notes.length === 0 && <p className="text-sm text-muted">No study notes could be made from this video’s captions.</p>}
          </div>
        </Card>
      </div>

      <aside className="space-y-5">
        {video.key_terms?.length > 0 && (
          <Card>
            <CardHeader icon={ShieldCheck} tone="accent" title="Key terms" subtitle="As used in the video" />
            <dl className="space-y-3 p-5">
              {video.key_terms.map((t) => (
                <div key={t.term}>
                  <dt className="font-semibold">{t.term}</dt>
                  <dd className="text-sm text-muted">{t.meaning}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
        <Card>
          <CardHeader icon={Search} title="Full captions" subtitle={`${video.segments.length} lines · tap one to jump`} />
          <div className="p-3">
            <label htmlFor={`cap-q-${video.id}`} className="sr-only">
              Search the captions
            </label>
            <input id={`cap-q-${video.id}`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the captions" className="mb-2 h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-brand" />
            <ol className="max-h-[28rem] space-y-0.5 overflow-y-auto pr-1">
              {lines.slice(0, 600).map((s, i) => (
                <li key={`${s.start}-${i}`}>
                  <button type="button" onClick={() => seek(s.start)} className="flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2">
                    <span className="w-12 shrink-0 font-mono text-xs text-brand">{formatTime(s.start)}</span>
                    <span>{s.text}</span>
                  </button>
                </li>
              ))}
              {lines.length === 0 && <li className="px-2 py-3 text-sm text-muted">No lines match “{query}”.</li>}
            </ol>
          </div>
        </Card>
      </aside>
    </div>
  )
}
