// A short note written for this attempt, in plain code: every number and fact comes from the results.
// (An AI coach can come later; this stays as its fallback, so nothing ever looks broken when AI is off.)
export function coachNote(report, previous) {
  const parts = []
  const weak = report.sections.filter((s) => s.weak)
  if (previous && previous.total) {
    const now = report.correct
    const was = previous.correct
    if (report.total === previous.total) {
      if (now > was) parts.push(`Up from ${was} to ${now} out of ${report.total} since last time.`)
      else if (now < was) parts.push(`${now} out of ${report.total} this time, ${was} last time.`)
      else parts.push(`${now} out of ${report.total} again.`)
    } else {
      parts.push(`${Math.round(report.score * 100)}% this time, ${Math.round(previous.score * 100)}% last time.`)
    }
    const again = weak.find((s) => (previous.weak || []).includes(s.heading))
    if (again) parts.push(`“${again.heading}” is still the part to practise.`)
  } else if (!weak.length) {
    parts.push(report.correct === report.total ? `All ${report.total} correct.` : `No weak areas: ${report.correct} of ${report.total} correct.`)
  }
  const fact = weak.flatMap((s) => s.missed_facts)[0]
  if (fact) parts.push(`Remember: ${fact.replace(/\s+/g, ' ').trim().replace(/([^.!?])$/, '$1.')}`)
  return parts.slice(0, 3).join(' ')
}
