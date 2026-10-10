// Builds slides/Roshni-AICON26.pptx from the real evaluation results in eval/results/*.json.
const fs = require('fs')
const path = require('path')
const pptxgen = require('pptxgenjs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const sharp = require('sharp')
const Lu = require('react-icons/lu')
const { applyTheme } = require(process.env.SKILL_DIR + '/scripts/apply_theme.js')

const ROOT = process.argv[2]
const OUT = process.env.OUT || path.join(ROOT, 'slides', 'Roshni-AICON26.pptx')
const SHOTS = process.argv[3]

const R = {}
for (const f of fs.readdirSync(path.join(ROOT, 'eval', 'results')).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'eval', 'results', f), 'utf8'))
  R[d.metric] = d
}
const val = (k, fallback = '—') => (R[k] ? R[k].display : fallback)

const THEME = {
  name: 'Roshni',
  headFontFace: 'Century Gothic',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '0D1B3E', lt1: 'FFFFFF', dk2: '1C3EA6', lt2: 'F2F5F3',
    accent1: '1C3EA6', accent2: '0B8F8F', accent3: 'F2A40E', accent4: '0C8259', accent5: 'BE3248', accent6: '4A5875',
    hlink: '1C3EA6', folHlink: '0B8F8F',
  },
}
const HEX = { ink: '0D1B3E', cobalt: '1C3EA6', teal: '0B8F8F', gold: 'F2A40E', green: '0C8259', rose: 'BE3248', muted: '4A5875', chalk: 'F2F5F3', line: 'D3DEDC', white: 'FFFFFF', soft: 'E7EEF9', tealSoft: 'D8F1EF', goldSoft: 'FFF0CC' }

async function icon(Comp, color = '#FFFFFF', size = 256) {
  const svg = renderToStaticMarkup(React.createElement(Comp, { size, color }))
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  return 'image/png;base64,' + png.toString('base64')
}

