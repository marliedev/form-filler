# Schnellfüllen ohne Vorlage – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Klick im Popup erkennt alle Formularfelder der Seite mit der Recorder-Logik, füllt sie ohne App und Vorlage, und bietet danach an, die Erkennung als Vorlage zu speichern.

**Architecture:** Die Erkennung läuft als reine Funktion im Content-Script (`scanControls`), angestoßen durch eine neue `scan`-Nachricht. Der Hintergrund-/Popup-Teil (`quickFill` in `dispatch.ts`) baut daraus eine Ad-hoc-Vorlage, füllt über den bestehenden Füllpfad und merkt sich den Lauf je Tab in `storage.session`. Das Popup zeigt den Knopf in drei Zuständen und speichert den Lauf auf Wunsch als Vorlage, bei Bedarf samt App.

**Tech Stack:** WXT 0.21 (MV3), Vue 3 `<script setup>`, TypeScript strict, Tailwind v4, Vitest + happy-dom + `wxt/testing/fake-browser`, Playwright (Browsertest aus PR #5).

**Spec:** `docs/superpowers/specs/2026-10-23-quick-fill-design.md`

## Global Constraints

- Basis ist `main` nach dem Merge der PRs #5 (Browsertest), #7 (Datensatz-Zeile) und #8 (Kürzel wählt Vorlage). Branch: `feat/quick-fill` (enthält bereits Spec und Plan; vor Task 1 auf `main` rebasen).
- Kein `any`, Kommentare Englisch (nur das Warum), Commit-Messages Conventional Commits auf Englisch, keine KI-Attribution.
- UI-Texte Deutsch, exakt wie in der Spec: „Ohne Vorlage füllen“, „Erkennt die Felder selbst und füllt sie mit Testdaten.“, „Als Vorlage speichern“, Statuspräfix „Schnellfüllen“, Vorlagen-Notiz „Vorlage „…“ gespeichert – Felder im Pflege-Tab prüfen.“, Fehler „Keine Formularfelder auf dieser Seite erkannt.“, Passwort-Festwert `Test1234!`.
- Ad-hoc-Vorlage: `id: 'quick'`, `name: 'Schnellfüllen'`, `process: null`, `appId: ''`, `lastMissing: []`. Sie wird nie in `storage.local` geschrieben, setzt `lastTemplateId` nicht und ändert keine Vorlage.
- Ausschluss beim Scan: `header, nav, footer, [role="banner"], [role="navigation"], [role="contentinfo"], [role="search"], form-filler-recorder` als Vorfahren; `type="search"`, `role="searchbox"`, `disabled`, `readonly`; die Eingabetypen, die `locator.ts` schon ignoriert.
- Slots: Person 1 / Adresse A zuerst; wiederholt sich ein Typ im aktuellen Slot seiner Familie, beginnt der nächste Slot (2 bzw. B).
- „Als Vorlage speichern“ nur, wenn `samePage(run.url, tab.url)` (Adresse ohne Query und Fragment gleich).
- Jeder Lauf: neuer Datensatz (Vorlage ohne Prozess → `getOrCreateDataset` legt neu an).

## Review Focus

- Seite, deren Felder alle in ausgeschlossenen Bereichen liegen → Fehlerbericht „Keine Formularfelder auf dieser Seite erkannt.“ mit Badge „!“, kein stilles „0 von 0“ (Test in Task 2).
- Felder, die erst nach dem Anhaken einer Checkbox erscheinen (Rechnungsadresse der Testseite) → nicht im Scan; Bericht „12 von 12“, keine Fehlermeldung; die gespeicherte Vorlage lässt sich per „Felder aufnehmen“ ergänzen (Test in Task 5).
- Zweiter Lauf auf derselben Seite → ersetzt den gemerkten Lauf und bringt einen neuen Datensatz (Test in Task 2).
- Seitenwechsel im Tab nach einem Lauf → kein „Als Vorlage speichern“ mehr, auch wenn die Sitzung den Lauf noch hält (Test in Task 3).
- Lauf im Modus „Nur Pflicht“ auf einer Seite ohne Pflichtmarkierungen → „Schnellfüllen: 0 von 0 befüllt“ ist sichtbar, die Umfang-Umschaltung steht direkt darüber (Test in Task 4: Umschaltung in der Ansicht ohne App).

---

### Task 1: Erkennung als reine Funktion

**Files:**
- Modify: `src/dom/locator.ts` (Kandidatensuche aus `findElement` herauslösen)
- Modify: `src/dom/suggest.ts` (Passwortregel)
- Modify: `src/recorder/useRecorder.ts` (`slotSequence` exportieren)
- Create: `src/dom/scan.ts`
- Test: `tests/dom/locator.test.ts`, `tests/dom/suggest.test.ts`, `tests/dom/scan.test.ts`

**Interfaces:**
- Consumes: `describeElement`, `displayLabel`, `isRequired`, `isVisible` (`src/dom/locator.ts`); `suggestDataType` (`src/dom/suggest.ts`); `slotKindFor` (`src/generators/catalog.ts`); `createId` (`src/model/id.ts`).
- Produces: `listControls(root: ParentNode): FormControl[]` in `locator.ts` (sichtbare unterstützte Controls in Dokumentreihenfolge, je nativer Radiogruppe das erste Radio, Radios in `[role="radiogroup"]` nicht einzeln; `findElement` nutzt sie). `export function slotSequence(kind: SlotKind, index: number): string` in `useRecorder.ts`. In `scan.ts`: `assignSlots(rules: readonly FieldRule[]): FieldRule[]` (reine Kopie mit gesetzten Slots) und `scanControls(root: ParentNode): FieldRule[]`.

- [ ] **Step 1: Failing tests schreiben**

`tests/dom/locator.test.ts`, neuer `describe('listControls')`:

```ts
it('lists visible supported controls once per radio group, in document order', () => {
  setup(`
    <input name="a"><input type="hidden" name="h"><input type="submit">
    <input type="radio" name="r" value="1"><input type="radio" name="r" value="2">
    <div role="radiogroup" aria-label="G"><input type="radio" name="g"></div>
    <select name="s"></select><textarea name="t"></textarea>
    <div role="combobox" aria-label="C" aria-controls="l"></div>
    <input name="gone" style="display:none">
  `)
  expect(listControls(document.body).map((el) => el.getAttribute('name') ?? el.getAttribute('aria-label'))).toEqual(['a', 'r', 'G', 's', 't', 'C'])
})
```

`tests/dom/suggest.test.ts`:

```ts
it('gives password fields a fixed value so repeated passwords match', () => {
  expect(suggestDataType(el('<label>Passwort <input type="password"></label>'))).toEqual({ type: 'fixed', value: 'Test1234!' })
})
```

`tests/dom/scan.test.ts` (Helfer `setup(html)` wie in `locator.test.ts`, `rule(type)` baut eine `FieldRule` mit `slot: null`):

```ts
describe('assignSlots', () => {
  it('opens the next address or person slot when a type repeats within the current slot', () => {
    const rules = ['companyName', 'streetName', 'zip', 'city', 'streetName', 'zip', 'firstName', 'lastName', 'email', 'firstName'].map(rule)
    expect(assignSlots(rules).map((r) => r.slot)).toEqual([null, 'A', 'A', 'A', 'B', 'B', '1', '1', '1', '2'])
  })
  it('does not mutate its input', () => { /* slots of the input stay null */ })
})

describe('scanControls', () => {
  it('builds recorder-like rules for the form fields and skips page chrome, search, disabled and readonly fields', () => {
    setup(`
      <header><input name="q"></header>
      <nav><select name="lang"><option>de</option></select></nav>
      <div role="search"><input name="s"></div>
      <main>
        <label for="c">Firmenname *</label><input id="c" name="company" required>
        <label for="p">PLZ</label><input id="p" name="zip">
        <input name="off" disabled><input name="ro" readonly><input type="search" name="find">
        <label for="pw">Passwort</label><input id="pw" type="password">
      </main>
      <footer><input name="newsletter"></footer>
    `)
    const rules = scanControls(document.body)
    expect(rules.map((r) => [r.label, r.config.type, r.slot, r.required, r.appendRunId])).toEqual([
      ['Firmenname', 'companyName', null, true, false],
      ['PLZ', 'zip', 'A', false, false],
      ['Passwort', 'fixed', null, false, false],
    ])
    expect(rules.map((r) => r.locator)).toEqual([
      { kind: 'text', name: 'company', id: 'c', label: 'firmenname', inputType: 'text' },
      { kind: 'text', name: 'zip', id: 'p', label: 'plz', inputType: 'text' },
      { kind: 'text', id: 'pw', label: 'passwort', inputType: 'password' },
    ])
    expect(new Set(rules.map((r) => r.id)).size).toBe(3)
  })

  it('names unlabeled fields by their name attribute, else "Feld"', () => {
    setup('<input name="customer_no"><input>')
    expect(scanControls(document.body).map((r) => r.label)).toEqual(['customer_no', 'Feld'])
  })

  it('ignores the recorder overlay host', () => {
    setup('<form-filler-recorder><input name="x"></form-filler-recorder><input name="y">')
    expect(scanControls(document.body).map((r) => r.locator.name)).toEqual(['y'])
  })
})
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run tests/dom`
Expected: FAIL – `listControls` not exported, `scan` module not found, Passwort-Test erwartet `fixed`, bekommt `text`.

- [ ] **Step 3: `listControls` in `locator.ts` herauslösen**

Die Schleife in `findElement`, die `candidates` sammelt, wird zur exportierten Funktion `listControls(root: ParentNode): FormControl[]` (ohne den `kindOf(el) !== loc.kind`-Filter; `findElement` filtert danach selbst auf `loc.kind`). Verhalten von `findElement` bleibt gleich; die bestehenden Locator-Tests müssen grün bleiben.

- [ ] **Step 4: Passwortregel in `suggest.ts`**

In `suggestDataType` vor der Regelsuche: `if (loc.inputType === 'password') return { type: 'fixed', value: 'Test1234!' }`.

- [ ] **Step 5: `slotSequence` exportieren und `scan.ts` schreiben**

`scan.ts`:
- `const EXCLUDED_ANCESTORS = 'header, nav, footer, [role="banner"], [role="navigation"], [role="contentinfo"], [role="search"], form-filler-recorder'`
- `assignSlots(rules)`: je Slot-Familie (`slotKindFor(rule.config)`) ein Zähler und ein `Set` der im aktuellen Slot vergebenen Typen; Typ schon vergeben → Zähler +1, Set leeren; Slot = `slotSequence(kind, index)`; Regeln ohne Familie behalten `slot: null`.
- `scanControls(root)`: `listControls(root)` → Filter (`el.closest(EXCLUDED_ANCESTORS)`, `type="search"`, `role="searchbox"`, `disabled`, `readOnly` bei `input`/`textarea`/`select`) → je Control eine Regel wie in `useRecorder.capture`: `{ id: createId(), label: displayLabel(el) || locator.name || 'Feld', locator: describeElement(el), config: suggestDataType(el), slot: null, required: isRequired(el), appendRunId: false }` → `assignSlots`.

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run tests/dom tests/recorder`
Expected: PASS, alle Dateien.

- [ ] **Step 7: Commit**

```bash
git add src/dom/locator.ts src/dom/suggest.ts src/dom/scan.ts src/recorder/useRecorder.ts tests/dom
git commit -m "feat: scan a page into recorder-like field rules"
```

---

### Task 2: Lauf-Speicher, scan-Nachricht und `quickFill`

**Files:**
- Create: `src/storage/quickRunStore.ts`
- Modify: `src/fill/messages.ts`, `entrypoints/content.ts`, `src/fill/dispatch.ts`, `entrypoints/background.ts`
- Test: `tests/storage/quickRunStore.test.ts`, `tests/fill/dispatch.test.ts`

**Interfaces:**
- Consumes: `scanControls` (Task 1); `getOrCreateDataset` (`src/storage/datasetStore.ts`); `recordFillResult` via `remember` in `dispatch.ts`; `isProblem` (`src/fill/reportSummary.ts`).
- Produces:
  - `messages.ts`: `ContentMessage` um `{ type: 'scan' }` erweitert; `export type ScanResponse = { ok: true; fields: FieldRule[] } | { ok: false; error: string }`.
  - `quickRunStore.ts`: `export interface QuickRun { fields: FieldRule[]; problems: string[]; url: string; title: string }`; `saveQuickRun(tabId: number, run: QuickRun): Promise<void>`, `getQuickRun(tabId: number): Promise<QuickRun | null>`, `clearQuickRun(tabId: number): Promise<void>`; Schlüssel `quick:<tabId>` in `storage.session`.
  - `dispatch.ts`: `export const QUICK_TEMPLATE_ID = 'quick'`, `export const NO_FIELDS_FOUND = 'Keine Formularfelder auf dieser Seite erkannt.'`, `scanPage(tabId: number): Promise<FieldRule[]>` (injiziert, sendet `scan`, wirft `Error(error)` bei `ok: false` oder „Die Seite hat nicht geantwortet“), `quickFill(tabId: number, mode: FillMode, page: { url: string; title: string }): Promise<FillReport>`. Intern: `fillWithTemplate(tabId, template, mode)` als gemeinsamer Füllteil von `dispatchFill` und `quickFill` (Datensatz, Injektion, `fill`-Nachricht, Antwortprüfung).

- [ ] **Step 1: Failing tests schreiben**

`tests/storage/quickRunStore.test.ts`:

```ts
const run: QuickRun = { fields: [], problems: ['b'], url: 'https://x.example.com/a', title: 'Seite' }
it('keeps one run per tab in session storage and clears it', async () => {
  await saveQuickRun(7, run)
  expect(await getQuickRun(7)).toEqual(run)
  expect(await getQuickRun(8)).toBeNull()
  expect(Object.keys(await fakeBrowser.storage.session.get(null))).toEqual(['quick:7'])
  await clearQuickRun(7)
  expect(await getQuickRun(7)).toBeNull()
})
it('a second run replaces the first', ...)  // saveQuickRun(7, run) zweimal mit anderem title → letzter gewinnt
```

`tests/fill/dispatch.test.ts`, neuer Helfer und `describe('quickFill')`:

```ts
/** Answers `scan` with the given fields and every other message with `response`. */
function mockScanAndFill(fields: FieldRule[], response: unknown = report) {
  const { execute, send } = mockMessaging(response)
  send.mockImplementation(async (_tab, message) => (message.type === 'scan' ? { ok: true, fields } : response))
  return { execute, send }
}
const scanned: FieldRule = { id: 'a', label: 'A', locator: { kind: 'text', name: 'a' }, config: { type: 'companyName' }, slot: null, required: false, appendRunId: false }

it('scans the page, fills with an ad-hoc template and keeps the run for the tab', async () => {
  const { send } = mockScanAndFill([scanned])
  const result = await quickFill(5, 'required', { url: 'https://x.example.com/a?b#c', title: 'Seite' })
  expect(result).toEqual(report)
  expect(send.mock.calls[0]?.[1]).toEqual({ type: 'scan' })
  const fill = send.mock.calls[1]?.[1]
  expect(fill).toMatchObject({ type: 'fill', mode: 'required', template: { id: 'quick', name: 'Schnellfüllen', appId: '', process: null, fields: [scanned], lastMissing: [] } })
  expect(await getQuickRun(5)).toEqual({ fields: [scanned], problems: ['b', 'c', 'd'], url: 'https://x.example.com/a?b#c', title: 'Seite' })
  expect((await getLastReport(5))?.templateId).toBe('quick')
  expect(await fakeBrowser.action.getBadgeText({ tabId: 5 })).toBe('3')
  expect((await getPrefs()).lastTemplateId).toBeNull()
  expect(await getTemplate('quick')).toBeUndefined()
})

it('starts a new dataset on every run', async () => {
  const { send } = mockScanAndFill([scanned])
  await quickFill(5, 'all', page); await quickFill(5, 'all', page)
  const first = send.mock.calls[1]?.[1], second = send.mock.calls[3]?.[1]
  expect(first?.type === 'fill' && second?.type === 'fill' && first.dataset !== second.dataset && first.dataset.company.name !== second.dataset.company.name).toBe(true)
})

it('reports an error when the page has no fields and sends no fill', async () => {
  const { send } = mockScanAndFill([])
  await expect(quickFill(5, 'all', page)).rejects.toThrow('Keine Formularfelder auf dieser Seite erkannt.')
  expect(send).toHaveBeenCalledTimes(1)
  expect((await getLastReport(5))?.error).toBe('Keine Formularfelder auf dieser Seite erkannt.')
  expect(await fakeBrowser.action.getBadgeText({ tabId: 5 })).toBe('!')
  expect(await getQuickRun(5)).toBeNull()
})

it('reports a scan failure', ...)  // send antwortet { ok: false, error: 'kaputt' } → rejects 'kaputt', Bericht mit error 'kaputt'
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run tests/storage/quickRunStore.test.ts tests/fill/dispatch.test.ts`
Expected: FAIL – Module/Exports fehlen.

- [ ] **Step 3: `quickRunStore.ts`, `messages.ts`, `content.ts`**

`content.ts`: `type === 'scan'` → `sendResponse({ ok: true, fields: scanControls(document) })`, Fehler als `{ ok: false, error }` (synchron möglich; `return true` wie bei den anderen Nachrichten).

- [ ] **Step 4: `dispatch.ts` umbauen**

`runDispatch` in `getTemplate`-Teil und `fillWithTemplate(tabId, template, mode)` trennen; `dispatchFill` ruft `fillWithTemplate` und danach wie bisher `setPrefs` + `updateLastMissing`. `quickFill`: `scanPage` → leer → `throw new Error(NO_FIELDS_FOUND)` → `fillWithTemplate` mit der Ad-hoc-Vorlage → `saveQuickRun` (Probleme = `report.fields.filter(f => isProblem(f.status)).map(f => f.fieldId)`) → `remember`. Fehler werden wie in `dispatchFill` als Fehlerbericht gemerkt und weitergeworfen.

- [ ] **Step 5: `background.ts`**

`tabs.onRemoved` ruft zusätzlich `void clearQuickRun(tabId)`.

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run tests/storage tests/fill`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/storage/quickRunStore.ts src/fill/messages.ts src/fill/dispatch.ts entrypoints/content.ts entrypoints/background.ts tests/storage/quickRunStore.test.ts tests/fill/dispatch.test.ts
git commit -m "feat: fill a page without a template through a scan message"
```

---

### Task 3: Popup-Zustand

**Files:**
- Create: `src/popup/samePage.ts`
- Modify: `src/popup/usePopup.ts`
- Test: `tests/popup/samePage.test.ts`, `tests/popup/usePopup.test.ts`

**Interfaces:**
- Consumes: `quickFill`, `QUICK_TEMPLATE_ID` (Task 2); `getQuickRun`, `clearQuickRun`, `QuickRun` (Task 2); `getLatestDataset` (PR #7); `saveTemplate`, `listTemplates`, `createId`.
- Produces: `samePage(a: string, b: string): boolean` (gleich ohne Query und Fragment; ungültige URLs → `false`). In `PopupState`: `title: Ref<string>` (aus `tab.title`), `quickRun: Ref<QuickRun | null>` (nur gesetzt, wenn `samePage(run.url, url)`), `quickFill(): Promise<void>`, `saveQuickTemplate(name: string): Promise<boolean>`, `createAppForCurrentPage(name: string, pattern?: string, templateName?: string): Promise<boolean>`.

- [ ] **Step 1: Failing tests schreiben**

`tests/popup/samePage.test.ts`:

```ts
expect(samePage('https://a.example.com/x?y=1#top', 'https://a.example.com/x')).toBe(true)
expect(samePage('https://a.example.com/x', 'https://a.example.com/x/')).toBe(false)
expect(samePage('https://a.example.com/x', 'https://b.example.com/x')).toBe(false)
expect(samePage('nope', 'https://a.example.com/x')).toBe(false)
```

`tests/popup/usePopup.test.ts` (Helfer `mockScanAndFill` wie in Task 2, `mockActiveTab(url, id = 7, title = 'Seite')` liefert `{ id, url, title }`):

```ts
it('quickFill fills without a template and remembers run, report and dataset', async () => {
  mockActiveTab('https://crm.example.com/')
  mockScanAndFill([scanned])
  const p = usePopup(); await p.load()
  expect(p.quickRun.value).toBeNull()
  await p.quickFill()
  expect(p.report.value).toEqual(report)
  expect(p.quickRun.value).toEqual({ fields: [scanned], problems: ['b'], url: 'https://crm.example.com/', title: 'Seite' })
  expect(p.dataset.value?.runId).toMatch(/^T\d{4}$/)
  expect(p.busy.value).toBe(false)
})

it('quickFill shows the German error of a failed scan', ...)  // send antwortet { ok: false, error: 'kaputt' } → p.error.value?.message 'kaputt.' (toUserError hängt den Punkt an), quickRun null

it('shows a stored run only on the page it came from', async () => {
  await saveQuickRun(7, { fields: [scanned], problems: [], url: 'https://crm.example.com/x?y', title: 'Seite' })
  mockActiveTab('https://crm.example.com/x#top')
  const same = usePopup(); await same.load()
  expect(same.quickRun.value?.title).toBe('Seite')
  mockActiveTab('https://crm.example.com/other')
  const other = usePopup(); await other.load()
  expect(other.quickRun.value).toBeNull()
})

it('saveQuickTemplate stores the run as template of the app with its problems marked and drops the run', async () => {
  await saveQuickRun(7, { fields: [scanned], problems: ['a'], url: 'https://crm.example.com/', title: 'Seite' })
  mockActiveTab('https://crm.example.com/')
  const p = usePopup(); await p.load()
  expect(await p.saveQuickTemplate('Neu')).toBe(true)
  const saved = (await listTemplates('crm')).find((t) => t.name === 'Neu')
  expect(saved).toMatchObject({ appId: 'crm', process: null, fields: [scanned], lastMissing: ['a'] })
  expect(p.templates.value.map((t) => t.name)).toContain('Neu')
  expect(p.notice.value).toBe('Vorlage „Neu“ gespeichert – Felder im Pflege-Tab prüfen.')
  expect(p.quickRun.value).toBeNull()
  expect(await getQuickRun(7)).toBeNull()
})

it('saveQuickTemplate rejects an empty name and needs a run', ...)  // '' → false, error 'Bitte einen Namen eingeben.'; ohne Lauf → false

it('createAppForCurrentPage also stores the run as template when a template name is given', async () => {
  await saveQuickRun(7, { fields: [scanned], problems: [], url: 'https://new.example.com/form', title: 'Seite' })
  mockActiveTab('https://new.example.com/form')
  mockPermissionRequest(true); mockPermissionContains(true)
  const p = usePopup(); await p.load()
  expect(await p.createAppForCurrentPage('Neu', undefined, 'Formular')).toBe(true)
  const app = p.app.value
  expect((await listTemplates(app?.id)).map((t) => [t.name, t.fields])).toEqual([['Formular', [scanned]]])
  expect(p.notice.value).toBe('App „Neu“ und Vorlage „Formular“ angelegt.')
  expect(p.quickRun.value).toBeNull()
})
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run tests/popup/samePage.test.ts tests/popup/usePopup.test.ts`
Expected: FAIL – `samePage` fehlt, `quickFill`/`quickRun`/`saveQuickTemplate` sind nicht definiert.

- [ ] **Step 3: `samePage.ts` und `usePopup.ts`**

`loadState`: `title.value = tab?.title ?? ''`; nach `dataset`: `const run = await getQuickRun(tabId)`; `quickRun.value = run !== null && url.value !== null && samePage(run.url, url.value) ? run : null`.
`quickFill()`: wie `fill()` über `run('Schnellfüllen fehlgeschlagen.', …)` mit `quickFill(id, mode.value, { url: url.value ?? '', title: title.value })`; im `finally` `dataset` und `quickRun` neu laden.
`saveQuickTemplate(name)`: Name trimmen (leer → Fehler „Bitte einen Namen eingeben.“), `app` und `quickRun` nötig; `saveTemplate({ id: createId(), appId, name, process: null, fields: run.fields, lastMissing: run.problems })`, `templates` neu laden, `clearQuickRun`, `quickRun = null`, Notiz.
`createAppForCurrentPage(name, pattern, templateName = '')`: nach erfolgreichem Anlegen, wenn `templateName.trim() !== ''` und `quickRun` vorhanden: Vorlage wie oben speichern, Notiz „App „X“ und Vorlage „Y“ angelegt.“, sonst Notiz wie bisher.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/popup`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/popup/samePage.ts src/popup/usePopup.ts tests/popup/samePage.test.ts tests/popup/usePopup.test.ts
git commit -m "feat: quick fill and save-as-template in the popup state"
```

---

### Task 4: Popup-Oberfläche

**Files:**
- Modify: `entrypoints/popup/App.vue`
- Test: `tests/popup/App.test.ts`

**Interfaces:**
- Consumes: `quickRun`, `quickFill`, `saveQuickTemplate`, `createAppForCurrentPage(name, pattern, templateName)`, `title` (Task 3); `QUICK_TEMPLATE_ID` (Task 2).
- Produces: nichts für spätere Tasks.

- [ ] **Step 1: Failing tests schreiben** (`tests/popup/App.test.ts`, Helfer `mockScanAndFill` wie in Task 2, `report` der Datei hat ein `missing`-Feld)

```ts
it('offers quick fill as the main action without an app, with mode switch and dataset line', async () => {
  mockActiveTab('https://new.example.com/')
  mockScanAndFill([scanned])
  const w = await mountApp()
  expect(w.get('[data-testid="dataset"]').exists()).toBe(true)
  expect(w.text()).toContain('Alle Felder')
  const button = w.findAll('button').find((b) => b.text() === 'Ohne Vorlage füllen')
  expect(button?.classes()).toContain('bg-brand')
  expect(w.text()).toContain('Erkennt die Felder selbst und füllt sie mit Testdaten.')
  await button?.trigger('click'); await flushPromises()
  expect(w.get('[role="status"]').text()).toBe('Schnellfüllen: 1 von 2 befüllt · 1 nicht gefunden')
  const save = w.findAll('button').find((b) => b.text() === 'Als Vorlage speichern')
  expect(save).toBeDefined()
  await save?.trigger('click'); await flushPromises()
  const template = w.get<HTMLInputElement>('#new-app-template')
  expect(template.element.value).toBe('Seite')
  expect(document.activeElement).toBe(w.get('#new-app-name').element)
  expect(w.get('form[aria-labelledby="new-app-heading"] button[type="submit"]').text()).toBe('App und Vorlage anlegen')
  w.unmount()
})

it('offers quick fill as a secondary action next to templates and saves the run as template', async () => {
  mockActiveTab('https://crm.example.com/x')
  mockScanAndFill([scanned])
  const w = await mountApp()
  const button = w.findAll('button').find((b) => b.text() === 'Ohne Vorlage füllen')
  expect(button?.classes()).not.toContain('bg-brand')
  await button?.trigger('click'); await flushPromises()
  await w.findAll('button').find((b) => b.text() === 'Als Vorlage speichern')?.trigger('click'); await flushPromises()
  const name = w.get<HTMLInputElement>('#quick-template-name')
  expect(name.element.value).toBe('Seite')
  await name.setValue('Lieferant')
  await w.get('#quick-template-form').trigger('submit'); await flushPromises()
  expect(w.text()).toContain('Lieferant')
  expect(w.get('[role="status"]').text()).toBe('Vorlage „Lieferant“ gespeichert – Felder im Pflege-Tab prüfen.')
  expect(w.find('#quick-template-form').exists()).toBe(false)
  w.unmount()
})

it('offers quick fill as the main action for an app without templates', ...)  // App ohne Vorlagen: Knopf mit bg-brand statt „Noch keine Vorlagen für diese App.“
it('hides "Als Vorlage speichern" without a run', ...)  // kein Lauf → kein Knopf
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run tests/popup/App.test.ts`
Expected: FAIL – Knöpfe und Formulare fehlen.

- [ ] **Step 3: Template umbauen**

- Nach den beiden Hinweis-Absätzen ein `<template v-else-if="loaded">` mit: Berechtigungs-Box (`v-if="app && permissionMissing"`), `Segmented`, Datensatz-Abschnitt, dann `<template v-if="app">` (Vorlagen-Abschnitt, „+ Neue Vorlage“, darunter Textknopf „Ohne Vorlage füllen“ mit `linkButton`; hat die App keine Vorlagen, steht anstelle von „Noch keine Vorlagen für diese App.“ der Knopf als `primaryButton` plus Hinweiszeile) und `<template v-else>` (Hinweis „Für diese Seite ist keine App hinterlegt.“, `primaryButton` „Ohne Vorlage füllen“, Hinweiszeile, dann das Formular „Neue App für diese Seite“).
- Formular „Neue App“: zusätzliches Feld `#new-app-template` (Label „Vorlage aus Schnellfüllen“, `v-if="quickRun"`, `v-model="newAppTemplateName"`, vorbelegt mit `quickRun.title` sobald ein Lauf vorliegt); Submit-Text „App und Vorlage anlegen“ wenn `quickRun`, sonst „App anlegen“; `submitNewApp` reicht `newAppTemplateName` durch.
- Statuszeile: Knopf „Als Vorlage speichern“ (`secondaryButton`, `v-if="quickRun"`) neben dem Bericht-Toggle. Mit App: öffnet `#quick-template-form` (Input `#quick-template-name`, vorbelegt mit `quickRun.title`, Fokus; Knöpfe „Speichern“/„Abbrechen“; Submit → `popup.saveQuickTemplate`). Ohne App: fokussiert `#new-app-name`.
- `statusText`: `r.templateId === QUICK_TEMPLATE_ID ? 'Schnellfüllen' : templates.find(…)?.name` als Präfix.

- [ ] **Step 4: Tests, Typecheck, Lint**

Run: `npx vitest run tests/popup && npm run typecheck && npm run lint`
Expected: PASS, keine Fehler.

- [ ] **Step 5: Sichtprüfung**

Build (`npx wxt build`) und Popup-Screenshots der drei Zustände mit dem Muster aus `.output/shot-popup.ts` (Tab der Testseite aktivieren, Popup-Seite neu laden); Popup bleibt 360 px breit, Knöpfe sichtbar, Tastaturfokus auf jedem neuen Element erkennbar.

- [ ] **Step 6: Commit**

```bash
git add entrypoints/popup/App.vue tests/popup/App.test.ts
git commit -m "feat: quick fill button and save-as-template in the popup"
```

---

### Task 5: Browsertest und Dokumentation

**Files:**
- Modify: `entrypoints/background.ts` (e2e-Hook), `tests/e2e/fixtures.ts`, `README.md`, `docs/manual-test-checklist.md`
- Create: `tests/e2e/quick.spec.ts`

**Interfaces:**
- Consumes: `quickFill` (Task 2); `Extension`-Fixture aus PR #5 (`seed`, `open`, `badge`, `session`, `worker`).
- Produces: `extension.quickFill(tabId: number, mode?: FillMode): Promise<FillReport>` in der Fixture (ruft `__formFillerE2E.quickFill(tabId, mode, { url: `${SITE_URL}/`, title: 'Musterformular' })`).

- [ ] **Step 1: Failing test schreiben** (`tests/e2e/quick.spec.ts`, `model(page)` wie in `fill.spec.ts`)

```ts
test('füllt die Testseite ohne App und Vorlage', async ({ extension }) => {
  await extension.seed([], [])
  const { page, tabId } = await extension.open()
  const report = await extension.quickFill(tabId)
  expect(report.error).toBeUndefined()
  expect(report.fields.filter((f) => f.status !== 'filled')).toEqual([])
  expect(report.filled).toBe(12)
  const m = await model(page)
  expect(m.company).not.toBe('')
  expect(m.customerNo).toMatch(/^TEST-\d{6}$/)
  expect(m.birthDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
  expect(['it', 'handel', 'bau']).toContain(m.industry)
  expect(['Teilnehmer', 'Lernmanager', 'Admin']).toContain(m.role)
  expect(m.country).toBe('de')
  expect(m.address.zip).toMatch(/^\d{5}$/)
  expect(m.billingDiffers).toBe(true)
  expect(await extension.badge(tabId)).toBe('✓')
  const run = (await extension.session())[`quick:${tabId}`] as { fields: unknown[]; problems: string[] }
  expect(run.fields).toHaveLength(12)
  expect(run.problems).toEqual([])
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npm run test:e2e`
Expected: FAIL – `extension.quickFill` fehlt.

- [ ] **Step 3: Hook und Fixture**

`background.ts`: `__formFillerE2E: { dispatchFill, startRecording, quickFill }`. `fixtures.ts`: `E2EApi` um `quickFill` erweitern, `Extension.quickFill` ergänzen.

- [ ] **Step 4: Browsertest laufen lassen**

Run: `npm run test:e2e`
Expected: 6 passed.

- [ ] **Step 5: Dokumentation**

README: unter „Funktionen“ ein Punkt „**Schnellfüllen:** Ohne Vorlage füllen erkennt die Felder einer Seite selbst und füllt sie sofort; die Erkennung lässt sich als Vorlage speichern.“; unter „Erste Schritte“ ein Schritt dazu. Checkliste: Abschnitt 2 „Popup“ bekommt die Punkte „Ohne Vorlage füllen“ in den drei Zuständen, „Als Vorlage speichern“ mit und ohne App, Angebot verschwindet nach Seitenwechsel.

- [ ] **Step 6: Commit**

```bash
git add entrypoints/background.ts tests/e2e/fixtures.ts tests/e2e/quick.spec.ts README.md docs/manual-test-checklist.md
git commit -m "test: browser test and docs for quick fill"
```
