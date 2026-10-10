// Practice tab: a quiz built only from Fact Guard's verified facts, answered by tapping, keys 1-4, or voice.
// Results show weak areas by section and a study plan that opens the lesson's own materials.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BookOpen, CircleCheck, CircleX, Clock, GraduationCap, Headphones, Keyboard, Languages, ListChecks, LoaderCircle, Mic, MicOff,
  MonitorPlay, Captions as CaptionsIcon, Play, Plus, Repeat, RotateCcw, SkipForward, Square, Target, Timer, Trophy, Volume2,
} from 'lucide-react'
import { api } from '../lib/api'
import { announce } from '../lib/announce'
import { useSettings } from '../lib/settings'
import { beep, closeMic, micSupported, openMic, recordAnswer, speak } from '../lib/voice'
import { Button, Card, CardHeader, ErrorNotice, Pill, Segmented, cx } from '../components/ui'
import { CountUp, EASE } from '../components/motion'
import { ProgressSteps } from '../components/Progress'

const LETTERS = ['A', 'B', 'C', 'D', 'E']
const KEY = 'roshni-practice-v1'
const DEFAULTS = { count: 15, level: 'easier', mode: 'tap', timerTap: 15, timerVoice: 0, readAloud: false, voiceLang: 'en' }
const PREP_STEPS = [
  { label: 'Fact Guard is checking this page', detail: 'Questions are only made from verified facts' },
  { label: 'Listing every fact on the page' },
  { label: 'Writing your questions', detail: 'Four options each, one correct' },
]
const QUIZ_STEPS = [{ label: 'Picking facts from every part of the page' }, { label: 'Writing your questions', detail: 'Four options each, checked in code' }]

function loadConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

