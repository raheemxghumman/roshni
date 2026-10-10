import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { CircleCheck, CircleX, FlaskConical, ListChecks, ShieldAlert, ShieldCheck, ShieldQuestion, TriangleAlert } from 'lucide-react'
import { api } from '../lib/api'
import { announce, shortModel } from '../lib/announce'
import { splitSentences } from '../lib/sentences'
import { Button, Card, Drawer, ErrorNotice, Pill, cx } from './ui'
import { CountUp, EASE } from './motion'

export function statusInfo(fg) {
  if (!fg) return { tone: 'info', icon: ShieldQuestion, label: 'Not checked yet' }
  if (fg.status === 'green') return { tone: 'ok', icon: ShieldCheck, label: `${fg.kept}/${fg.total} facts kept` }
  if (fg.status === 'amber') return { tone: 'warn', icon: ShieldAlert, label: `${fg.kept}/${fg.total} facts kept` }
  if (fg.status === 'no_facts') return { tone: 'info', icon: ShieldQuestion, label: 'No text facts to check' }
  return { tone: 'info', icon: ShieldQuestion, label: 'Unverified' }
}

export function FactGuardBadge({ fg, className }) {
  const s = statusInfo(fg)
  return (
    <Pill tone={s.tone} icon={s.icon} className={className}>
      Fact Guard: {s.label}
    </Pill>
  )
}

const FACT_STATUS = {
  kept: { icon: CircleCheck, tone: 'text-ok', label: 'Kept' },
  changed: { icon: TriangleAlert, tone: 'text-warn', label: 'Changed' },
  missing: { icon: CircleX, tone: 'text-bad', label: 'Missing' },
  supported: { icon: CircleCheck, tone: 'text-ok', label: 'Supported' },
  unsupported: { icon: CircleX, tone: 'text-bad', label: 'Not in lecture' },
}

