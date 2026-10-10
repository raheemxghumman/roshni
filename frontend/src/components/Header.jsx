import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { FlaskConical, Library, Moon, Plus, Settings2, Sun } from 'lucide-react'
import { api } from '../lib/api'
import { useSettings } from '../lib/settings'
import { cx } from './ui'
import DisplaySettings from './DisplaySettings'

export function Logo() {
  return (
    <a href="#/" className="group flex items-center gap-3 rounded-xl" aria-label="Roshni home">
      <span className="relative grid size-10 place-items-center">
        <svg viewBox="0 0 64 64" className="lamp-rays absolute inset-0" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i} x1="32" y1="32" x2="32" y2="3" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeOpacity={i % 2 ? 0.45 : 0.9} transform={`rotate(${i * 30} 32 32)`} />
          ))}
        </svg>
        <span className="relative grid size-7 place-items-center rounded-full bg-brand shadow-[0_0_18px_var(--glow)] transition group-hover:scale-110">
          <span className="size-3 rounded-full bg-accent" />
        </span>
      </span>
      <span className="flex items-baseline gap-2">
        <span className="font-display text-[19px] font-extrabold tracking-tight">roshni</span>
        <span className="urdu hidden text-[15px] text-teal sm:inline" lang="ur" style={{ lineHeight: 1 }}>
          روشنی
        </span>
      </span>
    </a>
  )
}

function Status() {
  const [health, setHealth] = useState(null)
  useEffect(() => {
    let alive = true
    const check = () =>
      api
        .health()
        .then((h) => alive && setHealth(h))
        .catch(() => alive && setHealth({ ok: false }))
    check()
    const t = setInterval(check, 30000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  if (!health) return null
  const [dot, label] = !health.ok ? ['bg-bad', 'Offline'] : health.demo_mode ? ['bg-accent', 'Demo mode'] : ['bg-ok', 'AI online']
  return (
    <span
      className="hidden items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-xs font-semibold text-muted lg:inline-flex"
      title={health.ok ? `Reader ${health.models?.reader} · Rewriter ${health.models?.rewriter} · Fact Guard ${health.models?.fact_guard}` : ''}
    >
      <span className="relative flex size-2">
        <span className={cx('absolute inline-flex size-full animate-ping rounded-full opacity-60', dot)} />
        <span className={cx('relative inline-flex size-2 rounded-full', dot)} />
      </span>
      {label}
    </span>
  )
}

export default function Header({ route }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('roshni:open-display', show)
    return () => window.removeEventListener('roshni:open-display', show)
  }, [])
  const { settings, update } = useSettings()
  const links = [
    { href: '#/', active: route.name === 'home' || route.name === 'lesson', label: 'Lessons', icon: Library },
    { href: '#/evidence', active: route.name === 'evidence', label: 'Evidence', icon: FlaskConical },
  ]
  const dark = settings.theme === 'dark'
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} aria-current={l.active ? 'page' : undefined} className={cx('relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors', l.active ? 'text-ink' : 'text-muted hover:text-ink')}>
              {l.active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-surface shadow-sm ring-1 ring-line" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
              <l.icon className="relative size-4" aria-hidden />
              <span className="relative">{l.label}</span>
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Status />
          <button
            type="button"
            onClick={() => update({ theme: dark ? 'light' : 'dark' })}
            className="grid size-10 place-items-center rounded-2xl border border-line bg-surface/70 transition hover:bg-surface-2"
            aria-label={dark ? 'Switch to light theme' : 'Switch to night theme'}
          >
            <motion.span key={dark ? 'moon' : 'sun'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.35 }}>
              {dark ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
            </motion.span>
          </button>
          <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-line bg-surface/70 px-3.5 text-sm font-semibold transition hover:bg-surface-2">
            <Settings2 className="size-4" aria-hidden />
            <span className="hidden sm:inline">Display</span>
          </button>
          <a href="#/" className="hidden h-10 items-center gap-1.5 rounded-2xl bg-brand px-4 text-sm font-semibold text-on-brand shadow-[0_6px_18px_-8px_var(--brand)] transition hover:-translate-y-0.5 hover:bg-brand-2 md:inline-flex">
            <Plus className="size-4" aria-hidden /> New lesson
          </a>
        </div>
      </div>
      <DisplaySettings open={open} onClose={() => setOpen(false)} />
    </header>
  )
}
