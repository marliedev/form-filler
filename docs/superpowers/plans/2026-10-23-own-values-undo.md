# Nur eigene Werte überschreiben und Rückgängig – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Füllen lässt fremde Eingaben stehen, ersetzt nur eigene Werte, meldet ausgelassene Felder als „bereits ausgefüllt“ und lässt sich mit „Rückgängig“ zurücknehmen.

**Architecture:** Ein Seitengedächtnis im Content-Script (`src/fill/ownership.ts`) kennt je Element und je Feldbeschreibung den zuletzt geschriebenen Zustand, den Platzhaltertext von ARIA-Feldern und die Felder des letzten Laufs. `runFill` fragt es vor jedem Feld; ein neuer Status `kept` läuft durch Bericht, Statuszeile und Protokoll. Eine neue Nachricht `undo` setzt den letzten Lauf mit den Füll-Primitiven zurück; Popup und Tastenkürzel nutzen denselben Weg.

**Tech Stack:** WXT 0.21 (MV3), Vue 3, TypeScript strict, Vitest + happy-dom + fake-browser, Playwright-Browsertest.

**Spec:** `docs/superpowers/specs/2026-10-23-own-values-undo-design.md`

## Global Constraints

- Basis `main` nach Merge von PR #13 und #14; Branch `feat/own-values-undo` (trägt Spec und Plan).
- Texte exakt: Status „bereits ausgefüllt“, Detail „Bereits ausgefüllt“, Hinweis „Letzter Lauf zurückgenommen · N Felder“, mit Anhang „ · nicht zurückgesetzt: A, B“, Fehler „Nichts zum Zurücknehmen – die Seite wurde seit dem letzten Lauf neu geladen.“, Knopf „Rückgängig“.
- Zustände als Zeichenkette (`FieldState = string`): Text/Datum = Wert; Auswahlliste = gewählter Wert; Radiogruppe = Wert des gewählten Radios, sonst `''`; Checkbox = `'on'`/`''`; Combobox und Auswahl-Button = angezeigter Text. `''` heißt leer.
- Füllbar = Zustand leer **oder** gleich dem Standard (`defaultState`) **oder** eigen (je Element oder je Feldbeschreibung). Sonst `kept`.
- `kept` ist kein Problem (Badge ✓, `problemCount` zählt es nicht), zählt aber zu `total`.
- Kein `any`, Kommentare Englisch (nur das Warum), Conventional Commits auf Englisch, keine KI-Attribution.

## Review Focus

- Auswahlliste ohne Platzhalter (erste Option vorgewählt) → wird gefüllt, nicht `kept` (Test in Task 1).
- Checkbox, die die Seite per HTML `checked` vorbelegt → gilt als Standard und wird nach Vorlage gesetzt; von der Testerin angehakt → bleibt (Test in Task 1).
- Prozess: Schritt 1 füllen, „Weiter“, „Zurück“ baut die Felder neu auf, „Neuer Datensatz“, erneut füllen → eigene Werte werden ersetzt (Browsertest in Task 3).
- Rückgängig nach einem Lauf, in dem die Testerin ein Feld danach geändert hat → das Feld bleibt und wird genannt (Test in Task 2).
- Zweiter Lauf ohne Datensatzwechsel → gleiche Werte werden erneut geschrieben, Bericht zeigt „befüllt“, Rückgängig stellt den Zustand vor dem zweiten Lauf her (Test in Task 2).

---

### Task 1: Zustand, Gedächtnis und `kept`

**Files:**
- Modify: `src/dom/fill.ts`, `src/fill/runFill.ts`, `src/fill/reportSummary.ts`, `src/ui/FillReportView.vue`
- Create: `src/fill/ownership.ts`
- Test: `tests/dom/fill.test.ts`, `tests/fill/ownership.test.ts`, `tests/fill/runFill.test.ts`, `tests/fill/reportSummary.test.ts`

