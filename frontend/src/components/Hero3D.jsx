// The hero: an open textbook in 3D. Its right-hand leaf keeps turning from the printed
// original to the Read Easy version, with Fact Guard's badge floating above it.
// The whole book tilts gently toward the pointer.
import { useRef } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { Captions, Headphones, ShieldCheck, Volume2 } from 'lucide-react'

function Lines({ n, widths = [92, 100, 86, 97, 74], tone = 'bg-ink/12' }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full ${tone}`} style={{ width: `${widths[i % widths.length]}%` }} />
      ))}
    </div>
  )
}

function OriginalPage() {
  return (
    <div className="flex h-full flex-col bg-surface p-5">
      <p className="eyebrow text-muted">Original · grade 9</p>
      <p className="mt-3 font-display text-[13px] font-semibold leading-tight">5.1 Overview of Photosynthesis</p>
      <p className="mt-3 font-serif text-[10.5px] leading-[1.55] text-muted">
        Through photosynthesis, certain organisms convert solar energy (sunlight) into chemical energy, which is then used to build carbohydrate molecules.
      </p>
      <div className="mt-3">
        <Lines n={6} />
      </div>
      <div className="mt-auto grid h-14 place-items-center rounded-lg border border-dashed border-line text-[9px] text-muted">Figure 5.2</div>
    </div>
  )
}

function SimplePage() {
  return (
    <div className="flex h-full flex-col p-5" style={{ background: 'linear-gradient(160deg, var(--surface), var(--teal-soft))' }}>
      <p className="eyebrow text-teal">Read Easy · grade 4</p>
      <p className="mt-3 font-display text-[13px] font-semibold leading-tight">Plants make food from light</p>
      <p className="mt-3 text-[12px] leading-[1.7]">
        <span className="rounded bg-highlight px-0.5">Plants use sunlight to make food.</span> This is called <span className="underline decoration-teal decoration-wavy underline-offset-4">photosynthesis</span>. The
        energy is stored in sugar.
      </p>
      <p lang="ur" className="urdu mt-2 text-[12px] text-muted">
        photosynthesis: پودے دھوپ سے خوراک بناتے ہیں
      </p>
      <div className="mt-auto flex items-center gap-2 rounded-lg bg-surface/80 px-2.5 py-2 text-[10px] font-semibold">
        <Volume2 className="size-3.5 text-brand" aria-hidden /> Reading aloud…
        <span className="ml-auto flex gap-0.5" aria-hidden>
          {[6, 10, 7, 12, 8].map((h, i) => (
            <span key={i} className="w-0.5 animate-pulse rounded bg-brand" style={{ height: h, animationDelay: `${i * 120}ms` }} />
          ))}
        </span>
      </div>
    </div>
  )
}

export default function Hero3D() {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotY = useSpring(useTransform(mx, [-1, 1], [-22, -6]), { stiffness: 120, damping: 18 })
  const rotX = useSpring(useTransform(my, [-1, 1], [22, 10]), { stiffness: 120, damping: 18 })
  const onMove = (e) => {
    if (reduce) return
    const r = ref.current.getBoundingClientRect()
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1)
    my.set(((e.clientY - r.top) / r.height) * 2 - 1)
  }

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={() => (mx.set(0), my.set(0))} className="stage-3d relative mx-auto aspect-[5/4] w-full max-w-[560px] select-none" aria-hidden>
      {/* lamplight */}
      <div className="absolute inset-[8%] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, var(--glow), transparent 65%)' }} />
      <svg viewBox="0 0 200 200" className="lamp-rays absolute left-1/2 top-[2%] size-40 -translate-x-1/2 opacity-60">
        {Array.from({ length: 16 }).map((_, i) => (
          <line key={i} x1="100" y1="100" x2="100" y2="6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeOpacity={i % 2 ? 0.35 : 0.7} transform={`rotate(${i * 22.5} 100 100)`} />
        ))}
      </svg>

      <motion.div
        className="book absolute inset-x-[6%] bottom-[8%] top-[18%]"
        style={{ rotateX: reduce ? 16 : rotX, rotateY: reduce ? -14 : rotY }}
        initial={{ opacity: 0, y: 40, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {/* book shadow */}
        <div className="absolute -bottom-6 left-[6%] right-[6%] h-8 rounded-[50%] bg-ink/25 blur-xl" style={{ transform: 'translateZ(-40px) rotateX(90deg)' }} />
        <div className="book-page book-left overflow-hidden">
          <OriginalPage />
        </div>
        <div className="book-page book-right overflow-hidden">
          <SimplePage />
        </div>
        <div className="book-leaf">
          <div className="front overflow-hidden border border-line shadow-xl">
            <OriginalPage />
          </div>
          <div className="back overflow-hidden border border-line shadow-xl">
            <SimplePage />
          </div>
        </div>
        {/* spine */}
        <div className="absolute bottom-0 left-1/2 top-0 w-[3px] -translate-x-1/2 bg-gradient-to-b from-line via-ink/20 to-line" />

        {/* floating chips in front of the book */}
        <div className="float-chip absolute -right-[4%] -top-[12%] flex items-center gap-2 rounded-2xl border border-ok/30 bg-surface px-3.5 py-2.5 shadow-[var(--shadow-lg)]" style={{ '--z': '90px' }}>
          <span className="grid size-8 place-items-center rounded-xl bg-ok-soft text-ok">
            <ShieldCheck className="size-5" />
          </span>
          <span>
            <span className="block font-display text-sm font-bold text-ok">12/12</span>
            <span className="block text-[11px] font-semibold text-muted">facts kept</span>
          </span>
        </div>
        <div className="float-chip absolute -left-[6%] top-[38%] flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-lg)]" style={{ '--z': '70px', animationDelay: '-1.5s' }}>
          <Headphones className="size-4 text-brand" />
          <span className="text-xs font-semibold">Listen</span>
        </div>
        <div className="float-chip absolute -bottom-[9%] right-[14%] flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-lg)]" style={{ '--z': '110px', animationDelay: '-3s' }}>
          <Captions className="size-4 text-teal" />
          <span className="text-xs font-semibold">Captions</span>
        </div>
      </motion.div>
    </div>
  )
}