;(async () => {
  const pres = new pptxgen()
  const drawLamp = (slide, cx, cy) => {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6
      const x0 = cx + Math.cos(a) * 0.95
      const y0 = cy + Math.sin(a) * 0.95
      const dx = Math.cos(a) * 0.55
      const dy = Math.sin(a) * 0.55
      // sizes must be positive: move the box and flip it for rays pointing left or up
      slide.addShape(pres.shapes.LINE, { x: dx < 0 ? x0 + dx : x0, y: dy < 0 ? y0 + dy : y0, w: Math.max(Math.abs(dx), 0.001), h: Math.max(Math.abs(dy), 0.001),
        flipH: dx < 0, flipV: dy < 0, line: { color: HEX.gold, width: 3, transparency: i % 2 ? 50 : 0 }, objectName: `ray-${i}` })
    }
    slide.addShape(pres.shapes.OVAL, { x: cx - 0.7, y: cy - 0.7, w: 1.4, h: 1.4, fill: { color: HEX.cobalt }, line: { color: HEX.cobalt }, objectName: 'lamp' })
    slide.addShape(pres.shapes.OVAL, { x: cx - 0.3, y: cy - 0.3, w: 0.6, h: 0.6, fill: { color: HEX.gold }, line: { color: HEX.gold }, objectName: 'flame' })
  }
  pres.layout = 'LAYOUT_WIDE' // 13.33 x 7.5
  pres.title = 'Roshni: One page. Every learner.'
  pres.author = '404 Team Not Found'
  pres.company = 'AICON 26 Build With AI'
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace }
  const C = pres.SchemeColor

  pres.defineSlideMaster({
    title: 'DARK',
    background: { color: HEX.ink },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 2.3, w: 8.2, h: 1.6, fontSize: 54, bold: true, color: C.background1, align: 'left', valign: 'top', margin: 0 }, text: '' } },
    ],
  })
  pres.defineSlideMaster({
    title: 'LIGHT',
    background: { color: HEX.chalk },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 0.45, w: 11.9, h: 0.9, fontSize: 30, bold: true, color: C.text1, align: 'left', valign: 'middle', margin: 0 }, text: '' } },
      { text: { text: 'Roshni · AICON’26 Build With AI · 404 Team Not Found', options: { x: 0.7, y: 7.0, w: 8, h: 0.3, fontSize: 10, color: HEX.muted, margin: 0 } } },
    ],
    slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: HEX.muted, align: 'right' },
  })

  const ic = {
    book: await icon(Lu.LuBookOpen, '#1C3EA6'), ear: await icon(Lu.LuHeadphones, '#0B8F8F'), cap: await icon(Lu.LuCaptions, '#7F5100'),
    scan: await icon(Lu.LuScanText), spark: await icon(Lu.LuSparkles), shield: await icon(Lu.LuShieldCheck), users: await icon(Lu.LuUsers),
    shieldGold: await icon(Lu.LuShieldCheck, '#F2A40E'), quote: await icon(Lu.LuQuote, '#1C3EA6'), arrows: await icon(Lu.LuArrowLeftRight, '#1C3EA6'),
    hash: await icon(Lu.LuHash, '#1C3EA6'), wrench: await icon(Lu.LuWrench, '#1C3EA6'), flask: await icon(Lu.LuFlaskConical, '#1C3EA6'),
    school: await icon(Lu.LuSchool, '#1C3EA6'), heart: await icon(Lu.LuHeartHandshake, '#0B8F8F'), bookmark: await icon(Lu.LuLibrary, '#7F5100'),
    brief: await icon(Lu.LuBriefcase, '#0C8259'), coins: await icon(Lu.LuCoins, '#F2A40E'), git: await icon(Lu.LuGitCommitHorizontal, '#F2A40E'),
  }

  // ---------- 1. Title
  pres.addSection({ title: 'Opening' })
  let s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Opening' })
  // lamp motif: gold circle with rays
  drawLamp(s, 10.35, 2.85)
  s.addText('AICON’26 · BUILD WITH AI · EDTECH & WORKFORCE', { x: 0.7, y: 1.5, w: 8, h: 0.4, fontSize: 13, color: HEX.gold, charSpacing: 3, bold: true, margin: 0, isTextBox: true, objectName: 'eyebrow' })
  s.addText('Roshni', { placeholder: 'title' })
  s.addText('روشنی', { x: 0.7, y: 3.35, w: 3, h: 0.7, fontSize: 30, color: '7FD9D3', fontFace: 'Arial', rtlMode: !process.env.SKIP_RTL, margin: 0, isTextBox: true, objectName: 'urdu' })
  s.addText('One page. Every learner.', { x: 0.7, y: 4.2, w: 8, h: 0.7, fontSize: 28, color: HEX.white, margin: 0, isTextBox: true, objectName: 'tagline' })
  s.addText('A photo of a textbook page becomes a lesson for blind, dyslexic and deaf students, and a second AI proves no fact was lost.', { x: 0.7, y: 5.0, w: 8.4, h: 0.9, fontSize: 16, color: 'C9D4F2', margin: 0, isTextBox: true, objectName: 'sub' })
  s.addText('404 Team Not Found', { x: 0.7, y: 6.55, w: 6, h: 0.4, fontSize: 14, color: 'C9D4F2', bold: true, margin: 0, isTextBox: true, objectName: 'team' })
  s.addNotes('Problem in one line: a printed page works for almost nobody who needs help. Roshni turns one photo into three accessible versions, and Fact Guard proves the facts survived.')

  // ---------- 2. Problem
  pres.addSection({ title: 'Problem' })
  s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: 'Problem' })
  s.addText('One printed page fails three students', { placeholder: 'title' })
  const learners = [
    { ic: ic.ear, tint: HEX.tealSoft, name: 'Bilal is blind', text: 'He can’t read the page or see its diagrams. Most Urdu and science textbooks have no accessible version.' },
    { ic: ic.book, tint: HEX.soft, name: 'Sara is dyslexic', text: 'Long sentences and hard words lose her, and Urdu-medium students hit the same wall with English textbooks.' },
    { ic: ic.cap, tint: HEX.goldSoft, name: 'Hamza is deaf', text: 'He misses everything the teacher says while explaining the page.' },
  ]
  learners.forEach((l, i) => {
    const x = 0.7 + i * 4.05
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.75, w: 3.75, h: 3.55, rectRadius: 0.18, fill: { color: HEX.white }, line: { color: HEX.line, width: 1 }, shadow: { type: 'outer', color: '0D1B3E', opacity: 0.12, blur: 10, offset: 3, angle: 90 }, objectName: `learner-card-${i}` })
    s.addShape(pres.shapes.OVAL, { x: x + 0.35, y: 2.1, w: 0.95, h: 0.95, fill: { color: l.tint }, line: { color: l.tint }, objectName: `learner-dot-${i}` })
    s.addImage({ data: l.ic, x: x + 0.57, y: 2.32, w: 0.51, h: 0.51, objectName: `learner-icon-${i}` })
    s.addText(l.name, { x: x + 0.35, y: 3.25, w: 3.1, h: 0.5, fontSize: 20, bold: true, color: HEX.ink, margin: 0, isTextBox: true, fontFace: 'Century Gothic', objectName: `learner-name-${i}` })
    s.addText(l.text, { x: x + 0.35, y: 3.8, w: 3.1, h: 1.35, fontSize: 15, color: HEX.muted, margin: 0, valign: 'top', isTextBox: true, objectName: `learner-text-${i}` })
  })
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 5.6, w: 11.9, h: 1.05, rectRadius: 0.15, fill: { color: HEX.ink }, line: { color: HEX.ink }, objectName: 'teacher-band' })
  s.addText([
    { text: 'Their teacher would have to adapt every page three different ways. ', options: { bold: true, color: HEX.white } },
    { text: 'There is never time, so it doesn’t happen. About 1 in 6 people live with a significant disability (WHO, 2023).', options: { color: 'C9D4F2' } },
  ], { x: 1.0, y: 5.68, w: 11.4, h: 0.9, fontSize: 16, valign: 'middle', margin: 0, isTextBox: true, objectName: 'teacher-text' })
  s.addNotes('Keep this human: three named students, one page. The teacher has no time. WHO estimates 1.3 billion people, about 1 in 6, live with significant disability.')

  // ---------- 3. Solution pipeline
  pres.addSection({ title: 'Solution' })
  s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: 'Solution' })
  s.addText('From one photo to three ways to learn', { placeholder: 'title' })
  const steps = [
    { ic: ic.scan, color: HEX.cobalt, t: 'Read the page', d: 'Gemini reads the photo, keeps headings and tables, and describes every diagram.' },
    { ic: ic.spark, color: HEX.teal, t: 'Rewrite it simply', d: 'Qwen rewrites at an easier level and explains hard words in Urdu.' },
    { ic: ic.shield, color: HEX.green, t: 'Fact Guard', d: 'GPT-OSS, a different AI family, audits every fact and repairs gaps.' },
    { ic: ic.users, color: HEX.ink, t: 'Learn your way', d: 'Read Easy, Listen or Captions, with the original always one tap away.' },
  ]
  steps.forEach((st, i) => {
    const x = 0.7 + i * 3.08
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.75, w: 2.75, h: 2.9, rectRadius: 0.18, fill: { color: HEX.white }, line: { color: HEX.line, width: 1 }, objectName: `step-card-${i}` })
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: 2.05, w: 0.85, h: 0.85, fill: { color: st.color }, line: { color: st.color }, objectName: `step-dot-${i}` })
    s.addImage({ data: st.ic, x: x + 0.5, y: 2.25, w: 0.45, h: 0.45, objectName: `step-icon-${i}` })
    s.addText(`0${i + 1}`, { x: x + 1.7, y: 2.1, w: 0.8, h: 0.6, fontSize: 24, bold: true, color: HEX.line, align: 'right', margin: 0, isTextBox: true, fontFace: 'Century Gothic', objectName: `step-num-${i}` })
    s.addText(st.t, { x: x + 0.3, y: 3.05, w: 2.25, h: 0.45, fontSize: 18, bold: true, color: HEX.ink, margin: 0, isTextBox: true, fontFace: 'Century Gothic', objectName: `step-title-${i}` })
    s.addText(st.d, { x: x + 0.3, y: 3.5, w: 2.25, h: 1.05, fontSize: 14, color: HEX.muted, margin: 0, valign: 'top', isTextBox: true, objectName: `step-text-${i}` })
    if (i < 3) s.addText('→', { x: x + 2.76, y: 2.9, w: 0.3, h: 0.5, fontSize: 22, color: HEX.cobalt, bold: true, align: 'center', margin: 0, isTextBox: true, objectName: `arrow-${i}` })
  })
  const modes = [
    { ic: ic.book, n: 'Read Easy', d: 'Simpler text side by side with the original, Urdu glossary, read-aloud that highlights each sentence, adaptive quiz' },
    { ic: ic.ear, n: 'Listen', d: 'Section-by-section audio, every figure described in words, full keyboard and screen-reader control' },
    { ic: ic.cap, n: 'Captions', d: 'Lecture transcript synced to the audio, plus a summary Fact Guard checks against what was said' },
  ]
  modes.forEach((m, i) => {
    const x = 0.7 + i * 4.05
    s.addImage({ data: m.ic, x, y: 5.05, w: 0.42, h: 0.42, objectName: `mode-icon-${i}` })
    s.addText(m.n, { x: x + 0.55, y: 4.98, w: 3.2, h: 0.5, fontSize: 17, bold: true, color: HEX.ink, margin: 0, isTextBox: true, fontFace: 'Century Gothic', objectName: `mode-name-${i}` })
    s.addText(m.d, { x, y: 5.55, w: 3.75, h: 1.2, fontSize: 14, color: HEX.muted, margin: 0, valign: 'top', isTextBox: true, objectName: `mode-text-${i}` })
  })
  s.addNotes('AI is the pipeline, not a chat box: vision reading, rewriting, an independent checker, speech-to-text and speech. Remove the AI and nothing works.')

  // ---------- 4. Fact Guard
  s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: 'Solution' })
  s.addText('Fact Guard: a second AI checks the first', { placeholder: 'title' })
  const checks = [
    { ic: ic.arrows, t: 'Independent model family', d: 'The checker is never from the same family as the rewriter, so it can’t simply agree with itself.' },
    { ic: ic.quote, t: 'Quote or it didn’t happen', d: 'A fact counts as kept only when the checker quotes it from the rewrite, and code confirms the quote states it.' },
    { ic: ic.hash, t: 'Numbers checked by plain code', d: '“50 min” can’t quietly become “100 min”. Units, formulas and symbols are compared without AI.' },
    { ic: ic.wrench, t: 'Repair, then re-check', d: 'Only flagged sentences are rewritten, up to two rounds. Anything still wrong stays visibly amber.' },
  ]
  checks.forEach((c, i) => {
    const y = 1.65 + i * 1.28
    s.addShape(pres.shapes.OVAL, { x: 0.7, y, w: 0.8, h: 0.8, fill: { color: HEX.soft }, line: { color: HEX.soft }, objectName: `check-dot-${i}` })
    s.addImage({ data: c.ic, x: 0.9, y: y + 0.2, w: 0.4, h: 0.4, objectName: `check-icon-${i}` })
    s.addText(c.t, { x: 1.75, y: y - 0.02, w: 5.6, h: 0.42, fontSize: 18, bold: true, color: HEX.ink, margin: 0, isTextBox: true, fontFace: 'Century Gothic', objectName: `check-title-${i}` })
    s.addText(c.d, { x: 1.75, y: y + 0.4, w: 5.6, h: 0.7, fontSize: 14, color: HEX.muted, margin: 0, valign: 'top', isTextBox: true, objectName: `check-text-${i}` })
  })
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.85, y: 1.65, w: 4.75, h: 4.95, rectRadius: 0.2, fill: { color: HEX.cobalt }, line: { color: HEX.cobalt }, objectName: 'stress-card' })
  s.addImage({ data: ic.shieldGold, x: 8.25, y: 2.0, w: 0.7, h: 0.7, objectName: 'stress-icon' })
  s.addText('STRESS TEST', { x: 8.25, y: 2.85, w: 4, h: 0.35, fontSize: 12, bold: true, color: HEX.gold, charSpacing: 3, margin: 0, isTextBox: true, objectName: 'stress-eyebrow' })
  s.addText(val('factguard_planted_errors'), { x: 8.25, y: 3.2, w: 4, h: 1.2, fontSize: 66, bold: true, color: HEX.white, margin: 0, isTextBox: true, fontFace: 'Century Gothic', objectName: 'stress-number' })
  s.addText('planted errors caught: changed numbers, deleted facts and invented claims, slipped into real rewrites by code.', { x: 8.25, y: 4.45, w: 4.0, h: 1.0, fontSize: 15, color: 'DCE4FA', margin: 0, valign: 'top', isTextBox: true, objectName: 'stress-text' })
  s.addText(`False alarms on unchanged text: ${val('factguard_false_alarms')}`, { x: 8.25, y: 5.7, w: 4.0, h: 0.5, fontSize: 15, bold: true, color: HEX.gold, margin: 0, isTextBox: true, objectName: 'stress-fa' })
  s.addNotes('Live in the demo: click Plant 3 errors and the cards flip to show what was caught. The false-alarm test audits each original page against itself, where nothing should be flagged.')

  // ---------- 5. Screenshot
  pres.addSection({ title: 'Product' })
  s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: 'Product' })
  s.addText('What Sara sees: the same page, easier, with proof', { placeholder: 'title' })
  if (SHOTS && fs.existsSync(path.join(SHOTS, 'deck-read.png'))) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.65, y: 1.55, w: 8.6, h: 5.25, rectRadius: 0.12, fill: { color: HEX.white }, line: { color: HEX.line, width: 1 }, shadow: { type: 'outer', color: '0D1B3E', opacity: 0.18, blur: 14, offset: 4, angle: 90 }, objectName: 'shot-frame' })
    s.addImage({ path: path.join(SHOTS, 'deck-read.png'), x: 0.75, y: 1.65, w: 8.4, h: 5.05, sizing: { type: 'cover', w: 8.4, h: 5.05 }, objectName: 'shot' })
  }
  const notes = [
    ['Original beside the rewrite', 'Nothing is hidden: the printed text is always next to the easier version.'],
    ['Read-aloud with highlighting', 'Each sentence lights up as it is read. Tap any sentence to start there.'],
    ['Urdu where it helps', 'Hard terms stay in English, with a short Urdu explanation and Urdu audio.'],
    ['Fact Guard on every page', 'A badge per section, the full fact list, and a live stress test.'],
  ]
  notes.forEach(([t, d], i) => {
    const y = 1.6 + i * 1.32
    s.addText(t, { x: 9.6, y, w: 3.1, h: 0.42, fontSize: 16, bold: true, color: HEX.ink, margin: 0, isTextBox: true, fontFace: 'Century Gothic', objectName: `shot-note-t-${i}` })
    s.addText(d, { x: 9.6, y: y + 0.42, w: 3.1, h: 0.8, fontSize: 13, color: HEX.muted, margin: 0, valign: 'top', isTextBox: true, objectName: `shot-note-d-${i}` })
  })
  s.addNotes('Switch to the live app here. Read aloud, tap an underlined word for Urdu, then run the stress test.')

  // ---------- 6. Evidence
  pres.addSection({ title: 'Evidence' })
  s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: 'Evidence' })
  s.addText('Measured, not claimed', { placeholder: 'title' })
  const stats = [
    { v: val('factguard_facts_kept'), l: 'Facts kept after Fact Guard', d: R.factguard_facts_kept?.n || '', c: HEX.green },
    { v: R.readability ? R.readability.display.replace('Grade ', '') : '—', l: 'Reading grade, original → Easier', d: R.readability?.n || '', c: HEX.cobalt },
    { v: val('factguard_planted_errors'), l: 'Planted errors caught', d: 'synthetic errors in real rewrites', c: HEX.cobalt },
    { v: val('factguard_false_alarms'), l: 'False alarms on unchanged text', d: R.factguard_false_alarms?.n || '', c: HEX.teal },
    { v: (R.ocr_cer && R.ocr_cer.hard_cer != null) ? `${(100 - R.ocr_cer.hard_cer * 100).toFixed(2)}%` : val('ocr_cer'), l: 'Page reading accuracy', d: 'even on this hard photo', c: HEX.teal },
    { v: val('processing_time'), l: 'Time to make a lesson', d: 'on free tiers, incl. rate-limit waits', c: HEX.ink },
  ]
  const hardImg = SHOTS && path.join(SHOTS, 'hard.jpg')
  stats.forEach((st, i) => {
    const x = 0.7 + (i % 3) * 4.05
    const y = 1.6 + Math.floor(i / 3) * 2.6
    const withPhoto = i === 4 && hardImg && fs.existsSync(hardImg)
    const tw = withPhoto ? 2.25 : 3.2
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 3.75, h: 2.3, rectRadius: 0.16, fill: { color: HEX.white }, line: { color: HEX.line, width: 1 }, objectName: `stat-card-${i}` })
    s.addText(st.v, { x: x + 0.3, y: y + 0.25, w: tw, h: 0.95, fontSize: 30, bold: true, color: st.c, margin: 0, valign: 'middle', fit: 'shrink', isTextBox: true, fontFace: 'Century Gothic', objectName: `stat-v-${i}` })
    s.addText(st.l, { x: x + 0.3, y: y + 1.25, w: tw, h: 0.45, fontSize: 15, bold: true, color: HEX.ink, margin: 0, fit: 'shrink', isTextBox: true, objectName: `stat-l-${i}` })
    s.addText(st.d, { x: x + 0.3, y: y + 1.7, w: tw, h: 0.45, fontSize: 12, color: HEX.muted, margin: 0, fit: 'shrink', isTextBox: true, objectName: `stat-d-${i}` })
    if (withPhoto) s.addImage({ path: hardImg, x: x + 2.65, y: y + 0.3, w: 0.9, h: 1.18, objectName: 'hard-photo' })
  })
  s.addText('Every number comes from a script in eval/ on OpenStax pages (CC BY 4.0). Synthetic test data is labelled. Run them yourself.', { x: 0.7, y: 6.55, w: 11.9, h: 0.35, fontSize: 12, italic: true, color: HEX.muted, margin: 0, isTextBox: true, objectName: 'stat-source' })
  s.addNotes('Stress honesty: real OpenStax text, scripted tests, sample sizes on the Evidence page. Not yet tested with disabled students; that is the pilot.')

  // ---------- 7. Impact
  pres.addSection({ title: 'Impact' })
  s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: 'Impact' })
  s.addText('Who adopts it, and why it scales', { placeholder: 'title' })
  const adopters = [
    { ic: ic.school, t: 'Special-education schools', d: 'Adapt any page for blind, dyslexic and deaf students in minutes.' },
    { ic: ic.heart, t: 'Inclusive-education NGOs', d: 'Run accessible classes without a team of specialists.' },
    { ic: ic.bookmark, t: 'Textbook boards and publishers', d: 'Produce accessible editions and see which pages are too hard.' },
    { ic: ic.brief, t: 'Employers and training providers', d: 'Make manuals, safety notices and job material accessible to staff with disabilities.' },
  ]
  adopters.forEach((a, i) => {
    const y = 1.65 + i * 1.22
    s.addShape(pres.shapes.OVAL, { x: 0.7, y, w: 0.78, h: 0.78, fill: { color: HEX.white }, line: { color: HEX.line, width: 1 }, objectName: `ad-dot-${i}` })
    s.addImage({ data: a.ic, x: 0.89, y: y + 0.19, w: 0.4, h: 0.4, objectName: `ad-icon-${i}` })
    s.addText(a.t, { x: 1.7, y: y - 0.02, w: 5.6, h: 0.42, fontSize: 18, bold: true, color: HEX.ink, margin: 0, isTextBox: true, fontFace: 'Century Gothic', objectName: `ad-t-${i}` })
    s.addText(a.d, { x: 1.7, y: y + 0.4, w: 5.6, h: 0.6, fontSize: 14, color: HEX.muted, margin: 0, valign: 'top', isTextBox: true, objectName: `ad-d-${i}` })
  })
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.85, y: 1.65, w: 4.75, h: 2.3, rectRadius: 0.18, fill: { color: HEX.goldSoft }, line: { color: HEX.goldSoft }, objectName: 'cost-card' })
  s.addImage({ data: ic.coins, x: 8.2, y: 1.95, w: 0.55, h: 0.55, objectName: 'cost-icon' })
  s.addText('PKR 0 to run today', { x: 8.2, y: 2.6, w: 4.1, h: 0.55, fontSize: 24, bold: true, color: HEX.ink, margin: 0, isTextBox: true, fontFace: 'Century Gothic', objectName: 'cost-title' })
  s.addText('Free tiers with automatic fallback across 8 models, caching and an offline demo mode.', { x: 8.2, y: 3.15, w: 4.1, h: 0.7, fontSize: 14, color: HEX.muted, margin: 0, valign: 'top', isTextBox: true, objectName: 'cost-text' })
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.85, y: 4.2, w: 4.75, h: 2.4, rectRadius: 0.18, fill: { color: HEX.ink }, line: { color: HEX.ink }, objectName: 'sdg-card' })
  s.addText('SDG 4.5 · 4.1 · 10.2', { x: 8.2, y: 4.45, w: 4.1, h: 0.5, fontSize: 22, bold: true, color: HEX.gold, margin: 0, isTextBox: true, fontFace: 'Century Gothic', objectName: 'sdg-title' })
  s.addText('Next: a pilot with one special-education school, testing with blind, dyslexic and deaf students, then printed Urdu pages.', { x: 8.2, y: 5.0, w: 4.1, h: 1.4, fontSize: 14, color: 'DCE4FA', margin: 0, valign: 'top', isTextBox: true, objectName: 'sdg-text' })
  s.addNotes('Industrial impact: clear adopters, near-zero running cost, and a workforce angle for accessible training material.')

  // ---------- 8. Close
  pres.addSection({ title: 'Close' })
  s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Close' })
  s.addText('Built during AICON’26', { placeholder: 'title' })
  drawLamp(s, 11.3, 3.75)
  s.addText([
    { text: 'Everything you saw was built in this event: the commit history is the record.', options: { breakLine: true } },
    { text: 'Gemini, Qwen, GPT-OSS and Whisper, all on free tiers. React + FastAPI. OpenStax pages, CC BY 4.0.', options: { breakLine: true } },
    { text: 'We used an AI coding assistant, as the rules allow. Disclosures are in docs/DISCLOSURES.md.' },
  ], { x: 0.7, y: 4.1, w: 8.5, h: 1.7, fontSize: 16, color: 'C9D4F2', margin: 0, valign: 'top', paraSpaceAfter: 8, isTextBox: true, objectName: 'close-text' })
  s.addText('One page. Every learner.', { x: 0.7, y: 6.0, w: 8, h: 0.6, fontSize: 24, bold: true, color: HEX.gold, margin: 0, isTextBox: true, fontFace: 'Century Gothic', objectName: 'close-tagline' })
  s.addNotes('Close on the tagline and invite questions. Have the Evidence page open for follow-ups.')

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  await pres.writeFile({ fileName: OUT })
  if (!process.env.SKIP_THEME) await applyTheme(OUT, THEME)
  console.log('wrote', OUT)
})()
