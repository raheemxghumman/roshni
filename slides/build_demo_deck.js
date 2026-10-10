// 5-minute demo deck for AICON'26 Build With AI. Objects that continue across slides share a "!!" name,
// so PowerPoint's Morph transition moves and reshapes them (the lamp, the panel, the student cards, the stats).
// Morph transitions are applied afterwards with PowerPoint itself (see slides/README.md).
// Usage: node build_demo_deck.js <repo-root> <assets-dir-with deck-read.png + hard.jpg> <out.pptx>
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

async function icon(Comp, color, size = 256) {
  const svg = renderToStaticMarkup(React.createElement(Comp, { size, color: '#' + color }))
  return 'image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')
}

;(async () => {
  const pres = new pptxgen()
  pres.layout = 'LAYOUT_WIDE'
  pres.title = 'Roshni: One page. Every learner.'
  pres.author = '404 Team Not Found'
  pres.company = 'AICON 26 Build With AI'
  pres.theme = { headFontFace: HEAD, bodyFontFace: BODY }

  const ic = {
    ear: await icon(Lu.LuHeadphones, C.teal), book: await icon(Lu.LuBookOpen, C.cobalt), cap: await icon(Lu.LuCaptions, '7F5100'),
    scan: await icon(Lu.LuScanText, C.white), spark: await icon(Lu.LuSparkles, C.white), shield: await icon(Lu.LuShieldCheck, C.white), mic: await icon(Lu.LuMic, C.white),
    arrows: await icon(Lu.LuArrowLeftRight, C.cobalt), quote: await icon(Lu.LuQuote, C.cobalt), hash: await icon(Lu.LuHash, C.cobalt), wrench: await icon(Lu.LuWrench, C.cobalt),
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
    for (let i = 0; i < 7; i++) {
      const on = i === active
      slide.addShape(pres.shapes.OVAL, { x: 11.2 + i * 0.26, y: 7.0, w: on ? 0.17 : 0.11, h: on ? 0.17 : 0.11, fill: { color: on ? C.gold : dark ? C.dotDark : C.dotLight }, line: { color: on ? C.gold : dark ? C.dotDark : C.dotLight }, objectName: `!!dot-${i}` })
    }
  }
  const kicker = (slide, text, x, y, color, w = 9) => T(slide, text, { x, y, w, h: 0.35, fontSize: 13, bold: true, color, charSpacing: 3, objectName: '!!kicker' })
  const title = (slide, text, opts) => T(slide, text, { fontFace: HEAD, bold: true, objectName: '!!title', valign: 'top', ...opts })

  // The three student cards on slide 2 become their three learning modes on slide 3.
  function card(slide, i, { x, y, w, h, title: t, desc, ic: img, tint, iconDot = 0.9, titleX, titleY, titleW, descX, descY, descW, descH, titleSize = 20, descSize = 15 }) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.2, fill: { color: C.white }, line: { color: C.line, width: 1 }, shadow: { type: 'outer', color: '0D1B3E', opacity: 0.13, blur: 12, offset: 3, angle: 90 }, objectName: `!!card-${i}` })
    slide.addShape(pres.shapes.OVAL, { x: x + 0.35, y: y + (h > 2 ? 0.32 : (h - iconDot) / 2), w: iconDot, h: iconDot, fill: { color: tint }, line: { color: tint }, objectName: `!!cdot-${i}` })
    const iy = y + (h > 2 ? 0.32 : (h - iconDot) / 2) + iconDot * 0.24
    slide.addImage({ data: img, x: x + 0.35 + iconDot * 0.24, y: iy, w: iconDot * 0.52, h: iconDot * 0.52, objectName: `!!cicon-${i}` })
    T(slide, t, { x: titleX, y: titleY, w: titleW, h: 0.5, fontSize: titleSize, bold: true, color: C.ink, fontFace: HEAD, objectName: `!!ctitle-${i}` })
    T(slide, desc, { x: descX, y: descY, w: descW, h: descH, fontSize: descSize, color: C.muted, valign: 'top', objectName: `!!cdesc-${i}` })
  }

  // ---------------------------------------------------------------- 1. Title (0:00–0:20)
  let s = pres.addSlide()
  s.background = { color: C.ink }
  panel(s, { x: 0, y: 0, w: W, h: H, color: C.ink })
  lamp(s, 9.95, 3.7, 1.15)
  kicker(s, 'AICON’26 · BUILD WITH AI · EDTECH & WORKFORCE', 0.8, 1.45, C.gold)
  title(s, 'Roshni', { x: 0.8, y: 1.9, w: 6.5, h: 1.4, fontSize: 72, color: C.white })
  T(s, 'روشنی', { x: 0.8, y: 3.3, w: 3, h: 0.8, fontSize: 34, color: C.tealLight, fontFace: 'Arial', rtlMode: true, objectName: 'urdu' })
  T(s, 'One page. Every learner.', { x: 0.8, y: 4.25, w: 7.2, h: 0.7, fontSize: 30, color: C.white, fontFace: HEAD, objectName: 'tagline' })
  T(s, 'A photo of a textbook page becomes a lesson that blind, dyslexic and deaf students can use, and a second AI proves no fact was lost.', { x: 0.8, y: 5.05, w: 7.2, h: 0.95, fontSize: 17, color: C.mist, objectName: 'subtitle' })
  T(s, '404 Team Not Found', { x: 0.8, y: 6.45, w: 5, h: 0.4, fontSize: 15, bold: true, color: C.mist, objectName: 'team' })
  progress(s, 0, true)
  s.addNotes('[0:00–0:20] Hi, we are 404 Team Not Found. This is Roshni, which means light. One page, every learner: we turn a photo of any textbook page into a lesson that blind, dyslexic and deaf students can use, and a second AI proves no fact was lost.')

  // ---------------------------------------------------------------- 2. Problem (0:20–0:50)
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
    { title: 'Sara is dyslexic', desc: 'Long sentences and hard words lose her, and Urdu-medium students hit the same wall in English.', ic: ic.book, tint: C.soft },
    { title: 'Hamza is deaf', desc: 'He misses everything the teacher says while explaining the page.', ic: ic.cap, tint: C.goldSoft },
  ]
  learners.forEach((l, i) => {
    const y = 0.6 + i * 1.98
    card(s, i, { x: 5.4, y, w: 7.45, h: 1.75, title: l.title, desc: l.desc, ic: l.ic, tint: l.tint, titleX: 6.85, titleY: y + 0.3, titleW: 5.7, descX: 6.85, descY: y + 0.82, descW: 5.7, descH: 0.8 })
  })
  progress(s, 1, false)
  s.addNotes('[0:20–0:50] Three students, one class, one printed page. Bilal is blind, Sara is dyslexic, Hamza is deaf. The page works for none of them, and their teacher has no time to adapt every page three ways. About 1 in 6 people live with a significant disability, so this happens in every school.')

  // ---------------------------------------------------------------- 3. Solution + where AI is used (0:50–1:30)
  s = pres.addSlide()
  s.background = { color: C.chalk }
  panel(s, { x: 0, y: 0, w: W, h: 2.2, color: C.cobalt })
  lamp(s, 12.2, 1.1, 0.38)
  kicker(s, '02 · OUR SOLUTION, AND WHERE AI IS USED', 0.8, 0.45, C.gold)
  title(s, 'One photo in. Three ways to learn out.', { x: 0.8, y: 0.85, w: 10.6, h: 1.0, fontSize: 34, color: C.white })
  const steps = [
    { img: ic.scan, t: 'Read', d: 'Gemini reads the photo and describes every figure', color: C.cobalt },
    { img: ic.spark, t: 'Rewrite', d: 'Qwen rewrites it simply and explains hard words in Urdu', color: C.teal },
    { img: ic.shield, t: 'Check', d: 'Fact Guard, a different AI, verifies every fact', color: '0C8259' },
    { img: ic.mic, t: 'Transcribe', d: 'Whisper transcribes the lecture; voices read it all aloud', color: C.ink },
  ]
  steps.forEach((st, i) => {
    const x = 0.8 + i * 3.06
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.55, w: 2.86, h: 1.3, rectRadius: 0.16, fill: { color: C.white }, line: { color: C.line, width: 1 }, objectName: `step-${i}` })
    s.addShape(pres.shapes.OVAL, { x: x + 0.22, y: 2.77, w: 0.62, h: 0.62, fill: { color: st.color }, line: { color: st.color }, objectName: `step-dot-${i}` })
    s.addImage({ data: st.img, x: x + 0.37, y: 2.92, w: 0.32, h: 0.32, objectName: `step-icon-${i}` })
    T(s, st.t, { x: x + 1.0, y: 2.72, w: 1.35, h: 0.35, fontSize: 16, bold: true, color: C.ink, fontFace: HEAD, objectName: `step-t-${i}` })
    T(s, st.d, { x: x + 1.0, y: 3.07, w: 1.75, h: 0.72, fontSize: 12, color: C.muted, valign: 'top', objectName: `step-d-${i}` })
    T(s, 'AI', { x: x + 2.38, y: 2.62, w: 0.4, h: 0.24, fontSize: 9, bold: true, color: '7F5100', fill: { color: C.goldSoft }, align: 'center', valign: 'middle', objectName: `step-ai-${i}` })
  })
  const modes = [
    { title: 'Listen', desc: 'For Bilal: the page read aloud section by section, every figure described in words, full keyboard control.', ic: ic.ear, tint: C.tealSoft },
    { title: 'Read Easy', desc: 'For Sara: simpler text beside the original, Urdu help for hard words, read-aloud that highlights each sentence.', ic: ic.book, tint: C.soft },
    { title: 'Captions', desc: 'For Hamza: the lecture as a transcript synced to the audio, plus a summary checked against what was said.', ic: ic.cap, tint: C.goldSoft },
  ]
  modes.forEach((m, i) => {
    const x = 0.8 + i * 4.1
    card(s, i, { x, y: 4.2, w: 3.85, h: 2.55, title: m.title, desc: m.desc, ic: m.ic, tint: m.tint, iconDot: 0.8, titleX: x + 1.3, titleY: 4.62, titleW: 2.4, descX: x + 0.35, descY: 5.35, descW: 3.2, descH: 1.3, descSize: 14 })
  })
  progress(s, 2, false)
  s.addNotes('[0:50–1:30] Our solution: one photo in, three ways to learn out. AI is the pipeline, not a chat box. Gemini reads the page and describes every figure. Qwen rewrites it at an easier level with Urdu help. Fact Guard, a different AI family, checks every fact. Whisper captions the lecture. Bilal gets Listen, Sara gets Read Easy, Hamza gets Captions.')

  // ---------------------------------------------------------------- 4. Live demo (1:30–3:30)
  s = pres.addSlide()
  s.background = { color: C.ink }
  panel(s, { x: 0, y: 0, w: W, h: H, color: C.ink })
  lamp(s, 1.35, 1.25, 0.45)
  kicker(s, '03 · LIVE DEMO · 2 MINUTES', 2.6, 1.08, C.gold, 5)
  title(s, 'Watch a real page become a lesson', { x: 0.8, y: 2.1, w: 6.1, h: 1.4, fontSize: 32, color: C.white })
  const demo = [
    ['Photograph a printed page', 'Gemini reads it in about 5 seconds'],
    ['Read Easy', 'Read-aloud highlighting, Urdu help, Fact Guard badge'],
    ['Plant 3 errors', 'Fact Guard catches them and repairs the rewrite'],
    ['Listen and Captions', 'Figures described, lecture transcript synced'],
  ]
  demo.forEach(([t, d], i) => {
    const y = 3.75 + i * 0.78
    s.addShape(pres.shapes.OVAL, { x: 0.8, y: y + 0.04, w: 0.46, h: 0.46, fill: { color: C.gold }, line: { color: C.gold }, objectName: `demo-n-${i}` })
    T(s, String(i + 1), { x: 0.8, y: y + 0.04, w: 0.46, h: 0.46, fontSize: 15, bold: true, color: C.ink, align: 'center', valign: 'middle', objectName: `demo-num-${i}` })
    T(s, t, { x: 1.45, y: y - 0.02, w: 5.2, h: 0.36, fontSize: 18, bold: true, color: C.white, objectName: `demo-t-${i}` })
    T(s, d, { x: 1.45, y: y + 0.33, w: 5.2, h: 0.32, fontSize: 13, color: C.mist, objectName: `demo-d-${i}` })
  })
  const shot = path.join(ASSETS, 'deck-read.png')
  if (fs.existsSync(shot)) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.25, y: 1.35, w: 5.6, h: 3.6, rectRadius: 0.14, fill: { color: C.white }, line: { color: '2A3A6E', width: 1 }, objectName: 'shot-frame' })
    s.addImage({ path: shot, x: 7.33, y: 1.43, w: 5.44, h: 3.44, sizing: { type: 'cover', w: 5.44, h: 3.44 }, objectName: 'shot' })
    T(s, 'Backup if the Wi-Fi fails: the same pipeline on cached sample lessons (demo mode).', { x: 7.25, y: 5.15, w: 5.6, h: 0.6, fontSize: 13, color: C.mist, italic: true, objectName: 'shot-note' })
  }
  progress(s, 3, true)
  s.addNotes('[1:30–3:30] SWITCH TO THE APP. 1) Photograph the printed page and upload it (about 5 s). 2) Read Easy: press Read aloud, tap an underlined word for the Urdu explanation and audio, point at the Fact Guard badge. 3) Press Plant 3 errors: the cards flip to Caught, then the rewrite is repaired back to green. 4) Listen tab: Alt+N jumps sections, show a figure description. Captions tab: click a line to jump the audio. If anything is slow, open the cached physics sample instead.')

  // ---------------------------------------------------------------- 5. Fact Guard (3:30–4:00)
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
    { img: ic.wrench, t: 'Repair, then re-check', d: 'Only flagged sentences are rewritten. Anything left stays visibly amber.' },
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
  s.addNotes('[3:30–4:00] Simplifying text can quietly drop a fact or change a number, so we built Fact Guard. A different AI family checks the rewrite, every kept fact must be quoted, numbers are checked by plain code, and anything missing is repaired. You just saw it live. In testing it caught all planted errors with zero false alarms.')

  // ---------------------------------------------------------------- 6. Measured (4:00–4:35)
  s = pres.addSlide()
  s.background = { color: C.chalk }
  lamp(s, 12.35, 0.95, 0.3)
  kicker(s, '05 · MEASURED, NOT CLAIMED', 0.8, 0.6, C.teal, 7)
  title(s, 'Real textbook pages, real numbers', { x: 0.8, y: 0.98, w: 10, h: 0.9, fontSize: 30, color: C.ink })
  const tiles = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  ].map(({ x, y }) => ({ x: 0.8 + x * 4.1, y: 2.15 + y * 2.45 }))
  // tile 0 is the panel itself, morphing from the big Fact Guard panel
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
  T(s, 'OpenStax textbook pages (CC BY 4.0) · every number comes from a script in our repo’s eval/ folder · synthetic test data is labelled', { x: 0.8, y: 6.95, w: 10, h: 0.3, fontSize: 11, italic: true, color: C.muted, objectName: 'source' })
  progress(s, 5, false)
  s.addNotes('[4:00–4:35] Everything here is measured on real OpenStax textbook pages by scripts in our repo. Fact Guard caught every planted error with no false alarms. 99% of facts are verifiably kept. Reading level drops from grade 11 to about 6. It reads even this blurry, tilted photo almost perfectly, and a lesson takes under half a minute on free tiers.')

  // ---------------------------------------------------------------- 7. Impact + built here (4:35–5:00)
  s = pres.addSlide()
  s.background = { color: C.ink }
  panel(s, { x: 0, y: 0, w: W, h: H, color: C.ink })
  lamp(s, 10.25, 3.45, 1.1)
  kicker(s, '06 · WHO ADOPTS IT, AND WHAT WE BUILT', 0.8, 0.65, C.gold)
  title(s, 'One page. Every learner.', { x: 0.8, y: 1.05, w: 7.6, h: 1.0, fontSize: 40, color: C.white })
  const adopters = [
    'Special-education schools and inclusive-education NGOs',
    'Textbook boards and publishers making accessible editions',
    'School chains with Urdu-medium students in English classes',
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
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.95, w: 2.25, h: 1.1, rectRadius: 0.16, fill: { color: '17285A' }, line: { color: '2A3A6E', width: 1 }, objectName: `chip-${i}` })
    T(s, a, { x: x + 0.2, y: 5.05, w: 1.9, h: 0.45, fontSize: 20, bold: true, color: C.gold, fontFace: HEAD, objectName: `chip-a-${i}` })
    T(s, b, { x: x + 0.2, y: 5.5, w: 1.9, h: 0.45, fontSize: 12.5, color: C.mist, objectName: `chip-b-${i}` })
  })
  T(s, 'Next: a pilot with a special-education school. Thank you! Questions?', { x: 0.8, y: 6.35, w: 9.5, h: 0.45, fontSize: 18, bold: true, color: C.gold, objectName: 'close' })
  progress(s, 6, true)
  s.addNotes('[4:35–5:00] Who adopts it: special-education schools and NGOs, textbook boards, school chains with Urdu-medium students, and employers making training accessible. It costs nothing to run today and serves SDG 4.5. Everything you saw was built during AICON’26, with an AI coding assistant as the rules allow; our commit history shows it. Next is a pilot with a special-education school. Thank you!')

  await pres.writeFile({ fileName: OUT })
  console.log('wrote', OUT)
})()
