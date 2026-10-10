// Ask about one sentence: grounded tutor. Tap Ask next to a sentence; the answer must quote the page.
import { useEffect, useRef, useState } from 'react'
import { MessageCircleQuestion, X } from 'lucide-react'
import { api } from '../lib/api'
import { announce } from '../lib/announce'
import { Button, ErrorNotice, Pill, cx } from './ui'

export function AskTrigger({ onAsk, className }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onAsk()
      }}
      className={cx('ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-brand opacity-70 hover:bg-brand/10 hover:opacity-100', className)}
      aria-label="Ask about this sentence"
      title="Ask about this sentence"
    >
      <MessageCircleQuestion className="size-3.5" aria-hidden />
    </button>
  )
}

export default function AskSentence({ lessonId, sentence, sectionHeading, open, onClose }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    setQuestion('')
    setLoading(false)
    setError(null)
    setResult(null)
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, sentence, onClose])

  if (!open) return null

  const submit = async (e) => {
    e?.preventDefault()
    if (!question.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await api.ask(lessonId, sentence, question.trim())
      setResult(r)
      announce(r.answer || "The page doesn't say that.")
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ask-title">
      <div ref={panelRef} className="w-full max-w-lg rounded-3xl border border-line bg-surface p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="ask-title" className="font-display text-lg font-bold">
              Ask about this sentence
            </h2>
            {sectionHeading && <p className="mt-0.5 text-sm text-muted">{sectionHeading}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl hover:bg-surface-2" aria-label="Close">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm leading-relaxed">{sentence}</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-semibold">Your question (English, Urdu or Pashto)</span>
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={400}
              className="mt-1.5 w-full rounded-2xl border border-line bg-bg px-3 py-2.5 text-[15px]"
              placeholder="What does this mean?"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={loading} disabled={!question.trim()}>
              Ask
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
        {error && <ErrorNotice error={error} onRetry={submit} className="mt-3" />}
        {result && (
          <div className="mt-4 space-y-3 rounded-2xl border border-line bg-bg p-3">
            {result.answerable ? (
              <>
                <Pill tone="ok">From this page</Pill>
                <ul className="space-y-3">
                  {(result.sentences?.length ? result.sentences : [{ text: result.answer, quote: result.quotes?.[0] }]).map((s, i) => (
                    <li key={i}>
                      <p className="leading-relaxed">{s.text}</p>
                      {s.quote && (
                        <p className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
                          From the page: <span className="italic">“{s.quote}”</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="leading-relaxed">{result.answer}</p>
                <Pill tone="warn">Not on this page</Pill>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
