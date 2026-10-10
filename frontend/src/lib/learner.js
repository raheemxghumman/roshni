// Anonymous learner id: a random string, made only when there is something to remember.
// It has no name, email or gender attached, and "Clear my data" deletes it (and the server copy).
const ID_KEY = 'roshni-learner-id'

function randomId() {
  try {
    if (crypto.randomUUID) return crypto.randomUUID()
    const b = crypto.getRandomValues(new Uint8Array(16)) // works on plain-http LAN demos too
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  } catch {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
  }
}

export function learnerId({ create = false } = {}) {
  try {
    let id = localStorage.getItem(ID_KEY)
    if (!id && create) {
      id = randomId()
      localStorage.setItem(ID_KEY, id)
    }
    return id || null
  } catch {
    return null
  }
}

export function forgetLearner() {
  try {
    localStorage.removeItem(ID_KEY)
  } catch {
    /* private mode */
  }
}
