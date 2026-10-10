import { Contrast, Moon, Sun } from 'lucide-react'
import { FONTS, OVERLAYS, useSettings } from '../lib/settings'
import { Button, Drawer, Segmented, cx } from './ui'

function Slider({ id, label, value, min, max, step, format, onChange }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <span className="text-sm tabular-nums text-muted">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
    </div>
  )
}

export default function DisplaySettings({ open, onClose }) {
  const { settings, update, reset } = useSettings()
  return (
    <Drawer open={open} onClose={onClose} title="Display settings" width="max-w-md">
      <div className="space-y-7">
        <div className="reading reading-surface rounded-xl border border-line p-4">
          Plants make their own food using sunlight. This is called photosynthesis.
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Theme</legend>
          <Segmented
            id="theme"
            label="Theme"
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'light', label: <span className="inline-flex items-center gap-1.5"><Sun className="size-4" aria-hidden />Light</span> },
              { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><Moon className="size-4" aria-hidden />Dark</span> },
              { value: 'contrast', label: <span className="inline-flex items-center gap-1.5"><Contrast className="size-4" aria-hidden />High contrast</span> },
            ]}
          />
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Reading font</legend>
          <div className="grid gap-2">
            {Object.entries(FONTS).map(([key, f]) => (
              <label key={key} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5', settings.font === key ? 'border-brand bg-surface-2' : 'border-line')}>
                <input type="radio" name="font" value={key} checked={settings.font === key} onChange={() => update({ font: key })} className="accent-[var(--brand)]" />
                <span style={{ fontFamily: f.css }} className="text-[17px]">
                  {f.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-5">
          <Slider id="ds-size" label="Text size" value={settings.scale} min={0.9} max={1.6} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(scale) => update({ scale })} />
          <Slider id="ds-leading" label="Line spacing" value={settings.leading} min={1.4} max={2.4} step={0.05} format={(v) => v.toFixed(2)} onChange={(leading) => update({ leading })} />
          <Slider id="ds-tracking" label="Letter spacing" value={settings.tracking} min={0} max={0.14} step={0.01} format={(v) => `${v.toFixed(2)} em`} onChange={(tracking) => update({ tracking })} />
          <Slider id="ds-word" label="Word spacing" value={settings.wordSpacing} min={0} max={0.4} step={0.02} format={(v) => `${v.toFixed(2)} em`} onChange={(wordSpacing) => update({ wordSpacing })} />
          <Slider id="ds-rate" label="Read-aloud speed" value={settings.rate} min={0.6} max={1.6} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(rate) => update({ rate })} />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Colour overlay</legend>
          <p className="mb-3 text-sm text-muted">Some readers with dyslexia find a tinted background easier on the eyes.</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(OVERLAYS).map(([key, o]) => (
              <button
                key={key}
                type="button"
                aria-pressed={settings.overlay === key}
                onClick={() => update({ overlay: key })}
                className={cx('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold', settings.overlay === key ? 'border-brand bg-surface-2' : 'border-line')}
              >
                <span className="size-4 rounded-full border border-line" style={{ background: `linear-gradient(${o.color}, ${o.color}), var(--surface)` }} aria-hidden />
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>

        <Button onClick={reset} className="w-full">
          Reset to defaults
        </Button>
      </div>
    </Drawer>
  )
}
