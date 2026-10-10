import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, BookOpen, Captions as CaptionsIcon, GraduationCap, Headphones, Image as ImageIcon, MonitorPlay, Sparkles, TriangleAlert, X } from 'lucide-react'
import { api } from '../lib/api'
import { openDisplay, setParam } from '../lib/router'
import { tabFor, tabReason, useProfile } from '../lib/profile'
import { announce, shortModel } from '../lib/announce'
import { ErrorNotice, Pill, Skeleton, cx } from '../components/ui'
import { EASE } from '../components/motion'
import ReadEasy from '../modes/ReadEasy'
import Listen from '../modes/Listen'
import Captions from '../modes/Captions'
import Original from '../modes/Original'
import Practice from '../modes/Practice'
import Videos from '../modes/Videos'

const TABS = [
  { id: 'read', label: 'Read Easy', icon: BookOpen, hint: 'Simpler text' },
  { id: 'listen', label: 'Listen', icon: Headphones, hint: 'Audio + figures' },
  { id: 'captions', label: 'Captions', icon: CaptionsIcon, hint: 'Lecture transcript' },
  { id: 'videos', label: 'Videos', icon: MonitorPlay, hint: 'YouTube to notes' },
  { id: 'practice', label: 'Practice', icon: GraduationCap, hint: 'Quiz + study plan' },
  { id: 'original', label: 'Original page', icon: ImageIcon, hint: 'As printed' },
]

