import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck } from 'lucide-react'
import { EASE } from './motion'
import { cx } from './ui'

// Shows the pipeline steps while a long request runs. Steps advance on a timer because the
// server answers once at the end; the last step waits until the request finishes.
export function ProgressSteps({ steps, active = true, stepMs = 4500, title }) {
  const [current, setCurrent] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    setCurrent(0)
    setElapsed(0)
    const started = Date.now()
    const t = setInterval(() => {
      const ms = Date.now() - started
      setElapsed(Math.floor(ms / 1000))
      setCurrent(Math.min(steps.length - 1, Math.floor(ms / stepMs)))
    }, 250)
    return () => clearInterval(t)
  }, [active, steps.length, stepMs])

  const pct = Math.min(96, ((current + Math.min(1, (elapsed * 1000 - current * stepMs) / stepMs)) / steps.length) * 100)
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 16, rotateX: 12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      style={{ transformPerspective: 1000 }}
      className="overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow)]"
    >
      <div className="h-1.5 bg-surface-2">
        <motion.div className="h-full rounded-r-full bg-gradient-to-r from-brand via-teal to-accent" animate={{ width: `${pct}%` }} transition={{ ease: 'easeOut', duration: 0.4 }} />
      </div>
      <div className="p-6">
        {title && <p className="mb-5 font-display text-lg font-semibold">{title}</p>}
        <ol className="space-y-4">
          {steps.map((s, i) => {
            const done = i < current
            const now = i === current
            return (
              <li key={s.label} className="flex items-start gap-3.5">
                <span className={cx('relative mt-0.5 grid size-7 shrink-0 place-items-center rounded-full transition-colors', done ? 'bg-ok text-white' : now ? 'bg-brand text-on-brand pulse-ring' : 'bg-surface-2 text-muted')}>
                  <AnimatePresence mode="wait" initial={false}>
                    {done ? (
                      <motion.span key="done" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
                        <CircleCheck className="size-4" aria-hidden />
                      </motion.span>
                    ) : (
                      <motion.span key="num" className="text-xs font-bold">
                        {i + 1}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <div>
                  <p className={cx('font-semibold transition-colors', !done && !now && 'text-muted')}>{s.label}</p>
                  <AnimatePresence>
                    {s.detail && now && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-sm text-muted">
                        {s.detail}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </li>
            )
          })}
        </ol>
        <p className="eyebrow mt-5 tabular-nums text-muted">{elapsed}s · free AI tiers can take a little longer when busy</p>
      </div>
    </motion.div>
  )
}
