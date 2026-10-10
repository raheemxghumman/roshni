// "Set Roshni up for you": two questions, native form controls, every choice applied at once.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Sparkles, X } from 'lucide-react'
import { announce } from '../lib/announce'
import { patchPracticeConfig } from '../lib/practiceConfig'
import { NEEDS, presetFor } from '../lib/presets'
import { useProfile } from '../lib/profile'
import { HELP_LANGS, useSettings } from '../lib/settings'
import { Button, Card, cx } from './ui'
import { EASE } from './motion'

export function SetupQuestions({ onDone, compact = false }) {
  const { settings, update: updateSettings } = useSettings()
  const { profile, update } = useProfile()
  const [lang, setLang] = useState(settings.helpLang || 'ur')
  const [needs, setNeeds] = useState(profile.needs || [])
  const toggle = (id) => setNeeds((n) => (n.includes(id) ? n.filter((x) => x !== id) : [...n, id]))

  const apply = (e) => {
    e?.preventDefault()
    const preset = presetFor(needs)
    updateSettings({ ...preset.settings, helpLang: lang })
    update({ ...preset.profile, onboarded: true })
    if (Object.keys(preset.practice).length) patchPracticeConfig(preset.practice)
    announce(needs.length ? 'Roshni is set up for you. Lessons will open the way you chose.' : 'Saved. Roshni keeps its standard setup.')
    onDone?.()
  }

  return (
    <form onSubmit={apply} className="space-y-6">
      <fieldset>
        <legend className={cx('font-semibold', compact ? 'text-sm' : 'text-base')}>1. Explain hard words in</legend>
        <p className="mt-1 text-sm text-muted">Every hard word also has a simple English explanation.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(HELP_LANGS).map(([value, l]) => (
            <label key={value} className={cx('flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2.5 transition', lang === value ? 'border-brand bg-brand/5' : 'border-line hover:border-brand/40')}>
              <input type="radio" name="setup-lang" value={value} checked={lang === value} onChange={() => setLang(value)} className="accent-[var(--brand)]" />
              <span lang={value} className={cx(l.className, 'text-xl leading-none')}>
                {l.native}
              </span>
              <span className="text-sm text-muted">{l.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={cx('font-semibold', compact ? 'text-sm' : 'text-base')}>2. What helps you learn? Choose any.</legend>
        <p className="mt-1 text-sm text-muted">Leave all empty to keep the standard setup. You can change this any time under Display.</p>
        <div className="mt-3 grid gap-2">
          {NEEDS.map((n) => {
            const on = needs.includes(n.id)
            return (
              <label key={n.id} className={cx('flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-4 py-3 transition', on ? 'border-brand bg-brand/5' : 'border-line hover:border-brand/40')}>
                <input type="checkbox" checked={on} onChange={() => toggle(n.id)} className="mt-1 size-4 accent-[var(--brand)]" aria-describedby={`need-${n.id}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{n.label}</span>
                  <span lang="ur" className="urdu block text-[15px] text-muted" style={{ lineHeight: 1.9 }}>
                    {n.ur}
                  </span>
                  <span id={`need-${n.id}`} className="block text-xs text-muted">
                    {n.note}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <Button type="submit" variant="primary" icon={Check}>
        Save my setup
      </Button>
    </form>
  )
}

// Home card for first visits. Nothing opens by itself: the learner chooses to set up, or not now.
export function SetupCard() {
  const { profile, update } = useProfile()
  const [open, setOpen] = useState(false)
  if (profile.onboarded) return null
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold">Set Roshni up for you</h2>
          <p className="text-sm text-muted">Two quick questions, about 20 seconds. Lessons will then open the way you learn best.</p>
        </div>
        {!open && (
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => setOpen(true)} aria-expanded={open}>
              Set up
            </Button>
            <Button variant="ghost" icon={X} onClick={() => update({ onboarded: true })}>
              Not now
            </Button>
          </div>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="border-t border-line">
            <div className="p-5">
              <SetupQuestions onDone={() => setOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
