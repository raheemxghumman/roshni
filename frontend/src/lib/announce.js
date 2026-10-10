// Sends a message to the page's ARIA live region so screen-reader users hear status changes.
export function announce(message) {
  window.dispatchEvent(new CustomEvent('roshni-announce', { detail: message }))
}

export const formatTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${sec}`
  return `${m}:${sec}`
}

export const shortModel = (name) => (name || '').split('/').pop()
