import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Gauge, GraduationCap, Languages, LoaderCircle, Volume2 } from 'lucide-react'
import { api } from '../lib/api'
import { announce } from '../lib/announce'
import { playClip } from '../lib/speech'
import { Button, Card, CardHeader, ErrorNotice, Pill, Skeleton, cx } from './ui'

function Meter({ label, before, after, max, unit = '', lowerIsBetter = true, format = (v) => v }) {
  const better = lowerIsBetter ? after < before : after > before
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-muted">
          {format(before)}
          {unit} → <b className={better ? 'text-ok' : 'text-ink'}>{format(after)}{unit}</b>
        </span>
      </div>
      <div className="mt-2 space-y-1.5" aria-hidden>
        <div className="h-2 rounded-full bg-surface-2">
          <motion.div className="h-2 rounded-full bg-muted/40" initial={{ width: 0 }} whileInView={{ width: `${Math.min(100, (before / max) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
        </div>
        <div className="h-2 rounded-full bg-surface-2">
          <motion.div className="h-2 rounded-full bg-gradient-to-r from-teal to-ok" initial={{ width: 0 }} whileInView={{ width: `${Math.min(100, (after / max) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }} />
        </div>
      </div>
    </div>
  )
}

export function ReadabilityCard({ readability }) {
  if (!readability) return null
  const { before, after } = readability
  return (
    <Card>
      <CardHeader icon={Gauge} title="How much easier?" subtitle="Measured with standard readability formulas" />
      <div className="space-y-5 p-5">
        <Meter label="Reading grade" before={before.grade} after={after.grade} max={Math.max(14, before.grade)} />
        <Meter label="Words per sentence" before={before.avg_sentence_words} after={after.avg_sentence_words} max={Math.max(30, before.avg_sentence_words)} />
        <Meter label="Hard words" before={before.hard_word_share * 100} after={after.hard_word_share * 100} max={40} unit="%" format={(v) => v.toFixed(0)} />
      </div>
    </Card>
  )
}

export function GlossaryCard({ state, onRetry: load, selected, onSelect }) {
  const [playing, setPlaying] = useState(null)

  useEffect(() => {
    if (selected) document.getElementById(`term-${selected}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])

  const speak = (item) => {
    setPlaying(item.term)
    playClip(api.ttsUrl(item.urdu, 'ur'), () => setPlaying(null)).catch(() => {
      setPlaying(null)
      announce('Urdu audio is not available right now')
    })
  }

  const items = state.data?.items || []
  return (
    <Card>
      <CardHeader icon={Languages} tone="teal" title="Hard words, explained" subtitle="Simple English and Urdu. Terms stay in English." />
      <div className="p-3">
        {state.loading && (
          <div className="space-y-3 p-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        )}
        <ErrorNotice error={state.error} onRetry={load} className="m-2" />
        {!state.loading && !state.error && items.length === 0 && <p className="p-3 text-sm text-muted">No hard words found on this page.</p>}
        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={it.term}
              id={`term-${it.term.toLowerCase()}`}
              className={cx('rounded-xl p-3 transition', selected === it.term.toLowerCase() ? 'bg-accent-soft ring-2 ring-accent' : 'hover:bg-surface-2')}
            >
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => onSelect?.(it.term.toLowerCase())} className="text-left font-semibold">
                  {it.term}
                </button>
                <button
                  type="button"
                  onClick={() => speak(it)}
                  className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-brand hover:bg-surface"
                  aria-label={`Listen to the Urdu explanation of ${it.term}`}
                >
                  {playing === it.term ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
                </button>
              </div>
              <p className="mt-0.5 text-sm text-muted">{it.simple_en}</p>
              {it.urdu && (
                <p lang="ur" className="urdu mt-1 text-[17px] text-ink">
                  {it.urdu}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

export function QuizCard({ lessonId, level, onLevelChange }) {
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setQuiz(null)
    setResult(null)
    setAnswers({})
  }, [lessonId, level])

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      setQuiz(await api.quiz(lessonId, level))
    } catch (e) {
      setError(e)
    }
    setBusy(false)
  }
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.answer(quiz.id, answers)
      setResult(r)
      announce(`You got ${Math.round(r.score * 100)} percent. ${r.advice}`)
    } catch (e) {
      setError(e)
    }
    setBusy(false)
  }

  const byId = Object.fromEntries((result?.results || []).map((r) => [r.id, r]))
  const levelName = { original: 'the original text', easier: 'Easier', simplest: 'Simplest' }
  return (
    <Card>
      <CardHeader icon={GraduationCap} tone="accent" title="Check your understanding" subtitle="Questions come only from facts Fact Guard verified" />
      <div className="p-5">
        <ErrorNotice error={error} onRetry={quiz ? submit : start} className="mb-4" />
        {!quiz && (
          <Button variant="primary" className="w-full" onClick={start} loading={busy}>
            Start a short quiz
          </Button>
        )}
        {quiz && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
            className="space-y-5"
          >
            {quiz.questions.map((q, n) => {
              const r = byId[q.id]
              return (
                <fieldset key={q.id} className="space-y-2">
                  <legend className="font-semibold leading-snug">
                    {n + 1}. {q.question}
                  </legend>
                  {q.options.map((o) => {
                    const isAnswer = r && o === r.answer
                    const isWrongPick = r && o === r.given && !r.correct
                    return (
                      <label
                        key={o}
                        className={cx(
                          'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-[15px]',
                          isAnswer ? 'border-ok bg-ok-soft' : isWrongPick ? 'border-bad bg-bad-soft' : answers[q.id] === o ? 'border-brand bg-surface-2' : 'border-line',
                        )}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={o}
                          checked={answers[q.id] === o}
                          disabled={!!result}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                          className="accent-[var(--brand)]"
                        />
                        {o}
                      </label>
                    )
                  })}
                </fieldset>
              )
            })}
            {!result ? (
              <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={Object.keys(answers).length < quiz.questions.length}>
                Check my answers
              </Button>
            ) : (
              <div className="space-y-3 rounded-xl bg-surface-2 p-4">
                <p className="font-display text-2xl font-bold">{Math.round(result.score * 100)}%</p>
                <p>{result.advice}</p>
                {result.new_level !== level && (
                  <Button variant="accent" onClick={() => onLevelChange?.(result.new_level)}>
                    Switch to {levelName[result.new_level]}
                  </Button>
                )}
              </div>
            )}
          </form>
        )}
        {!quiz && !error && (
          <p className="mt-3 text-center text-xs text-muted">
            <Pill tone="info">4 questions</Pill>
          </p>
        )}
      </div>
    </Card>
  )
}
