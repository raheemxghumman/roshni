import { ExternalLink, TriangleAlert } from 'lucide-react'
import { apiUrl } from '../lib/api'
import { Card, CardHeader, Pill } from '../components/ui'
import { ScanText } from 'lucide-react'

function Block({ b }) {
  if (b.type === 'figure') {
    return (
      <figure className="rounded-xl border border-line bg-surface-2 p-4">
        <figcaption className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent-ink">{b.text || 'Figure'} · description written by AI</figcaption>
        <p>{b.description}</p>
      </figure>
    )
  }
  if (b.type === 'table' && b.rows?.length) {
    return (
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-[15px]">
          <tbody>
            {b.rows.map((row, r) => (
              <tr key={r} className="border-b border-line last:border-0">
                {row.map((c, i) => (r === 0 ? <th key={i} className="bg-surface-2 px-3 py-2 font-semibold">{c}</th> : <td key={i} className="px-3 py-2">{c}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (b.type === 'equation') return <p className="rounded-lg bg-surface-2 px-3 py-2 font-mono">{b.text}</p>
  if (b.type === 'caption') return <p className="text-[0.9em] italic text-muted">{b.text}</p>
  if (b.type === 'heading') return <h3 className="font-semibold">{b.text}</h3>
  if (b.type === 'list') {
    return (
      <ul className="list-disc space-y-1 pl-6">
        {b.text.split('\n').filter(Boolean).map((li, i) => (
          <li key={i}>{li.replace(/^[-•*]\s*/, '')}</li>
        ))}
      </ul>
    )
  }
  return <p>{b.text}</p>
}

export default function Original({ lesson }) {
  const unclear = lesson.sections.flatMap((s) => s.blocks).filter((b) => b.unclear).length
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHeader icon={ScanText} title="The page as uploaded" subtitle="Compare anything here with the structured text" />
        <div className="space-y-4 bg-surface-2 p-4">
          {lesson.source.images.map((src, i) => (
            <a key={src} href={apiUrl(src)} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl border border-line bg-white">
              <img src={apiUrl(src)} alt={`Photo of the original page${lesson.source.images.length > 1 ? `, page ${i + 1}` : ''}`} className="w-full" />
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
                <ExternalLink className="size-3.5" aria-hidden /> Full size
              </span>
            </a>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader
          icon={ScanText}
          title="What Roshni read"
          subtitle="Exactly as on the page. Only figure descriptions are AI-written."
          action={unclear > 0 ? <Pill tone="warn" icon={TriangleAlert}>{unclear} unclear</Pill> : <Pill tone="ok">All text read</Pill>}
        />
        <div className="reading reading-surface space-y-6 p-5">
          {lesson.sections.map((s) => (
            <section key={s.id} aria-labelledby={`oh-${s.id}`} className="space-y-3">
              <h2 id={`oh-${s.id}`} className="text-[1.15em] font-semibold">
                {s.heading}
              </h2>
              {s.blocks.map((b) => (
                <Block key={b.id} b={b} />
              ))}
            </section>
          ))}
        </div>
      </Card>
    </div>
  )
}
