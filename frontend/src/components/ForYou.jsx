// Home "For you": where you left off and your next step, built only from this learner's own profile.
import { ArrowRight, BookOpen, GraduationCap, Headphones, Captions as CaptionsIcon, MonitorPlay, Play, RotateCcw } from 'lucide-react'
import { msg } from '../lib/messages'
import { useProfile } from '../lib/profile'
import { useSettings } from '../lib/settings'
import { cx } from './ui'

const TAB_NAME = { read: 'Read Easy', listen: 'Listen', captions: 'Captions', videos: 'Videos', practice: 'Practice', original: 'Original page' }
const TAB_ICON = { read: BookOpen, listen: Headphones, captions: CaptionsIcon, videos: MonitorPlay, practice: GraduationCap }

export function relativeTime(ms) {
  const mins = Math.round((Date.now() - ms) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

// Deep link for a study-plan action: the lesson opens on the right tab, level, section, word or video minute.
export function stepHref(lessonId, action = {}) {
  if (action.practice) return `#/lesson/${lessonId}?tab=practice`
  const params = new URLSearchParams()
  for (const k of ['tab', 'level', 'section', 'term', 'video', 't']) if (action[k] != null) params.set(k, String(action[k]))
  return `#/lesson/${lessonId}?${params}`
}

export default function ForYou({ lessonIds }) {
  const { profile, clearAll } = useProfile()
  const { settings } = useSettings()
  const exists = (id) => !lessonIds || lessonIds.has(id)
  const recent = profile.recent.find((r) => exists(r.id))
  const report = profile.lastReport && exists(profile.lastReport.lessonId) ? profile.lastReport : null
  const reviewItems = (profile.review || []).filter((r) => exists(r.lessonId))
  const reviewLessonId = reviewItems[0]?.lessonId
  // Count only facts for the lesson the CTA opens (matches Practice's per-lesson filter)
  const reviewCount = reviewLessonId ? reviewItems.filter((r) => r.lessonId === reviewLessonId).length : 0
  if (!recent && !report && !reviewCount) return null
  const RecentIcon = TAB_ICON[recent?.tab] || BookOpen
  const nextLabel = report?.step
    ? msg('next', { helpLang: settings.helpLang, addressForm: profile.addressForm, title: report.step.title }) || report.step.title
    : null
  return (
    <section aria-labelledby="for-you-h" className="pt-6">
      <h2 id="for-you-h" className="eyebrow text-accent-ink">
        For you
      </h2>
      <div className={cx('mt-3 grid gap-4', (recent ? 1 : 0) + (report?.step ? 1 : 0) + (reviewCount ? 1 : 0) > 1 && 'md:grid-cols-2')}>
        {recent && (
          <a href={`#/lesson/${recent.id}?tab=${recent.tab || 'read'}`} className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow)] transition hover:-translate-y-1 hover:border-brand/40">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
              <RecentIcon className="size-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-muted">Continue where you left off</span>
              <span className="block truncate font-display text-lg font-bold">{recent.title}</span>
              <span className="block text-sm text-muted">
                {TAB_NAME[recent.tab] || 'Read Easy'} · {relativeTime(recent.at)}
              </span>
            </span>
            <Play className="size-5 shrink-0 text-brand transition group-hover:translate-x-1" aria-hidden />
          </a>
        )}
        {report?.step && (
          <a href={stepHref(report.lessonId, report.step.action)} className="group flex items-center gap-4 rounded-3xl bg-ink p-5 text-bg shadow-[var(--shadow)] transition hover:-translate-y-1">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-[#241600]">
              <GraduationCap className="size-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm opacity-75">
                Your next step · from your last quiz ({report.correct} of {report.total})
              </span>
              <span className="block font-display text-lg font-bold leading-snug" lang={settings.helpLang === 'ur' || settings.helpLang === 'ps' ? settings.helpLang : undefined} dir={settings.helpLang === 'ur' || settings.helpLang === 'ps' ? 'rtl' : undefined}>
                {nextLabel}
              </span>
              <span className="block truncate text-sm opacity-75">{report.title}</span>
            </span>
            <ArrowRight className="size-5 shrink-0 transition group-hover:translate-x-1" aria-hidden />
          </a>
        )}
        {reviewCount > 0 && reviewLessonId && (
          <a href={`#/lesson/${reviewLessonId}?tab=practice&review=1`} className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow)] transition hover:-translate-y-1 hover:border-brand/40 md:col-span-2">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-warn-soft text-warn">
              <RotateCcw className="size-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-muted">Review what you missed</span>
              <span className="block font-display text-lg font-bold" lang={settings.helpLang === 'ur' || settings.helpLang === 'ps' ? settings.helpLang : undefined} dir={settings.helpLang === 'ur' || settings.helpLang === 'ps' ? 'rtl' : undefined}>
                {msg('review', { helpLang: settings.helpLang, addressForm: profile.addressForm, count: reviewCount })}
              </span>
              <span className="block truncate text-sm text-muted">{reviewItems[0].title}</span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-brand transition group-hover:translate-x-1" aria-hidden />
          </a>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        Not you?{' '}
        <button type="button" className="font-semibold underline underline-offset-2 hover:text-ink" onClick={() => window.confirm('Clear this browser’s setup and progress?') && clearAll()}>
          Clear my data
        </button>
      </p>
    </section>
  )
}
