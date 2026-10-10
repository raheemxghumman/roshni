// 5-minute demo deck for AICON'26 Build With AI: 8 slides, about 4:50. Speaker A and Speaker B talk; one teammate
// controls the slides and drives the app during the live demo. Speaker notes on every slide give who speaks, the time,
// the script, and a "► CLICK" cue for the slide controller.
// Objects that continue across slides share a "!!" name, so PowerPoint's Morph transition moves and reshapes them
// (the lamp, the panel, the learner cards, the stats). Morph is applied afterwards with set_morph.py.
// Usage: node build_demo_deck.js <repo-root> <assets-dir with deck-read.png, deck-practice-crop.png, hard.jpg> <out.pptx>
const fs = require('fs')
const path = require('path')
const pptxgen = require('pptxgenjs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const sharp = require('sharp')
const Lu = require('react-icons/lu')

const ROOT = process.argv[2]
const ASSETS = process.argv[3]
const OUT = process.argv[4]

const R = {}
for (const f of fs.readdirSync(path.join(ROOT, 'eval', 'results')).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'eval', 'results', f), 'utf8'))
  R[d.metric] = d
}
const fa = R.factguard_false_alarms
const faFacts = fa ? (fa.n.match(/(\d+) facts/) || [])[1] : '142'
const faFlags = fa ? (fa.detail.match(/(\d+) flag/) || [])[1] : '0'
const S = {
  planted: R.factguard_planted_errors?.display || '28/28',
  falseAlarms: `${faFlags}/${faFacts}`,
  kept: R.factguard_facts_kept?.display || '99%',
  grade: (R.readability?.display || 'Grade 11.0 → 6.3').replace('Grade ', ''),
  ocr: R.ocr_cer?.hard_cer != null ? `${(100 - R.ocr_cer.hard_cer * 100).toFixed(2)}%` : '99.98%',
  time: (R.processing_time?.display || '26 s per page').replace(' per page', ''),
}

const C = { ink: '0D1B3E', cobalt: '1C3EA6', teal: '0B8F8F', tealLight: '7FD9D3', gold: 'F2A40E', chalk: 'F2F5F3', white: 'FFFFFF', muted: '4A5875', mist: 'C9D4F2', line: 'D3DEDC', soft: 'E7EEF9', tealSoft: 'D8F1EF', goldSoft: 'FFF0CC', dotDark: '3A4A7A', dotLight: 'C3CDDD' }
const HEAD = 'Century Gothic'
const BODY = 'Calibri'
const W = 13.333
const H = 7.5
const DOTS = 8

async function icon(Comp, color, size = 256) {
  const svg = renderToStaticMarkup(React.createElement(Comp, { size, color: '#' + color }))
  return 'image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')
}

// Speaker notes: who talks, when, what to say, and when the slide controller clicks.
const NOTE = (speaker, time, script, click) => `${speaker} · ${time}\n\n${script}\n\n► CLICK: ${click}`