const pct = (x) => Math.round(x * 100)
const when = (iso) => {
  try {
    return new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------- the tab

export default function Practice({ lesson, onLesson, onNavigate }) {
  const [config, setConfig] = useState(loadConfig)
  const [phase, setPhase] = useState('setup') // setup | preparing | loading | playing | results
  const [quiz, setQuiz] = useState(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [info, setInfo] = useState({ history: [], facts: null })
  const [stream, setStream] = useState(null)
  const [voiceOn, setVoiceOn] = useState(false)
  const lastRequest = useRef(null)

  const update = (patch) =>
    setConfig((c) => {
      const next = { ...c, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* private mode */
      }
      return next
    })

  const loadInfo = useCallback(() => {
    api.practice(lesson.id).then(setInfo).catch(() => {})
  }, [lesson.id])
  useEffect(loadInfo, [loadInfo])

  // release the microphone whenever the quiz ends or the tab closes
  useEffect(() => () => closeMic(stream), [stream])

  const start = async ({ sectionIds = [], fresh = false } = {}) => {
    lastRequest.current = { sectionIds, fresh }
    setError(null)
    setNotice(null)
    setReport(null)
    let mic = null
    let useVoice = config.mode === 'voice'
    if (useVoice) {
      try {
        mic = await openMic()
      } catch (e) {
        useVoice = false
        setNotice(`${e.message} Questions will still be read aloud.`)
      }
    }
    setVoiceOn(useVoice)
    setStream(mic)
    setPhase('loading')
    announce('Making your quiz')
    const request = () => api.quiz(lesson.id, { level: config.level, count: config.count, sectionIds, fresh })
    try {
      let q
      try {
        q = await request()
      } catch (e) {
        if (e.code !== 'NEEDS_CHECK') throw e
        setPhase('preparing')
        announce('Fact Guard is checking this page first. This takes about 20 seconds.')
        const result = await api.simplify(lesson.id, config.level)
        onLesson((l) => ({ ...l, simplified: { ...(l.simplified || {}), [config.level]: result } }))
        setPhase('loading')
        q = await request()
      }
      setQuiz(q)
      setPhase('playing')
    } catch (e) {
      closeMic(mic)
      setStream(null)
      setError(e)
      setPhase('setup')
    }
  }

  const finish = async (answers, timedOut) => {
    setPhase('loading')
    closeMic(stream)
    setStream(null)
    try {
      const r = await api.finishQuiz(quiz.id, answers, timedOut, voiceOn ? 'voice' : 'tap')
      setReport(r)
      setInfo((i) => ({ ...i, history: r.history }))
      setPhase('results')
    } catch (e) {
      setError(e)
      setPhase('setup')
    }
  }

  const quit = () => {
    closeMic(stream)
    setStream(null)
    setQuiz(null)
    setPhase('setup')
    loadInfo()
  }

  if (phase === 'preparing') return <ProgressSteps steps={PREP_STEPS} stepMs={6000} title="Getting this page ready for practice" />
  if (phase === 'loading')
    return (
      <div className="max-w-3xl">
        <ProgressSteps steps={QUIZ_STEPS} stepMs={4000} title={report || quiz ? 'Checking your answers' : 'Making your quiz'} />
      </div>
    )
  if (phase === 'playing' && quiz)
    return (
      <QuizPlayer
        quiz={quiz}
        timer={config.mode === 'voice' ? config.timerVoice : config.timerTap}
        readAloud={config.mode === 'voice' || config.readAloud}
        voice={voiceOn}
        stream={stream}
        voiceLang={config.voiceLang}
        notice={notice}
        onFinish={finish}
        onQuit={quit}
      />
    )
  if (phase === 'results' && report)
    return (
      <QuizResults
        report={report}
        quizLevel={quiz?.level || config.level}
        spoken={config.mode === 'voice'}
        onNavigate={onNavigate}
        onRetryWeak={() => start({ sectionIds: report.weak_sections, fresh: true })}
        onNew={() => start({ fresh: true })}
        onSetup={() => {
          setPhase('setup')
          loadInfo()
        }}
      />
    )
  return <Setup config={config} update={update} info={info} error={error} notice={notice} onStart={() => start({ fresh: false })} onRetry={() => start(lastRequest.current || {})} />
}

// ---------------------------------------------------------------- setup

function ModeCard({ selected, onSelect, icon: Icon, title, text, disabled, note }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cx(
        'group relative flex flex-1 flex-col items-start gap-2 rounded-3xl border-2 p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
        selected ? 'border-brand bg-brand/5 shadow-[var(--shadow)]' : 'border-line bg-surface hover:-translate-y-0.5 hover:border-brand/40',
      )}
    >
      <span className={cx('grid size-12 place-items-center rounded-2xl transition', selected ? 'bg-brand text-on-brand' : 'bg-surface-2 text-brand')}>
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="font-display text-lg font-bold">{title}</span>
      <span className="text-sm text-muted">{text}</span>
      {note && <span className="text-xs font-semibold text-warn">{note}</span>}
      {selected && <CircleCheck className="absolute right-4 top-4 size-5 text-brand" aria-hidden />}
    </button>
  )
}

function Setup({ config, update, info, error, notice, onStart, onRetry }) {
  const voiceMode = config.mode === 'voice'
  const timer = voiceMode ? config.timerVoice : config.timerTap
  const canVoice = micSupported()
  const facts = info.facts
  const willAsk = facts ? Math.min(config.count, facts) : config.count
  const history = info.history || []
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader icon={GraduationCap} tone="accent" title="Practice what you learned" subtitle="Every question comes from a fact Fact Guard verified on this page. You get your weak areas and a study plan at the end." />
          <div className="space-y-6 p-5">
            <div role="radiogroup" aria-label="How do you want to answer?" className="flex flex-col gap-3 sm:flex-row">
              <ModeCard selected={!voiceMode} onSelect={() => update({ mode: 'tap' })} icon={Keyboard} title="Tap or type" text="Choose with a tap, or press 1 to 4. Good for everyone." />
              <ModeCard
                selected={voiceMode}
                onSelect={() => update({ mode: 'voice' })}
                icon={Mic}
                title="Voice quiz"
                text="Questions and options are read aloud. After the beep, say A, B, C or D, or the answer itself."
                disabled={!canVoice}
                note={!canVoice ? 'This browser can’t use the microphone' : null}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Questions" icon={ListChecks}>
                <Segmented id="pq-count" label="Number of questions" value={config.count} onChange={(v) => update({ count: v })} options={[5, 10, 15].map((n) => ({ value: n, label: String(n) }))} />
              </Field>
              <Field label="Wording" icon={BookOpen}>
                <Segmented id="pq-level" label="Question wording" value={config.level} onChange={(v) => update({ level: v })} options={[{ value: 'easier', label: 'Easier' }, { value: 'simplest', label: 'Simplest' }]} />
              </Field>
              <Field label="Time per question" icon={Timer}>
                <Segmented
                  id="pq-timer"
                  label="Time per question"
                  value={timer}
                  onChange={(v) => update(voiceMode ? { timerVoice: v } : { timerTap: v })}
                  options={[{ value: 0, label: 'Off' }, { value: 15, label: '15 s' }, { value: 30, label: '30 s' }, { value: 60, label: '60 s' }]}
                />
              </Field>
              {voiceMode ? (
                <Field label="I’ll answer in" icon={Languages}>
                  <Segmented
                    id="pq-lang"
                    label="Language you will answer in"
                    value={config.voiceLang}
                    onChange={(v) => update({ voiceLang: v })}
                    options={[{ value: 'en', label: 'English' }, { value: 'ur', label: <span lang="ur" className="urdu text-[15px] leading-none">اردو</span> }, { value: 'ps', label: <span lang="ps" className="pashto text-[15px] leading-none">پښتو</span> }]}
                  />
                </Field>
              ) : (
                <Field label="Read questions aloud" icon={Volume2}>
                  <Segmented id="pq-read" label="Read questions aloud" value={config.readAloud ? 'on' : 'off'} onChange={(v) => update({ readAloud: v === 'on' })} options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]} />
                </Field>
              )}
            </div>
            <p className="text-sm text-muted">
              {timer ? (
                <>
                  The timer {voiceMode || config.readAloud ? 'starts after the question has been read, and ' : ''}pauses if you leave this tab. You can add 15 seconds at any time.
                </>
              ) : (
                <>No timer: take as long as you need.</>
              )}{' '}
              {facts != null && facts > 0 && facts < config.count && <b className="text-ink">This page has {facts} verified facts, so the quiz will have {facts} questions.</b>}
              {facts === 0 && <b className="text-ink">First quiz on this page: Fact Guard checks the page first (about 20 seconds).</b>}
            </p>
            {notice && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm">{notice}</p>}
            <ErrorNotice error={error} onRetry={onRetry} />
            <Button variant="primary" size="lg" icon={voiceMode ? Mic : Play} className="w-full sm:w-auto" onClick={onStart}>
              Start {willAsk}-question {voiceMode ? 'voice quiz' : 'quiz'}
            </Button>
          </div>
        </Card>
      </div>
      <aside className="space-y-5">
        <Card>
          <CardHeader icon={Trophy} title="Your progress" subtitle={history.length ? `${history.length} quiz${history.length > 1 ? 'zes' : ''} on this page` : 'Your scores will appear here'} />
          <div className="p-5">
            {history.length === 0 ? (
              <p className="text-sm text-muted">Take a quiz to see how you improve over time.</p>
            ) : (
              <>
                <div className="flex h-24 items-end gap-1.5" aria-hidden>
                  {history.slice(-10).map((h, i) => (
                    <motion.div key={h.at + i} initial={{ height: 0 }} animate={{ height: `${Math.max(6, pct(h.score))}%` }} transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }} className={cx('flex-1 rounded-t-lg', h.score >= 0.8 ? 'bg-ok' : h.score >= 0.5 ? 'bg-accent' : 'bg-bad/70')} />
                  ))}
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  {history
                    .slice(-4)
                    .reverse()
                    .map((h) => (
                      <li key={h.at + h.quiz_id} className="flex items-center gap-2">
                        <b className="w-11 tabular-nums">{pct(h.score)}%</b>
                        <span className="flex-1 truncate text-muted">
                          {h.correct}/{h.total} · {h.mode === 'voice' ? 'voice' : 'tap'}
                          {h.focus ? ' · weak areas' : ''}
                        </span>
                        <span className="text-xs text-muted">{when(h.at)}</span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </div>
        </Card>
        <Card className="p-5 text-sm text-muted">
          <p className="font-semibold text-ink">Keyboard</p>
          <ul className="mt-2 space-y-1">
            <li><b className="text-ink">1–4</b> or <b className="text-ink">A–D</b>: answer</li>
            <li><b className="text-ink">Enter</b>: next question</li>
            <li><b className="text-ink">R</b>: read the question again</li>
            <li><b className="text-ink">M</b>: answer by voice · <b className="text-ink">S</b>: skip</li>
          </ul>
        </Card>
      </aside>
    </div>
  )
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Icon className="size-4 text-muted" aria-hidden /> {label}
      </p>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------- player

function TimerRing({ left, total }) {
  const r = 22
  const c = 2 * Math.PI * r
  const frac = total ? Math.max(0, left) / total : 0
  const urgent = left <= 5
  return (
    <div className="relative grid size-14 place-items-center" aria-hidden>
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={urgent ? 'var(--bad)' : 'var(--brand)'} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
      </svg>
      <span className={cx('font-display text-base font-bold tabular-nums', urgent && 'text-bad')}>{Math.ceil(Math.max(0, left))}</span>
    </div>
  )
}

function questionScript(q, i, n) {
  const opts = q.options.map((o, k) => `Option ${LETTERS[k]}: ${o}.`).join(' ')
  return `Question ${i + 1} of ${n}. ${q.question} ${opts}`
}

function QuizPlayer({ quiz, timer, readAloud, voice, stream, voiceLang, notice, onFinish, onQuit }) {
  const { settings } = useSettings()
  const n = quiz.questions.length
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)
  const [answers, setAnswers] = useState({})
  const [timedOut, setTimedOut] = useState([])
  const [left, setLeft] = useState(timer)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [status, setStatus] = useState('idle') // idle | reading | listening | thinking
  const [heard, setHeard] = useState(null)
  const [level, setLevel] = useState(0)
  const [score, setScore] = useState(0)
  const token = useRef(0) // bumps on every question change / cancel, so stale async steps stop
  const answersRef = useRef({}) // refs mirror the state so finishing never reads a stale copy
  const timedOutRef = useRef([])
  const lastTry = useRef({ index: null, how: 'tap' })
  const advanceRef = useRef(() => {})
  const finished = useRef(false)
  const speechRef = useRef(null)
  const recRef = useRef(null)
  const misses = useRef(0)
  const warned = useRef(false)
  const headingRef = useRef(null)
  const nextRef = useRef(null)
  const topRef = useRef(null)
  const q = quiz.questions[index]

  const stopAudio = useCallback(() => {
    speechRef.current?.cancel()
    recRef.current?.cancel()
    setLevel(0)
  }, [])

  const say = useCallback(
    async (text, t) => {
      speechRef.current?.cancel()
      const s = speak(text, { rate: settings.rate || 1 })
      speechRef.current = s
      await s.done
      return t === token.current
    },
    [settings.rate],
  )

  // ---- answering
  const submit = useCallback(
    async (optionIndex, how = 'tap') => {
      if (feedback || checking || !q) return
      const t = token.current
      setRunning(false)
      stopAudio()
      setStatus('idle')
      setChosen(optionIndex)
      setChecking(true)
      setError(null)
      const given = optionIndex == null ? '' : q.options[optionIndex]
      lastTry.current = { index: optionIndex, how }
      try {
        const r = await api.checkAnswer(quiz.id, q.id, given)
        if (t !== token.current) return
        setFeedback({ ...r, how })
        if (given) {
          answersRef.current = { ...answersRef.current, [q.id]: given }
          setAnswers(answersRef.current)
        }
        if (r.correct) setScore((s) => s + 1)
        beep(r.correct ? 'ok' : 'no')
        const right = `${LETTERS[r.answer_index]}: ${r.answer}`
        const line =
          how === 'timeout' ? `Time's up. The answer was ${right}.` : how === 'skip' ? `Skipped. The answer was ${right}.` : r.correct ? 'Correct!' : `Not quite. The answer is ${right}.`
        announce(`${line} ${r.explanation || ''}`)
        if (readAloud) {
          const still = await say(`${line} ${r.explanation || ''}`, t)
          if (still && voice && !paused) setTimeout(() => t === token.current && advanceRef.current(), 700)
        }
      } catch (e) {
        if (t === token.current) setError(e)
      } finally {
        if (t === token.current) setChecking(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feedback, checking, q, quiz.id, readAloud, voice, paused, say, stopAudio],
  )

  const timeUp = useCallback(() => {
    if (feedback || !q) return
    if (!timedOutRef.current.includes(q.id)) timedOutRef.current = [...timedOutRef.current, q.id]
    setTimedOut(timedOutRef.current)
    submit(null, 'timeout')
  }, [feedback, q, submit])

  const skip = useCallback(() => submit(null, 'skip'), [submit])

  const finishNow = useCallback(() => {
    if (finished.current) return
    finished.current = true
    token.current += 1
    stopAudio()
    onFinish(answersRef.current, timedOutRef.current)
  }, [onFinish, stopAudio])

  const advance = useCallback(() => {
    if (index + 1 >= n) return finishNow()
    setIndex((i) => i + 1)
  }, [index, n, finishNow])
  advanceRef.current = advance

  // ---- voice: listen for one answer, retrying a few times
  const listen = useCallback(async () => {
    if (!voice || !stream || feedback) return
    const t = token.current
    setStatus('listening')
    setHeard(null)
    await beep('listen')
    if (t !== token.current) return
    const rec = recordAnswer(stream, { onLevel: setLevel })
    recRef.current = rec
    const blob = await rec.done
    if (t !== token.current) return
    if (!blob) {
      misses.current += 1
      if (misses.current >= 3) {
        setStatus('idle')
        announce('No answer heard. Press M or the microphone button to try again, or press 1 to 4.')
        return
      }
      if (await say('I didn’t hear anything. Say A, B, C or D.', t)) listen()
      return
    }
    setStatus('thinking')
    try {
      const res = await api.voiceAnswer(blob, q.options, voiceLang)
      if (t !== token.current) return
      setHeard(res)
      if (res.command === 'repeat') {
        setStatus('reading')
        if (await say(questionScript(q, index, n), t)) listen()
      } else if (res.command === 'skip') {
        skip()
      } else if (res.command === 'stop') {
        setPaused(true)
        setRunning(false)
        setStatus('idle')
        say('Paused. Press the microphone button or M to continue.', t)
      } else if (res.choice != null && res.choice < q.options.length) {
        submit(res.choice, 'voice')
      } else {
        misses.current += 1
        const why = res.reason === 'more than one answer' ? 'I heard more than one answer.' : res.heard ? `I heard “${res.heard}”.` : 'I didn’t catch that.'
        if (misses.current >= 3) {
          setStatus('idle')
          say(`${why} Press M to try again, or press 1 to 4.`, t)
          return
        }
        if (await say(`${why} Please say A, B, C or D.`, t)) listen()
      }
    } catch (e) {
      if (t !== token.current) return
      setStatus('idle')
      setError(e)
    }
  }, [voice, stream, feedback, q, index, n, voiceLang, say, skip, submit])

  // ---- each new question
  useEffect(() => {
    token.current += 1
    const t = token.current
    stopAudio()
    setChosen(null)
    setFeedback(null)
    setError(null)
    setHeard(null)
    setLeft(timer)
    setPaused(false)
    misses.current = 0
    warned.current = false
    // keep the progress bar, timer and question in view (the tab bar above is sticky)
    topRef.current?.scrollIntoView({ behavior: index ? 'smooth' : 'auto', block: 'start' })
    if (!readAloud) {
      setRunning(!!timer)
      headingRef.current?.focus({ preventScroll: true })
      return undefined
    }
    setRunning(false)
    setStatus('reading')
    ;(async () => {
      const still = await say(questionScript(q, index, n), t)
      if (!still) return
      setStatus('idle')
      setRunning(!!timer)
      if (voice) listen()
    })()
    return () => {
      token.current += 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // stop everything on unmount
  useEffect(
    () => () => {
      token.current += 1
      speechRef.current?.cancel()
      recRef.current?.cancel()
    },
    [],
  )

  // ---- timer: counts only while running, not paused, and the tab is visible
  useEffect(() => {
    if (!running || paused || !timer) return undefined
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      if (document.hidden) return
      setLeft((l) => l - dt)
    }, 250)
    return () => clearInterval(id)
  }, [running, paused, timer])

  useEffect(() => {
    if (!running || !timer || feedback) return
    if (left <= 5 && !warned.current) {
      warned.current = true
      announce('5 seconds left')
    }
    if (left <= 0) {
      recRef.current?.cancel()
      timeUp()
    }
  }, [left, running, timer, feedback, timeUp])

  useEffect(() => {
    if (!feedback) return
    nextRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (!readAloud) nextRef.current?.focus({ preventScroll: true })
  }, [feedback, readAloud])

  // ---- keyboard: 1-4 / A-D answer, Enter next, R repeat, M listen, S skip
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key.toLowerCase()
      const idx = ['1', '2', '3', '4', '5'].indexOf(k) >= 0 ? Number(k) - 1 : ['a', 'b', 'c', 'd', 'e'].indexOf(k)
      if (!feedback && idx >= 0 && idx < q.options.length) {
        e.preventDefault()
        submit(idx, 'key')
      } else if (feedback && (k === 'enter' || k === 'n') && e.target?.tagName !== 'BUTTON') {
        e.preventDefault()
        advance()
      } else if (k === 'r' && !feedback) {
        e.preventDefault()
        const t = token.current
        recRef.current?.cancel()
        setStatus('reading')
        say(questionScript(q, index, n), t).then((still) => {
          if (!still) return
          setStatus('idle')
          if (voice) listen()
        })
      } else if (k === 'm' && voice && !feedback && status !== 'listening') {
        e.preventDefault()
        misses.current = 0
        setPaused(false)
        setRunning(!!timer)
        listen()
      } else if (k === 's' && !feedback) {
        e.preventDefault()
        skip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feedback, q, index, n, submit, advance, say, listen, skip, voice, status, timer])

  const statusLine = {
    reading: { icon: Volume2, text: 'Reading the question…' },
    listening: { icon: Mic, text: 'Listening… say A, B, C or D' },
    thinking: { icon: LoaderCircle, text: 'Understanding your answer…' },
  }[status]

  return (
    <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-36 space-y-4">
      {notice && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm">{notice}</p>}
      <Card className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-muted">
            Question {index + 1} of {n} · {score} correct
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <motion.div className="h-2 rounded-full bg-gradient-to-r from-brand to-teal" animate={{ width: `${((index + (feedback ? 1 : 0)) / n) * 100}%` }} transition={{ duration: 0.5, ease: EASE }} />
          </div>
        </div>
        {timer > 0 && (
          <div className="flex items-center gap-2">
            <TimerRing left={left} total={timer} />
            <span className="sr-only">{Math.ceil(Math.max(0, left))} seconds left</span>
            <Button size="sm" icon={Plus} onClick={() => setLeft((l) => l + 15)} disabled={!!feedback} aria-label="Add 15 seconds">
              15 s
            </Button>
          </div>
        )}
        <Button size="sm" variant="ghost" icon={Square} onClick={() => (Object.keys(answers).length || timedOut.length ? finishNow() : onQuit())}>
          {Object.keys(answers).length || timedOut.length ? 'Finish now' : 'Quit'}
        </Button>
      </Card>

      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, rotateY: 10, x: 40 }} animate={{ opacity: 1, rotateY: 0, x: 0 }} exit={{ opacity: 0, rotateY: -10, x: -40 }} transition={{ duration: 0.4, ease: EASE }} style={{ transformPerspective: 1400 }}>
          <Card className="p-5 sm:p-7">
            <h2 ref={headingRef} tabIndex={-1} className="font-display text-xl font-bold leading-snug outline-none sm:text-2xl">
              {q.question}
            </h2>
            <div role="group" aria-label="Answer options" className="mt-6 grid gap-3">
              {q.options.map((o, k) => {
                const isAnswer = feedback && k === feedback.answer_index
                const isWrong = feedback && k === chosen && !feedback.correct
                return (
                  <motion.button
                    key={o}
                    type="button"
                    whileHover={feedback ? undefined : { x: 4 }}
                    whileTap={feedback ? undefined : { scale: 0.98 }}
                    onClick={() => submit(k, 'tap')}
                    disabled={!!feedback || checking}
                    aria-label={`Option ${LETTERS[k]}: ${o}${isAnswer ? ' (correct answer)' : isWrong ? ' (your answer, wrong)' : ''}`}
                    className={cx(
                      'flex items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left text-[16px] transition-colors disabled:cursor-default',
                      isAnswer ? 'border-ok bg-ok-soft' : isWrong ? 'border-bad bg-bad-soft' : chosen === k ? 'border-brand bg-surface-2' : 'border-line hover:border-brand/50 hover:bg-surface-2',
                    )}
                  >
                    <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl font-display font-bold', isAnswer ? 'bg-ok text-white' : isWrong ? 'bg-bad text-white' : 'bg-surface-2 text-brand')}>
                      {isAnswer ? <CircleCheck className="size-5" aria-hidden /> : isWrong ? <CircleX className="size-5" aria-hidden /> : LETTERS[k]}
                    </span>
                    <span className="flex-1">{o}</span>
                    {checking && chosen === k && <LoaderCircle className="size-5 animate-spin text-muted" aria-hidden />}
                  </motion.button>
                )
              })}
            </div>

            {!feedback && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {voice && (
                  <Button
                    variant={status === 'listening' ? 'primary' : 'secondary'}
                    icon={status === 'listening' ? Mic : MicOff}
                    onClick={() => {
                      if (status === 'listening') return recRef.current?.stop()
                      misses.current = 0
                      setPaused(false)
                      setRunning(!!timer)
                      listen()
                    }}
                    disabled={status === 'thinking' || status === 'reading'}
                  >
                    {status === 'listening' ? 'Done speaking' : 'Answer by voice (M)'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  icon={Repeat}
                  onClick={() => {
                    const t = token.current
                    recRef.current?.cancel()
                    setStatus('reading')
                    say(questionScript(q, index, n), t).then((still) => {
                      if (!still) return
                      setStatus('idle')
                      if (voice) listen()
                    })
                  }}
                >
                  Read aloud (R)
                </Button>
                {voice && paused && (
                  <Button variant="ghost" icon={Play} onClick={() => { setPaused(false); setRunning(!!timer); listen() }}>
                    Continue
                  </Button>
                )}
                <Button variant="ghost" icon={SkipForward} onClick={skip} className="ml-auto">
                  Skip (S)
                </Button>
              </div>
            )}

            {statusLine && !feedback && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm" role="status">
                <statusLine.icon className={cx('size-5 text-brand', status === 'thinking' && 'animate-spin')} aria-hidden />
                <span className="flex-1">{statusLine.text}</span>
                {status === 'listening' && (
                  <span className="flex h-6 items-end gap-0.5" aria-hidden>
                    {[0.6, 1, 0.75, 0.9, 0.5].map((m, i) => (
                      <span key={i} className="w-1.5 rounded-full bg-brand transition-[height] duration-100" style={{ height: `${Math.max(12, level * m * 100)}%` }} />
                    ))}
                  </span>
                )}
              </div>
            )}
            {heard?.heard && !feedback && (
              <p className="mt-2 text-sm text-muted">
                Heard: “{heard.heard}”{heard.choice != null ? ` → ${LETTERS[heard.choice]}` : ''}
              </p>
            )}
            <ErrorNotice error={error} onRetry={() => submit(lastTry.current.index, lastTry.current.how)} className="mt-4" />

            <AnimatePresence>
              {feedback && (
                <motion.div initial={{ opacity: 0, y: 12, rotateX: -12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.4, ease: EASE }} style={{ transformPerspective: 900 }} className={cx('mt-6 rounded-2xl p-5', feedback.correct ? 'bg-ok-soft' : 'bg-warn-soft')}>
                  <p className="flex items-center gap-2 font-display text-lg font-bold">
                    {feedback.correct ? <CircleCheck className="size-5 text-ok" aria-hidden /> : feedback.how === 'timeout' ? <Clock className="size-5 text-warn" aria-hidden /> : <CircleX className="size-5 text-warn" aria-hidden />}
                    {feedback.correct ? 'Correct!' : feedback.how === 'timeout' ? 'Time’s up' : feedback.how === 'skip' ? 'Skipped' : 'Not quite'}
                    {feedback.how === 'voice' && heard?.heard && <span className="text-sm font-normal text-muted">· you said “{heard.heard}”</span>}
                  </p>
                  {!feedback.correct && (
                    <p className="mt-1">
                      The answer is <b>{LETTERS[feedback.answer_index]}: {feedback.answer}</b>
                    </p>
                  )}
                  {feedback.explanation && <p className="mt-2 text-[15px]">{feedback.explanation}</p>}
                  <p className="mt-3 border-t border-ink/10 pt-3 text-sm text-muted">
                    <b className="text-ink">From the page (verified):</b> {feedback.fact}
                  </p>
                  <Button ref={nextRef} variant="primary" className="mt-4" icon={index + 1 >= n ? Trophy : SkipForward} onClick={advance}>
                    {index + 1 >= n ? 'See my results' : 'Next question'}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------- results

const PLAN_ICONS = { read: BookOpen, listen: Headphones, words: Languages, video: MonitorPlay, lecture: CaptionsIcon, timer: Timer, retry: Target }

function QuizResults({ report, quizLevel, spoken, onNavigate, onRetryWeak, onNew, onSetup }) {
  const { settings } = useSettings()
  const weak = report.sections.filter((s) => s.weak)
  const levelName = { original: 'the original page', easier: 'Easier', simplest: 'Simplest' }
  const summary = useMemo(() => {
    const parts = [`You got ${report.correct} out of ${report.total}.`]
    if (weak.length) parts.push(`Practise ${weak.map((s) => s.heading).join(' and ')}.`, report.plan[0] ? `First step: ${report.plan[0].title}.` : '')
    else parts.push('No weak areas. Well done!')
    return parts.join(' ')
  }, [report, weak])

  useEffect(() => {
    announce(summary)
    if (!spoken) return undefined
    const s = speak(summary, { rate: settings.rate || 1 })
    return () => s.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const act = (step) => {
    const a = step.action || {}
    if (a.practice === 'weak') return onRetryWeak()
    if (a.practice === 'setup') return onSetup()
    onNavigate(a)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-6 p-6">
            <ScoreRing score={report.score} />
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-muted">Your result</p>
              <p className="mt-1 font-display text-3xl font-bold">
                <CountUp to={report.correct} /> of {report.total} correct
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {report.timed_out > 0 && <Pill tone="warn" icon={Clock}>{report.timed_out} ran out of time</Pill>}
                {report.skipped > 0 && <Pill tone="info" icon={SkipForward}>{report.skipped} skipped</Pill>}
                <Pill tone={weak.length ? 'warn' : 'ok'} icon={weak.length ? Target : CircleCheck}>{weak.length ? `${weak.length} weak area${weak.length > 1 ? 's' : ''}` : 'No weak areas'}</Pill>
              </div>
              <p className="mt-3">{report.advice}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line bg-surface-2/50 px-6 py-4">
            {weak.length > 0 && (
              <Button variant="primary" icon={Target} onClick={onRetryWeak}>
                Practise weak areas only
              </Button>
            )}
            <Button icon={RotateCcw} onClick={onNew}>
              New quiz
            </Button>
            {report.new_level !== quizLevel && (
              <Button variant="accent" icon={BookOpen} onClick={() => onNavigate(report.new_level === 'original' ? { tab: 'original' } : { tab: 'read', level: report.new_level })}>
                Open {levelName[report.new_level]}
              </Button>
            )}
            <Button variant="ghost" onClick={onSetup} className="ml-auto">
              Quiz settings
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Target} tone="accent" title="Your weak areas" subtitle="Each part of the page, by how many questions you got right" />
          <ul className="space-y-4 p-5">
            {report.sections.map((s, i) => (
              <li key={s.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold">{s.heading}</span>
                  <span className={cx('shrink-0 font-semibold', s.weak ? 'text-warn' : 'text-ok')}>
                    {s.correct}/{s.total} · {s.weak ? 'Needs practice' : 'Strong'}
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <motion.div className={cx('h-full rounded-full', s.weak ? 'bg-warn' : 'bg-ok')} initial={{ width: 0 }} animate={{ width: `${(s.correct / s.total) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.08, ease: EASE }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {report.plan.length > 0 && (
          <Card>
            <CardHeader icon={ListChecks} title="Your study plan" subtitle="Made from this lesson’s own materials. Each step opens the right place." />
            <ol className="divide-y divide-line">
              {report.plan.map((step, i) => {
                const Icon = PLAN_ICONS[step.kind] || ListChecks
                return (
                  <motion.li key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 + i * 0.06, ease: EASE }} className="flex items-center gap-4 px-5 py-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand/10 font-display font-bold text-brand">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">
                        <span className="sr-only">Step {i + 1}: </span>
                        {step.title}
                      </p>
                      {step.detail && <p className="mt-0.5 text-sm text-muted">{step.detail}</p>}
                    </div>
                    <Button size="sm" onClick={() => act(step)} aria-label={`Open: ${step.title}`}>
                      Open
                    </Button>
                  </motion.li>
                )
              })}
            </ol>
          </Card>
        )}
      </div>

      <aside className="space-y-5">
        {weak.some((s) => s.missed_facts.length) && (
          <Card>
            <CardHeader icon={GraduationCap} tone="teal" title="What to remember" subtitle="The verified facts behind the questions you missed" />
            <div className="space-y-4 p-5">
              {weak.map((s) => (
                <div key={s.id}>
                  <p className="eyebrow text-muted">{s.heading}</p>
                  <ul className="mt-2 space-y-2">
                    {s.missed_facts.map((f) => (
                      <li key={f} className="rounded-xl bg-teal-soft/60 px-3 py-2 text-[15px]">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card>
          <CardHeader icon={ListChecks} title="Review your answers" />
          <ul className="divide-y divide-line">
            {report.results.map((r, i) => (
              <li key={r.id}>
                <details className="group px-5 py-3">
                  <summary className="flex cursor-pointer list-none items-start gap-2 text-sm">
                    {r.correct ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Correct" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-bad" aria-label="Wrong" />}
                    <span className="flex-1">
                      {i + 1}. {r.question}
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1 pl-6 text-sm">
                    <p>
                      Your answer: <b>{r.given || (r.timed_out ? 'ran out of time' : 'skipped')}</b>
                    </p>
                    {!r.correct && (
                      <p>
                        Correct: <b className="text-ok">{r.answer}</b>
                      </p>
                    )}
                    {r.explanation && <p className="text-muted">{r.explanation}</p>}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  )
}

function ScoreRing({ score }) {
  const r = 52
  const c = 2 * Math.PI * r
  const color = score >= 0.8 ? 'var(--ok)' : score >= 0.5 ? 'var(--accent)' : 'var(--bad)'
  return (
    <div className="relative grid size-32 shrink-0 place-items-center" role="img" aria-label={`Score ${pct(score)} percent`}>
      <svg viewBox="0 0 128 128" className="absolute inset-0 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="11" />
        <motion.circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score) }} transition={{ duration: 1.2, ease: EASE }} />
      </svg>
      <span className="font-display text-3xl font-bold" aria-hidden>
        <CountUp to={pct(score)} suffix="%" />
      </span>
    </div>
  )
}

export function PracticeTeaser({ onOpen }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          <GraduationCap className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">Check your understanding</h2>
          <p className="mt-0.5 text-sm text-muted">Up to 15 questions from verified facts, with a voice mode, a timer, your weak areas and a study plan.</p>
        </div>
      </div>
      <Button variant="primary" icon={Target} className="mt-4 w-full" onClick={onOpen}>
        Open Practice
      </Button>
    </Card>
  )
}

