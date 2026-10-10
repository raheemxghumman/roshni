import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { LectureUpload, LectureView } from '../components/Lecture'
import { ErrorNotice, Skeleton } from '../components/ui'

export default function Captions({ lesson, onLesson }) {
  const [lecture, setLecture] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    if (!lesson.lecture_id) return
    setError(null)
    api.lecture(lesson.lecture_id).then(setLecture).catch(setError)
  }
  useEffect(load, [lesson.lecture_id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!lesson.lecture_id) {
    return (
      <div className="max-w-3xl">
        <LectureUpload
          lessonId={lesson.id}
          onDone={(lec) => {
            setLecture(lec)
            onLesson((l) => ({ ...l, lecture_id: lec.id }))
          }}
        />
      </div>
    )
  }
  if (error) return <ErrorNotice error={error} onRetry={load} />
  if (!lecture) return <Skeleton className="h-96" />
  return <LectureView lecture={lecture} />
}
