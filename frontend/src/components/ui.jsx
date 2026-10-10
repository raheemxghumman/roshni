import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { EASE } from './motion'

const cx = (...c) => c.filter(Boolean).join(' ')
export { cx }

const VARIANTS = {
  primary: 'bg-brand text-on-brand shadow-[0_6px_18px_-8px_var(--brand)] hover:bg-brand-2',
  secondary: 'bg-surface text-ink border border-line hover:border-brand/40 hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
  accent: 'bg-accent text-[#241600] shadow-[0_6px_18px_-8px_var(--accent)] hover:brightness-105',
  teal: 'bg-teal text-white hover:brightness-110',
}
const SIZES = { sm: 'h-9 px-3.5 text-sm gap-1.5', md: 'h-11 px-4.5 text-[15px] gap-2', lg: 'h-13 px-6 text-base gap-2.5' }

export function Button({ variant = 'secondary', size = 'md', icon: Icon, loading, disabled, className, children, ...props }) {
  const isDisabled = Boolean(loading || disabled)
  return (
    <motion.button
      type="button"
      whileHover={isDisabled ? undefined : { y: -1.5 }}
      whileTap={isDisabled ? undefined : { scale: 0.96, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-2xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
      disabled={isDisabled}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-[18px]" aria-hidden /> : null}
      {children}
    </motion.button>
  )
}

export function Card({ className, children, as: Tag = 'section', ...props }) {
  return (
    <Tag className={cx('rounded-3xl border border-line bg-surface shadow-[var(--shadow)]', className)} {...props}>
      {children}
    </Tag>
  )
}

export function CardHeader({ icon: Icon, title, subtitle, action, tone = 'brand' }) {
  const tones = { brand: 'bg-brand/10 text-brand', teal: 'bg-teal-soft text-teal', accent: 'bg-accent-soft text-accent-ink' }
  return (
    <div className="flex items-start gap-3 border-b border-line px-5 py-4">
      {Icon && (
        <span className={cx('mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl', tones[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

const TONES = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-surface-2 text-ink',
  brand: 'bg-brand text-on-brand',
  accent: 'bg-accent-soft text-accent-ink',
  teal: 'bg-teal-soft text-teal',
}

export function Pill({ tone = 'info', icon: Icon, children, className }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', TONES[tone], className)}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  )
}

export function Spinner({ label = 'Loading' }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-muted">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </span>
  )
}

export function ErrorNotice({ error, onRetry, className }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -8, rotateX: -20 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: EASE }}
          style={{ transformPerspective: 800 }}
          className={cx('flex items-start gap-3 rounded-2xl border border-bad/30 bg-bad-soft p-4 text-ink', className)}
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{error.message || 'Something went wrong.'}</p>
            {error.code && <p className="eyebrow mt-1 text-muted">Error code: {error.code}</p>}
          </div>
          {onRetry && error.retryable !== false && (
            <Button size="sm" icon={RotateCcw} onClick={onRetry}>
              Try again
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Skeleton({ className }) {
  return <div className={cx('skeleton-shimmer rounded-2xl', className)} aria-hidden />
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Side drawer dialog that swings in like a door. Focus moves to the heading, Tab stays inside, Escape closes.
export function Drawer({ open, onClose, title, children, width = 'max-w-xl' }) {
  const panelRef = useRef(null)
  const titleRef = useRef(null)
  const lastFocus = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    lastFocus.current = document.activeElement
    setTimeout(() => titleRef.current?.focus(), 30)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      lastFocus.current?.focus?.()
    }
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ perspective: 1600 }}>
          <motion.div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            initial={{ x: '100%', rotateY: -18, opacity: 0.6 }}
            animate={{ x: 0, rotateY: 0, opacity: 1 }}
            exit={{ x: '100%', rotateY: -12, opacity: 0.6 }}
            transition={{ duration: 0.5, ease: EASE }}
            style={{ transformOrigin: '100% 50%' }}
            className={cx('relative flex h-full w-full flex-col bg-surface shadow-2xl', width)}
          >
            <div className="flex items-center gap-3 border-b border-line px-6 py-4">
              <h2 id="drawer-title" ref={titleRef} tabIndex={-1} className="flex-1 text-lg font-semibold outline-none">
                {title}
              </h2>
              <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-2xl transition hover:rotate-90 hover:bg-surface-2" aria-label="Close">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function Segmented({ label, options, value, onChange, id = 'seg' }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  const select = (next) => {
    onChange(next)
    requestAnimationFrame(() => {
      document.querySelector(`[data-group="${id}"][aria-checked="true"]`)?.focus()
    })
  }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      select(options[(idx + 1) % options.length].value)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      select(options[(idx - 1 + options.length) % options.length].value)
    } else if (e.key === 'Home') {
      e.preventDefault()
      select(options[0].value)
    } else if (e.key === 'End') {
      e.preventDefault()
      select(options[options.length - 1].value)
    }
  }
  return (
    <div role="radiogroup" aria-label={label} className="relative inline-flex rounded-2xl border border-line bg-surface-2 p-1" onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value || (value == null && i === 0) ? 0 : -1}
          onClick={() => onChange(o.value)}
          data-group={id}
          className={cx('rounded-xl px-4 py-1.5 text-sm font-semibold transition-all duration-300', value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
