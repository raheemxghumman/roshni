import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Headphones, Keyboard, Minus, Pause, Play, Plus, Repeat, SkipBack, SkipForward, Square } from 'lucide-react'
import { announce } from '../lib/announce'
import { splitSentences } from '../lib/sentences'
import { useSettings } from '../lib/settings'
import { useSpeech } from '../lib/speech'
import AskSentence, { AskTrigger } from '../components/AskSentence'
import { Button, Card, Pill, cx } from '../components/ui'

function buildUnits(lesson, useSimple) {
  const level = useSimple === 'simplest' ? 'simplest' : useSimple ? 'easier' : null
  const simple = level
    ? Object.fromEntries((lesson.simplified?.[level]?.sections || []).map((s) => [s.id, s.text]))
    : {}
  const n = lesson.sections.length
  const units = []
  lesson.sections.forEach((s, si) => {
    units.push({ text: `Section ${si + 1} of ${n}: ${s.heading}.`, si, kind: 'heading' })
    if (level && simple[s.id]) {
      splitSentences(simple[s.id]).forEach((t) => units.push({ text: t, si, kind: 'text' }))
      s.blocks.filter((b) => b.type === 'figure').forEach((b) => units.push({ text: `Figure. ${b.description}`, si, kind: 'figure', bid: b.id }))
      return
    }
    s.blocks.forEach((b) => {
      if (b.type === 'figure') {
        units.push({ text: `Figure${b.text ? `: ${b.text}` : ''}. ${b.description}`, si, kind: 'figure', bid: b.id })
      } else if (b.type === 'table' && b.rows?.length) {
        units.push({ text: 'A table follows.', si, kind: 'text', bid: b.id })
        b.rows.forEach((row, r) => units.push({ text: `Row ${r + 1}: ${row.join(', ')}.`, si, kind: 'text', bid: b.id }))
      } else if (b.type === 'equation') {
        units.push({ text: `Equation: ${b.text}`, si, kind: 'text', bid: b.id })
      } else {
        splitSentences(b.text).forEach((t) => units.push({ text: t, si, kind: 'text', bid: b.id }))
      }
    })
  })
  return units
}