export default function Lesson({ id, tab: initialTab, params = {} }) {
  const { profile, recordOpen, update: updateProfile } = useProfile()
  const [lesson, setLesson] = useState(null)
  const [error, setError] = useState(null)
  const linkTab = TABS.some((t) => t.id === initialTab) ? initialTab : null
  const [tab, setTab] = useState(linkTab || 'read')
  const [because, setBecause] = useState(null) // why the lesson opened this way, in one plain sentence
  const opened = useRef(false)
  const tabRefs = useRef({})
  // where a study-plan step (or a "next step" link) asked to go: {tab, level, section, term, video, t, nonce}
  const [focus, setFocus] = useState(() => {
    const f = {}
    for (const k of ['level', 'section', 'term', 'video']) if (params[k]) f[k] = params[k]
    if (params.t != null && !Number.isNaN(Number(params.t))) f.t = Number(params.t)
    if (params.review) f.review = true
    return Object.keys(f).length || params.review ? { ...f, tab: linkTab || 'read', nonce: 1 } : null
  })

  const load = (signal) =>
    api
      .lesson(id, { signal })
      .then((l) => {
        if (signal?.aborted) return
        setLesson(l)
        setError(null)
      })
      .catch((e) => {
        if (signal?.aborted || e?.name === 'AbortError') return
        setError(e)
      })
  useEffect(() => {
    const ac = new AbortController()
    setLesson(null)
    setError(null)
    opened.current = false
    load(ac.signal)
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // first load: open on the learner's tab (unless the link chose one), remember the visit, and drop one-time link params
  useEffect(() => {
    if (!lesson || opened.current) return
    opened.current = true
    let first = linkTab
    if (!first) {
      first = tabFor(profile, lesson)
      const reason = tabReason(profile, first)
      if (reason && !profile.dismissed?.[lesson.id]) setBecause(`Opened in ${TABS.find((t) => t.id === first)?.label} because ${reason}.`)
      if (first !== 'read') setTab(first)
    }
    recordOpen(lesson, first)
    if (focus) setParam('tab', first, { only: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson])

  useEffect(() => {
    if (because) announce(because)
  }, [because])

  // a link to this same lesson (e.g. "Your next step") changes the tab or target without remounting the page
  const linkKey = JSON.stringify(params)
  const firstLink = useRef(linkKey)
  useEffect(() => {
    if (linkKey === firstLink.current) return
    firstLink.current = linkKey
    const f = {}
    for (const k of ['level', 'section', 'term', 'video']) if (params[k]) f[k] = params[k]
    if (params.t != null && !Number.isNaN(Number(params.t))) f.t = Number(params.t)
    if (params.review) f.review = true
    const next = linkTab || tab
    if (next !== tab) setTab(next)
    if (Object.keys(f).length) {
      setFocus({ ...f, tab: next, nonce: Date.now() })
      setParam('tab', next, { only: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey])

  const choose = (t) => {
    setTab(t)
    setParam('tab', t)
    if (lesson) recordOpen(lesson, t)
  }
  const goTo = (target = {}) => {
    if (!target.tab) return
    setFocus({ ...target, nonce: Date.now() })
    choose(target.tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const onTabKey = (e, i) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = TABS[(i + dir + TABS.length) % TABS.length].id
    choose(next)
    tabRefs.current[next]?.focus()
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorNotice error={error} onRetry={load} />
        <a href="#/" className="mt-6 inline-flex items-center gap-2 font-semibold text-brand">
          <ArrowLeft className="size-4" aria-hidden /> Back to lessons
        </a>
      </div>
    )
  }
  if (!lesson) {
    return (
      <div className="mx-auto max-w-[1680px] space-y-4 px-4 py-8 sm:px-6 lg:px-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const words = lesson.sections.reduce((n, s) => n + (s.text?.split(/\s+/).filter(Boolean).length || 0), 0)
  const figures = lesson.sections.flatMap((s) => s.blocks).filter((b) => b.type === 'figure').length
  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-10 sm:px-6 lg:px-10">
      <div className="pt-6">
        <a href="#/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Lessons
        </a>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="mt-3 text-3xl leading-tight sm:text-4xl">
          {lesson.title}
        </motion.h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>{lesson.source.type === 'pdf' ? `PDF · ${lesson.source.pages} page${lesson.source.pages > 1 ? 's' : ''}` : 'Photo'}</Pill>
          <Pill>{lesson.sections.length} sections · {words} words</Pill>
          {figures > 0 && <Pill>{figures} figure{figures > 1 ? 's' : ''} described</Pill>}
          <Pill>Read by {lesson.models?.reader?.map(shortModel).join(', ') || 'text layer'}</Pill>
          {lesson.sample && <Pill tone="accent">Sample · OpenStax CC BY 4.0</Pill>}
        </div>
        {because && (
          <p className="mt-4 inline-flex max-w-full items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm text-ink">
            <Sparkles className="size-4 shrink-0 text-accent-ink" aria-hidden />
            <span className="min-w-0">{because}</span>
            <button type="button" onClick={openDisplay} className="shrink-0 font-semibold underline underline-offset-2">
              Change
            </button>
            <button type="button" onClick={() => { setBecause(null); updateProfile((p) => ({ dismissed: { ...p.dismissed, [lesson.id]: true } })) }} className="grid size-6 shrink-0 place-items-center rounded-lg hover:bg-surface" aria-label="Hide this note">
              <X className="size-3.5" aria-hidden />
            </button>
          </p>
        )}
        {lesson.warnings?.length > 0 && (
          <ul className="mt-4 space-y-2">
            {lesson.warnings.map((w) => (
              <li key={w} className="flex items-start gap-2 rounded-xl bg-warn-soft px-4 py-2.5 text-sm text-ink">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div role="tablist" aria-label="Learning modes" className="sticky top-16 z-30 -mx-4 mt-7 flex gap-1 overflow-x-auto border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:mx-0 sm:px-0">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => (tabRefs.current[t.id] = el)}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => choose(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={cx(
              'relative flex shrink-0 items-center gap-2 px-4 py-3.5 text-[15px] font-semibold transition',
              tab === t.id ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            <t.icon className="size-[18px]" aria-hidden />
            {t.label}
            <span className="hidden text-xs font-normal text-muted lg:inline">· {t.hint}</span>
            {tab === t.id && <motion.span layoutId="tab-underline" className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-brand" transition={{ type: 'spring', stiffness: 420, damping: 34 }} aria-hidden />}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6" style={{ perspective: 1600 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, rotateY: 8, x: 30, scale: 0.98 }}
            animate={{ opacity: 1, rotateY: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, rotateY: -8, x: -30, scale: 0.98 }}
            transition={{ duration: 0.4, ease: EASE }}
            style={{ transformOrigin: '50% 30%' }}
          >
            {tab === 'read' && <ReadEasy lesson={lesson} onLesson={setLesson} focus={focus?.tab === 'read' ? focus : null} onNavigate={goTo} />}
            {tab === 'listen' && <Listen lesson={lesson} focus={focus?.tab === 'listen' ? focus : null} />}
            {tab === 'captions' && <Captions lesson={lesson} onLesson={setLesson} />}
            {tab === 'videos' && <Videos lesson={lesson} onLesson={setLesson} focus={focus?.tab === 'videos' ? focus : null} />}
            {tab === 'practice' && <Practice lesson={lesson} onLesson={setLesson} onNavigate={goTo} focus={focus?.tab === 'practice' || focus?.review ? focus : null} />}
            {tab === 'original' && <Original lesson={lesson} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
