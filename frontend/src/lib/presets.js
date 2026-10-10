// What each setup choice changes. Each need only adds what it literally promises; needs combine.
export const NEEDS = [
  { id: 'reading_tiring', label: 'Reading is slow or tiring for me', ur: 'پڑھنا مشکل یا تھکا دینے والا', note: 'Easier font and spacing, simplest text, no quiz timer' },
  { id: 'large_text', label: 'I need large, clear text', ur: 'بڑا اور صاف لکھا ہوا', note: 'Bigger text and lines' },
  { id: 'screen_reader', label: 'I use a screen reader or only the keyboard', ur: 'اسکرین ریڈر یا صرف کی بورڈ', note: 'Lessons open in Listen, no quiz timer' },
  { id: 'captions', label: 'I follow lessons by captions', ur: 'کیپشن کے ذریعے سمجھنا', note: 'Captions first when a lesson has a lecture' },
  { id: 'second_language', label: 'English is not my first language', ur: 'انگریزی میری پہلی زبان نہیں', note: 'Simplest text and word help in your language' },
]

// Returns {settings, profile, practice} patches for a set of needs.
export function presetFor(needs) {
  const has = (n) => needs.includes(n)
  const settings = {}
  const practice = {}
  const profile = { needs, defaultLevel: null, preferredTab: 'read' }
  if (has('reading_tiring')) {
    Object.assign(settings, { font: 'lexend', leading: 2.0, wordSpacing: 0.1 })
    Object.assign(practice, { level: 'simplest', timerTap: 0 })
    profile.defaultLevel = 'simplest'
  }
  if (has('large_text')) Object.assign(settings, { scale: Math.max(1.3, settings.scale || 0), leading: Math.max(1.95, settings.leading || 0) })
  if (has('second_language')) {
    profile.defaultLevel = 'simplest'
    Object.assign(practice, { level: 'simplest' })
  }
  if (has('captions')) {
    profile.preferredTab = 'captions'
    Object.assign(practice, { readAloud: false })
  }
  if (has('screen_reader')) {
    // the screen reader already reads aloud: no second voice, no timer, no surprise microphone prompt
    profile.preferredTab = 'listen'
    Object.assign(practice, { timerTap: 0, timerVoice: 0, readAloud: false, mode: 'tap' })
  }
  return { settings, profile, practice }
}