export default function Listen({ lesson, focus }) {
  const { settings, update } = useSettings()
  const speech = useSpeech()
  const hasSimple = !!lesson.simplified?.easier || !!lesson.simplified?.simplest
  const [useSimple, setUseSimple] = useState(false) // false | true/'easier' | 'simplest'
  const [shortcutMode, setShortcutMode] = useState(false)
  const [ask, setAsk] = useState(null)
  const units = useMemo(() => buildUnits(lesson, useSimple), [lesson, useSimple])
  const key = `listen-${lesson.id}-${useSimple || 'original'}`
  const isMine = speech.key === key
  const current = isMine && speech.status !== 'idle' ? speech.index : -1
  const currentSection = current >= 0 ? units[current]?.si : -1
  const sectionStart = (si) => units.findIndex((u) => u.si === si)

  const playFrom = (i) => speech.play(units.map((u) => u.text), { start: i, rate: settings.rate, key })
  const toggle = () => {
    if (isMine && speech.status === 'playing') speech.pause()
    else if (isMine && speech.status === 'paused') speech.resume()
    else playFrom(0)
  }
  const goSection = (delta) => {
    const base = currentSection >= 0 ? currentSection : delta > 0 ? -1 : 0
    const target = Math.min(lesson.sections.length - 1, Math.max(0, base + delta))
    playFrom(sectionStart(target))
  }
  const changeRate = (delta) => {
    const rate = Math.round(Math.min(1.6, Math.max(0.6, settings.rate + delta)) * 100) / 100
    update({ rate })
    speech.setRate(rate)
    announce(`Speed ${rate}`)
  }

  useEffect(() => {
    if (currentSection >= 0) announce(`Section ${currentSection + 1}: ${lesson.sections[currentSection]?.heading}`)
  }, [currentSection, lesson.sections])

  // a study-plan step can open a section (and optionally a simpler level)
  useEffect(() => {
    if (!focus) return undefined
    if (focus.level === 'simplest' && lesson.simplified?.simplest) setUseSimple('simplest')
    else if (focus.level === 'easier' && lesson.simplified?.easier) setUseSimple(true)
    else if (focus.simple && lesson.simplified?.easier) setUseSimple(true)
    if (!focus.section) return undefined
    const id = setTimeout(() => {
      const card = document.getElementById(`lh-${focus.section}`)?.closest('article')
      if (!card) return
      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      card.querySelector('button')?.focus({ preventScroll: true })
    }, 450)
    return () => clearTimeout(id)
  }, [focus?.nonce, focus?.section, focus?.level, focus?.simple, lesson.simplified])

  useEffect(() => {
    if (current >= 0) document.getElementById(`unit-${current}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current])

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)
      const k = e.key.toLowerCase()
      const act = { n: () => goSection(1), p: () => goSection(-1), k: toggle, r: () => current >= 0 && speech.jump(current), s: () => changeRate(-0.1), f: () => changeRate(0.1) }
      if (e.altKey && act[k]) {
        e.preventDefault()
        act[k]()
      } else if (shortcutMode && !typing && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === ' ' && tag !== 'BUTTON') {
          e.preventDefault()
          toggle()
        } else if (['n', 'p', 'r'].includes(k)) {
          e.preventDefault()
          act[k]()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => () => speech.stop(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const playing = isMine && speech.status === 'playing'
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <Card className="sticky top-[7.6rem] z-20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" variant="primary" icon={playing ? Pause : Play} onClick={toggle} className="min-w-36">
              {playing ? 'Pause' : isMine && speech.status === 'paused' ? 'Resume' : 'Play lesson'}
            </Button>
            <Button size="lg" icon={SkipBack} onClick={() => goSection(-1)} aria-label="Previous section (Alt+P)">
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <Button size="lg" icon={SkipForward} onClick={() => goSection(1)} aria-label="Next section (Alt+N)">
              <span className="hidden sm:inline">Next</span>
            </Button>
            <Button size="lg" icon={Repeat} onClick={() => current >= 0 && speech.jump(current)} disabled={current < 0} aria-label="Repeat sentence (Alt+R)" />
            <Button size="lg" icon={Square} onClick={speech.stop} disabled={!isMine || speech.status === 'idle'} aria-label="Stop" />
            <div className="ml-auto flex items-center gap-1 rounded-xl border border-line p-1">
              <button type="button" className="grid size-9 place-items-center rounded-lg hover:bg-surface-2" onClick={() => changeRate(-0.1)} aria-label="Slower (Alt+S)">
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="w-14 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                {settings.rate.toFixed(1)}×
              </span>
              <button type="button" className="grid size-9 place-items-center rounded-lg hover:bg-surface-2" onClick={() => changeRate(0.1)} aria-label="Faster (Alt+F)">
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted" aria-hidden>
            {current >= 0 ? (
              <>
                Now reading <b className="text-ink">section {currentSection + 1} of {lesson.sections.length}</b>: {lesson.sections[currentSection]?.heading}
              </>
            ) : (
              'Press Play, or choose a section below.'
            )}
          </p>
          {!speech.supported && <p className="mt-2 text-sm text-bad">This browser can&apos;t read aloud. Try Chrome or Edge.</p>}
        </Card>

        <ol className="space-y-4">
          {lesson.sections.map((s, si) => {
            const items = units.map((u, i) => ({ ...u, i })).filter((u) => u.si === si && u.kind !== 'heading')
            return (
              <li key={s.id}>
                <Card as={motion.article} initial={{ opacity: 0, y: 24, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.55, delay: si * 0.07, ease: [0.2, 0.8, 0.2, 1] }} style={{ transformPerspective: 1200 }} aria-labelledby={`lh-${s.id}`} className={cx('overflow-hidden', currentSection === si && 'ring-2 ring-brand')}>
                  <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-sm font-bold">{si + 1}</span>
                    <h2 id={`lh-${s.id}`} className="flex-1 text-lg font-semibold">
                      {s.heading}
                    </h2>
                    <Button size="sm" icon={Play} onClick={() => playFrom(sectionStart(si))} aria-label={`Play section ${si + 1}: ${s.heading}`}>
                      Play
                    </Button>
                  </header>
                  <div className="reading reading-surface space-y-3 px-5 py-4">
                    {items.map((u) =>
                      u.kind === 'figure' ? (
                        <figure key={u.i} id={`unit-${u.i}`} className={cx('rounded-xl border border-line bg-surface-2 p-4 text-[0.95em]', current === u.i && 'ring-2 ring-accent')}>
                          <figcaption className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent-ink">Figure, described by AI</figcaption>
                          {u.text.replace(/^Figure:?\s*/, '')}
                        </figure>
                      ) : (
                        <span key={u.i} className="inline">
                          <span
                            id={`unit-${u.i}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => playFrom(u.i)}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), playFrom(u.i))}
                            className={cx('sentence', current === u.i && 'is-current')}
                          >
                            {u.text}
                          </span>
                          {u.kind === 'text' && <AskTrigger onAsk={() => setAsk({ sentence: u.text, heading: s.heading })} />}{' '}
                        </span>
                      ),
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ol>
      </div>

      <aside className="space-y-4" aria-label="Listening options">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Headphones className="size-5 text-brand" aria-hidden />
            <h2 className="font-semibold">Listen mode</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">The page is read aloud section by section. Every figure is described in words, so nothing is only visual.</p>
          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
              <span className="text-sm font-semibold">Read the easier version</span>
              <input type="checkbox" checked={!!useSimple} disabled={!hasSimple} onChange={(e) => {
                speech.stop()
                if (!e.target.checked) setUseSimple(false)
                else if (lesson.simplified?.simplest) setUseSimple('simplest')
                else setUseSimple(true)
              }} className="size-5 accent-[var(--brand)]" />
            </label>
            {!hasSimple && <p className="text-xs text-muted">Open Read Easy once to make the easier version.</p>}
            {useSimple === 'simplest' && <p className="text-xs text-muted">Using the Simplest rewrite.</p>}
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
              <span className="text-sm font-semibold">Single-key shortcuts</span>
              <input type="checkbox" checked={shortcutMode} onChange={(e) => setShortcutMode(e.target.checked)} className="size-5 accent-[var(--brand)]" />
            </label>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Keyboard className="size-5 text-brand" aria-hidden />
            <h2 className="font-semibold">Keyboard</h2>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {[
              ['Alt + K', 'Play / pause'],
              ['Alt + N', 'Next section'],
              ['Alt + P', 'Previous section'],
              ['Alt + R', 'Repeat sentence'],
              ['Alt + S / F', 'Slower / faster'],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt>
                  <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
                </dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">With single-key shortcuts on: Space, N, P and R. Off by default because screen readers use those keys.</p>
          <p className="mt-3">
            <Pill tone="info">Works with NVDA, VoiceOver and TalkBack</Pill>
          </p>
        </Card>
      </aside>
      <AskSentence
        lessonId={lesson.id}
        sentence={ask?.sentence || ''}
        sectionHeading={ask?.heading}
        open={!!ask}
        onClose={() => setAsk(null)}
      />
    </div>
  )
}
