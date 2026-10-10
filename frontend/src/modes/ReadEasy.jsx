import { motion } from 'motion/react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { CircleCheck, Eye, EyeOff, Pause, Play, ShieldAlert, Square } from 'lucide-react'
import { api } from '../lib/api'
import { announce } from '../lib/announce'
import { escapeRegExp, splitSentences } from '../lib/sentences'
import { useSettings } from '../lib/settings'
import { useSpeech } from '../lib/speech'
import { FactGuardBadge, FactGuardCard } from '../components/FactGuard'
import { GlossaryCard, ReadabilityCard } from '../components/Sidebar'
import { PracticeTeaser } from './Practice'
import { ProgressSteps } from '../components/Progress'
import { Button, Card, ErrorNotice, Pill, Segmented, cx } from '../components/ui'

const LEVELS = [
  { value: 'easier', label: 'Easier' },
  { value: 'simplest', label: 'Simplest' },
]
const LEVEL_NAME = { easier: 'Easier', simplest: 'Simplest' }

const STEPS = [
  { label: 'Rewriting at the chosen level', detail: 'Shorter sentences, everyday words, same facts' },
  { label: 'Fact Guard lists every fact', detail: 'A different AI reads the original page' },
  { label: 'Checking each fact', detail: 'Missing, changed and invented facts are flagged' },
  { label: 'Repairing anything flagged', detail: 'Only the problem sentences are rewritten' },
]

