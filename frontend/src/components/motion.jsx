// Motion building blocks. Everything respects the OS "reduce motion" setting
// (MotionConfig reducedMotion="user" in App + the CSS media query).
import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'

export const EASE = [0.2, 0.8, 0.2, 1]

// Card that tilts in 3D toward the pointer, with a soft glare that follows it.
export function TiltCard({ children, className = '', max = 8, glare = true, ...props }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 200, damping: 20 })
  const gx = useTransform(px, (v) => `${v * 100}%`)
  const gy = useTransform(py, (v) => `${v * 100}%`)
  const glareBg = useMotionTemplate`radial-gradient(420px circle at ${gx} ${gy}, rgba(255,255,255,0.22), transparent 45%)`

  const onMove = (e) => {
    if (reduce || e.pointerType === 'touch') return
    const r = ref.current.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  const reset = () => {
    px.set(0.5)
    py.set(0.5)
  }
  return (
    <div className="stage-3d h-full">
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={reset}
        style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        whileHover={reduce ? undefined : { y: -4 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className={`relative h-full ${className}`}
        {...props}
      >
        {children}
        {glare && !reduce && <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: glareBg }} />}
      </motion.div>
    </div>
  )
}

// Fades and lifts content in, with a slight 3D tilt, when it scrolls into view.
export function Reveal({ children, delay = 0, className = '', as = 'div', y = 24 }) {
  const Tag = motion[as] || motion.div
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y, rotateX: 8 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      style={{ transformPerspective: 1000 }}
    >
      {children}
    </Tag>
  )
}

export const stagger = (step = 0.07) => ({
  hidden: {},
  show: { transition: { staggerChildren: step } },
})
export const item = {
  hidden: { opacity: 0, y: 22, rotateX: 10, scale: 0.98 },
  show: { opacity: 1, y: 0, rotateX: 0, scale: 1, transition: { duration: 0.6, ease: EASE } },
}

// Counts up to a number when it first appears.
export function CountUp({ to, decimals = 0, duration = 1.2, suffix = '', prefix = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [value, setValue] = useState(reduce ? to : 0)
  useEffect(() => {
    if (!inView || reduce) {
      setValue(to)
      return undefined
    }
    const controls = animate(0, to, { duration, ease: EASE, onUpdate: setValue })
    return () => controls.stop()
  }, [inView, to, duration, reduce])
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {Number(value).toFixed(decimals)}
      {suffix}
    </span>
  )
}

// Wraps each route: content arrives from slightly below and "behind" the screen.
export function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26, rotateX: 6, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      exit={{ opacity: 0, y: -14, rotateX: -4, scale: 0.99 }}
      transition={{ duration: 0.55, ease: EASE }}
      style={{ transformPerspective: 1600, transformOrigin: '50% 0%' }}
    >
      {children}
    </motion.div>
  )
}
