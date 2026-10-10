// Sends a message to the page's ARIA live region so screen-reader users hear status changes.
export function announce(message) {
  window.dispatchEvent(new CustomEvent('roshni-announce', { detail: message }))
}

export const formatTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const shortModel = (name) => (name || '').split('/').pop()
