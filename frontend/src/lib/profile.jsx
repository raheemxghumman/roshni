// The learner's profile: how they like to learn and where they left off.
// Kept in this browser first (works offline and in demo mode), and copied to the server under an anonymous id
// when the server has a profile store (Neon Postgres). No name, email or gender is ever stored.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { forgetLearner, learnerId } from './learner'
import { PRACTICE_KEY } from './practiceConfig'

const KEY = 'roshni-profile-v1'
export const PROFILE_DEFAULTS = {
  onboarded: false,
  needs: [], // reading_tiring | large_text | screen_reader | captions | second_language
  preferredTab: 'read',
  defaultLevel: null, // 'simplest' when a need asks for simpler text
  levels: {}, // lessonId -> {level, from: 'quiz'|'manual', score, at}
  recent: [], // [{id, title, tab, at}], newest first
  last: {}, // lessonId -> {correct, total, score, weak: [headings], at}  (this learner's previous attempt)
  lastReport: null, // {lessonId, title, correct, total, score, level, weak, step: {title, action}, at}
  best: {}, // lessonId -> best score
  dismissed: {}, // lessonId -> true when the "opened because" line was dismissed
  review: [], // [{lessonId, title, factId, fact, at}] missed facts waiting for a correct answer
  addressForm: 'neutral', // how Roshni addresses you in Urdu/Pashto templates
  updatedAt: 0,
}

function load() {
  try {
    return { ...PROFILE_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...PROFILE_DEFAULTS }
  }
}

const Ctx = createContext(null)

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(load)
  const [sync, setSync] = useState('local') // local | synced | saving | offline
  const storeOn = useRef(false)
  const pushTimer = useRef(null)
  const loadedFromServer = useRef(false)

  // persist locally on every change
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile))
    } catch {
      /* private mode */
    }
  }, [profile])

  // on start: if this browser already has a learner id and the server has a store, take the newer copy
  useEffect(() => {
    let alive = true
    api
      .health()
      .then(async (h) => {
        storeOn.current = !!h?.profile_store
        if (!storeOn.current || !learnerId()) return
        const remote = await api.me()
        if (!alive || !remote?.profile) return
        loadedFromServer.current = true
        setProfile((local) => {
          if ((remote.profile.updatedAt || 0) > (local.updatedAt || 0)) {
            return { ...PROFILE_DEFAULTS, ...remote.profile }
          }
          // Local is newer: keep it and push so the server catches up
          if ((local.updatedAt || 0) > (remote.profile.updatedAt || 0)) {
            learnerId({ create: true })
            api.saveMe(local).catch(() => {})
          }
          return local
        })
        setSync('synced')
      })
      .catch(() => alive && setSync(learnerId() ? 'offline' : 'local'))
    return () => {
      alive = false
    }
  }, [])

  const push = useCallback((next) => {
    if (!storeOn.current) return
    clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      learnerId({ create: true })
      setSync('saving')
      api
        .saveMe(next)
        .then(() => setSync('synced'))
        .catch(() => setSync('offline'))
    }, 1200)
  }, [])

  const update = useCallback(
    (patch) =>
      setProfile((p) => {
        const next = { ...p, ...(typeof patch === 'function' ? patch(p) : patch), updatedAt: Date.now() }
        push(next)
        return next
      }),
    [push],
  )

  const recordOpen = useCallback(
    (lesson, tab) =>
      update((p) => ({ recent: [{ id: lesson.id, title: lesson.title, tab, at: Date.now() }, ...p.recent.filter((r) => r.id !== lesson.id)].slice(0, 8) })),
    [update],
  )

  const rememberLevel = useCallback(
    (lessonId, level, from, score = null) => {
      if (level !== 'easier' && level !== 'simplest') return
      update((p) => ({ levels: { ...p.levels, [lessonId]: { level, from, score, at: Date.now() } } }))
    },
    [update],
  )

  const saveResult = useCallback(
    (lesson, quizLevel, report) =>
      update((p) => {
        const weak = report.sections.filter((s) => s.weak).map((s) => s.heading)
        const step = report.plan.find((s) => s.action?.tab) || report.plan[0] || null
        const entry = { correct: report.correct, total: report.total, score: report.score, weak, at: Date.now() }
        // Missed facts join the review list; facts answered correctly this attempt leave it.
        const gotRight = new Set((report.results || []).filter((r) => r.correct && r.fact_id).map((r) => r.fact_id))
        const missed = (report.results || [])
          .filter((r) => !r.correct && r.fact_id)
          .map((r) => ({ lessonId: lesson.id, title: lesson.title, factId: r.fact_id, fact: r.fact, at: Date.now() }))
        const kept = (p.review || []).filter((item) => !(item.lessonId === lesson.id && gotRight.has(item.factId)))
        const seen = new Set(kept.map((item) => `${item.lessonId}:${item.factId}`))
        const review = [...missed.filter((m) => !seen.has(`${m.lessonId}:${m.factId}`)), ...kept].slice(0, 40)
        const next = {
          last: { ...p.last, [lesson.id]: entry },
          best: { ...p.best, [lesson.id]: Math.max(p.best[lesson.id] || 0, report.score) },
          lastReport: { lessonId: lesson.id, title: lesson.title, level: quizLevel, ...entry, step: step && { title: step.title, action: step.action } },
          review,
        }
        if (report.new_level === 'easier' || report.new_level === 'simplest') {
          next.levels = { ...p.levels, [lesson.id]: { level: report.new_level, from: 'quiz', score: report.score, correct: report.correct, total: report.total, at: Date.now() } }
        }
        return next
      }),
    [update],
  )

  const clearReviewed = useCallback(
    (lessonId, factId) =>
      update((p) => ({ review: (p.review || []).filter((item) => !(item.lessonId === lessonId && item.factId === factId)) })),
    [update],
  )

  const clearAll = useCallback(async () => {
    if (learnerId() && storeOn.current) await api.deleteMe().catch(() => {})
    try {
      ;[KEY, 'roshni-display-v1', PRACTICE_KEY].forEach((k) => localStorage.removeItem(k))
    } catch {
      /* private mode */
    }
    forgetLearner()
    window.location.replace('#/')
    window.location.reload()
  }, [])

  const value = useMemo(
    () => ({ profile, update, recordOpen, rememberLevel, saveResult, clearReviewed, clearAll, sync }),
    [profile, update, recordOpen, rememberLevel, saveResult, clearReviewed, clearAll, sync],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useProfile = () => useContext(Ctx)

// Which tab a lesson should open on for this learner: Captions only when the lesson has a lecture.
export function tabFor(profile, lesson) {
  const tab = profile.preferredTab
  if (tab === 'captions' && !lesson.lecture_id) return 'read'
  return ['read', 'listen', 'captions'].includes(tab) ? tab : 'read'
}

// One plain sentence explaining why a lesson opened on a tab, or null when it is just the default.
export function tabReason(profile, tab) {
  if (tab === 'listen' && profile.needs.includes('screen_reader')) return 'you said you use a screen reader or keyboard'
  if (tab === 'captions' && profile.needs.includes('captions')) return 'you said you follow lessons by captions'
  return null
}
