# Produktvideo Form Filler – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein reproduzierbar gerendertes, stummes 55-Sekunden-Produktvideo (MP4) plus 11-Sekunden-Teaser-GIF, gebaut als GSAP-Animation im Browser und per Playwright + ffmpeg exportiert, eingebunden im README.

**Architecture:** `promo/video/` ist eine eigenständige Vite-Seite im Repo, die dieselben Tokens, Schriften und Tailwind-Utilities wie die Erweiterung lädt und die Oberfläche nachbaut. Eine einzige pausierte GSAP-Timeline (Labels je Szene, Modus `full` oder `teaser`) wird vom Render-Skript Bild für Bild per `seek(t)` fotografiert; ffmpeg encodiert MP4 und GIF. Vorschau mit Play und Scrubber im Browser.

**Tech Stack:** Vite 8, Tailwind 4 (`@tailwindcss/vite`), GSAP 3.13 (+ TextPlugin), Playwright 1.64 (steuert installierten Chrome, `channel: 'chrome'`), ffmpeg 9 (Homebrew), tsx, Vitest + happy-dom.

**Spec:** `docs/superpowers/specs/2026-10-22-promo-video-design.md`

## Global Constraints

- Sprache im Video: Deutsch. Einblendungen exakt wie in Spec §4 (Tabelle, Spalte „Einblendung“) und §4 „Teaser-GIF“.
- Nur Tokens aus `src/theme/tokens.css` und deren Utilities (`bg-bg`, `bg-surface`, `text-muted`, `text-brand-fg`, `bg-brand`, `bg-brand-2`, `border-line`, `font-display`, …); keine freien Hex-Werte außer in der Demo-Seite (Spec §5: `#f4f5f7`, `#1f2430`) und im Cursor (`#110078`).
- Schriften: Bricolage Grotesque aus dem Repo; Wotfard nur über `registerPageFonts()` aus `src/theme/overlayFonts.ts` (lokal, optional). Keine weiteren Schriftdateien ins Repo.
- Keine beruflichen Namen, Apps oder Daten. Demo-App „Kundenportal“, Daten exakt aus Spec §5.
- „Code gewinnt“: Beschriftungen, Zustände und Formate der Erweiterung sind verbindlich: Badge bei Erfolg „✓“ auf Grün, Status „Kundenanlage: 12 von 12 befüllt“, Buttons „App anlegen“, „Anlegen und Felder aufnehmen“, „Füllen“, Hinweis „✓ Vorlage gespeichert“, Popup-Zusatz „An der Adresse erkannt“, Aufnahme-Leiste „Aufnahme · N Felder“ mit „Beenden“/„Speichern“, Kennung `T` + vier Ziffern mit Trenner ` · `.
- Determinismus: keine CSS-Transitions, keine CSS-Animationen, kein `Math.random`, kein `Date`. Nur die pausierte GSAP-Timeline bewegt etwas.
- Ausgaben: MP4 H.264 `yuv420p`, 1920 × 1080, 30 fps, 50–60 s, ≤ 10 MB, nicht eingecheckt. GIF 960 × 540, 20 fps, 10–12 s, Endlosschleife, ≤ 5 MB, eingecheckt als `docs/media/teaser.gif`. `promo/video/out/` ist gitignored.
- Bühne 1920 × 1080; Browserfenster 1440 × 810 bei x 240 / y 60; Textzone unten 230 px; Einblendungen unten links bei x 96 / Unterkante 64; Popup 360 px, Feld-Fenster 304 px breit.
- Code-Kommentare Englisch, Commit-Messages Conventional Commits auf Englisch, TypeScript strict ohne `any`, `npm run lint` und `npm run typecheck` bleiben grün.

## Review Focus

1. Das erste Bild wird fotografiert, bevor die Schriften geladen sind → `fontsReady()` wartet auf `document.fonts.ready`, Render wartet auf `window.__video.ready` (Test in Task 2).
2. Eine Tailwind-Utility mit `transition`/`animate-`/`duration-` schleicht sich ein und macht Frames zeitabhängig → Markup- und CSS-Test in Task 3.
3. ffmpeg fehlt oder hat keinen H.264-/GIF-Encoder → Render bricht vor dem ersten Frame mit klarer Meldung ab (`hasEncoders`, Task 4).
4. MP4 oder GIF überschreiten das Limit → Größenprüfung mit fester Reduktionsreihenfolge (Task 4, Task 9).
5. Wotfard fehlt lokal und das Video wird still mit Systemschrift gerendert → `fontReport` warnt im Render-Log (Task 4).

---

## Dateistruktur

```
promo/video/
  vite.config.ts      Vite-Root dieser Seite, Tailwind-Plugin
  index.html          #stage (1920 × 1080) + #controls (nur Vorschau)
  styles.css          Tailwind + tokens.css + fonts.css + Bühnen-Basisregeln
  main.ts             Boot: Fonts, Stage, Timeline, window.__video, Vorschau
  video-api.ts        Typen: Mode, VideoApi, window.__video
  data.ts             Demo-App, Felder, Datensätze, Kennungen, Einblendungstexte
  schedule.ts         Szenenreihenfolge, Dauern, Startzeiten, Teaser-Dauer
  stage.ts            renderStage(): Markup aller Ebenen (statisch, Anfangszustand)
  fx.ts               Bausteine: cursorTo, click, typeText, caption, zoom, glow, sweep, fontsReady
  scenes/intro.ts … outro.ts   je Szene eine Funktion, hängt Tweens an die Timeline
  timeline.ts         buildTimeline(root, mode): pausierte Timeline mit Labels
  preview.ts          Play/Pause, Scrubber, Zeitanzeige
  render-lib.ts       reine Helfer: parseArgs, frameTimes, ffmpegArgs, hasEncoders, sizeLimit, nextReduction, fontReport
  render.ts           CLI: Vite-Server, Playwright, Frames, ffmpeg
  out/                gitignored: frames/, teaser/, *.mp4
tests/promo/          data, schedule, stage, timeline, render-lib
docs/media/teaser.gif
```

