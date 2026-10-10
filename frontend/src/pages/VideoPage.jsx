import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { navigate } from '../lib/router'
import { VideoAdd, VideoView } from '../components/VideoNotes'
import { ErrorNotice, Skeleton } from '../components/ui'

export default function VideoPage({ id }) {
  const [video, setVideo] = useState(null)
  const [error, setError] = useState(null)
  const isNew = id === 'new'

  const load = () => {
    if (isNew) return
    setError(null)
    api.video(id).then(setVideo).catch(setError)
  }
  useEffect(load, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
      <a href="#/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Lessons
      </a>
      <h1 className="mb-6 mt-2 text-3xl font-bold">{isNew ? 'Notes from a video' : 'Video notes'}</h1>
      {isNew && (
        <div className="max-w-3xl">
          <VideoAdd onDone={(v) => navigate(`/video/${v.id}`)} />
        </div>
      )}
      <ErrorNotice error={error} onRetry={load} />
      {!isNew && !video && !error && <Skeleton className="h-96" />}
      {video && <VideoView video={video} />}
    </div>
  )
}
