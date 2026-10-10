// Practice quiz settings, shared by the Practice tab and the setup presets.
// Saved per browser; a preset can change them while the Practice tab is open (it listens for the event).
export const PRACTICE_KEY = 'roshni-practice-v1'
export const PRACTICE_DEFAULTS = { count: 15, level: 'easier', mode: 'tap', timerTap: 15, timerVoice: 0, readAloud: false, voiceLang: 'en' }
const EVENT = 'roshni-practice-config'

export function loadPracticeConfig() {
  try {
    return { ...PRACTICE_DEFAULTS, ...JSON.parse(localStorage.getItem(PRACTICE_KEY) || '{}') }
  } catch {
    return { ...PRACTICE_DEFAULTS }
  }
}

export function savePracticeConfig(config) {
  try {
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(config))
  } catch {
    /* private mode: settings still apply for this visit */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: config }))
}

export function patchPracticeConfig(patch) {
  const next = { ...loadPracticeConfig(), ...patch }
  savePracticeConfig(next)
  return next
}

export function onPracticeConfig(callback) {
  const handler = (e) => callback(e.detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
