// Tiny hash router: #/  #/lesson/<id>?tab=listen  #/lecture/<id|new>  #/evidence
import { useEffect, useState } from 'react'

export function parseHash(hash) {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  const params = Object.fromEntries(new URLSearchParams(query))
  if (parts.length === 0) return { name: 'home', params }
  if (parts[0] === 'lesson' && parts[1]) return { name: 'lesson', id: parts[1], params }
  if (parts[0] === 'lecture' && parts[1]) return { name: 'lecture', id: parts[1], params }
  if (parts[0] === 'evidence') return { name: 'evidence', params }
  return { name: 'notfound', params }
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export const navigate = (path) => {
  window.location.hash = path
}

// Updates a query param without adding a history entry or scrolling.
export const setParam = (key, value) => {
  const [path, query = ''] = window.location.hash.replace(/^#/, '').split('?')
  const params = new URLSearchParams(query)
  params.set(key, value)
  window.history.replaceState(null, '', `#${path}?${params}`)
}
