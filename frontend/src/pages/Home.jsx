import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, BookOpen, Captions, FileAudio, FlaskConical, GraduationCap, Headphones, MonitorPlay, MousePointerClick, ScanText, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { api, apiUrl } from '../lib/api'
import UploadPanel from '../components/UploadPanel'
import ForYou from '../components/ForYou'
import { SetupCard } from '../components/Setup'
import { useProfile } from '../lib/profile'
import Hero3D from '../components/Hero3D'
import { FactGuardBadge } from '../components/FactGuard'
import { CountUp, EASE, Reveal, TiltCard, item, stagger } from '../components/motion'
import { ErrorNotice, Pill, Skeleton, cx } from '../components/ui'

const MODES = [
  { icon: BookOpen, name: 'Read Easy', who: 'If reading is slow or tiring, or English is your second language', tone: 'text-brand bg-brand/10',
    text: 'The page rewritten at an easier level, hard words explained in Urdu or Pashto, and read-aloud that highlights each sentence as it goes.' },
  { icon: Headphones, name: 'Listen', who: 'If you learn by listening, or are blind or have low vision', tone: 'text-teal bg-teal-soft',
    text: 'The page read aloud section by section, every figure described in words, and full keyboard and screen-reader control.' },
  { icon: Captions, name: 'Captions', who: 'If you are deaf or hard of hearing, or prefer reading what was said', tone: 'text-accent-ink bg-accent-soft',
    text: 'The lecture as a timestamped transcript, plus a summary that Fact Guard checks against what the teacher actually said.' },
]

const STEPS = [
  { icon: ScanText, title: 'Read the page', text: 'Gemini reads the photo, keeps headings and tables, and describes each diagram for blind learners.' },
  { icon: Sparkles, title: 'Rewrite it simply', text: 'A writing model rewrites the page at an easier level and explains hard words in Urdu or Pashto.' },
  { icon: ShieldCheck, title: 'Fact Guard checks', text: 'A different AI lists every fact and checks the rewrite kept each one. Problems are repaired.' },
  { icon: Headphones, title: 'Learn your way', text: 'Read, listen or follow captions. The original page is always one tap away.' },
]

function ModeCard({ m, i }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <motion.li variants={item} className="stage-3d h-64">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        onMouseEnter={() => setFlipped(true)}
        onMouseLeave={() => setFlipped(false)}
        aria-pressed={flipped}
        aria-label={`${m.name}: ${m.who}. ${m.text}`}
        className={cx('flip relative block h-full w-full text-left', flipped && 'is-flipped')}
      >
        <span className="face absolute inset-0 flex flex-col rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <span className="eyebrow text-muted">Mode 0{i + 1}</span>
          <span className={cx('mt-4 grid size-14 place-items-center rounded-2xl', m.tone)}>
            <m.icon className="size-7" aria-hidden />
          </span>
          <span className="mt-auto font-display text-2xl font-bold">{m.name}</span>
          <span className="mt-1 text-sm text-muted">{m.who}</span>
        </span>
        <span className="face face-back absolute inset-0 flex flex-col rounded-3xl bg-brand p-6 text-on-brand shadow-[var(--shadow-lg)]">
          <span className="eyebrow opacity-70">{m.name}</span>
          <span className="mt-4 text-[17px] leading-relaxed">{m.text}</span>
          <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold opacity-80">
            <MousePointerClick className="size-4" aria-hidden /> Open any lesson to try it
          </span>
        </span>
      </button>
    </motion.li>
  )
}

