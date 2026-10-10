// Display settings (font, size, spacing, overlay, theme, help language), saved per browser and applied as CSS variables.
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export const FONTS = {
  atkinson: { label: 'Atkinson Hyperlegible', css: '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif' },
  lexend: { label: 'Lexend', css: '"Lexend", "Segoe UI", system-ui, sans-serif' },
  system: { label: 'System font', css: 'system-ui, "Segoe UI", Arial, sans-serif' },
}

export const OVERLAYS = {
  none: { label: 'None', color: 'transparent' },
  cream: { label: 'Cream', color: 'rgba(255, 232, 170, 0.35)' },
  blue: { label: 'Blue', color: 'rgba(150, 200, 255, 0.28)' },
  green: { label: 'Green', color: 'rgba(170, 230, 180, 0.30)' },
  rose: { label: 'Rose', color: 'rgba(255, 190, 200, 0.30)' },
  grey: { label: 'Grey', color: 'rgba(160, 160, 160, 0.22)' },
}

// Language for hard-word explanations and their audio. Terms themselves stay in English.
export const HELP_LANGS = {
  ur: { label: 'Urdu', native: 'اردو', field: 'urdu', className: 'urdu' },
  ps: { label: 'Pashto', native: 'پښتو', field: 'pashto', className: 'pashto' },
}

export const DEFAULTS = { font: 'atkinson', scale: 1, leading: 1.75, tracking: 0.01, wordSpacing: 0.04, overlay: 'none', theme: 'light', rate: 1, helpLang: 'ur' }
const KEY = 'roshni-display-v1'

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

const Ctx = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme === 'light' ? '' : settings.theme
    if (settings.theme === 'light') delete root.dataset.theme
    root.style.setProperty('--reading-font', FONTS[settings.font]?.css || FONTS.atkinson.css)
    root.style.setProperty('--reading-scale', String(settings.scale))
    root.style.setProperty('--reading-leading', String(settings.leading))
    root.style.setProperty('--reading-tracking', `${settings.tracking}em`)
    root.style.setProperty('--reading-word', `${settings.wordSpacing}em`)
    root.style.setProperty('--overlay', OVERLAYS[settings.overlay]?.color || 'transparent')
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* private mode: settings still apply for this visit */
    }
  }, [settings])

  const value = useMemo(
    () => ({ settings, update: (patch) => setSettings((s) => ({ ...s, ...patch })), reset: () => setSettings(DEFAULTS) }),
    [settings],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