**Interfaces:**
- Consumes: `fillElement`, `displayedText`-Logik in `fill.ts`; `FieldRule`, `ControlKind`; `isProblem`/`STATUS_TEXT`.
- Produces (`fill.ts`): `export type FieldState = string`; `currentState(el: FormControl, kind: ControlKind): FieldState`; `defaultState(el: FormControl, kind: ControlKind, placeholder: string): FieldState` (HTML-Standard: `defaultValue`, `defaultChecked`-Radio, `defaultSelected`-Option sonst erste Option; für `combobox` der übergebene Platzhalter).
- Produces (`ownership.ts`):
  ```ts
  export interface RunEntry { el: FormControl; fieldId: string; label: string; kind: ControlKind; before: FieldState; written: FieldState }
  export interface Ownership {
    isOwn(el: Element, key: string, state: FieldState): boolean
    /** Returns the stored placeholder text of an ARIA control, storing `shown` on first contact. */
    placeholderOf(el: Element, shown: string): string
    beginRun(): void
    record(entry: RunEntry): void
    lastRun(): readonly RunEntry[]
    clearRun(): void
  }
  export function createOwnership(): Ownership
  /** One memory per page; lives until the page reloads. */
  export function pageOwnership(): Ownership
  export const locatorKey = (locator: FieldLocator): string => JSON.stringify(locator)
  ```
- Produces (`runFill.ts`): `FieldReport['status']` um `'kept'`; `runFill(root, t, ds, mode, f, ownership = pageOwnership())`.
- Produces (`reportSummary.ts`): `STATUS_TEXT.kept = 'bereits ausgefüllt'`; `summarizeReport` hängt `· N bereits ausgefüllt` nach den Problemen an.

- [ ] **Step 1: Failing tests schreiben**

`tests/dom/fill.test.ts`, neuer `describe('currentState / defaultState')`:

```ts
it('reads text, select, radio, checkbox and combobox states', () => {
  setup(`<input id="t" value="x"><select id="s"><option value="">Bitte wählen</option><option value="a" selected>A</option></select>
    <label><input type="radio" name="r" value="1"> 1</label><label><input type="radio" name="r" value="2" checked> 2</label>
    <input id="c" type="checkbox" checked><div id="cb" role="combobox" aria-controls="lb"><span>Deutschland</span></div>`)
  expect(currentState(q('#t'), 'text')).toBe('x')
  expect(currentState(q('#s'), 'select')).toBe('a')
  expect(currentState(q('input[name="r"]'), 'radiogroup')).toBe('2')
  expect(currentState(q('#c'), 'checkbox')).toBe('on')
  expect(currentState(q('#cb'), 'combobox')).toBe('Deutschland')
})
it('treats the HTML default as the default state', () => {
  setup(`<input id="t" value="vorbelegt"><select id="s"><option value="a">A</option><option value="b">B</option></select>
    <label><input type="radio" name="r" value="1" checked> 1</label><input id="c" type="checkbox">`)
  expect(defaultState(q('#t'), 'text', '')).toBe('vorbelegt')
  expect(defaultState(q('#s'), 'select', '')).toBe('a')          // first option, no placeholder
  expect(defaultState(q('input[name="r"]'), 'radiogroup', '')).toBe('1')
  expect(defaultState(q('#c'), 'checkbox', '')).toBe('')
  expect(defaultState(q('#cb') /* combobox from previous markup */, 'combobox', 'Bitte wählen')).toBe('Bitte wählen')
})
```

`tests/fill/ownership.test.ts`:

```ts
it('recognizes own values per element and per locator key after a re-render', () => {
  const o = createOwnership()
  const el = document.createElement('input'); const key = locatorKey({ kind: 'text', name: 'zip' })
  o.beginRun(); o.record({ el, fieldId: 'f', label: 'PLZ', kind: 'text', before: '', written: '50667' })
  expect(o.isOwn(el, key, '50667')).toBe(true)
  expect(o.isOwn(el, key, '50668')).toBe(false)
  const rebuilt = document.createElement('input')
  expect(o.isOwn(rebuilt, key, '50667')).toBe(true)   // same locator, new element
  expect(o.isOwn(rebuilt, locatorKey({ kind: 'text', name: 'city' }), '50667')).toBe(false)
})
it('keeps the first shown text of an ARIA control as its placeholder', () => { /* placeholderOf(el, 'Bitte wählen') → 'Bitte wählen'; placeholderOf(el, 'Deutschland') → 'Bitte wählen' */ })
it('keeps only the last run', () => { /* beginRun, record a; beginRun, record b → lastRun() is [b]; clearRun() → [] */ })
```

`tests/fill/runFill.test.ts` (Markup der Datei nutzen):

```ts
it('keeps a field with a foreign value and reports it as kept', ...)   // input value 'Kunde 4711' vorher per el.value gesetzt (kein defaultValue) → status 'kept', detail 'Bereits ausgefüllt', total zählt es, filled nicht
it('fills empty fields, HTML defaults and its own values', ...)        // leer → filled; value-Attribut vorbelegt → filled; zweiter Lauf mit anderem Datensatz → filled (eigen)
it('fills a select without placeholder and a checkbox checked by the page, keeps a checkbox ticked by hand', ...)
it('records before and written state for undo', ...)                   // ownership.lastRun() enthält Einträge mit before '' und written = Feldwert
```