Jede Szene ist `export function <name>(ctx: SceneContext): void` mit `interface SceneContext { tl: gsap.core.Timeline; root: HTMLElement; at: number }`; sie fügt ihre Tweens an absoluten Positionen `ctx.at + offset` ein. Elemente werden per `data-el="<name>"` adressiert (`root.querySelector('[data-el=popup]')`).

---

### Task 1: Vite-Seite, Demo-Daten und Skripte

**Files:**
- Create: `promo/video/vite.config.ts`, `promo/video/index.html`, `promo/video/styles.css`, `promo/video/main.ts`, `promo/video/video-api.ts`, `promo/video/data.ts`
- Modify: `package.json` (scripts), `.gitignore`
- Test: `tests/promo/data.test.ts`

**Interfaces:**
- Produces `data.ts`:
  - `export const APP = { name: 'Kundenportal', url: 'https://portal.example.com/kunden/neu', pattern: 'https://portal.example.com/*', title: 'Kundenanlage', subtitle: 'Schritt 1 von 3 · Stammdaten' } as const`
  - `export type FieldKey = 'company' | 'salutation' | 'firstName' | 'lastName' | 'email' | 'phone' | 'street' | 'zip' | 'city' | 'customerNo' | 'billingEmail' | 'iban'`
  - `export interface Field { key: FieldKey; label: string; required: boolean; typeLabel: string; kind: 'text' | 'select' }` und `export const FIELDS: readonly Field[]` in Spec-Reihenfolge; `typeLabel` ist das Typ-Label der Erweiterung (Werte aus `src/ui/configOptions.ts`, z. B. „Firmenname“, „E-Mail-Adresse“, „Postleitzahl“).
  - `export const RUN_IDS = ['T4821', 'T7306'] as const`
  - `export const DATASETS: readonly [Record<FieldKey, string>, Record<FieldKey, string>]` mit den Werten aus Spec §5; `customerNo` = `K-2041 · T4821` bzw. `K-2041 · T7306`.
  - `export const CAPTIONS` mit Schlüsseln `problem`, `detect1`, `detect2`, `record1`, `record2`, `record3`, `fill1`, `fill2`, `shortcut`, `manage`, `outroRepo`, `outroBrowsers`, `outroCopyright`, `claim`, `by` → jeweils `{ title: string; sub?: string }`, Texte exakt aus Spec §4.
- Produces `video-api.ts`: `export type Mode = 'full' | 'teaser'`; `export interface VideoApi { ready: Promise<void>; mode: Mode; duration: number; seek(t: number): void }`; `declare global { interface Window { __video?: VideoApi } }`.
- Produces npm-Skripte: `video:preview` = `vite --config promo/video/vite.config.ts --open`, `video:render` = `tsx promo/video/render.ts`, `video:teaser` = `tsx promo/video/render.ts --mode teaser`.

- [ ] **Step 1: Failing test schreiben** – `tests/promo/data.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { APP, CAPTIONS, DATASETS, FIELDS, RUN_IDS } from '../../promo/video/data'

describe('promo data', () => {
  it('has the 12 fields of the spec in order, with the required markers', () => {
    expect(FIELDS.map((f) => f.label)).toEqual(['Firma', 'Anrede', 'Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Straße', 'PLZ', 'Ort', 'Kundennummer', 'Rechnungs-E-Mail', 'IBAN'])
    expect(FIELDS.filter((f) => !f.required).map((f) => f.key)).toEqual(['phone', 'billingEmail', 'iban'])
  })
  it('second dataset differs from the first in every field', () => {
    for (const f of FIELDS) expect(DATASETS[1][f.key]).not.toBe(DATASETS[0][f.key])
  })
  it('uses run ids in the real format and appends them with the real separator', () => {
    for (const id of RUN_IDS) expect(id).toMatch(/^T\d{4}$/)
    expect(DATASETS[0].customerNo).toBe('K-2041 · T4821')
    expect(DATASETS[1].customerNo).toBe('K-2041 · T7306')
  })
  it('carries the exact captions and app copy', () => {
    expect(CAPTIONS.claim.title).toBe('Einmal aufnehmen. Immer ausfüllen.')
    expect(CAPTIONS.problem.title).toBe('12 Felder. Jeder Testlauf. Von Hand.')
    expect(CAPTIONS.fill2.title).toBe('Jedes Mal neue, stimmige Daten.')
    expect(CAPTIONS.outroCopyright.title).toBe('© 2026 Martin Liesche')
    expect(APP.pattern).toBe('https://portal.example.com/*')
  })
})
```

