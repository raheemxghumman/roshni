import { AnimatePresence, MotionConfig } from 'motion/react'
import { SettingsProvider } from './lib/settings'
import { useRoute } from './lib/router'
import Header from './components/Header'
import { Footer, LiveRegion, SkipLink } from './components/Shell'
import { PageTransition } from './components/motion'
import Home from './pages/Home'
import Lesson from './pages/Lesson'
import LecturePage from './pages/LecturePage'
import Evidence from './pages/Evidence'

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-28 text-center">
      <p className="eyebrow text-accent-ink">404</p>
      <h1 className="mt-3 text-3xl">This page wandered off</h1>
      <p className="mt-3 text-muted">The link doesn&apos;t lead anywhere.</p>
      <a href="#/" className="mt-7 inline-block rounded-2xl bg-brand px-5 py-3 font-semibold text-on-brand">
        Back to lessons
      </a>
    </div>
  )
}

export default function App() {
  const route = useRoute()
  const key = `${route.name}-${route.id || ''}`
  return (
    <MotionConfig reducedMotion="user">
      <SettingsProvider>
        <div className="tile-bg flex min-h-screen flex-col overflow-x-clip text-ink">
          <SkipLink />
          <Header route={route} />
          <main id="main" tabIndex={-1} className="flex-1 outline-none" style={{ perspective: 1800 }}>
            <AnimatePresence mode="wait">
              <PageTransition key={key}>
                {route.name === 'home' && <Home />}
                {route.name === 'lesson' && <Lesson id={route.id} tab={route.params.tab} />}
                {route.name === 'lecture' && <LecturePage id={route.id} />}
                {route.name === 'evidence' && <Evidence />}
                {route.name === 'notfound' && <NotFound />}
              </PageTransition>
            </AnimatePresence>
          </main>
          <Footer />
          <LiveRegion />
        </div>
      </SettingsProvider>
    </MotionConfig>
  )
}