`tests/fill/reportSummary.test.ts`: `it('counts kept fields without treating them as problems', ...)` → `summarizeReport` = `'11 von 12 befüllt · 1 bereits ausgefüllt'`, `problemCount` 0.

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run tests/dom/fill.test.ts tests/fill`
Expected: FAIL – `currentState`/`ownership` fehlen, `kept` unbekannt.

- [ ] **Step 3: Implementieren**

`currentState`/`defaultState` in `fill.ts` neben `displayedText` (dieselben Helfer nutzen; Radiogruppe über `nativeGroup`/`[role="radio"][aria-checked="true"]`). `ownership.ts` mit `WeakMap<Element, FieldState>`, `Map<string, FieldState>` (Locator-Schlüssel), `WeakMap<Element, string>` (Platzhalter) und `RunEntry[]`. `runFill`: vor `fillElement` → `state = currentState`, `fillable = state === '' || state === defaultState(el, kind, ownership.placeholderOf(el, state)) || ownership.isOwn(el, locatorKey(rule.locator), state)`; nicht füllbar → `{ status: 'kept', detail: 'Bereits ausgefüllt' }`; nach erfolgreichem Füllen `ownership.record({ … before: state, written: currentState(el, kind) })`; `ownership.beginRun()` am Anfang von `runFill`. `FillReportView`: `kept` mit Icon „–“ und `text-muted`, Rang wie `skipped`.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run`
Expected: PASS (bestehende Tests bleiben grün; Felder in den vorhandenen Tests sind leer oder HTML-vorbelegt).

- [ ] **Step 5: Commit**

```bash
git add src/dom/fill.ts src/fill/ownership.ts src/fill/runFill.ts src/fill/reportSummary.ts src/ui/FillReportView.vue tests/dom/fill.test.ts tests/fill
git commit -m "feat: fill only empty, default or own values and report kept fields"
```

---

### Task 2: Rückgängig im Content-Script, Dispatch und Popup

**Files:**
- Create: `src/fill/undo.ts`
- Modify: `src/fill/messages.ts`, `entrypoints/content.ts`, `src/fill/dispatch.ts`, `src/fill/lastReport.ts`, `src/popup/usePopup.ts`, `entrypoints/popup/App.vue`, `entrypoints/background.ts` (e2e-Hook)
- Test: `tests/fill/undo.test.ts`, `tests/fill/dispatch.test.ts`, `tests/popup/usePopup.test.ts`, `tests/popup/App.test.ts`

**Interfaces:**
- Consumes: `Ownership`, `RunEntry`, `currentState`, Füll-Primitiven (Task 1).
- Produces: `messages.ts`: `ContentMessage` um `{ type: 'undo' }`; `export type UndoResponse = { ok: true; restored: number; kept: string[] } | { ok: false; error: string }`. `undo.ts`: `undoLastRun(ownership: Ownership): Promise<UndoResponse>` (rückwärts über `lastRun()`; `currentState !== written` → `kept` mit Label; Radio mit `before === ''` und ARIA-Feld mit `before === placeholder` → `kept`; sonst zurücksetzen über `fillElement` mit `before` als festem Wert, Text auch `''`; danach `clearRun()`; leerer `lastRun` → `{ ok: false, error: 'Nichts zum Zurücknehmen – die Seite wurde seit dem letzten Lauf neu geladen.' }`). `lastReport.ts`: `clearLastReport(tabId)` (Bericht aus `storage.session` entfernen, Badge leeren). `dispatch.ts`: `undoLastRun(tabId: number): Promise<UndoResponse>` (injizieren, senden, bei `ok` Bericht löschen). `usePopup`: `canUndo: ComputedRef<boolean>` (`report.filled > 0`), `undo(): Promise<void>` (Notiz mit `restored`/`kept`, `report = null`; bei `ok: false` die Meldung als Notiz, `report = null`). e2e-Hook: `__formFillerE2E.undoLastRun`.

- [ ] **Step 1: Failing tests schreiben**

`tests/fill/undo.test.ts` (Markup wie `runFill.test.ts`, Lauf über `runFill` mit `createOwnership()`):