- [ ] **Step 2: Test laufen lassen, erwartet FAIL** – `npx vitest run tests/promo/data.test.ts` → „Failed to resolve import“.
- [ ] **Step 3: `data.ts` und `video-api.ts` anlegen** (Interfaces oben; Werte aus Spec §4/§5).
- [ ] **Step 4: Vite-Seite anlegen**
  - `vite.config.ts` wie `test-site/vite.config.ts`, aber `plugins: [tailwindcss()]` aus `@tailwindcss/vite`, `root: import.meta.dirname`.
  - `styles.css`: `@import 'tailwindcss'; @import '../../src/theme/tokens.css'; @import '../../src/theme/fonts.css';` plus `@layer base` mit `body { margin: 0; background: var(--color-bg); color: var(--color-text); font-weight: 300 }` und `#stage { position: relative; width: 1920px; height: 1080px; overflow: hidden }`.
  - `index.html`: `<div id="stage"></div><div id="controls"></div>` und `<script type="module" src="./main.ts">`.
  - `main.ts` vorerst: `import './styles.css'`, `registerPageFonts()` aus `../../src/theme/overlayFonts`, und `document.getElementById('stage')!.textContent = 'stage'`. (Wird in Task 2 ersetzt.)
- [ ] **Step 5: Skripte und gitignore** – die drei npm-Skripte in `package.json`; `promo/video/out/` in `.gitignore`.
- [ ] **Step 6: Prüfen** – `npx vitest run tests/promo/data.test.ts` → PASS; `npm run typecheck` und `npm run lint` grün; `npm run video:preview` zeigt die leere dunkle Seite mit „stage“ in Wotfard (lokal vorhanden) bzw. Systemschrift.
- [ ] **Step 7: Commit** – `git add promo/video tests/promo package.json package-lock.json .gitignore && git commit -m "feat(video): scaffold promo video page with demo data"`

---

### Task 2: Zeitplan, Timeline-Gerüst und Vorschau

**Files:**
- Create: `promo/video/schedule.ts`, `promo/video/timeline.ts`, `promo/video/fx.ts` (nur `fontsReady`), `promo/video/preview.ts`
- Modify: `promo/video/main.ts`
- Test: `tests/promo/schedule.test.ts`, `tests/promo/timeline.test.ts`

**Interfaces:**
- Produces `schedule.ts`:
  - `export type SceneId = 'intro' | 'problem' | 'detect' | 'record' | 'fill' | 'shortcut' | 'manage' | 'outro'`
  - `export const SCENES: readonly { id: SceneId; duration: number }[]` = intro 6, problem 5, detect 8, record 14, fill 10, shortcut 5, manage 5, outro 4 (Summe 57).
  - `export function sceneStart(id: SceneId): number`; `export const TOTAL: number`; `export const TEASER_DURATION = 11`.
- Produces `timeline.ts`: `export function buildTimeline(root: HTMLElement, mode: Mode): gsap.core.Timeline` – pausiert; im Modus `full` ein Label je Szene bei `sceneStart(id)` und ein leerer Platzhalter-Tween am Ende, sodass `duration() === TOTAL`; im Modus `teaser` Label `teaser` bei 0 und `duration() === TEASER_DURATION`. Registriert `TextPlugin`. Die Szenenfunktionen werden ab Task 5 hier aufgerufen.
- Produces `fx.ts`: `export function fontsReady(doc: Document): Promise<void>` → `doc.fonts?.ready` oder sofort erfüllt.
- Produces `main.ts`: liest `mode` (`?mode=teaser`) und `render` (`?render`) aus `location.search`; rendert `renderStage()` (ab Task 3, vorerst Platzhalter), baut die Timeline, setzt `window.__video = { ready, mode, duration: tl.duration(), seek: (t) => tl.seek(t, false) }`; `ready` = `fontsReady(document)`. Ohne `?render` wird `mountPreview(tl, document.getElementById('controls')!)` aufgerufen.
- Produces `preview.ts`: `export function mountPreview(tl: gsap.core.Timeline, host: HTMLElement): void` – Button „Play/Pause“, `<input type="range" min=0 max=duration step=1/30>` gekoppelt an `tl.time()`, Zeitanzeige `mm:ss.f`, Link zum anderen Modus. Mit `?play` startet die Timeline sofort.

- [ ] **Step 1: Failing tests schreiben**

`tests/promo/schedule.test.ts`:
```ts
it('orders the scenes as in the spec and lands between 50 and 60 seconds', () => {
  expect(SCENES.map((s) => s.id)).toEqual(['intro', 'problem', 'detect', 'record', 'fill', 'shortcut', 'manage', 'outro'])
  expect(sceneStart('fill')).toBe(33)
  expect(TOTAL).toBeGreaterThanOrEqual(50); expect(TOTAL).toBeLessThanOrEqual(60)
  expect(TEASER_DURATION).toBeGreaterThanOrEqual(10); expect(TEASER_DURATION).toBeLessThanOrEqual(12)
})
```

`tests/promo/timeline.test.ts` (happy-dom):
```ts
it('builds a paused full timeline with one label per scene', () => {
  const root = document.createElement('div'); document.body.append(root)
  const tl = buildTimeline(root, 'full')
  expect(tl.paused()).toBe(true)
  expect(tl.labels).toEqual(Object.fromEntries(SCENES.map((s) => [s.id, sceneStart(s.id)])))
  expect(tl.duration()).toBeCloseTo(TOTAL, 3)
})
it('builds the teaser timeline with the teaser duration', () => {
  expect(buildTimeline(document.createElement('div'), 'teaser').duration()).toBeCloseTo(TEASER_DURATION, 3)
})
it('fontsReady resolves after document.fonts.ready', async () => {
  let resolved = false
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve().then(() => { resolved = true }) } })
  await fontsReady(document)
  expect(resolved).toBe(true)
})
```
(Restore von `document.fonts` im `afterEach` wie in `tests/theme/overlayFonts.test.ts`.)