function withTerms(text, regex, onTerm) {
  if (!regex) return text
  const parts = text.split(regex)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <button
        key={i}
        type="button"
        className="term"
        onClick={(e) => {
          e.stopPropagation()
          onTerm(part.toLowerCase())
        }}
        aria-label={`${part}: show explanation`}
      >
        {part}
      </button>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

export default function ReadEasy({ lesson, onLesson, focus, onNavigate }) {
  const { settings } = useSettings()
  const speech = useSpeech()
  const [level, setLevel] = useState(focus?.level === 'simplest' ? 'simplest' : 'easier')
  const [state, setState] = useState({ loading: false, error: null })
  const [showOriginal, setShowOriginal] = useState(() => window.innerWidth >= 1024)
  const [glossary, setGlossary] = useState({ loading: true, data: null, error: null })
  const [selectedTerm, setSelectedTerm] = useState(null)
  const data = lesson.simplified?.[level]

  const simplify = async (lvl = level) => {
    setState({ loading: true, error: null })
    announce(`Making the ${LEVEL_NAME[lvl]} version. This takes about 10 seconds.`)
    try {
      const result = await api.simplify(lesson.id, lvl)
      onLesson((l) => ({ ...l, simplified: { ...(l.simplified || {}), [lvl]: result } }))
      setState({ loading: false, error: null })
      const fg = result.factguard
      announce(fg.status === 'green' ? `Ready. Fact Guard: all ${fg.total} facts kept.` : `Ready. Fact Guard: ${fg.kept} of ${fg.total} facts kept.`)
    } catch (error) {
      setState({ loading: false, error })
    }
  }

  useEffect(() => {
    speech.stop()
    if (!lesson.simplified?.[level]) simplify(level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, lesson.id])

  // a study-plan step can ask for a level, a section and a word
  useEffect(() => {
    if (!focus) return
    if (focus.level && focus.level !== level && (focus.level === 'easier' || focus.level === 'simplest')) setLevel(focus.level)
    if (focus.term) setSelectedTerm(focus.term)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce])
  useEffect(() => {
    if (!focus?.section || !data) return undefined
    const id = setTimeout(() => {
      const el = document.getElementById(`h-${focus.section}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.setAttribute('tabindex', '-1')
      el.focus({ preventScroll: true })
      el.closest('article')?.classList.add('ring-4', 'ring-accent')
      setTimeout(() => el.closest('article')?.classList.remove('ring-4', 'ring-accent'), 2600)
    }, 450)
    return () => clearTimeout(id)
  }, [focus?.nonce, focus?.section, data])

  const loadGlossary = () => {
    setGlossary({ loading: true, data: null, error: null })
    api
      .glossary(lesson.id)
      .then((d) => setGlossary({ loading: false, data: d, error: null }))
      .catch((error) => setGlossary({ loading: false, data: null, error }))
  }
  useEffect(loadGlossary, [lesson.id])

  const termRegex = useMemo(() => {
    const terms = (glossary.data?.items || []).map((i) => i.term).filter(Boolean)
    if (!terms.length) return null
    return new RegExp(`\\b(${terms.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})\\b`, 'gi')
  }, [glossary.data])

  const flat = useMemo(() => (data?.sections || []).flatMap((s) => splitSentences(s.text).map((t) => ({ sid: s.id, t }))), [data])
  const key = `read-${lesson.id}-${level}`
  const isMine = speech.key === key
  const current = isMine && speech.status !== 'idle' ? speech.index : -1

  useEffect(() => {
    if (current >= 0) document.getElementById(`sent-${current}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current])

  const readFrom = (i) => speech.play(flat.map((x) => x.t), { start: i, rate: settings.rate, key })
  const originalById = Object.fromEntries(lesson.sections.map((s) => [s.id, s]))
  const fg = data?.factguard
  let counter = -1

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <Card className="sticky top-[7.6rem] z-20 flex flex-wrap items-center gap-3 px-4 py-3">
          <Segmented id="level" label="Reading level" options={LEVELS} value={level} onChange={setLevel} />
          {speech.supported && data && (
            <div className="flex items-center gap-2">
              {isMine && speech.status === 'playing' ? (
                <Button variant="primary" icon={Pause} onClick={speech.pause}>
                  Pause
                </Button>
              ) : isMine && speech.status === 'paused' ? (
                <Button variant="primary" icon={Play} onClick={speech.resume}>
                  Resume
                </Button>
              ) : (
                <Button variant="primary" icon={Play} onClick={() => readFrom(0)}>
                  Read aloud
                </Button>
              )}
              {isMine && speech.status !== 'idle' && <Button icon={Square} onClick={speech.stop} aria-label="Stop reading" />}
            </div>
          )}
          <Button variant="ghost" icon={showOriginal ? EyeOff : Eye} onClick={() => setShowOriginal((v) => !v)} aria-pressed={showOriginal}>
            {showOriginal ? 'Hide original' : 'Show original'}
          </Button>
          {fg && <FactGuardBadge fg={fg} className="ml-auto" />}
        </Card>

        {state.loading && <ProgressSteps steps={STEPS} stepMs={3000} title={`Making the ${LEVEL_NAME[level]} version`} />}
        <ErrorNotice error={state.error} onRetry={() => simplify(level)} />

        {data && !state.loading && (
          <>
            <p className="px-1 text-sm text-muted">Tap any sentence to start reading aloud from there. Underlined words have an explanation in English and Urdu or Pashto.</p>
            {data.sections.map((s, idx) => {
              const facts = fg?.facts?.filter((f) => f.section_id === s.id) || []
              const notKept = facts.filter((f) => f.status !== 'kept').length
              const added = fg?.added_claims?.filter((a) => a.section_id === s.id).length || 0
              const original = originalById[s.id]
              return (
                <Card key={s.id} as={motion.article} initial={{ opacity: 0, y: 24, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.55, delay: idx * 0.07, ease: [0.2, 0.8, 0.2, 1] }} style={{ transformPerspective: 1200 }} aria-labelledby={`h-${s.id}`} className={cx('overflow-hidden', (notKept || added) && 'ring-2 ring-warn/50')}>
                  <header className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
                    <h2 id={`h-${s.id}`} className="flex-1 text-lg font-semibold">
                      {s.heading}
                    </h2>
                    {s.simplified === false && (
                      <Pill tone="warn" icon={ShieldAlert}>
                        Not simplified, showing original
                      </Pill>
                    )}
                    {facts.length > 0 &&
                      (notKept || added ? (
                        <Pill tone="warn" icon={ShieldAlert}>
                          {notKept + added} to check
                        </Pill>
                      ) : (
                        <Pill tone="ok" icon={CircleCheck}>
                          {facts.length} facts kept
                        </Pill>
                      ))}
                  </header>
                  <div className={cx('grid', showOriginal && 'md:grid-cols-2')}>
                    {showOriginal && original && (
                      <div className="border-b border-line bg-surface-2/50 px-5 py-4 md:border-b-0 md:border-r">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Original</p>
                        <div className="space-y-3 text-[15px] leading-relaxed text-muted">
                          {original.text.split('\n').map((p, i) => (
                            <p key={i}>{p}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="reading-surface px-5 py-4">
                      {showOriginal && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-ink">{LEVEL_NAME[level]} version</p>}
                      <p className="reading">
                        {splitSentences(s.text).map((t) => {
                          counter += 1
                          const i = counter
                          return (
                            <span key={i}>
                              <span
                                id={`sent-${i}`}
                                role="button"
                                tabIndex={0}
                                aria-label={`Read aloud from: ${t}`}
                                onClick={() => readFrom(i)}
                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), readFrom(i))}
                                className={cx('sentence', current === i && 'is-current')}
                              >
                                {withTerms(t, termRegex, setSelectedTerm)}
                              </span>{' '}
                            </span>
                          )
                        })}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </>
        )}
      </div>

      <aside className="space-y-4" aria-label="Lesson tools">
        {data && <FactGuardCard fg={fg} sections={lesson.sections} lessonId={lesson.id} level={level} />}
        {data && <ReadabilityCard readability={data.readability} />}
        <GlossaryCard state={glossary} onRetry={loadGlossary} selected={selectedTerm} onSelect={setSelectedTerm} />
        {data && fg?.status !== 'unavailable' && onNavigate && <PracticeTeaser onOpen={() => onNavigate({ tab: 'practice' })} />}
      </aside>
    </div>
  )
}
