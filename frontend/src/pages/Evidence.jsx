import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { FlaskConical, Gauge, Info, ShieldCheck } from 'lucide-react'
import { api } from '../lib/api'
import { Card, CardHeader, ErrorNotice, Pill, Skeleton } from '../components/ui'
import { CountUp, Reveal, TiltCard, item, stagger } from '../components/motion'

const CHECKS = [
  ['Independent checker', 'The rewrite comes from one AI model. A model from a different family lists the original facts and checks them, so it can’t simply agree with itself.'],
  ['Quote or it didn’t happen', 'A fact only counts as kept when the checker can quote the supporting words from the rewrite.'],
  ['Both directions', 'It looks for facts that went missing or changed, and for claims the rewrite invented.'],
  ['Plain-code number check', 'Numbers, units and formulas are compared with regular code, not AI, so “50 min” can’t quietly become “100 min”.'],
  ['Repair, then re-check', 'Only the flagged sentences are rewritten, up to two rounds. If problems remain, the badge stays amber and the original sits beside the text.'],
]

function Stat({ value, label, sub, accent = 'text-ink' }) {
  return (
    <motion.li variants={item} className="h-full">
      <TiltCard className="rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow)]" max={6}>
        <p className={`font-display text-3xl font-bold tabular-nums ${accent}`} style={{ transform: 'translateZ(30px)' }}>{value}</p>
        <p className="mt-2 font-semibold">{label}</p>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </TiltCard>
    </motion.li>
  )
}

export default function Evidence() {
  const [metrics, setMetrics] = useState(null)
  const [lessons, setLessons] = useState(null)
  const [error, setError] = useState(null)
  const load = () => {
    setError(null)
    Promise.all([api.metrics(), api.lessons()])
      .then(([m, l]) => {
        setMetrics(m)
        setLessons(l)
      })
      .catch(setError)
  }
  useEffect(load, [])

  const levels = (lessons || []).flatMap((l) => Object.entries(l.factguard || {}).map(([lvl, fg]) => ({ lvl, fg, rd: l.readability?.[lvl] })))
  const totalFacts = levels.reduce((n, x) => n + (x.fg.total || 0), 0)
  const keptFacts = levels.reduce((n, x) => n + (x.fg.kept || 0), 0)
  const grades = levels.filter((x) => x.rd)
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
  const stress = (lessons || []).flatMap((l) => Object.values(l.stress || {}))
  const caught = stress.reduce((n, s) => n + s.caught, 0)
  const planted = stress.reduce((n, s) => n + s.planted, 0)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6">
      <Pill tone="accent" icon={FlaskConical}>
        Evidence
      </Pill>
      <h1 className="mt-5 text-3xl sm:text-5xl">Does it work? Here are the numbers.</h1>
      <p className="mt-3 max-w-3xl text-lg text-muted">
        Every number on this page comes from a test you can run again. Each result says which data it used and how many items were tested. Synthetic test data is labelled.
      </p>
      <ErrorNotice error={error} onRetry={load} className="mt-6" />

      <section aria-labelledby="live-h" className="mt-10">
        <h2 id="live-h" className="text-xl font-bold">
          From the lessons in this app
        </h2>
        <p className="mt-1 text-sm text-muted">Calculated live from every simplified lesson stored on this server.</p>
        {!lessons && !error ? (
          <Skeleton className="mt-4 h-28" />
        ) : (
          <motion.ul initial="hidden" animate="show" variants={stagger(0.08)} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat accent="text-ok" value={totalFacts ? <CountUp to={(keptFacts / totalFacts) * 100} suffix="%" /> : '—'} label="Facts kept after Fact Guard" sub={`${keptFacts} of ${totalFacts} facts across ${levels.length} rewrites`} />
            <Stat value={grades.length ? <><CountUp to={avg(grades.map((g) => g.rd.before))} decimals={1} /> → <CountUp to={avg(grades.map((g) => g.rd.after))} decimals={1} /></> : '—'} label="Reading grade (Flesch-Kincaid)" sub="Average, original → simplified" />
            <Stat value={grades.length ? <><CountUp to={avg(grades.map((g) => g.rd.sentence_before))} /> → <CountUp to={avg(grades.map((g) => g.rd.sentence_after))} /></> : '—'} label="Words per sentence" sub="Average, original → simplified" />
            <Stat accent="text-brand" value={planted ? <><CountUp to={caught} />/{planted}</> : '—'} label="Planted errors caught" sub={planted ? `${stress.length} stress tests run in the app` : 'Run a stress test from any lesson'} />
          </motion.ul>
        )}
      </section>

      <section aria-labelledby="eval-h" className="mt-12">
        <h2 id="eval-h" className="text-xl font-bold">
          Evaluation runs
        </h2>
        <p className="mt-1 text-sm text-muted">Produced by the scripts in the repository&apos;s eval/ folder.</p>
        {!metrics && !error && <Skeleton className="mt-4 h-40" />}
        {metrics?.length === 0 && (
          <Card className="mt-4 p-6 text-muted">
            <Info className="mb-2 size-5" aria-hidden />
            No evaluation results yet. Run the scripts in <code>eval/</code> to fill this section.
          </Card>
        )}
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {metrics?.map((m, i) => (
            <Reveal key={m.metric} delay={i * 0.06}>
            <Card>
              <CardHeader icon={m.metric?.startsWith('factguard') ? ShieldCheck : Gauge} title={m.title} subtitle={m.method} action={<Pill tone={m.data_type === 'real' ? 'ok' : 'accent'}>{m.data_type === 'real' ? 'Real data' : 'Synthetic test'}</Pill>} />
              <div className="p-5">
                <p className="font-display text-4xl font-bold tabular-nums">{m.display}</p>
                <p className="mt-2 text-sm text-muted">{m.detail}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted">Dataset</dt>
                    <dd className="font-semibold">{m.dataset}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Sample size</dt>
                    <dd className="font-semibold">{m.n}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Models</dt>
                    <dd className="font-semibold">{m.models}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Run on</dt>
                    <dd className="font-semibold">{m.date}</dd>
                  </div>
                </dl>
              </div>
            </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-h" className="mt-12">
        <h2 id="how-h" className="text-xl font-bold">
          How Fact Guard checks a rewrite
        </h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {CHECKS.map(([t, d], i) => (
            <Reveal as="li" key={t} delay={i * 0.08} className="rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
              <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-bold text-on-brand">{i + 1}</span>
              <p className="mt-3 font-semibold">{t}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
            </Reveal>
          ))}
        </ol>
      </section>
    </div>
  )
}