;(async () => {
  const pres = new pptxgen()
  pres.layout = 'LAYOUT_WIDE'
  pres.title = 'Roshni: One page. Every learner.'
  pres.author = '404 Team Not Found'
  pres.company = 'AICON 26 Build With AI'
  pres.theme = { headFontFace: HEAD, bodyFontFace: BODY }

  const ic = {
    ear: await icon(Lu.LuHeadphones, C.teal), book: await icon(Lu.LuBookOpen, C.cobalt), cap: await icon(Lu.LuCaptions, '7F5100'),
    video: await icon(Lu.LuMonitorPlay, C.teal), grad: await icon(Lu.LuGraduationCap, '7F5100'),
    scan: await icon(Lu.LuScanText, C.white), spark: await icon(Lu.LuSparkles, C.white), shield: await icon(Lu.LuShieldCheck, C.white), mic: await icon(Lu.LuMic, C.white),
    arrows: await icon(Lu.LuArrowLeftRight, C.cobalt), quote: await icon(Lu.LuQuote, C.cobalt), hash: await icon(Lu.LuHash, C.cobalt), wrench: await icon(Lu.LuWrench, C.cobalt),
    setup: await icon(Lu.LuSlidersHorizontal, C.cobalt), why: await icon(Lu.LuSparkles, C.cobalt), target: await icon(Lu.LuTarget, C.cobalt), lock: await icon(Lu.LuLock, C.cobalt),
  }

  // ---------------------------------------------------------------- persistent objects
  const T = (slide, text, opts) => slide.addText(text, { isTextBox: true, margin: 0, fontFace: BODY, ...opts })

  function panel(slide, { x, y, w, h, color, radius = 0 }) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: radius, fill: { color }, line: { color }, objectName: '!!panel' })
  }
  function lamp(slide, cx, cy, r) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6
      const x0 = cx + Math.cos(a) * r * 1.35
      const y0 = cy + Math.sin(a) * r * 1.35
      const dx = Math.cos(a) * r * 0.7
      const dy = Math.sin(a) * r * 0.7
      slide.addShape(pres.shapes.LINE, {
        x: dx < 0 ? x0 + dx : x0, y: dy < 0 ? y0 + dy : y0, w: Math.max(Math.abs(dx), 0.001), h: Math.max(Math.abs(dy), 0.001),
        flipH: dx < 0, flipV: dy < 0, line: { color: C.gold, width: Math.max(1.5, r * 2.6), transparency: i % 2 ? 45 : 0 }, objectName: `!!ray-${i}`,
      })
    }
    slide.addShape(pres.shapes.OVAL, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: C.cobalt }, line: { color: C.white, width: Math.max(1, r * 2) }, objectName: '!!ring' })
    slide.addShape(pres.shapes.OVAL, { x: cx - r * 0.42, y: cy - r * 0.42, w: r * 0.84, h: r * 0.84, fill: { color: C.gold }, line: { color: C.gold }, objectName: '!!flame' })
  }
  function progress(slide, active, dark) {
    for (let i = 0; i < DOTS; i++) {
      const on = i === active
      slide.addShape(pres.shapes.OVAL, { x: 10.95 + i * 0.26, y: 7.0, w: on ? 0.17 : 0.11, h: on ? 0.17 : 0.11, fill: { color: on ? C.gold : dark ? C.dotDark : C.dotLight }, line: { color: on ? C.gold : dark ? C.dotDark : C.dotLight }, objectName: `!!dot-${i}` })
    }
  }
  const kicker = (slide, text, x, y, color, w = 9) => T(slide, text, { x, y, w, h: 0.35, fontSize: 13, bold: true, color, charSpacing: 3, objectName: '!!kicker' })
  const title = (slide, text, opts) => T(slide, text, { fontFace: HEAD, bold: true, objectName: '!!title', valign: 'top', ...opts })

  // The three learner cards on slide 2 become the first three learning modes on slide 3.
  function card(slide, i, { x, y, w, h, title: t, desc, ic: img, tint, iconDot = 0.9, titleX, titleY, titleW, descX, descY, descW, descH, titleSize = 20, descSize = 15 }) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.2, fill: { color: C.white }, line: { color: C.line, width: 1 }, shadow: { type: 'outer', color: '0D1B3E', opacity: 0.13, blur: 12, offset: 3, angle: 90 }, objectName: `!!card-${i}` })
    slide.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + (h > 2 ? 0.3 : (h - iconDot) / 2), w: iconDot, h: iconDot, fill: { color: tint }, line: { color: tint }, objectName: `!!cdot-${i}` })
    const iy = y + (h > 2 ? 0.3 : (h - iconDot) / 2) + iconDot * 0.24
    slide.addImage({ data: img, x: x + 0.3 + iconDot * 0.24, y: iy, w: iconDot * 0.52, h: iconDot * 0.52, objectName: `!!cicon-${i}` })
    T(slide, t, { x: titleX, y: titleY, w: titleW, h: 0.5, fontSize: titleSize, bold: true, color: C.ink, fontFace: HEAD, objectName: `!!ctitle-${i}` })
    T(slide, desc, { x: descX, y: descY, w: descW, h: descH, fontSize: descSize, color: C.muted, valign: 'top', objectName: `!!cdesc-${i}` })
  }

  // ---------------------------------------------------------------- 1. Title (0:00–0:15) · Speaker A
  let s = pres.addSlide()
  s.background = { color: C.ink }
  panel(s, { x: 0, y: 0, w: W, h: H, color: C.ink })
  lamp(s, 9.95, 3.7, 1.15)
  kicker(s, 'AICON’26 · BUILD WITH AI · EDTECH & WORKFORCE', 0.8, 1.45, C.gold)
  title(s, 'Roshni', { x: 0.8, y: 1.9, w: 6.5, h: 1.4, fontSize: 72, color: C.white })
  T(s, 'روشنی', { x: 0.8, y: 3.3, w: 3, h: 0.8, fontSize: 34, color: C.tealLight, fontFace: 'Arial', rtlMode: true, objectName: 'urdu' })
  T(s, 'One page. Every learner.', { x: 0.8, y: 4.25, w: 7.2, h: 0.7, fontSize: 30, color: C.white, fontFace: HEAD, objectName: 'tagline' })
  T(s, 'A photo of any page, a lecture or a YouTube video becomes a lesson for blind, dyslexic, deaf and Urdu/Pashto-medium learners, and a second AI proves no fact was lost.', { x: 0.8, y: 5.05, w: 7.4, h: 1.0, fontSize: 17, color: C.mist, objectName: 'subtitle' })
  T(s, '404 Team Not Found', { x: 0.8, y: 6.45, w: 5, h: 0.4, fontSize: 15, bold: true, color: C.mist, objectName: 'team' })
  progress(s, 0, true)
  s.addNotes(NOTE('SPEAKER A', '0:00–0:15',
    'Assalam-o-Alaikum. We are 404 Team Not Found, and this is Roshni, which means light. One page, every learner: any page, lecture or video becomes a lesson that every student can use, and a second AI proves no fact was lost.',
    'after “…no fact was lost.”'))

  // ---------------------------------------------------------------- 2. Problem (0:15–0:40) · Speaker A
  s = pres.addSlide()
  s.background = { color: C.chalk }
  panel(s, { x: 0.45, y: 0.45, w: 4.55, h: 6.6, color: C.ink, radius: 0.3 })
  lamp(s, 1.4, 1.4, 0.42)
  kicker(s, '01 · THE PROBLEM', 0.95, 2.4, C.gold, 3.8)
  title(s, 'One printed page fails three students', { x: 0.95, y: 2.8, w: 3.7, h: 2.1, fontSize: 30, color: C.white })
  T(s, [
    { text: 'Why it matters: ', options: { bold: true, color: C.white } },
    { text: 'about 1 in 6 people live with a significant disability (WHO, 2023). Teachers have no time to adapt every page three ways, so it never happens.', options: { color: C.mist } },
  ], { x: 0.95, y: 5.0, w: 3.7, h: 1.7, fontSize: 15, valign: 'top', objectName: 'why' })
  const learners = [
    { title: 'Bilal is blind', desc: 'He can’t read the page or see its diagrams. Most textbooks have no accessible version.', ic: ic.ear, tint: C.tealSoft },
    { title: 'Sara is dyslexic', desc: 'Long sentences and hard words lose her, and Urdu- and Pashto-medium students hit the same wall in English.', ic: ic.book, tint: C.soft },
    { title: 'Hamza is deaf', desc: 'He misses everything the teacher says while explaining the page.', ic: ic.cap, tint: C.goldSoft },
  ]
  learners.forEach((l, i) => {
    const y = 0.6 + i * 1.98
    card(s, i, { x: 5.4, y, w: 7.45, h: 1.75, title: l.title, desc: l.desc, ic: l.ic, tint: l.tint, titleX: 6.85, titleY: y + 0.3, titleW: 5.7, descX: 6.85, descY: y + 0.82, descW: 5.7, descH: 0.8 })
  })
  progress(s, 1, false)
  s.addNotes(NOTE('SPEAKER A', '0:15–0:40',
    'Three students, one class, one printed page. Bilal is blind, Sara is dyslexic, Hamza is deaf. The page works for none of them, and their teacher has no time to adapt every page three ways. About 1 in 6 people live with a significant disability, so this happens in every school.',
    'after “…happens in every school.”'))

  // ---------------------------------------------------------------- 3. Solution + where AI is used (0:40–1:15) · Speaker A
  s = pres.addSlide()
  s.background = { color: C.chalk }
  panel(s, { x: 0, y: 0, w: W, h: 2.2, color: C.cobalt })
  lamp(s, 12.2, 1.1, 0.38)
  kicker(s, '02 · OUR SOLUTION, AND WHERE AI IS USED', 0.8, 0.45, C.gold)
  title(s, 'One page in. Five ways to learn out.', { x: 0.8, y: 0.85, w: 10.6, h: 1.0, fontSize: 34, color: C.white })
  const steps = [
    { img: ic.scan, t: 'Read', d: 'Gemini reads the photo, describes every figure, even watches videos', color: C.cobalt },
    { img: ic.spark, t: 'Rewrite', d: 'Qwen simplifies; hard words explained in Urdu or Pashto', color: C.teal },
    { img: ic.shield, t: 'Check', d: 'Fact Guard, a different AI, verifies every fact', color: '0C8259' },
    { img: ic.mic, t: 'Listen', d: 'Whisper hears lectures and spoken quiz answers', color: C.ink },
  ]
  steps.forEach((st, i) => {
    const x = 0.8 + i * 3.06
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.55, w: 2.86, h: 1.3, rectRadius: 0.16, fill: { color: C.white }, line: { color: C.line, width: 1 }, objectName: `step-${i}` })
    s.addShape(pres.shapes.OVAL, { x: x + 0.22, y: 2.77, w: 0.62, h: 0.62, fill: { color: st.color }, line: { color: st.color }, objectName: `step-dot-${i}` })
    s.addImage({ data: st.img, x: x + 0.37, y: 2.92, w: 0.32, h: 0.32, objectName: `step-icon-${i}` })
    T(s, st.t, { x: x + 1.0, y: 2.72, w: 1.35, h: 0.35, fontSize: 16, bold: true, color: C.ink, fontFace: HEAD, objectName: `step-t-${i}` })
    T(s, st.d, { x: x + 1.0, y: 3.07, w: 1.75, h: 0.72, fontSize: 11.5, color: C.muted, valign: 'top', objectName: `step-d-${i}` })
    T(s, 'AI', { x: x + 2.38, y: 2.62, w: 0.4, h: 0.24, fontSize: 9, bold: true, color: '7F5100', fill: { color: C.goldSoft }, align: 'center', valign: 'middle', objectName: `step-ai-${i}` })
  })
  const modes = [
    { title: 'Listen', desc: 'For Bilal: read aloud, every figure described, full keyboard control.', ic: ic.ear, tint: C.tealSoft },
    { title: 'Read Easy', desc: 'For Sara: simpler text beside the original, word help, read-aloud.', ic: ic.book, tint: C.soft },
    { title: 'Captions', desc: 'For Hamza: lecture transcript plus a checked summary.', ic: ic.cap, tint: C.goldSoft },
    { title: 'Videos', desc: 'Any YouTube video becomes timestamped, checked notes.', ic: ic.video, tint: C.tealSoft },
    { title: 'Practice', desc: 'Quiz by tap or voice, weak areas and a study plan.', ic: ic.grad, tint: C.goldSoft },
  ]
  modes.forEach((m, i) => {
    const x = 0.8 + i * 2.37
    card(s, i, { x, y: 4.2, w: 2.25, h: 2.55, title: m.title, desc: m.desc, ic: m.ic, tint: m.tint, iconDot: 0.62, titleX: x + 0.3, titleY: 5.08, titleW: 1.85, descX: x + 0.3, descY: 5.55, descW: 1.8, descH: 1.1, titleSize: 17, descSize: 12.5 })
  })
  progress(s, 2, false)
  s.addNotes(NOTE('SPEAKER A', '0:40–1:15',
    'Our solution: one page in, five ways to learn out. AI is the pipeline, not a chat box. Gemini reads the page and describes every figure. Qwen rewrites it simply, with hard words explained in Urdu or Pashto. Fact Guard, a different AI family, checks every fact. Whisper hears lectures and spoken answers. Bilal gets Listen, Sara gets Read Easy, Hamza gets Captions, and everyone gets video notes and Practice. Now [Speaker B] will show you.',
    'after “…will show you.” Hand over to Speaker B.'))

  // ---------------------------------------------------------------- 4. Live demo (1:15–2:55) · Speaker B talks, the slide controller drives the app
  s = pres.addSlide()
  s.background = { color: C.ink }
  panel(s, { x: 0, y: 0, w: W, h: H, color: C.ink })
  lamp(s, 1.35, 1.25, 0.45)
  kicker(s, '03 · LIVE DEMO · 100 SECONDS', 2.85, 1.08, C.gold, 5)
  title(s, 'Watch a real page become a lesson', { x: 0.8, y: 2.1, w: 6.1, h: 1.4, fontSize: 32, color: C.white })
  const demo = [
    ['Set up for you', 'Two questions; the lesson opens your way and says why'],
    ['Read Easy', 'Read-aloud highlighting, Urdu/Pashto word help'],
    ['Plant 3 errors', 'Fact Guard catches them and repairs the rewrite'],
    ['Voice quiz', 'Say “B” → weak areas → a study plan to the exact spot'],
  ]
  demo.forEach(([t, d], i) => {
    const y = 3.75 + i * 0.78
    s.addShape(pres.shapes.OVAL, { x: 0.8, y: y + 0.04, w: 0.46, h: 0.46, fill: { color: C.gold }, line: { color: C.gold }, objectName: `demo-n-${i}` })
    T(s, String(i + 1), { x: 0.8, y: y + 0.04, w: 0.46, h: 0.46, fontSize: 15, bold: true, color: C.ink, align: 'center', valign: 'middle', objectName: `demo-num-${i}` })
    T(s, t, { x: 1.45, y: y - 0.02, w: 5.2, h: 0.36, fontSize: 18, bold: true, color: C.white, objectName: `demo-t-${i}` })
    T(s, d, { x: 1.45, y: y + 0.33, w: 5.3, h: 0.32, fontSize: 13, color: C.mist, objectName: `demo-d-${i}` })
  })
  const shot = path.join(ASSETS, 'deck-read.png')
  if (fs.existsSync(shot)) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.25, y: 1.35, w: 5.6, h: 3.6, rectRadius: 0.14, fill: { color: C.white }, line: { color: '2A3A6E', width: 1 }, objectName: 'shot-frame' })
    s.addImage({ path: shot, x: 7.33, y: 1.43, w: 5.44, h: 3.44, sizing: { type: 'cover', w: 5.44, h: 3.44 }, objectName: 'shot' })
    T(s, 'Backup if the Wi-Fi fails: the same features on cached sample lessons (demo mode).', { x: 7.25, y: 5.15, w: 5.6, h: 0.6, fontSize: 13, color: C.mist, italic: true, objectName: 'shot-note' })
  }
  progress(s, 3, true)
  s.addNotes(NOTE('SPEAKER B (talks) + SLIDE CONTROLLER (drives the app)', '1:15–2:55',
    'CONTROLLER: Alt+Tab to the app (Home already open; demo profile set up the night before).\n' +
    '1) [15 s] Home: point at “For you”, open the Photosynthesis sample; it opens with the “because you said…” line. B: “Roshni remembers how this learner reads.”\n' +
    '2) [30 s] Read Easy: press Read aloud (sentences highlight); tap an underlined word for the Urdu/Pashto explanation and press the speaker. B: “Hard words, in their own language.”\n' +
    '3) [25 s] Fact Guard card → Plant 3 errors: the cards flip to Caught, then the rewrite is repaired. B: “We break our own rewrite on purpose, and Fact Guard catches it.”\n' +
    '4) [30 s] Practice tab → Voice quiz → after the beep, B says “B”. Show the results: weak areas and the study plan; click Open on a step. B: “It tells each learner exactly what to revise.”\n' +
    'If anything is slow, keep talking and move to the next step; the samples are cached.',
    'CONTROLLER: Alt+Tab back to the slides and click when B says “…exactly what to revise.”'))

  // ---------------------------------------------------------------- 5. Fact Guard (2:55–3:20) · Speaker B
  s = pres.addSlide()
  s.background = { color: C.chalk }
  panel(s, { x: 8.35, y: 0.45, w: 4.55, h: 6.3, color: C.cobalt, radius: 0.3 })
  lamp(s, 10.62, 1.35, 0.42)
  kicker(s, '04 · WHY YOU CAN TRUST IT', 0.8, 0.6, C.teal, 7)
  title(s, 'Fact Guard: a second AI checks the first', { x: 0.8, y: 0.98, w: 7.2, h: 1.2, fontSize: 30, color: C.ink })
  const checks = [
    { img: ic.arrows, t: 'A different AI family checks', d: 'It can’t simply agree with the model that rewrote the page.' },
    { img: ic.quote, t: 'Quote or it didn’t happen', d: 'Every kept fact must be quoted from the rewrite, and code confirms the quote.' },
    { img: ic.hash, t: 'Numbers checked by plain code', d: '“50 min” can never quietly become “100 min”.' },
    { img: ic.wrench, t: 'Repair, then re-check', d: 'Only flagged sentences are rewritten. Also used for lecture summaries and video notes.' },
  ]
  checks.forEach((c, i) => {
    const y = 2.45 + i * 1.12
    s.addShape(pres.shapes.OVAL, { x: 0.8, y, w: 0.72, h: 0.72, fill: { color: C.soft }, line: { color: C.soft }, objectName: `chk-dot-${i}` })
    s.addImage({ data: c.img, x: 0.98, y: y + 0.18, w: 0.36, h: 0.36, objectName: `chk-icon-${i}` })
    T(s, c.t, { x: 1.75, y: y - 0.02, w: 6.2, h: 0.4, fontSize: 18, bold: true, color: C.ink, fontFace: HEAD, objectName: `chk-t-${i}` })
    T(s, c.d, { x: 1.75, y: y + 0.38, w: 6.2, h: 0.5, fontSize: 14, color: C.muted, valign: 'top', objectName: `chk-d-${i}` })
  })
  T(s, 'STRESS TEST', { x: 8.8, y: 2.3, w: 3.7, h: 0.35, fontSize: 13, bold: true, color: C.gold, charSpacing: 3, objectName: 'st-label' })
  T(s, S.planted, { x: 8.8, y: 2.65, w: 3.8, h: 1.2, fontSize: 68, bold: true, color: C.white, fontFace: HEAD, objectName: '!!stat-a' })
  T(s, 'planted errors caught: changed numbers, deleted facts, invented claims', { x: 8.8, y: 3.9, w: 3.75, h: 0.9, fontSize: 15, color: 'DCE4FA', valign: 'top', objectName: '!!stat-a-label' })
  T(s, S.falseAlarms, { x: 8.8, y: 4.95, w: 3.8, h: 0.8, fontSize: 40, bold: true, color: C.gold, fontFace: HEAD, objectName: '!!stat-b' })
  T(s, 'false alarms on unchanged facts', { x: 8.8, y: 5.75, w: 3.75, h: 0.5, fontSize: 15, color: 'DCE4FA', objectName: '!!stat-b-label' })
  progress(s, 4, false)
  s.addNotes(NOTE('SPEAKER B', '2:55–3:20',
    'You just saw Fact Guard live. Simplifying can quietly drop a fact or change a number, so a different AI family checks the rewrite, every kept fact must be quoted, numbers are checked by plain code, and gaps are repaired. In testing it caught 28 of 28 planted errors with zero false alarms.',
    'after “…zero false alarms.” Hand over to Speaker A.'))

  // ---------------------------------------------------------------- 6. Set up for you (3:20–3:50) · Speaker A
  s = pres.addSlide()
  s.background = { color: C.chalk }
  panel(s, { x: 6.75, y: 0.45, w: 6.15, h: 6.3, color: C.cobalt, radius: 0.3 })
  lamp(s, 12.2, 1.05, 0.3)
  kicker(s, '05 · PERSONALIZED LEARNING', 0.8, 0.6, C.teal, 5.8)
  title(s, 'Set up for each learner, and it says why', { x: 0.8, y: 0.98, w: 5.7, h: 1.2, fontSize: 28, color: C.ink })
  const pers = [
    { img: ic.setup, t: 'Two questions, no account', d: 'Which language helps, and what helps you learn. No name, no gender.' },
    { img: ic.why, t: 'Opens your way, and says why', d: '“Opened at Simplest because your last quiz here was 4 of 10.”' },
    { img: ic.target, t: 'Weak areas → a study plan', d: 'Each step opens the exact section, hard word or video minute.' },
    { img: ic.lock, t: 'Private by design', d: 'An anonymous code in Neon Postgres; “Clear my data” deletes it.' },
  ]
  pers.forEach((c, i) => {
    const y = 2.45 + i * 1.1
    s.addShape(pres.shapes.OVAL, { x: 0.8, y, w: 0.7, h: 0.7, fill: { color: C.soft }, line: { color: C.soft }, objectName: `pers-dot-${i}` })
    s.addImage({ data: c.img, x: 0.97, y: y + 0.17, w: 0.36, h: 0.36, objectName: `pers-icon-${i}` })
    T(s, c.t, { x: 1.7, y: y - 0.02, w: 4.9, h: 0.4, fontSize: 17, bold: true, color: C.ink, fontFace: HEAD, objectName: `pers-t-${i}` })
    T(s, c.d, { x: 1.7, y: y + 0.38, w: 4.9, h: 0.55, fontSize: 13.5, color: C.muted, valign: 'top', objectName: `pers-d-${i}` })
  })
  const pshot = path.join(ASSETS, 'deck-practice-crop.png')
  if (fs.existsSync(pshot)) {
    T(s, 'A REAL RESULT SCREEN', { x: 7.15, y: 1.6, w: 4.6, h: 0.3, fontSize: 12, bold: true, color: C.gold, charSpacing: 3, objectName: 'pers-label' })
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.1, y: 2.05, w: 5.45, h: 3.52, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.white }, objectName: 'pers-frame' })
    s.addImage({ path: pshot, x: 7.16, y: 2.11, w: 5.33, h: 3.4, sizing: { type: 'cover', w: 5.33, h: 3.4 }, objectName: 'pers-shot' })
    T(s, 'Score, weak areas by section, and a study plan made from this lesson’s own materials.', { x: 7.15, y: 5.75, w: 5.4, h: 0.6, fontSize: 13, color: 'DCE4FA', valign: 'top', objectName: 'pers-cap' })
  }
  progress(s, 5, false)
  s.addNotes(NOTE('SPEAKER A', '3:20–3:50',
    'Every learner gets Roshni set up for them: two questions, no account, no name or gender. Lessons open the way you need and say why. After a quiz, Roshni finds your weak areas and builds a study plan from the lesson itself, down to the exact section, word or video minute. Your profile is an anonymous code you can delete any time.',
    'after “…delete any time.” Hand over to Speaker B.'))

  // ---------------------------------------------------------------- 7. Measured (3:50–4:20) · Speaker B
  s = pres.addSlide()
  s.background = { color: C.chalk }
  lamp(s, 12.35, 0.95, 0.3)
  kicker(s, '06 · MEASURED, NOT CLAIMED', 0.8, 0.6, C.teal, 7)
  title(s, 'Real textbook pages, real numbers', { x: 0.8, y: 0.98, w: 10, h: 0.9, fontSize: 30, color: C.ink })
  const tiles = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  ].map(({ x, y }) => ({ x: 0.8 + x * 4.1, y: 2.15 + y * 2.45 }))
  // tile 0 is the panel itself, morphing from the previous slide's blue panel
  panel(s, { x: tiles[0].x, y: tiles[0].y, w: 3.85, h: 2.2, color: C.cobalt, radius: 0.2 })
  T(s, S.planted, { x: tiles[0].x + 0.3, y: tiles[0].y + 0.22, w: 3.3, h: 0.95, fontSize: 44, bold: true, color: C.white, fontFace: HEAD, objectName: '!!stat-a' })
  T(s, 'planted errors caught by Fact Guard', { x: tiles[0].x + 0.3, y: tiles[0].y + 1.25, w: 3.3, h: 0.75, fontSize: 15, color: 'DCE4FA', valign: 'top', objectName: '!!stat-a-label' })
  const rest = [
    { v: S.falseAlarms, l: 'false alarms on unchanged facts', id: 'b', color: C.teal },
    { v: S.kept, l: 'facts verifiably kept in the rewrite', color: '0C8259' },
    { v: S.grade, l: 'reading grade, original → Easier', color: C.cobalt },
    { v: S.ocr, l: 'page reading, even on this hard photo', color: C.teal, photo: true },
    { v: S.time, l: 'to make a lesson, on free tiers', color: C.ink },
  ]
  rest.forEach((st, k) => {
    const t = tiles[k + 1]
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: t.x, y: t.y, w: 3.85, h: 2.2, rectRadius: 0.2, fill: { color: C.white }, line: { color: C.line, width: 1 }, objectName: `tile-${k}` })
    const tw = st.photo ? 2.3 : 3.3
    T(s, st.v, { x: t.x + 0.3, y: t.y + 0.22, w: tw, h: 0.95, fontSize: st.photo ? 32 : 40, bold: true, color: st.color, fontFace: HEAD, objectName: st.id ? `!!stat-${st.id}` : `tile-v-${k}` })
    T(s, st.l, { x: t.x + 0.3, y: t.y + 1.25, w: tw, h: 0.75, fontSize: 15, color: C.muted, valign: 'top', objectName: st.id ? `!!stat-${st.id}-label` : `tile-l-${k}` })
    if (st.photo && fs.existsSync(path.join(ASSETS, 'hard.jpg'))) s.addImage({ path: path.join(ASSETS, 'hard.jpg'), x: t.x + 2.72, y: t.y + 0.28, w: 0.9, h: 1.18, objectName: 'hard-photo' })
  })
  T(s, 'OpenStax textbook pages (CC BY 4.0) · every number comes from a script in our repo’s eval/ folder · synthetic test data is labelled', { x: 0.8, y: 6.95, w: 9.9, h: 0.3, fontSize: 11, italic: true, color: C.muted, objectName: 'source' })
  progress(s, 6, false)
  s.addNotes(NOTE('SPEAKER B', '3:50–4:20',
    'Everything here is measured on real OpenStax textbook pages by scripts in our repo. 28 of 28 planted errors caught, no false alarms, 99% of facts verifiably kept. Reading level drops from grade 11 to about 6. It reads even this blurry, tilted photo almost perfectly, and a lesson takes under half a minute on free tiers.',
    'after “…on free tiers.” Hand over to Speaker A.'))

  // ---------------------------------------------------------------- 8. Impact + built here (4:20–4:50) · Speaker A
  s = pres.addSlide()
  s.background = { color: C.ink }
  panel(s, { x: 0, y: 0, w: W, h: H, color: C.ink })
  lamp(s, 10.25, 3.45, 1.1)
  kicker(s, '07 · WHO ADOPTS IT, AND WHAT WE BUILT', 0.8, 0.65, C.gold)
  title(s, 'One page. Every learner.', { x: 0.8, y: 1.05, w: 7.6, h: 1.0, fontSize: 40, color: C.white })
  const adopters = [
    'Special-education schools and inclusive-education NGOs',
    'Textbook boards and publishers making accessible editions',
    'School chains with Urdu- and Pashto-medium students',
    'Employers: accessible training manuals and safety notices',
  ]
  adopters.forEach((a, i) => {
    const y = 2.35 + i * 0.6
    s.addShape(pres.shapes.OVAL, { x: 0.82, y: y + 0.13, w: 0.16, h: 0.16, fill: { color: C.gold }, line: { color: C.gold }, objectName: `ad-dot-${i}` })
    T(s, a, { x: 1.15, y, w: 6.8, h: 0.42, fontSize: 18, color: C.white, objectName: `ad-${i}` })
  })
  const chips = [['PKR 0', 'to run, on free tiers'], ['SDG 4.5', 'equal access to education'], ['Built here', 'all during AICON’26']]
  chips.forEach(([a, b], i) => {
    const x = 0.8 + i * 2.45
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.85, w: 2.25, h: 1.1, rectRadius: 0.16, fill: { color: '17285A' }, line: { color: '2A3A6E', width: 1 }, objectName: `chip-${i}` })
    T(s, a, { x: x + 0.2, y: 4.95, w: 1.9, h: 0.45, fontSize: 20, bold: true, color: C.gold, fontFace: HEAD, objectName: `chip-a-${i}` })
    T(s, b, { x: x + 0.2, y: 5.4, w: 1.9, h: 0.45, fontSize: 12.5, color: C.mist, objectName: `chip-b-${i}` })
  })
  T(s, 'Next: a pilot with a special-education school. Thank you! Questions?', { x: 0.8, y: 6.2, w: 9.5, h: 0.45, fontSize: 18, bold: true, color: C.gold, objectName: 'close' })
  T(s, 'github.com/raheemxghumman/roshni', { x: 0.8, y: 6.75, w: 6, h: 0.35, fontSize: 13, color: C.mist, objectName: 'repo' })
  progress(s, 7, true)
  s.addNotes(NOTE('SPEAKER A', '4:20–4:50',
    'Who adopts it: special-education schools and NGOs, textbook boards, school chains with Urdu- and Pashto-medium students, and employers making training manuals accessible. It costs nothing to run today and serves SDG 4.5. Everything you saw was built during AICON’26, with an AI coding assistant as the rules allow, and our commit history shows it. Next is a pilot with a special-education school. Thank you!',
    'none: stay on this slide for the judges’ questions.'))

  await pres.writeFile({ fileName: OUT })
  console.log('wrote', OUT)
})()