- [ ] **Step 2: Tests laufen lassen, erwartet FAIL** – `npx vitest run tests/promo` → Import-Fehler.
- [ ] **Step 3: `schedule.ts`, `fx.ts` (`fontsReady`), `timeline.ts`, `preview.ts`, `main.ts` umsetzen** (Signaturen oben).
- [ ] **Step 4: Tests laufen lassen, erwartet PASS** – `npx vitest run tests/promo`.
- [ ] **Step 5: Vorschau prüfen** – `npm run video:preview`: Scrubber läuft von 0 bis 57 s, `?mode=teaser` zeigt 11 s; Konsole ohne Fehler.
- [ ] **Step 6: Commit** – `git commit -m "feat(video): add scene schedule, timeline skeleton and preview controls"`

---

### Task 3: Bühnen-Markup

**Files:**
- Create: `promo/video/stage.ts`
- Modify: `promo/video/main.ts` (ruft `renderStage()`), `promo/video/styles.css` (Ebenen, Bühnen-Regeln)
- Test: `tests/promo/stage.test.ts`

**Interfaces:**
- Produces `stage.ts`: `export function renderStage(): string` – HTML-String aller Ebenen im Anfangszustand (alles, was später erscheint, ist mit `opacity: 0` oder außerhalb positioniert, aber vorhanden). Ebenen in dieser Reihenfolge, jede `position: absolute; inset: 0`:
  1. `[data-el=glow]` – radialer Indigo-Glow (Spec §6).
  2. `[data-el=window]` – enthält `[data-el=browser]` (1440 × 810 bei 240/60, `overflow: hidden`, Chrome-Leiste mit `[data-el=url]`, Symbolleiste mit `[data-el=toolbar-icon]` und `[data-el=badge]`), darin `[data-el=page]` (Seitentitel, Untertitel, Formular-Grid 2 Spalten, je Feld `[data-field=<key>]` mit `[data-el=value]`-Span und `[data-el=caret]`), `[data-el=veil]`, `[data-el=popup]` (Zustände `[data-el=popup-noapp]` mit Formular „Neue App für diese Seite“ und `[data-el=popup-app]` mit Kopf, Segmented „Alle | Nur Pflicht“, Zeile „Kundenanlage“ + „Füllen“ + „⋯“, Kachel „+ Neue Vorlage“, Statuszeile `[data-el=status]`), `[data-el=popover]` (Feld-Fenster nach `src/recorder/CapturePopover.vue`: Kopf, Datentyp-Select, Slot-Select, Chips „Pflichtfeld“/„Kennung anhängen“, Fußzeile „Abbrechen“/„Übernehmen“), `[data-el=bar]` (Aufnahme-Leiste nach `src/recorder/Recorder.vue`), je Feld eine `[data-captured=<key>]`-Box (grüner Rahmen + Typ-Label wie `data-testid="captured-box"`), `[data-el=saved]` („✓ Vorlage gespeichert“), `[data-el=permission]` (vereinfachte Browser-Blase mit „Zulassen“), `[data-el=manage]` (Verwaltungsseite: Kopf „Kundenanlage · Kundenportal · 12 Felder“, Buttons, Tabelle mit 6 Zeilen `[data-row=<key>]`, Griff „⋮⋮“, Typ, Pflicht-Schalter; Wortlaut nach `src/manage/TemplateTable.vue`).
  3. `[data-el=band]` – Textzone-Verlauf.
  4. `[data-el=intro]` – Icon (inline SVG aus `assets/icon/icon.svg` mit `[data-el=icon-liquid]` für den Pegel), `[data-el=title]`, `[data-el=claim]`, `[data-el=by]` („developed by“ + Signet, Pfad aus `src/theme/BrandSignet.vue`); `[data-el=outro]` – Icon, Titel, Repo-Adresse, Browser-Zeile, Copyright.
  5. `[data-el=captions]` – `[data-el=caption-title]`, `[data-el=caption-sub]`.
  6. `[data-el=cursor]` (SVG-Pfeil 28 px, Spec §6), `[data-el=ripple]`.
  7. `[data-el=keys]` – drei Tastenkappen `[data-key=alt|shift|f]`.
- Alle Texte aus `data.ts`; Oberflächen-Wortlaut aus den referenzierten Komponenten.

- [ ] **Step 1: Failing test schreiben** – `tests/promo/stage.test.ts`:

```ts
const html = renderStage()
it('contains every field label and the real extension wording', () => {
  for (const f of FIELDS) expect(html).toContain(f.label)
  for (const s of ['An der Adresse erkannt', 'Neue App für diese Seite', 'App anlegen', '+ Neue Vorlage', 'Füllen', 'Anlegen und Felder aufnehmen', 'Aufnahme', 'Beenden', 'Speichern', 'Übernehmen', '✓ Vorlage gespeichert', 'Pflichtfeld', 'Kennung anhängen', 'Exportieren', 'github.com/marliedev/form-filler', '© 2026 Martin Liesche']) expect(html).toContain(s)
})
it('addresses every animated element by data-el', () => {
  for (const el of ['glow', 'window', 'browser', 'url', 'page', 'veil', 'popup', 'popup-noapp', 'popup-app', 'status', 'popover', 'bar', 'saved', 'permission', 'manage', 'band', 'intro', 'icon-liquid', 'title', 'claim', 'by', 'outro', 'captions', 'caption-title', 'caption-sub', 'cursor', 'ripple', 'keys', 'badge', 'toolbar-icon']) expect(html).toContain(`data-el="${el}"`)
  for (const f of FIELDS) { expect(html).toContain(`data-field="${f.key}"`); expect(html).toContain(`data-captured="${f.key}"`) }
})
it('never uses time-dependent CSS', () => {
  expect(html).not.toMatch(/\b(transition|animate-|duration-)/)
  const css = readFileSync('promo/video/styles.css', 'utf8')
  expect(css).not.toMatch(/transition|@keyframes/)
})
```