function LessonCard({ lesson, onDelete }) {
  const best = useProfile().profile.best?.[lesson.id] ?? null
  const fg = lesson.factguard?.easier || Object.values(lesson.factguard || {})[0]
  const rd = lesson.readability?.easier
  return (
    <motion.li variants={item} className="h-full">
      <TiltCard className="group overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow)]" max={6}>
        <div className="relative aspect-[4/3] overflow-hidden border-b border-line bg-surface-2">
          {lesson.thumbnail && <img src={apiUrl(lesson.thumbnail)} alt="" className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-105" loading="lazy" />}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
          {rd && (
            <span className="absolute bottom-3 left-3 rounded-full bg-ink/80 px-2.5 py-1 font-mono text-[11px] font-semibold text-white backdrop-blur">
              grade {rd.before} → {rd.after}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 p-5" style={{ transform: 'translateZ(30px)' }}>
          <h3 className="text-[15px] font-semibold leading-snug">
            <a href={`#/lesson/${lesson.id}`} className="after:absolute after:inset-0">
              {lesson.title}
            </a>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {fg ? <FactGuardBadge fg={fg} /> : <Pill>Not simplified yet</Pill>}
            {lesson.has_lecture && <Pill tone="teal" icon={Captions}>Lecture</Pill>}
            {lesson.videos > 0 && <Pill tone="teal" icon={MonitorPlay}>{lesson.videos} video{lesson.videos > 1 ? 's' : ''}</Pill>}
            {best != null && <Pill tone="accent" icon={GraduationCap}>Your best quiz {Math.round(best * 100)}%</Pill>}
            {lesson.sample && <Pill tone="accent">Sample</Pill>}
          </div>
        </div>
        {!lesson.sample && (
          <button
            type="button"
            onClick={() => onDelete(lesson)}
            className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-xl bg-surface/90 text-muted opacity-0 shadow transition hover:text-bad focus:opacity-100 group-hover:opacity-100"
            aria-label={`Delete lesson ${lesson.title}`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </TiltCard>
    </motion.li>
  )
}

export default function Home() {
  const [lessons, setLessons] = useState(null)
  const [error, setError] = useState(null)
  const load = () =>
    api
      .lessons()
      .then((l) => {
        setLessons(l)
        setError(null)
      })
      .catch(setError)
  useEffect(() => {
    load()
  }, [])

  const remove = async (lesson) => {
    if (!window.confirm(`Delete "${lesson.title}"?`)) return
    try {
      await api.deleteLesson(lesson.id)
      load()
    } catch (e) {
      setError(e)
    }
  }

  const facts = (lessons || []).reduce((acc, l) => {
    Object.values(l.factguard || {}).forEach((fg) => {
      acc.kept += fg.kept || 0
      acc.total += fg.total || 0
    })
    return acc
  }, { kept: 0, total: 0 })
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* ------------------------------------------------------------ for you: only for returning learners */}
      <ForYou lessonIds={lessons ? new Set(lessons.map((l) => l.id)) : null} />
      <div className="pt-4">
        <SetupCard />
      </div>
      {/* ------------------------------------------------------------ hero */}
      <section className="grid items-center gap-8 pb-6 pt-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:pt-14">
        <motion.div initial="hidden" animate="show" variants={stagger(0.09)} className="min-w-0">
          <motion.p variants={item} className="eyebrow inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-muted">
            <span className="size-1.5 rounded-full bg-accent" /> AICON&apos;26 · EdTech &amp; Workforce
          </motion.p>
          <motion.h1 variants={item} className="mt-6 text-[2.35rem] leading-[1.04] sm:text-6xl">
            One page.
            <br />
            <span className="relative inline-block text-brand">
              Every learner.
              <svg viewBox="0 0 300 18" className="absolute -bottom-3 left-0 w-full" aria-hidden preserveAspectRatio="none">
                <motion.path d="M4 12 C 80 2, 180 2, 296 10" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.6, ease: EASE }} />
              </svg>
            </span>
          </motion.h1>
          <motion.p variants={item} className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
            Photograph any page you need to learn from: a textbook, a training manual, a safety notice, a worksheet. Roshni turns it into a lesson set up the way you learn, for blind, dyslexic and deaf learners too, and <b className="text-ink">Fact Guard</b>, a second AI, makes sure no fact was lost on the way.
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => scrollTo('start')} className="inline-flex h-13 items-center gap-2 rounded-2xl bg-brand px-6 font-semibold text-on-brand shadow-[0_10px_30px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:bg-brand-2">
              Make a lesson <ArrowRight className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => scrollTo('lessons')} className="inline-flex h-13 items-center gap-2 rounded-2xl border border-line bg-surface px-6 font-semibold transition hover:-translate-y-0.5 hover:border-brand/40">
              Open a sample
            </button>
          </motion.div>
          <motion.dl variants={item} className="mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-line pt-6 sm:gap-4">
            <div>
              <dt className="eyebrow text-muted">Learners</dt>
              <dd className="mt-1 font-display text-lg font-bold sm:text-2xl">3 modes</dd>
            </div>
            <div>
              <dt className="eyebrow text-muted">Facts kept</dt>
              <dd className="mt-1 font-display text-lg font-bold text-ok sm:text-2xl">{facts.total ? <CountUp to={(facts.kept / facts.total) * 100} suffix="%" /> : '—'}</dd>
            </div>
            <div>
              <dt className="eyebrow text-muted">Cost</dt>
              <dd className="mt-1 font-display text-lg font-bold sm:text-2xl">PKR 0</dd>
            </div>
          </motion.dl>
        </motion.div>
        <Hero3D />
      </section>

      {/* ------------------------------------------------------------ start */}
      <section id="start" aria-labelledby="start-h" className="scroll-mt-24 py-10">
        <Reveal className="grid gap-5 rounded-[2rem] border border-line bg-surface/80 p-5 shadow-[var(--shadow)] backdrop-blur sm:p-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <p className="eyebrow text-accent-ink">Start here</p>
            <h2 id="start-h" className="mt-2 text-2xl">
              Turn a page into a lesson
            </h2>
            <p className="mb-5 mt-2 text-muted">Takes about 15 seconds. Works with phone photos, scans and PDFs.</p>
            <UploadPanel />
          </div>
          <div className="flex flex-col gap-4">
            <a href="#/lecture/new" className="group relative flex flex-1 flex-col overflow-hidden rounded-3xl bg-ink p-6 text-bg transition hover:-translate-y-1">
              <div className="absolute -right-10 -top-10 size-40 rounded-full bg-teal/40 blur-3xl transition group-hover:bg-teal/60" />
              <FileAudio className="relative size-8 text-teal" aria-hidden />
              <p className="relative mt-auto pt-10 font-display text-xl font-bold">Only have a lecture recording?</p>
              <p className="relative mt-2 text-sm opacity-75">Captions and a checked summary for deaf learners.</p>
              <span className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal">
                Make captions <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
              </span>
            </a>
            <a href="#/video/new" className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 transition hover:-translate-y-1">
              <span className="grid size-12 place-items-center rounded-2xl bg-teal-soft text-teal">
                <MonitorPlay className="size-6" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Learning from a YouTube video?</span>
                <span className="block text-sm text-muted">Paste a link for checked study notes.</span>
              </span>
              <ArrowRight className="size-5 text-muted transition group-hover:translate-x-1" aria-hidden />
            </a>
            <a href="#/evidence" className="group flex items-center gap-4 rounded-3xl border border-line bg-surface-2 p-5 transition hover:-translate-y-1">
              <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
                <FlaskConical className="size-6" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">See the evidence</span>
                <span className="block text-sm text-muted">Accuracy tests you can run yourself.</span>
              </span>
              <ArrowRight className="size-5 text-muted transition group-hover:translate-x-1" aria-hidden />
            </a>
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------------------ lessons */}
      <section id="lessons" aria-labelledby="lessons-h" className="scroll-mt-24 py-10">
        <Reveal className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-accent-ink">Library</p>
            <h2 id="lessons-h" className="mt-2 text-3xl">
              Lessons
            </h2>
            <p className="mt-2 text-muted">Your pages and the ready-made samples, from school, work or everyday life. Each one opens the way you learn.</p>
          </div>
        </Reveal>
        <ErrorNotice error={error} onRetry={load} className="mb-4" />
        {!lessons && !error && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        )}
        {lessons?.length === 0 && (
          <div className="rounded-3xl border border-dashed border-line p-10 text-center">
            <p className="font-display text-lg font-semibold">No lessons yet</p>
            <p className="mt-1 text-muted">Upload a page above to make your first accessible lesson.</p>
          </div>
        )}
        {lessons?.length > 0 && (
          <motion.ul initial="hidden" animate="show" variants={stagger(0.08)} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((l) => (
              <LessonCard key={l.id} lesson={l} onDelete={remove} />
            ))}
          </motion.ul>
        )}
      </section>

      {/* ------------------------------------------------------------ modes */}
      <section aria-labelledby="modes-h" className="py-10">
        <Reveal>
          <p className="eyebrow text-accent-ink">Three ways in</p>
          <h2 id="modes-h" className="mt-2 text-3xl">
            The same page, for every learner
          </h2>
          <p className="mt-2 max-w-3xl text-muted">Hover or tap a card to flip it. The same works beyond school: training manuals, safety notices and job materials for employees who are blind, dyslexic or deaf.</p>
        </Reveal>
        <motion.ul initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} variants={stagger(0.1)} className="mt-7 grid gap-5 md:grid-cols-3">
          {MODES.map((m, i) => (
            <ModeCard key={m.name} m={m} i={i} />
          ))}
        </motion.ul>
      </section>

      {/* ------------------------------------------------------------ fact guard band */}
      <Reveal className="my-10 overflow-hidden rounded-[2rem] bg-brand text-on-brand shadow-[var(--shadow-lg)]">
        <div className="relative grid gap-8 p-8 sm:p-10 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="pointer-events-none absolute -left-16 -top-24 size-72 rounded-full bg-accent/30 blur-3xl" aria-hidden />
          <motion.div
            className="relative grid size-24 place-items-center rounded-[1.75rem] bg-on-brand/10 ring-1 ring-on-brand/20"
            initial={{ rotateY: -180, opacity: 0 }}
            whileInView={{ rotateY: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: EASE }}
            style={{ transformPerspective: 600 }}
          >
            <ShieldCheck className="size-12 text-accent" aria-hidden />
          </motion.div>
          <div className="relative">
            <p className="eyebrow opacity-70">Why you can trust a rewrite</p>
            <h2 className="mt-2 text-2xl sm:text-3xl">Fact Guard: a second AI that checks the first</h2>
            <p className="mt-3 max-w-2xl leading-relaxed opacity-85">
              Simplifying text can quietly drop a fact or change a number. Fact Guard uses a different AI family to list every fact on the original page, demands a quote for
              each one from the rewrite, checks numbers with plain code, and repairs anything missing. You can even plant errors on purpose and watch it catch them.
            </p>
          </div>
          <a href="#/evidence" className="relative inline-flex h-12 items-center gap-2 self-start rounded-2xl bg-accent px-5 font-semibold text-[#241600] transition hover:-translate-y-0.5 lg:self-center">
            See the tests <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      </Reveal>

      {/* ------------------------------------------------------------ how */}
      <section aria-labelledby="how-h" className="py-10">
        <Reveal>
          <p className="eyebrow text-accent-ink">Under the hood</p>
          <h2 id="how-h" className="mt-2 text-3xl">
            How it works
          </h2>
        </Reveal>
        <motion.ol initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} variants={stagger(0.12)} className="relative mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="absolute left-0 right-0 top-[2.1rem] hidden h-px bg-gradient-to-r from-transparent via-line to-transparent lg:block" aria-hidden />
          {STEPS.map((s, i) => (
            <motion.li key={s.title} variants={item} className="h-full">
              <TiltCard className="rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow)]" max={7}>
                <div className="flex items-center justify-between" style={{ transform: 'translateZ(40px)' }}>
                  <span className="grid size-12 place-items-center rounded-2xl bg-brand text-on-brand shadow-[0_8px_20px_-10px_var(--brand)]">
                    <s.icon className="size-6" aria-hidden />
                  </span>
                  <span className="font-display text-4xl font-extrabold text-line">0{i + 1}</span>
                </div>
                <p className="mt-5 font-display text-lg font-semibold">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </TiltCard>
            </motion.li>
          ))}
        </motion.ol>
      </section>
    </div>
  )
}
