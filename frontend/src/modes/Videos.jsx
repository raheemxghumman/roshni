// Lesson tab: YouTube videos attached to this page, each with checked study notes.
import { useEffect, useState } from 'react'
import { MonitorPlay, Plus, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { api } from '../lib/api'
import { announce } from '../lib/announce'
import { VideoAdd, VideoView } from '../components/VideoNotes'
import { Button, ErrorNotice, Skeleton, cx } from '../components/ui'

export default function Videos({ lesson, onLesson, focus }) {
  const attached = lesson.videos || []
  const [selected, setSelected] = useState(focus?.video || attached[attached.length - 1]?.id || null)
  const [video, setVideo] = useState(null)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(attached.length === 0)

  useEffect(() => {
    if (focus?.video) {
      setSelected(focus.video)
      setAdding(false)
    }
  }, [focus?.video, focus?.nonce])

  const load = () => {
    if (!selected) return
    setError(null)
    setVideo(null)
    api.video(selected).then(setVideo).catch(setError)
  }
  useEffect(load, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const onAdded = (v) => {
    const card = { id: v.id, video_id: v.video_id, title: v.title, author: v.author, duration: v.duration, factguard: v.factguard, relevance: v.relevance }
    onLesson((l) => ({ ...l, videos: [...(l.videos || []).filter((x) => x.id !== v.id), card] }))
    setVideo(v)
    setSelected(v.id)
    setAdding(false)
  }
  const remove = async (id) => {
    if (!window.confirm('Remove this video from the lesson? The notes are kept and can be added again.')) return
    try {
      await api.detachVideo(lesson.id, id)
      const rest = attached.filter((v) => v.id !== id)
      onLesson((l) => ({ ...l, videos: rest }))
      announce('Video removed')
      setSelected(rest[rest.length - 1]?.id || null)
      if (!rest.length) setAdding(true)
    } catch (e) {
      setError(e)
    }
  }

  const current = attached.find((v) => v.id === selected)
  return (
    <div className="space-y-5">
      {attached.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Videos for this lesson">
          {attached.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={selected === v.id && !adding}
              onClick={() => {
                setSelected(v.id)
                setAdding(false)
              }}
              className={cx('flex max-w-xs items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm transition', selected === v.id && !adding ? 'border-brand bg-brand/5 font-semibold' : 'border-line bg-surface hover:border-brand/40')}
            >
              <MonitorPlay className="size-4 shrink-0 text-teal" aria-hidden />
              <span className="truncate">{v.title}</span>
              {v.relevance?.related === false ? <TriangleAlert className="size-4 shrink-0 text-warn" aria-label="May not match this page" /> : <ShieldCheck className={cx('size-4 shrink-0', v.factguard?.status === 'green' ? 'text-ok' : 'text-warn')} aria-hidden />}
            </button>
          ))}
          {attached.length < 5 && (
            <Button size="sm" variant={adding ? 'primary' : 'ghost'} icon={Plus} onClick={() => setAdding(true)}>
              Add a video
            </Button>
          )}
          {current && !adding && (
            <Button size="sm" variant="ghost" icon={Trash2} className="ml-auto" onClick={() => remove(current.id)} aria-label={`Remove ${current.title} from this lesson`}>
              Remove
            </Button>
          )}
        </div>
      )}
      {adding ? (
        <div className="max-w-3xl">
          <VideoAdd lessonId={lesson.id} onDone={onAdded} />
          {attached.length === 0 && <p className="mt-3 text-sm text-muted">Tip: pick a video about this page. Your Practice study plan will then point to the exact minute that explains what you got wrong.</p>}
        </div>
      ) : (
        <>
          <ErrorNotice error={error} onRetry={load} />
          {!video && !error && <Skeleton className="h-96" />}
          {video && <VideoView video={video} relevance={current?.relevance} jump={focus?.video === video.id ? focus : null} />}
        </>
      )}
    </div>
  )
}