```ts
it('restores text, select and checkbox to their state before the run', ...)   // vorher 'alt', '', '' → nach runFill geändert → undo → wieder 'alt', Platzhalter, unchecked; restored 3
it('leaves fields changed by hand after the run and names them', ...)          // Feld nach dem Lauf auf 'manuell' gesetzt → bleibt, kept ['PLZ']
it('cannot clear a radio group or a combobox that showed its placeholder and says so', ...)   // kept enthält 'Rolle', 'Land'
it('answers with an error when there is nothing to undo', ...)
```

`tests/fill/dispatch.test.ts`: `it('undoLastRun injects, sends undo and clears report and badge', ...)`. `tests/popup/usePopup.test.ts`: `it('undo shows the result and drops the report', ...)`, `it('undo reports a reloaded page', ...)`. `tests/popup/App.test.ts`: `it('offers Rückgängig after a run and reports the result', ...)` (Knopf nur bei `report.filled > 0`; nach Klick Statuszeile „Letzter Lauf zurückgenommen · 1 Felder“; Knopf weg).

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run tests/fill tests/popup`
Expected: FAIL – `undo` fehlt.

- [ ] **Step 3: Implementieren** (Schnittstellen oben; Hinweistext: `Letzter Lauf zurückgenommen · ${restored} Felder` plus ` · nicht zurückgesetzt: ${kept.join(', ')}` wenn `kept` nicht leer). Knopf „Rückgängig“ (`secondaryButton`) in der Statuszeile neben „Details“, `v-if="canUndo && !busy"`.

- [ ] **Step 4: Tests, Typecheck, Lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: PASS, keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/fill/undo.ts src/fill/messages.ts entrypoints/content.ts src/fill/dispatch.ts src/fill/lastReport.ts src/popup/usePopup.ts entrypoints/popup/App.vue entrypoints/background.ts tests/fill tests/popup
git commit -m "feat: undo the last fill run from the popup"
```

---

### Task 3: Browsertest und Dokumentation

**Files:**
- Modify: `tests/e2e/fixtures.ts` (`undo(tabId)`), `README.md`, `docs/manual-test-checklist.md`
- Create: `tests/e2e/own-values.spec.ts`

- [ ] **Step 1: Failing test schreiben**

```ts
test('lässt fremde Eingaben stehen, ersetzt eigene Werte und nimmt den Lauf zurück', async ({ extension }) => {
  await extension.seed([APP], [STEP1])
  const { page, tabId } = await extension.open()
  await page.locator('#customer-no').fill('K-MANUELL')
  const first = await extension.fill(tabId, STEP1.id)
  expect(first.fields.find((f) => f.fieldId === 'f-customer-no')?.status).toBe('kept')
  const m1 = await model(page)
  expect(m1.customerNo).toBe('K-MANUELL')
  // own values are replaced after a new dataset, the manual one stays
  await extension.newDataset(tabId)   // Helfer: clearDatasetsForTab über den Worker (chrome.storage.session keys ds:<tab>:*)
  const second = await extension.fill(tabId, STEP1.id)
  const m2 = await model(page)
  expect(m2.company).not.toBe(m1.company)
  expect(m2.customerNo).toBe('K-MANUELL')
  expect(second.fields.filter((f) => f.status === 'kept').map((f) => f.fieldId)).toEqual(['f-customer-no'])
  // undo restores the state before the second run
  const undone = await extension.undo(tabId)
  expect(undone).toMatchObject({ ok: true })
  const m3 = await model(page)
  expect(m3.company).toBe(m1.company)
  expect(m3.customerNo).toBe('K-MANUELL')
})

test('erkennt eigene Werte nach einem Schrittwechsel wieder', async ({ extension }) => {
  // STEP1 füllen, „Weiter“, „Zurück“, Datensatz neu, erneut füllen → kein kept außer manuell gesetzten Feldern
})
```

- [ ] **Step 2: Fehlschlag prüfen, dann Fixture/Hook ergänzen, Test grün** (`npm run test:e2e`, Expected: alle Szenarien bestanden).

- [ ] **Step 3: Dokumentation**: README „Funktionen“: „**Nichts geht verloren:** Füllen lässt Eingaben stehen, die nicht von Form Filler stammen, und lässt sich mit „Rückgängig“ zurücknehmen.“; „Erste Schritte“ Satz zu Rückgängig; Checkliste Abschnitt 1: Punkte für fremden Wert, Neuer Datensatz, Rückgängig.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e README.md docs/manual-test-checklist.md
git commit -m "test: browser test and docs for own values and undo"
```