- [ ] **Step 2: Test laufen lassen, erwartet FAIL.**
- [ ] **Step 3: `renderStage()` und die Bühnen-CSS umsetzen.** Maße und Stile aus Spec §5/§6. Chrome-Leiste, Popup, Feld-Fenster und Leiste mit den Utility-Klassen der echten Komponenten nachbauen (Referenzen: `entrypoints/popup/App.vue` 150–200 und 380–425, `src/recorder/CapturePopover.vue`, `src/recorder/Recorder.vue` 262–300 und 370–430, `src/manage/TemplateTable.vue`).
- [ ] **Step 4: Test laufen lassen, erwartet PASS**; `npm run typecheck`, `npm run lint`.
- [ ] **Step 5: Sichtprüfung** – `npm run video:preview`: Bei `tl.seek(0)` ist nur Glow + Intro sichtbar; die restlichen Ebenen liegen unsichtbar bereit (in der Vorschau per Konsole `gsap.set('[data-el=window]', {opacity: 1})` kurz einblenden und mit dem Storyboard vergleichen).
- [ ] **Step 6: Commit** – `git commit -m "feat(video): render the stage markup for all scenes"`

---

### Task 4: Render-Skript (Frames, MP4, GIF)

**Files:**
- Create: `promo/video/render-lib.ts`, `promo/video/render.ts`
- Test: `tests/promo/render-lib.test.ts`

**Interfaces:**
- Produces `render-lib.ts`:
  - `export interface RenderArgs { mode: Mode; fps: number; at: number[] | null; skipEncode: boolean }`; `export function parseArgs(argv: string[]): RenderArgs` – Defaults `{ mode: 'full', fps: 30, at: null, skipEncode: false }`; im Modus `teaser` ist `fps` default 20; `--at 1.5,9` → `[1.5, 9]`.
  - `export function frameTimes(duration: number, fps: number): number[]` – `[0, 1/fps, …]` bis `< duration`.
  - `export function ffmpegArgs(kind: 'mp4' | 'palette' | 'gif', o: { fps: number; input: string; output: string; palette?: string; dither: boolean }): string[]` – MP4: `-y -framerate fps -i input -c:v libx264 -pix_fmt yuv420p -crf 22 -preset slow -movflags +faststart output`; Palette: `-vf scale=960:540:flags=lanczos,palettegen=max_colors=256:stats_mode=diff`; GIF: `-lavfi scale=960:540:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3` (ohne Dithering: `dither=none`), `-loop 0`.
  - `export function hasEncoders(encoderList: string): boolean` – true, wenn `libx264` und ` gif ` vorkommen.
  - `export function sizeLimit(kind: 'mp4' | 'gif'): number` – 10 bzw. 5 MiB.
  - `export const REDUCTIONS = ['fps15', 'trim9s', 'nodither'] as const`; `export function nextReduction(done: readonly string[]): (typeof REDUCTIONS)[number] | null`.
  - `export function fontReport(checks: Record<string, boolean>): string[]` – je nicht geladener Schrift `Schrift nicht geladen: <name>`.
- Produces `render.ts` (CLI, `tsx`): prüft `ffmpeg -hide_banner -encoders` mit `hasEncoders`, startet Vite per `createServer({ configFile: 'promo/video/vite.config.ts' })`, `chromium.launch({ channel: 'chrome' })`, Seite 1920 × 1080 mit `?render&mode=<mode>`, wartet auf `window.__video.ready`, loggt `fontReport` aus `document.fonts.check('300 16px Wotfard')` und `check('700 16px "Bricolage Grotesque"')`, fotografiert pro `frameTimes(duration, fps)` nach `seek(t)` als PNG in `out/frames/` (full) bzw. `out/teaser/` (teaser), mit `--at` nur die genannten Zeiten nach `out/at/<t>.png`. Danach ffmpeg (außer `--skip-encode`): full → `out/form-filler.mp4`; teaser → Palette + `docs/media/teaser.gif`. Prüft die Dateigröße gegen `sizeLimit` und bricht mit Exit 1 und dem nächsten Reduktionsschritt in der Meldung ab, wenn sie überschritten ist.

- [ ] **Step 1: Failing tests schreiben** – `tests/promo/render-lib.test.ts` mit je einem `it` für Defaults/`--at`, `frameTimes(2, 30)` (60 Werte, letzter `59/30`), MP4-/GIF-Argumente (enthalten `libx264`, `yuv420p`, `-crf`, `22`, `palettegen`, `bayer_scale=3`, `scale=960:540`), `hasEncoders` (Beispielausgabe mit/ohne `libx264`), `sizeLimit`, `nextReduction([])` → `'fps15'`, `nextReduction(['fps15','trim9s','nodither'])` → `null`, `fontReport({ Wotfard: false, 'Bricolage Grotesque': true })` → `['Schrift nicht geladen: Wotfard']`.
- [ ] **Step 2: Tests laufen lassen, erwartet FAIL.**
- [ ] **Step 3: `render-lib.ts` und `render.ts` umsetzen.**
- [ ] **Step 4: Tests PASS; `npm run typecheck`, `npm run lint`.**
- [ ] **Step 5: Durchstich** – `npm run video:render -- --at 0,30 --skip-encode` erzeugt zwei PNGs 1920 × 1080 in `promo/video/out/at/`; `npm run video:render -- --fps 2` rendert ~114 Frames und ein kurzes MP4 ohne Fehler (nur Funktionsprobe).
- [ ] **Step 6: Commit** – `git commit -m "feat(video): add frame renderer with ffmpeg export"`

