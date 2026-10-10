// Same sentence rules as the backend (readability.split_sentences), so highlights line up with Fact Guard.
const ABBREV = /\b(e\.g|i\.e|etc|Fig|fig|Dr|Mr|Mrs|Ms|vs|approx|No)\./g

export function splitSentences(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const protectedText = clean.replace(ABBREV, (m) => m.replace(/\./g, '§'))
  return protectedText
    .split(/(?<=[.!?]["')\]]?)\s+(?=[A-Z0-9"'(\[])/)
    .map((s) => s.replace(/§/g, '.').trim())
    .filter(Boolean)
}

export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
