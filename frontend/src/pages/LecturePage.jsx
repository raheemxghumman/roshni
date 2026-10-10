import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { navigate } from '../lib/router'
import { LectureUpload, LectureView } from '../components/Lecture'
import { ErrorNotice, Skeleton } from '../components/ui'

export default function LecturePage({ id }) {
  const [lecture, setLecture] = useState(null)
  const [error, setError] = useState(null)
  const isNew = id === 'new'

  const load = () => {
    if (isNew) return
    setError(null)
    api.lecture(id).then(setLecture).catch(setError)
  }
  useEffect(load, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-10 pt-6 sm:px-6 lg:px-10">
      <a href="#/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Lessons
      </a>
      <h1 className="mb-6 mt-2 text-3xl font-bold">{isNew ? 'Lecture captions' : lecture?.filename || 'Lecture'}</h1>
      {isNew && (
        <div className="max-w-3xl">
          <LectureUpload onDone={(lec) => navigate(`/lecture/${lec.id}`)} />
        </div>
      )}
      <ErrorNotice error={error} onRetry={load} />
      {!isNew && !lecture && !error && <Skeleton className="h-96" />}
      {lecture && <LectureView lecture={lecture} />}
    </div>
  )
}