---

### Task 5: Bausteine, Intro und Problem-Szene

**Files:**
- Modify: `promo/video/fx.ts`, `promo/video/timeline.ts`
- Create: `promo/video/scenes/intro.ts`, `promo/video/scenes/problem.ts`
- Test: `tests/promo/timeline.test.ts` (erweitern)

**Interfaces:**
- Produces in `fx.ts` (alle fügen an `tl` bei absoluter Zeit `at` ein und geben die Endzeit zurück):
  - `cursorTo(tl, root, x: number, y: number, at: number, duration = 0.45): number` (Bühnenkoordinaten, `power2.inOut`)
  - `click(tl, root, at: number): number` – Pfeil kurz auf 0.9, Ripple 300 ms
  - `typeText(tl, el: Element, text: string, at: number, msPerChar: number, caret = false): number` – TextPlugin, optional blinkender Caret
  - `caption(tl, root, key: keyof typeof CAPTIONS, at: number, hold: number): number` – ein-/ausblenden nach Spec §6
  - `zoom(tl, root, focus: { x: number; y: number; scale: number }, at: number, duration = 0.7): number` – auf `[data-el=window]`
  - `glow(tl, el: Element, at: number): number` – Teal-Box-Shadow 0 → 1 → 0 in 500 ms
  - `sweep(tl, root, at: number): number` – Lichtstreifen 900 ms über `[data-el=browser]`
- Produces `scenes/intro.ts` `intro(ctx)` und `scenes/problem.ts` `problem(ctx)`; `timeline.ts` ruft im Modus `full` beide mit `at = sceneStart(id)` auf.

Ablauf (Offsets in der Szene, Richtwerte): **Intro** 0,0 Icon skaliert 0,6 → 1 (`back.out(1.4)`), 0,3–1,4 Pegel steigt (`[data-el=icon-liquid]` y von +52 auf 0), 1,2 Titel, 1,8 Claim, 2,6 „developed by“, 4,6–5,8 Icon schrumpft zur Symbolleiste (Zielposition von `[data-el=toolbar-icon]` per `getBoundingClientRect` relativ zur Bühne), Browser fährt von y +300 ein, Intro-Texte blenden aus. **Problem** 0,0 Caption `problem` (hold 4,5), 0,4 Cursor zum Feld `company`, Klick, Tippen „Max“ (65 ms/Zeichen, Caret), 1,8 Pause, 2,2 Text löschen (TextPlugin rückwärts), 2,8 „Nordlicht“ (45 ms/Zeichen), 3,9 Wisch (Werte-Spans auf leer, kurzer Glow).

- [ ] **Step 1: Failing test ergänzen** – in `timeline.test.ts`:

```ts
it('seeks deterministically: the same time yields the same DOM regardless of the path', () => {
  const root = document.createElement('div'); root.innerHTML = renderStage(); document.body.append(root)
  const tl = buildTimeline(root, 'full')
  tl.seek(0); tl.seek(4); const a = root.innerHTML
  tl.seek(40); tl.seek(4); expect(root.innerHTML).toBe(a)
})
it('shows the claim during the intro and hides it in the problem scene', () => {
  const root = …; const tl = buildTimeline(root, 'full')
  const claim = root.querySelector<HTMLElement>('[data-el=claim]')!
  tl.seek(3); expect(parseFloat(claim.style.opacity)).toBeGreaterThan(0.9)
  tl.seek(sceneStart('problem') + 1); expect(parseFloat(claim.style.opacity)).toBe(0)
})
```

- [ ] **Step 2: Tests FAIL.**
- [ ] **Step 3: `fx.ts`-Bausteine, `intro.ts`, `problem.ts` umsetzen; in `timeline.ts` registrieren.**
- [ ] **Step 4: Tests PASS; typecheck, lint.**
- [ ] **Step 5: Sichtprüfung** – `npm run video:render -- --at 1,3,5.5,7,9 --skip-encode`, PNGs gegen Storyboard Bild 0/1 prüfen: Pegel sichtbar gestiegen, Match-Cut landet auf dem Symbolleisten-Icon, Caption liegt in der Textzone.
- [ ] **Step 6: Commit** – `git commit -m "feat(video): add animation helpers, intro and problem scenes"`

---

### Task 6: Szenen „App erkennen“ und „Vorlage aufnehmen“

**Files:**
- Create: `promo/video/scenes/detect.ts`, `promo/video/scenes/record.ts`
- Modify: `promo/video/timeline.ts`
- Test: `tests/promo/timeline.test.ts` (erweitern)

**Interfaces:** `detect(ctx)`, `record(ctx)`; verwenden nur `fx.ts`.

Ablauf **detect** (8 s): 0,0 Cursor zum Symbolleisten-Icon, 0,6 Klick, 0,7 Popup `popup-noapp` erscheint (y −8 → 0, Deckung), 0,9 `veil` auf 0,55, 1,0 Zoom auf Popup (Fokus Popup-Mitte, Scale 1,6), 1,6 Caption `detect1` (hold 3), 1,8 Tippen „Kundenportal“ (60 ms/Zeichen), 3,2 Cursor zu „App anlegen“, Klick, 3,5 `permission` erscheint, 4,4 Klick „Zulassen“, 4,6 Wechsel auf `popup-app` (Kopf „Kundenportal“, „An der Adresse erkannt“), 5,0 Caption `detect2` (hold 2,5), 6,8 Zoom zurück, Veil weg, 7,6 Popup schließt.