function FactRow({ fact, text }) {
  const s = FACT_STATUS[fact.status] || FACT_STATUS.missing
  const Icon = s.icon
  return (
    <li className="flex gap-3 py-3">
      <Icon className={cx('mt-0.5 size-5 shrink-0', s.tone)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="leading-snug">{text ?? fact.text}</p>
        <p className={cx('mt-1 text-xs font-semibold uppercase tracking-wide', s.tone)}>{s.label}</p>
        {fact.evidence && <p className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">Found: “{fact.evidence}”</p>}
        {fact.note && fact.status !== 'kept' && fact.status !== 'supported' && <p className="mt-1.5 text-sm text-muted">{fact.note}</p>}
      </div>
    </li>
  )
}

const words = (t) => (t || '').toLowerCase().match(/[a-z0-9]+/g) || []

// How many substantial sentences of the original are represented by at least one extracted fact.
function coverage(fg, sections) {
  const sources = (fg.facts || []).map((f) => new Set(words(`${f.source_sentence} ${f.text}`)))
  let total = 0
  let covered = 0
  sections?.forEach((s) =>
    splitSentences(s.text).forEach((sent) => {
      const w = words(sent).filter((x) => x.length > 3)
      if (w.length < 4) return
      total += 1
      if (sources.some((src) => w.filter((x) => src.has(x)).length / w.length >= 0.5)) covered += 1
    }),
  )
  return { total, covered }
}

export function FactList({ fg, sections }) {
  const cov = coverage(fg, sections)
  const groups = sections?.length ? sections.map((s) => ({ ...s, facts: fg.facts.filter((f) => f.section_id === s.id) })).filter((g) => g.facts.length) : [{ id: 'all', heading: 'Facts', facts: fg.facts || [] }]
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface-2 p-4 text-sm">
        <p>
          Rewritten by <b>{shortModel(fg.rewriter_model)}</b>, checked by <b>{shortModel(fg.checker_model)}</b>. Fact Guard always uses a model from a different family, so it
          can&apos;t simply agree with itself.
        </p>
        <p className="mt-1.5 text-muted">A fact only counts as kept when the checker can quote it from the rewrite. Numbers, units and formulas are also checked by plain code.</p>
        {cov.total > 0 && (
          <p className="mt-1.5 text-muted">
            Coverage: the {fg.total} facts cover <b className="text-ink">{cov.covered} of {cov.total}</b> substantial sentences on the original page.
          </p>
        )}
      </div>
      {groups.map((g) => (
        <div key={g.id}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{g.heading}</h3>
          <ul className="divide-y divide-line">
            {g.facts.map((f) => (
              <FactRow key={f.id} fact={f} />
            ))}
          </ul>
        </div>
      ))}
      {fg.added_claims?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-bad">Added claims not in the original</h3>
          <ul className="mt-2 space-y-2">
            {fg.added_claims.map((a, i) => (
              <li key={i} className="rounded-lg border border-bad/30 bg-bad-soft px-3 py-2 text-sm">
                “{a.quote}” <span className="text-muted">{a.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {fg.missing_tokens?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-bad">Numbers or symbols that changed</h3>
          <p className="mt-2 flex flex-wrap gap-2">
            {fg.missing_tokens.map((t, i) => (
              <Pill key={i} tone="bad">
                {t.token}
              </Pill>
            ))}
          </p>
        </div>
      )}
    </div>
  )
}

function Rounds({ rounds }) {
  if (!rounds?.length) return null
  return (
    <ol className="space-y-2" aria-label="Fact Guard rounds">
      {rounds.map((r) => (
        <motion.li key={r.round} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 * r.round, ease: EASE }} className="flex items-center gap-3 text-sm">
          <span className={cx('grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold', r.status === 'green' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}>{r.round}</span>
          <span className="flex-1 text-muted">{r.action}</span>
          <span className={cx('font-semibold tabular-nums', r.status === 'green' ? 'text-ok' : 'text-warn')}>
            {r.kept}/{r.total}
          </span>
        </motion.li>
      ))}
    </ol>
  )
}

const PLANT_LABEL = { changed_number: 'Changed a number', deleted_fact: 'Deleted a fact', added_claim: 'Invented a claim' }

// Each planted error shows first as "planted", then flips over to reveal whether Fact Guard caught it.
function PlantedCard({ p, i }) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 500 + i * 450)
    return () => clearTimeout(t)
  }, [i])
  const detail = (
    <>
      {p.before && <p className="mt-1.5 line-clamp-2 text-muted line-through decoration-bad/60">{p.before}</p>}
      {p.after && <p className="mt-1 line-clamp-2 text-ink">{p.after}</p>}
    </>
  )
  return (
    <li className="stage-3d">
      <div className={cx('flip grid', flipped && 'is-flipped')}>
        <div className="face col-start-1 row-start-1 rounded-2xl border border-dashed border-line bg-surface-2 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold"><FlaskConical className="size-4 text-brand" aria-hidden />Planted: {PLANT_LABEL[p.type]}</p>
          {detail}
        </div>
        <div className={cx('face face-back col-start-1 row-start-1 rounded-2xl p-3 text-sm', p.caught ? 'bg-ok-soft' : 'bg-bad-soft')}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{PLANT_LABEL[p.type]}</span>
            <Pill tone={p.caught ? 'ok' : 'bad'} icon={p.caught ? CircleCheck : CircleX}>
              {p.caught ? 'Caught' : 'Missed'}
            </Pill>
          </div>
          {detail}
        </div>
      </div>
    </li>
  )
}

