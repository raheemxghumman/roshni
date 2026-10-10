// Fetch wrapper. Every backend error has the shape {error: {code, message_for_user, retryable}}.
// The anonymous learner id (if this browser has one) goes with every request, so quiz history stays per learner.
import { learnerId } from './learner'
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
    const headers = {}
    if (body) headers['Content-Type'] = 'application/json'
    const id = learnerId()
    if (id) headers['X-Learner-Id'] = id
    res = await fetch(apiUrl(path), {
      method,
      signal,
      body: form ?? (body ? JSON.stringify(body) : undefined),
      headers,
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
  quiz: (id, { level = 'easier', count = 15, sectionIds = [], fresh = false } = {}) =>
    request(`/api/lessons/${id}/quiz`, { method: 'POST', body: { level, count, section_ids: sectionIds, fresh } }),
  checkAnswer: (quizId, questionId, answer) => request(`/api/quiz/${quizId}/check`, { method: 'POST', body: { question_id: questionId, answer } }),
  finishQuiz: (quizId, answers, timedOut, mode) =>
    request(`/api/quiz/${quizId}/answers`, { method: 'POST', body: { answers, timed_out: timedOut, mode } }),
  practice: (id) => request(`/api/lessons/${id}/practice`),
  voiceAnswer: (blob, options, language) => {
    const ext = /mp4/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm'
    const f = new FormData()
    f.append('file', blob, `answer.${ext}`)
    f.append('options', JSON.stringify(options))
    f.append('language', language)
    return request('/api/voice/answer', { method: 'POST', form: f })
  },
  video: (key) => request(`/api/videos/${key}`),
  makeVideo: (url, { language = 'auto', lessonId } = {}) =>
    request('/api/videos', { method: 'POST', body: { url, language, lesson_id: lessonId || null } }),
  detachVideo: (lessonId, key) => request(`/api/lessons/${lessonId}/videos/${key}`, { method: 'DELETE' }),
  uploadLecture: (file, language, lessonId) =>
    request('/api/lectures', { method: 'POST', form: form({ file, language, lesson_id: lessonId }) }),
  lecture: (id) => request(`/api/lectures/${id}`),
  metrics: () => request('/api/metrics'),
  me: () => request('/api/me'),
  saveMe: (profile) => request('/api/me', { method: 'PUT', body: { profile } }),
  deleteMe: () => request('/api/me', { method: 'DELETE' }),
  ttsUrl: (text, lang = 'ur') => apiUrl(`/api/tts?${new URLSearchParams({ text, lang })}`),
}