Ablauf **record** (14 s): 0,0 Popup `popup-app` öffnet, Cursor zur Kachel „+ Neue Vorlage“, 0,8 Klick, Name „Kundenanlage“ tippen, 2,2 Klick „Anlegen und Felder aufnehmen“, 2,6 Popup zu, `bar` fährt von unten ein („Aufnahme · 0 Felder“), 3,0 Caption `record1` (hold 4), 3,2 Cursor zu `company`, Klick → Rahmen `brand-fg`, `popover` erscheint (Kopf „Feld „Firma““, Datentyp „Firmenname“, Chip Pflichtfeld aktiv), 4,6 Klick „Übernehmen“ → `captured=company` Box ein, Zähler „1 Feld“, 5,2 Feld `email` ebenso bis 7,2 („2 Felder“), 7,4 Caption `record2` (hold 2,5), 7,6–11,0 Zeitraffer: Cursor hüpft je 0,3 s durch die restlichen 10 Felder, je Feld `captured`-Box + Zähler, 11,2 Caption `record3` (hold 2,4), 11,4 Cursor zu „Speichern“, 11,9 Klick, 12,1 `saved` erscheint 1,5 s, 13,4 Leiste und Boxen blenden aus.

- [ ] **Step 1: Failing tests ergänzen** – `tl.seek(sceneStart('detect') + 2.5)`: `[data-el=popup-noapp]` Deckung 1, `[data-el=veil]` Deckung ≈ 0,55; `tl.seek(sceneStart('record') + 13)`: Zähler-Text in `[data-el=bar]` enthält „12 Felder“ und alle 12 `[data-captured]` haben Deckung 1.
- [ ] **Step 2: FAIL.** – [ ] **Step 3: Umsetzen.** – [ ] **Step 4: PASS, typecheck, lint.**
- [ ] **Step 5: Sichtprüfung** – `--at 13,15,22,25,29,31`: Popup im Zoom lesbar, Veil dunkelt die Seite, Feld-Fenster überdeckt nicht die Textzone, grüne Boxen mit Typ-Label wie in der echten Aufnahme.
- [ ] **Step 6: Commit** – `git commit -m "feat(video): add app detection and template recording scenes"`

---

### Task 7: Szenen „Ausfüllen“ und „Tastenkürzel“

**Files:**
- Create: `promo/video/scenes/fill.ts`, `promo/video/scenes/shortcut.ts`
- Modify: `promo/video/timeline.ts`
- Test: `tests/promo/timeline.test.ts` (erweitern)

**Interfaces:**
- `fill(ctx, options: { dataset: 0 | 1; caption: boolean; camera: 'full' | 'teaser' })` – wiederverwendbar für Szene 4 und den Teaser (Task 9). `shortcut(ctx)`.
- Produces in `fx.ts`: `fillCascade(tl, root, dataset: 0 | 1, at: number): number` – Felder in Spec-Reihenfolge je 0,14 s versetzt: `typeText` mit 30 ms/Zeichen (max. 0,6 s je Feld), `glow` je Feld; Kundennummer bekommt den Kennungs-Teil in `text-brand-2`.

Ablauf **fill** (10 s): 0,0 Popup `popup-app` öffnet, 0,6 Cursor zu „Füllen“, 1,0 Klick (Button kurz dunkler = Beschäftigt), 1,1 `sweep`, 1,2 `fillCascade(0)`, 3,4 Caption `fill1` (hold 2), 3,6 Status „Kundenanlage: 12 von 12 befüllt“ mit grünem Punkt, Badge „✓“ (`back.out(1.4)`), 4,0 Zoom auf Kundennummer (Scale 1,8, 1,2 s halten), 5,6 Zoom zurück, 6,0 Klick „Füllen“ erneut, 6,2 `fillCascade(1)`, 6,4 Caption `fill2` (hold 3), 9,4 Popup schließt.

Ablauf **shortcut** (5 s): 0,2 Caption `shortcut` (hold 3,5), 0,4 Tastenkappen ploppen nacheinander ein (`back.out(1.4)`, je 0,15 s versetzt), 1,2–1,8 drücken sich nacheinander nieder (Unterkante 4 px → 1 px, y +4), 1,9 `fillCascade(0)` ohne Popup, 4,2 Tastenkappen aus.

- [ ] **Step 1: Failing tests ergänzen** – `tl.seek(sceneStart('fill') + 3.8)`: `[data-field=company] [data-el=value]` Text = `DATASETS[0].company`, `[data-el=badge]` Text „✓“, `[data-el=status]` enthält „12 von 12 befüllt“; `tl.seek(sceneStart('fill') + 9)`: `company` Text = `DATASETS[1].company`; `tl.seek(sceneStart('shortcut') + 1.5)`: `[data-key=alt]` hat `y` > 0 (`gsap.getProperty`).
- [ ] **Step 2: FAIL.** – [ ] **Step 3: Umsetzen.** – [ ] **Step 4: PASS, typecheck, lint.**
- [ ] **Step 5: Sichtprüfung** – `--at 34.5,36.8,37.8,40,44.5,45.8`: Lichtstreifen sichtbar, Kaskade von oben nach unten, Kennung in Teal, Badge „✓“ grün, Tastenkappen gedrückt.
- [ ] **Step 6: Commit** – `git commit -m "feat(video): add fill and shortcut scenes"`

