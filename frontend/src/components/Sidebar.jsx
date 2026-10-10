import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Gauge, Languages, LoaderCircle, Volume2 } from 'lucide-react'
import { api } from '../lib/api'
import { announce } from '../lib/announce'
import { HELP_LANGS, useSettings } from '../lib/settings'
import { playClip } from '../lib/speech'
import { Card, CardHeader, ErrorNotice, Segmented, Skeleton, cx } from './ui'

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
  const { settings, update } = useSettings()
  const lang = HELP_LANGS[settings.helpLang] ? settings.helpLang : 'ur'
  const help = HELP_LANGS[lang]

  useEffect(() => {
    if (selected) document.getElementById(`term-${selected}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])

  const speak = (item) => {
    setPlaying(item.term)
    const voice = lang === 'ur' ? settings.urduVoice : lang === 'ps' ? settings.pashtoVoice : undefined
    playClip(api.ttsUrl(item[help.field], lang, voice), () => setPlaying(null)).catch(() => {
      setPlaying(null)
      announce(`${help.label} audio is not available right now`)
    })
  }

  const items = state.data?.items || []
  return (
    <Card>
      <CardHeader icon={Languages} tone="teal" title="Hard words, explained" subtitle={`Simple English and ${help.label}. Terms stay in English.`} />
      <div className="p-3">
        <div className="flex items-center justify-between gap-3 px-2 pb-2">
          <span className="text-xs font-semibold text-muted">Explain in</span>
          <Segmented
            id="help-lang"
            label="Language for word explanations"
            value={lang}
            onChange={(v) => {
              update({ helpLang: v })
              announce(`Word explanations now in ${HELP_LANGS[v].label}`)
            }}
            options={Object.entries(HELP_LANGS).map(([value, l]) => ({
              value,
              label: (
                <span lang={value} className={cx(l.className, 'text-[15px] leading-none')} title={l.label}>
                  {l.native}
                </span>
              ),
            }))}
          />
        </div>
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
                  disabled={!it[help.field]}
                  className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-brand hover:bg-surface disabled:opacity-40"
                  aria-label={`Listen to the ${help.label} explanation of ${it.term}`}
                >
                  {playing === it.term ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
                </button>
              </div>
              <p className="mt-0.5 text-sm text-muted">{it.simple_en}</p>
              {it[help.field] ? (
                <p lang={lang} className={cx(help.className, 'mt-1 text-[17px] text-ink')}>
                  {it[help.field]}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted">{help.label} explanation not ready for this word yet.</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
