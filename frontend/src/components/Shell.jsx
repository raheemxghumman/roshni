import { useEffect, useState } from 'react'
import { Logo } from './Header'

export function LiveRegion() {
  const [message, setMessage] = useState('')
  useEffect(() => {
    const onAnnounce = (e) => {
      setMessage('')
      setTimeout(() => setMessage(e.detail), 30)
    }
    window.addEventListener('roshni-announce', onAnnounce)
    return () => window.removeEventListener('roshni-announce', onAnnounce)
  }, [])
  return (
    <div aria-live="polite" role="status" className="sr-only">
      {message}
    </div>
  )
}

// A button, not a link: an in-page #anchor would clash with the hash router.
export function SkipLink() {
  return (
    <button
      type="button"
      onClick={() => document.getElementById('main')?.focus()}
      className="sr-only z-50 rounded-2xl bg-brand px-4 py-2 font-semibold text-on-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
    >
      Skip to main content
    </button>
  )
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-surface/60 backdrop-blur">
      <div className="mx-auto grid max-w-[1680px] gap-6 px-4 py-10 sm:px-6 lg:px-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Logo />
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            One page. Every learner. Built at AICON&apos;26 Build With AI (EdTech &amp; Workforce) by 404 Team Not Found.
          </p>
        </div>
        <div className="space-y-1 text-sm text-muted md:text-right">
          <p>Sample pages: OpenStax, CC BY 4.0.</p>
          <p>AI can make mistakes. Fact Guard checks every rewrite, and the original is always one tap away.</p>
        </div>
      </div>
    </footer>
  )
}