function StressTest({ lessonId, level }) {
  const [state, setState] = useState({ loading: false, data: null, error: null })
  const run = async () => {
    setState({ loading: true, data: null, error: null })
    announce('Running the Fact Guard stress test')
    try {
      const data = await api.stress(lessonId, level)
      setState({ loading: false, data, error: null })
      announce(`Fact Guard caught ${data.caught} of ${data.total_planted} planted errors`)
    } catch (error) {
      setState({ loading: false, data: null, error })
    }
  }
  const d = state.data
  return (
    <div className="rounded-xl border border-dashed border-line p-4">
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
        <div className="flex-1">
          <p className="font-semibold">Stress test</p>
          <p className="text-sm text-muted">Secretly break the rewrite on purpose and see if Fact Guard notices.</p>
        </div>
      </div>
      {!d && (
        <Button className="mt-3 w-full" icon={FlaskConical} onClick={run} loading={state.loading}>
          {state.loading ? 'Planting errors and checking…' : 'Plant 3 errors'}
        </Button>
      )}
      <ErrorNotice error={state.error} onRetry={run} className="mt-3" />
      {d && (
        <div className="mt-3 space-y-3">
          <p className={cx('rounded-lg px-3 py-2 text-sm font-semibold', d.caught === d.total_planted ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}>
            Caught {d.caught} of {d.total_planted} planted errors
          </p>
          <ul className="space-y-2.5">
            {d.planted.map((p, i) => (
              <PlantedCard key={i} p={p} i={i} />
            ))}
          </ul>
          <p className="text-sm text-muted">
            After repair: <b className={d.repaired_report.status === 'green' ? 'text-ok' : 'text-warn'}>{d.repaired_report.kept}/{d.repaired_report.total} facts kept</b>
            {d.repaired_report.added_claims.length === 0 ? ', no invented claims.' : `, ${d.repaired_report.added_claims.length} claim(s) still flagged.`}
          </p>
        </div>
      )}
    </div>
  )
}

export function FactGuardCard({ fg, sections, lessonId, level }) {
  const [open, setOpen] = useState(false)
  const s = statusInfo(fg)
  const Icon = s.icon
  const big = { ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', info: 'bg-surface-2 text-muted' }[s.tone] || 'bg-surface-2 text-muted'
  return (
    <Card>
      <div className="p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand" aria-hidden />
          <h2 className="font-semibold">Fact Guard</h2>
        </div>
        <div className={cx('mt-4 flex items-center gap-4 rounded-2xl p-4', big)}>
          <motion.span
            key={`${fg?.status}-${fg?.kept}`}
            initial={{ rotateY: -180, scale: 0.6 }}
            animate={{ rotateY: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: EASE }}
            style={{ transformPerspective: 500 }}
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-surface/70"
          >
            <Icon className="size-8" aria-hidden />
          </motion.span>
          <div>
            <p className="font-display text-3xl font-bold tabular-nums">{fg?.total ? <><CountUp to={fg.kept} />/{fg.total}</> : '—'}</p>
            <p className="text-sm font-semibold">{fg?.status === 'green' ? 'All facts kept' : fg?.status === 'amber' ? 'Some facts need a look' : s.label}</p>
          </div>
        </div>
        {fg?.status === 'amber' && <p className="mt-3 text-sm text-muted">Compare the highlighted sections with the original. The original text is always shown alongside.</p>}
        {fg?.status === 'unavailable' && <p className="mt-3 text-sm text-muted">{fg.note}</p>}
        {fg?.rounds?.length > 0 && (
          <div className="mt-4">
            <Rounds rounds={fg.rounds} />
          </div>
        )}
        {fg?.facts?.length > 0 && (
          <Button className="mt-4 w-full" icon={ListChecks} onClick={() => setOpen(true)}>
            See every fact
          </Button>
        )}
      </div>
      {fg?.facts?.length > 0 && lessonId && (
        <div className="border-t border-line p-5">
          <StressTest lessonId={lessonId} level={level} />
        </div>
      )}
      <Drawer open={open} onClose={() => setOpen(false)} title={`Fact Guard · ${s.label}`}>
        {fg && <FactList fg={fg} sections={sections} />}
      </Drawer>
    </Card>
  )
}
