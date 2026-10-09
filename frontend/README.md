# Frontend: React + Vite + Tailwind

## First-time scaffold (run inside this folder)
```bash
npm create vite@latest . -- --template react   # choose "Ignore files and continue" if asked about a non-empty folder
npm install
npm install -D tailwindcss @tailwindcss/vite
```
Create `.env.local` containing `VITE_API_BASE_URL=http://localhost:8000`.

## Planned structure
```
src/
├── pages/        Home.jsx (upload + samples), Lesson.jsx (mode tabs), Metrics.jsx
├── modes/        ReadEasy.jsx, Listen.jsx, Captions.jsx, Original.jsx
├── components/   FactGuardBadge.jsx, FactGuardPanel.jsx, Glossary.jsx, AudioControls.jsx,
│                 DisplaySettings.jsx, UploadBox.jsx, StepProgress.jsx, ErrorNotice.jsx
├── lib/          api.js (fetch + error shape), speech.js (one utterance per sentence + highlight),
│                 shortcuts.js (Alt-based keys + shortcut-mode toggle), settings.js (localStorage)
└── styles/       index.css (theme tokens, dyslexia spacing, overlay colours)
```

## Accessibility must-haves (see docs/PLAN.md section 8)

- Semantic HTML, a skip link, an ARIA live region, visible focus, contrast of at least 4.5:1
- Every shortcut also available as a button; single-letter keys only in shortcut mode
- Fact Guard status shown with an icon **and** text, never colour alone
- `lang="ur"` and `dir="rtl"` on Urdu blocks, using Noto Nastaliq Urdu
- Test with NVDA (Windows) before the code freeze
