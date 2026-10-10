// Fixed Urdu / Pashto learner messages. Only neutral, native-safe templates ship.
// Neutral Urdu uses آپ with object-agreeing perfective or nominal lines.
// Neutral Pashto uses تاسو the same way. Anything that can't stay neutral is omitted.

export const ADDRESS_FORMS = {
  neutral: {
    id: 'neutral',
    label: 'Neutral (recommended)',
    sample: {
      en: 'You got 6 out of 10.',
      ur: 'آپ نے 10 میں سے 6 درست کیے۔',
      ps: 'تاسو له 10 څخه 6 سم کړل.',
    },
  },
}

const SCORE = {
  en: (c, t) => `You got ${c} out of ${t}.`,
  ur: (c, t) => `آپ نے ${t} میں سے ${c} درست کیے۔`,
  ps: (c, t) => `تاسو له ${t} څخه ${c} سم کړل.`,
}

const NEXT_STEP = {
  en: (title) => `Your next step: ${title}`,
  ur: (title) => `اگلا قدم: ${title}`,
  ps: (title) => `بل قدم: ${title}`,
}

const REVIEW = {
  en: (n) => (n === 1 ? '1 fact to review' : `${n} facts to review`),
  ur: (n) => (n === 1 ? '1 حقیقت دوبارہ دیکھیں' : `${n} حقائق دوبارہ دیکھیں`),
  ps: (n) => (n === 1 ? '1 حقیقت بیا وګورئ' : `${n} حقیقتونه بیا وګورئ`),
}

function langOf(helpLang, addressForm) {
  if (addressForm !== 'neutral') return 'en' // unreviewed forms fall back to English
  if (helpLang === 'ur' || helpLang === 'ps') return helpLang
  return 'en'
}

/** Fill a short status line. Returns English when the template can't stay neutral. */
export function msg(kind, { helpLang = 'en', addressForm = 'neutral', correct, total, title, count } = {}) {
  const lang = langOf(helpLang, addressForm)
  if (kind === 'score' && correct != null && total != null) return SCORE[lang](correct, total)
  if (kind === 'next' && title) return NEXT_STEP[lang](title)
  if (kind === 'review' && count != null) return REVIEW[lang](count)
  return ''
}

export function addressSample(formId = 'neutral', lang = 'ur') {
  const form = ADDRESS_FORMS[formId] || ADDRESS_FORMS.neutral
  return form.sample[lang] || form.sample.en
}
