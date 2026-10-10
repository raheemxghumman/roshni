// Read-aloud with the browser voice, one utterance per sentence.
// One-per-sentence avoids Chrome's missing word-boundary events and its ~15 s cut-off bug,
// and gives us a reliable onstart event to highlight the current sentence.
import { useCallback, useEffect, useRef, useState } from 'react'

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

function pickVoice() {
  if (!supported) return null
  const voices = window.speechSynthesis.getVoices()
  const english = voices.filter((v) => /^en/i.test(v.lang))
  return (
    english.find((v) => /natural|online/i.test(v.name) && /en-(US|GB)/i.test(v.lang)) ||
    english.find((v) => /google/i.test(v.name)) ||
    english.find((v) => /en-(US|GB)/i.test(v.lang)) ||
    english[0] ||
    null
  )
}

export function useSpeech() {
  const [state, setState] = useState({ status: 'idle', index: -1, key: null })
  const run = useRef(0)
  const queue = useRef({ items: [], rate: 1, key: null })
  const voice = useRef(null)

  useEffect(() => {
    if (!supported) return undefined
    const update = () => {
      voice.current = pickVoice()
    }
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', update)
      run.current += 1
      window.speechSynthesis.cancel()
    }
  }, [])

  const speakAt = useCallback((i, token) => {
    const q = queue.current
    if (token !== run.current) return
    if (i >= q.items.length) {
      setState({ status: 'idle', index: -1, key: q.key })
      return
    }
    const u = new SpeechSynthesisUtterance(q.items[i])
    if (voice.current) u.voice = voice.current
    u.lang = voice.current?.lang || 'en-US'
    u.rate = q.rate
    u.onstart = () => token === run.current && setState({ status: 'playing', index: i, key: q.key })
    u.onend = () => token === run.current && speakAt(i + 1, token)
    u.onerror = (e) => {
      if (token === run.current && !['interrupted', 'canceled'].includes(e.error)) speakAt(i + 1, token)
    }
    window.speechSynthesis.speak(u)
  }, [])

  const play = useCallback(
    (items, { start = 0, rate, key = null } = {}) => {
      if (!supported || !items?.length) return
      window.speechSynthesis.cancel()
      run.current += 1
      const token = run.current
      queue.current = { items, rate: rate ?? queue.current.rate ?? 1, key }
      const first = Math.max(0, Math.min(start, items.length - 1))
      setState({ status: 'playing', index: first, key })
      setTimeout(() => speakAt(first, token), 50)
    },
    [speakAt],
  )

  const stop = useCallback(() => {
    run.current += 1
    if (supported) window.speechSynthesis.cancel()
    setState((s) => ({ status: 'idle', index: -1, key: s.key }))
  }, [])

  // Pause = stop but remember the sentence; resume restarts that sentence. Works with every voice.
  const pause = useCallback(() => {
    run.current += 1
    if (supported) window.speechSynthesis.cancel()
    setState((s) => ({ ...s, status: 'paused' }))
  }, [])

  const resume = useCallback(() => {
    const q = queue.current
    play(q.items, { start: Math.max(0, state.index), rate: q.rate, key: q.key })
  }, [play, state.index])

  const jump = useCallback(
    (i) => {
      const q = queue.current
      play(q.items, { start: i, rate: q.rate, key: q.key })
    },
    [play],
  )

  const setRate = useCallback(
    (rate) => {
      queue.current.rate = rate
      if (state.status === 'playing') jump(state.index)
    },
    [jump, state.status, state.index],
  )

  return { ...state, supported, play, stop, pause, resume, jump, setRate, rate: queue.current.rate }
}

// Plays server-generated audio (Urdu voice) one clip at a time.
let currentAudio = null
export function playClip(url, onEnd) {
  if (currentAudio) currentAudio.pause()
  currentAudio = new Audio(url)
  currentAudio.onended = () => onEnd?.()
  currentAudio.onerror = () => onEnd?.(new Error('audio failed'))
  return currentAudio.play().catch((e) => {
    onEnd?.(e)
    throw e
  })
}
export const stopClip = () => currentAudio?.pause()
