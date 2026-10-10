// Home "For you": where you left off and your next step, built only from this learner's own profile.
import { ArrowRight, BookOpen, GraduationCap, Headphones, Captions as CaptionsIcon, MonitorPlay, Play } from 'lucide-react'
import { useProfile } from '../lib/profile'
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
  const exists = (id) => !lessonIds || lessonIds.has(id)
  const recent = profile.recent.find((r) => exists(r.id))
  const report = profile.lastReport && exists(profile.lastReport.lessonId) ? profile.lastReport : null
  if (!recent && !report) return null
  const RecentIcon = TAB_ICON[recent?.tab] || BookOpen
  return (
    <section aria-labelledby="for-you-h" className="pt-6">
      <h2 id="for-you-h" className="eyebrow text-accent-ink">
        For you
      </h2>
      <div className={cx('mt-3 grid gap-4', recent && report && 'md:grid-cols-2')}>
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
              <span className="block font-display text-lg font-bold leading-snug">{report.step.title}</span>
              <span className="block truncate text-sm opacity-75">{report.title}</span>
            </span>
            <ArrowRight className="size-5 shrink-0 transition group-hover:translate-x-1" aria-hidden />
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