---

### Task 8: Szenen „Verwalten“ und Outro, volles Rendern

**Files:**
- Create: `promo/video/scenes/manage.ts`, `promo/video/scenes/outro.ts`
- Modify: `promo/video/timeline.ts`
- Test: `tests/promo/timeline.test.ts` (erweitern)

Ablauf **manage** (5 s): 0,0 harter Schnitt: `page` aus, `manage` ein, `url` zeigt `chrome-extension://…/manage.html`, 0,3 Caption `manage` (hold 4), 0,6 Cursor zum Griff der Zeile `email`, Drag um eine Zeile nach oben (Zeile hebt sich: Schatten + Rahmen `brand-fg`, andere Zeile rutscht), 2,2 Cursor zum Pflicht-Schalter `phone`, Klick, Schalter kippt, 3,2 Cursor zu „Exportieren“, Klick, 3,5 kleines Dokument-Symbol fliegt nach unten rechts heraus, 4,6 Ausblenden.

Ablauf **outro** (4 s): 0,0 Fenster-Ebene aus, 0,2 Icon + Titel ein, 0,8 `outroRepo` (in `text-brand-fg`), 1,2 `outroBrowsers`, 1,6 `outroCopyright` (in `text-subtle`), hält bis Ende.

- [ ] **Step 1: Failing tests ergänzen** – `tl.seek(sceneStart('manage') + 3)`: `[data-el=manage]` Deckung 1, `[data-el=page]` Deckung 0; `tl.seek(TOTAL - 0.1)`: `[data-el=outro]` Deckung 1 und enthält „github.com/marliedev/form-filler“.
- [ ] **Step 2: FAIL.** – [ ] **Step 3: Umsetzen.** – [ ] **Step 4: PASS, typecheck, lint; `npm test` komplett grün.**
- [ ] **Step 5: Volles Rendern** – `npm run video:render`: MP4 entsteht in `promo/video/out/form-filler.mp4`, Log ohne Schrift-Warnung (Wotfard lokal vorhanden), Größe ≤ 10 MB, Dauer 57 s (`ffprobe` oder Log). Datei in Dia/QuickTime ansehen; Auffälligkeiten (Timing, Überlappungen) direkt in den Szenen korrigieren und erneut rendern.
- [ ] **Step 6: Commit** – `git commit -m "feat(video): add manage and outro scenes"`

---

### Task 9: Teaser-Modus, GIF und README

**Files:**
- Modify: `promo/video/timeline.ts` (Modus `teaser`), `promo/video/scenes/fill.ts` (Kamera `teaser`), `README.md`
- Create: `docs/media/teaser.gif` (gerendert)
- Test: `tests/promo/timeline.test.ts` (erweitern)

**Interfaces:** Im Modus `teaser` baut `buildTimeline` nur: Fenster-Ebene sofort sichtbar, `zoom` auf Formular + Popup (Fokus x 1180 / y 420, Scale 1,4) bei 0 ohne Dauer, Glow auf 50 % Deckung, dann `fill(ctx, { dataset: 0, caption: true, camera: 'teaser' })` ab 0,2 mit den Captions `fill1` und `fill2`, Ende bei `TEASER_DURATION` mit 0,8 s Standbild.

- [ ] **Step 1: Failing test ergänzen** – `const tl = buildTimeline(root, 'teaser'); tl.seek(5)`: `gsap.getProperty(root.querySelector('[data-el=window]'), 'scale')` ≥ 1,4 und `[data-el=intro]` Deckung 0.
- [ ] **Step 2: FAIL.** – [ ] **Step 3: Umsetzen.** – [ ] **Step 4: PASS, typecheck, lint.**
- [ ] **Step 5: GIF rendern** – `npm run video:teaser`: `docs/media/teaser.gif` entsteht, 960 × 540, ≤ 5 MB; sonst Reduktionsschritte in der Reihenfolge aus `REDUCTIONS` anwenden (Flag `--reduce fps15` usw. in `render.ts`, falls noch nicht vorhanden, in diesem Task ergänzen) und neu rendern. GIF in Dia ansehen: Statuszeile lesbar, keine Farbbänder im Glow.
- [ ] **Step 6: README** – direkt unter der H1: `![Form Filler füllt ein Formular mit einem Klick](docs/media/teaser.gif)`; neuer Abschnitt „## Video“ nach „Funktionen“: ein Satz, dass das vollständige Video unten eingebettet wird (Platzhalter-Kommentar `<!-- Video-Link nach dem Upload hier eintragen -->`), dazu „Neu rendern: `npm run video:render` (MP4 nach `promo/video/out/`), `npm run video:teaser` (GIF)“ und der Hinweis, dass Wotfard lokal vorliegen muss, damit die Fließtexte im Video der Marke entsprechen.
- [ ] **Step 7: Commit** – `git add docs/media/teaser.gif README.md promo/video tests/promo && git commit -m "feat(video): add teaser mode, render the README teaser gif"`

---

## Abschluss

- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` grün (der Extension-Build darf `promo/` nicht einbinden; prüfen, dass `.output/` unverändert bleibt).
- [ ] Die Suche nach Namen aus dem beruflichen Umfeld (Liste liegt lokal, nicht im Repository) über das gesamte Repository und die Branch-Historie liefert nichts.
- [ ] PR `feat/promo-video` → `main` mit MP4-Größe, GIF-Größe und offenen Sichtprüfungen (Dia, hell/dunkel) in der Beschreibung.
