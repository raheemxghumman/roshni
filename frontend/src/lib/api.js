// Fetch wrapper. Every backend error has the shape {error: {code, message_for_user, retryable}}.
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export const apiUrl = (path) => (!path || path.startsWith('http') ? path : BASE + path)

export class ApiError extends Error {
  constructor(code, message, retryable = true, status = 0) {
    super(message)
    this.code = code
    this.retryable = retryable
    this.status = status
  }
}

async function request(path, { method = 'GET', body, form, signal } = {}) {
  let res
  try {
    res = await fetch(apiUrl(path), {
      method,
      signal,
      body: form ?? (body ? JSON.stringify(body) : undefined),
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new ApiError('NETWORK', "Can't reach the Roshni server. Check the internet connection and try again.", true, 0)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const err = data?.error
    throw new ApiError(err?.code || `HTTP_${res.status}`, err?.message_for_user || 'Something went wrong. Please try again.', err?.retryable ?? true, res.status)
  }
  return data
}

const form = (fields) => {
  const f = new FormData()
  Object.entries(fields).forEach(([k, v]) => v != null && f.append(k, v))
  return f
}

export const api = {
  health: () => request('/api/health'),
  lessons: () => request('/api/lessons'),
  lesson: (id) => request(`/api/lessons/${id}`),
  upload: (file, signal) => request('/api/lessons', { method: 'POST', form: form({ file }), signal }),
  deleteLesson: (id) => request(`/api/lessons/${id}`, { method: 'DELETE' }),
  simplify: (id, level) => request(`/api/lessons/${id}/simplify`, { method: 'POST', body: { level } }),
  stress: (id, level) => request(`/api/lessons/${id}/factguard/stress`, { method: 'POST', body: { level } }),
  glossary: (id) => request(`/api/lessons/${id}/glossary`, { method: 'POST' }),
  quiz: (id, level) => request(`/api/lessons/${id}/quiz`, { method: 'POST', body: { level } }),
  answer: (quizId, answers) => request(`/api/quiz/${quizId}/answers`, { method: 'POST', body: { answers } }),
  uploadLecture: (file, language, lessonId) =>
    request('/api/lectures', { method: 'POST', form: form({ file, language, lesson_id: lessonId }) }),
  lecture: (id) => request(`/api/lectures/${id}`),
  metrics: () => request('/api/metrics'),
  ttsUrl: (text, lang = 'ur') => apiUrl(`/api/tts?${new URLSearchParams({ text, lang })}`),
}
