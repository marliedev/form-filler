# Formulare in Shadow DOM und iframes – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Felder in offenen Shadow Roots und in iframes derselben Herkunft werden aufgenommen, wiedergefunden und gefüllt wie Felder im Hauptdokument, inklusive der zwei häufigen Komponentenmuster (Attribute am Wirt, Label im Hauptdokument auf den Wirt).

**Architecture:** Ein neues Modul `src/dom/deep.ts` kapselt die tiefe Suche (Shadow Roots, zugreifbare Rahmen), die Ortsbestimmung (`scope`) und Rechtecke relativ zum obersten Viewport. Locator, Füllen und Recorder nutzen es; der Locator bekommt ein optionales `scope`, das beim Wiederfinden wie ein Label zählt. Alles läuft im Content-Script des Hauptdokuments, ohne neue Berechtigungen.

**Tech Stack:** WXT 0.21 (MV3), Vue 3, TypeScript strict, Vitest + happy-dom (unterstützt `attachShadow` und `iframe[srcdoc]` mit `contentDocument`), Playwright-Browsertest aus PR #5, zod-Schema in `src/model/schema.ts`.

**Spec:** `docs/superpowers/specs/2026-10-23-shadow-dom-iframes-design.md`

## Global Constraints

- Basis: `main` nach Merge von PR #5 (Browsertest) und Vorhaben A (Schnellfüllen, liefert `listControls`); Branch `feat/shadow-dom-iframes` vor Task 1 auf `main` rebasen.
- `scope`-Einträge exakt: Rahmen `iframe:<name, sonst title, sonst id, sonst leer>`, Wirt `<tagname klein>` plus `#<id>` falls vorhanden; Hauptdokument `[]`; fehlendes `scope` im Locator zählt als `[]`.
- Punktevergabe: übereinstimmender `scope` +3 (wie Label); `MIN_SCORE` bleibt 3.
- Wirt-Rückfall nur für `name`, `label`, `aria-label`, `placeholder`, `required`/`aria-required`, `autocomplete`; Wirt = Shadow-Wirt des Baums, in dem das Feld liegt (`hostOf`).
- Füll-Ereignisse `composed: true` (`input`, `change`, `mousedown`, `mouseup`, `click`, `keydown`).
- Fremde Rahmen (Zugriff auf `contentDocument` wirft oder liefert `null`) werden still übersprungen; geschlossene Shadow Roots werden nicht gesucht.
- Kein `any`, Kommentare Englisch (nur das Warum), Conventional Commits auf Englisch, keine KI-Attribution.

## Review Focus

- Alte Vorlage (ohne `scope`) auf einer Seite, die nun denselben Feldnamen zusätzlich in einem Rahmen hat → findet weiterhin das Feld im Hauptdokument, nicht „mehrdeutig“ (Test in Task 1).
- Feld in einem per `display: none` ausgeblendeten Rahmen oder in einer ausgeblendeten Komponente → gilt als unsichtbar und wird nicht gefüllt (Test in Task 1).
- Komponente, deren inneres Feld nur ein `aria-label` trägt, Name am Wirt → wird aufgenommen und mit Name + Ort wiedergefunden (Score ≥ 3) (Test in Task 2).
- Bindung am Wirt (`v-model` auf `<wc-text-field>`) sieht den gefüllten Wert, weil `input` aus dem Shadow Root dringt (Test in Task 2 und Browsertest in Task 3).
- Rahmen, der erst nach dem Start der Aufnahme lädt → Klicks darin öffnen trotzdem das Popover, weil Listener bei jedem Mess-Tick ergänzt werden (Test in Task 3).

---

### Task 1: Tiefe Suche, `scope` und Sichtbarkeit

**Files:**
- Create: `src/dom/deep.ts`
- Modify: `src/model/types.ts` (`FieldLocator.scope?: string[]`), `src/model/schema.ts` (`scope: z.array(z.string()).optional()`), `src/dom/locator.ts`, `src/dom/fill.ts`, `src/recorder/useRecorder.ts` (`LOCATOR_KEYS` um `scope`, Vergleich per `JSON.stringify`)
- Test: `tests/dom/deep.test.ts`, `tests/dom/locator.test.ts`, `tests/dom/fill.test.ts`, `tests/model/schema.test.ts`, `tests/recorder/useRecorder.test.ts`

**Interfaces:**
- Consumes: `listControls(root)` und `findElement(root, loc)` (`locator.ts`); `CANDIDATE_SELECTOR`.
- Produces (`deep.ts`):
  - `deepQuerySelectorAll(root: ParentNode, selector: string): Element[]` – Dokumentreihenfolge; Inhalt eines offenen `shadowRoot` direkt nach seinem Wirt, Inhalt eines zugreifbaren `iframe` direkt nach dem `iframe`-Element; rekursiv.
  - `rootOf(el: Element): Document | ShadowRoot`
  - `hostOf(el: Element): Element | null` – Wirt des Shadow Roots, in dem `el` liegt, sonst `null`.
  - `frameElementOf(node: Node): HTMLIFrameElement | null` – das `iframe`-Element des Dokuments, in dem `node` liegt, sonst `null`.
  - `deepClosest(el: Element, selector: string): Element | null` – wie `closest`, setzt am Wirt bzw. am `iframe`-Element fort.
  - `scopeOf(el: Element): string[]` – Kette vom Hauptdokument zum Feld.
  - `viewportRect(el: Element): DOMRect` – `getBoundingClientRect` plus `left`/`top` aller umschließenden `iframe`-Elemente.
  - `frameDocuments(root: Document): Document[]` – alle zugreifbaren Rahmen-Dokumente, rekursiv, in Dokumentreihenfolge.
- Produces (`locator.ts`): `describeElement` setzt `scope` immer (ggf. `[]`); `score` gibt +3 für `JSON.stringify(loc.scope ?? []) === JSON.stringify(scopeOf(el))`; `listControls` und `findElement` nutzen `deepQuerySelectorAll`; `rawLabel`/`textOfIds`/`radioLabel`/`openListbox`/`nativeGroup` nutzen `rootOf`; `isVisible` steigt über `hostOf` und `frameElementOf` auf.

- [ ] **Step 1: Failing tests schreiben**

`tests/dom/deep.test.ts` (Helfer: `shadow(host, html)` hängt einen offenen Shadow Root mit `html` an, `frame(html)` erzeugt `<iframe srcdoc>` und wartet einen Tick, bis `contentDocument` befüllt ist):

```ts
it('walks shadow roots and same-origin frames in document order', async () => {
  document.body.innerHTML = '<input name="a"><x-host></x-host><input name="d">'
  shadow(document.querySelector('x-host')!, '<input name="b"><y-host></y-host>')
  shadow(document.querySelector('x-host')!.shadowRoot!.querySelector('y-host')!, '<input name="c">')
  const f = await frame('<input name="e">')   // ans Ende von body
  expect(deepQuerySelectorAll(document, 'input').map((el) => el.getAttribute('name'))).toEqual(['a', 'b', 'c', 'd', 'e'])
})
it('skips frames whose document is not accessible', ...)   // iframe-Element, dessen contentDocument-Getter wirft (Object.defineProperty) → übersprungen, kein Fehler
it('scopeOf names frames by name, title or id and hosts by tag and id', async () => {
  // <iframe name="delivery"> → ['iframe:delivery']; <iframe title="T"> → ['iframe:T']; <wc-input id="po"> → ['wc-input#po']; wc-text-field ohne id → ['wc-text-field']; verschachtelt: ['iframe:delivery', 'wc-input#po']; Hauptdokument → []
})
it('viewportRect adds the offsets of enclosing frames', ...)   // getBoundingClientRect des iframe-Elements per vi.spyOn auf {left: 100, top: 50}, inneres Feld {left: 10, top: 20} → {left: 110, top: 70}
it('deepClosest crosses hosts and frame elements', ...)   // <header><x-host>[input]</x-host></header> → deepClosest(input, 'header') ist der header
it('frameDocuments lists accessible frame documents recursively', ...)
```

`tests/dom/locator.test.ts`:

```ts
describe('deep lookup', () => {
  it('describes a field inside a shadow root with its label from the same tree and its scope', () => {
    // <wc-x id="h"> shadow: <label for="i">PLZ</label><input id="i" name="zip">  → { kind:'text', name:'zip', id:'i', label:'plz', inputType:'text', scope:['wc-x#h'] }
  })
  it('an old locator without scope prefers the main-document field over an equally named one in a frame', async () => {
    // Haupt: <label for="zip">PLZ</label><input id="zip" name="zip">; Rahmen name="delivery" mit identischem Markup
    // findElement(document, { kind:'text', name:'zip', id:'zip', label:'plz' }) → found, el.ownerDocument === document
  })
  it('a locator recorded in a frame finds the frame field, not the main-document twin', ...)   // scope ['iframe:delivery'] → el.ownerDocument !== document
  it('two identical hosts without id or name stay ambiguous', ...)   // zwei <wc-x> mit gleichem Shadow-Inhalt → ambiguous, count 2
  it('treats fields in hidden frames and hidden hosts as invisible', ...)   // iframe style display:none → findElement missing; host display:none → missing
  it('listControls includes shadow and frame fields', ...)
})
```

`tests/dom/fill.test.ts`: `it('fills a radio group and a combobox inside a shadow root', ...)` (Label-Suche und Listbox per `rootOf`). `tests/model/schema.test.ts`: `it('accepts and keeps locator.scope, and accepts locators without it', ...)`. `tests/recorder/useRecorder.test.ts`: `it('treats locators with different scope as different fields', ...)` über `capture` zweier gleich beschrifteter Felder in zwei Wirten mit IDs → zwei Regeln.

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run tests/dom tests/model tests/recorder`
Expected: FAIL – `deep` fehlt, `scope` unbekannt, Felder im Shadow Root „missing“.

- [ ] **Step 3: `deep.ts`, Typen, Schema**

`deepQuerySelectorAll`: `root.querySelectorAll('*')` einmal durchlaufen; je Element: passt es auf `selector` → aufnehmen; hat es einen offenen `shadowRoot` → rekursiv; ist es ein `iframe` mit zugreifbarem `contentDocument` (in `try/catch`) → rekursiv auf dessen Dokument. Das liefert die geforderte Reihenfolge ohne Sortierung.

- [ ] **Step 4: `locator.ts` und `fill.ts` umstellen**

Alle `ownerDocument`-Suchen nach Labels, IDs und Radios auf `rootOf(el)`; `isVisible` steigt nach `parentElement === null` über `hostOf(node)` bzw. `frameElementOf(node)` weiter auf. `describeElement` ergänzt `scope: scopeOf(el)`. In `src/dom/scan.ts` (Vorhaben A) prüft der Ausschluss `EXCLUDED_ANCESTORS` mit `deepClosest` statt `closest`, damit ein Feld in einer Komponente im Seitenkopf ausgeschlossen bleibt (Test: `scanControls` mit `<header><x-host>[input]</x-host></header>` → leer).

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run`
Expected: PASS, alle Dateien (auch bestehende Locator-, Fill- und Recorder-Tests).

- [ ] **Step 6: Commit**

```bash
git add src/dom/deep.ts src/model/types.ts src/model/schema.ts src/dom/locator.ts src/dom/fill.ts src/recorder/useRecorder.ts tests/dom tests/model tests/recorder
git commit -m "feat: find and fill fields in open shadow roots and same-origin frames"
```

---

### Task 2: Komponentenmuster und durchdringende Ereignisse

**Files:**
- Modify: `src/dom/locator.ts`, `src/dom/suggest.ts`, `src/dom/fill.ts`
- Test: `tests/dom/locator.test.ts`, `tests/dom/suggest.test.ts`, `tests/dom/fill.test.ts`

**Interfaces:**
- Consumes: `hostOf`, `rootOf` (Task 1).
- Produces (`locator.ts`, intern, von `describeElement`, `score`, `displayLabel` und `isRequired` gemeinsam genutzt): `effectiveName(el)`, `effectiveLabel(el)` (eigenes Label → `<label for="<host.id>">` im Baum des Wirts → `label`-Attribut des Wirts), `effectiveAttr(el, name)` (eigenes Attribut, sonst das des Wirts; für `aria-label`, `placeholder`, `autocomplete`), `isRequired` prüft auch den Wirt. `suggest.ts` liest `autocomplete` über `effectiveAttr`.

- [ ] **Step 1: Failing tests schreiben**

`tests/dom/locator.test.ts`:

```ts
describe('web component patterns', () => {
  it('falls back to host attributes for name, label, placeholder and required', () => {
    // <wc-text-field name="cost_center" label="Kostenstelle" placeholder="z. B. 4711" required> shadow: <input aria-label="Eingabe">
    // describeElement(inner) → { kind:'text', name:'cost_center', label:'kostenstelle', ariaLabel:'eingabe', placeholder:'z. b. 4711', inputType:'text', scope:['wc-text-field'] }
    // isRequired(inner) → true; displayLabel(inner) → 'Kostenstelle'
  })
  it('uses a main-document label that points at the host', () => {
    // <label for="po-number">Bestellnummer</label><wc-input id="po-number"> shadow: <input> → label 'bestellnummer', scope ['wc-input#po-number']
  })
  it('refinds a host-named field with only an aria-label inside', () => {
    // Locator aus Test 1 → findElement found (Score: name 4 + scope 3 + …)
  })
  it('the inner field’s own attributes win over the host’s', ...)
})
```

`tests/dom/suggest.test.ts`: `it('suggests from host name and label', ...)` (`<wc-text-field name="iban">` mit innerem leeren `input` → `{ type: 'iban' }`; Wirt `autocomplete="email"` → `{ type: 'email' }`).

`tests/dom/fill.test.ts`:

```ts
it('fires composed events so listeners on the shadow host see the input', async () => {
  // Wirt mit Listener: host.addEventListener('input', spy); inneres Feld füllen → spy einmal aufgerufen; für select (change), checkbox (click) und radio ebenso
})
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run tests/dom`
Expected: FAIL – Wirt-Werte fehlen im Locator, Spy am Wirt nicht aufgerufen.

- [ ] **Step 3: Implementieren**

`fire`, `pointerPress` und der `keydown` in `waitForListbox` setzen `composed: true`. Die `effective*`-Helfer in `locator.ts`; `score` vergleicht mit denselben Helfern, damit Aufnahme und Wiederfinden dieselben Werte sehen.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dom/locator.ts src/dom/suggest.ts src/dom/fill.ts tests/dom
git commit -m "feat: read host attributes of web components and emit composed events"
```

---

### Task 3: Recorder, Testseite und Browsertest

**Files:**
- Modify: `src/recorder/Recorder.vue`, `test-site/src/TestForm.vue`, `test-site/src/main.ts`, `tests/e2e/site.ts`, `tests/e2e/fixtures.ts` (falls Helfer nötig), `README.md` (Funktionen: Hinweis auf Web-Components und eingebettete Formulare derselben Adresse), `docs/manual-test-checklist.md` (Abschnitt 3: Aufnahme in Komponente und Rahmen)
- Create: `test-site/src/components.ts`, `test-site/frame.html`, `test-site/src/frame.ts`, `tests/e2e/deep.spec.ts`
- Test: `tests/recorder/Recorder.test.ts`, `tests/e2e/deep.spec.ts`

**Interfaces:**
- Consumes: `viewportRect`, `frameDocuments`, `scopeOf` (Task 1); Browsertest-Fixture aus PR #5 (`seed`, `open`, `fill`, `record`, `local`).
- Produces: Testseite mit `<wc-text-field name="cost_center" label="Kostenstelle" required>` (Muster 1, löst bei Eingabe ein `composed` `input`-Ereignis aus; `v-model`-Bindung über `@input` auf `model.costCenter`), `<label for="po-number">Bestellnummer</label><wc-input id="po-number" name="po_number">` (Muster 2), `<iframe src="/frame.html" name="delivery" title="Lieferadresse">` mit `street`, `zip`, `city` (gleiche IDs und Namen wie die Firmenadresse; `frame.ts` sendet Änderungen per `postMessage` an die Hauptseite, die sie unter `model.delivery` zeigt). `tests/e2e/site.ts` exportiert `DEEP: Template` mit den Feldern Kostenstelle (`scope: ['wc-text-field']`, Typ `pattern` `KST-{zahl:4}`), Bestellnummer (`scope: ['wc-input#po-number']`, Typ `pattern`), Lieferadresse Straße/PLZ/Ort (`scope: ['iframe:delivery']`, Slot `B`) und Firmen-PLZ (`scope: []`, Slot `A`).

- [ ] **Step 1: Failing tests schreiben**

`tests/recorder/Recorder.test.ts`:

```ts
it('opens the popover for a field inside a shadow root and positions boxes by viewport rect', ...)   // focusin aus dem Shadow Root (composed) → Popover offen; Markierung nutzt viewportRect (vi.spyOn)
it('listens in frames that load after the recorder started', async () => {
  // Recorder mounten, danach <iframe srcdoc> anhängen, scheduleMeasure auslösen (scroll-Event), focusin im Rahmen → Popover offen
})
```

`tests/e2e/deep.spec.ts`:

```ts
test('füllt Felder in Web-Components und im Rahmen und hält Haupt- und Rahmen-PLZ auseinander', async ({ extension }) => {
  await extension.seed([APP], [DEEP])
  const { page, tabId } = await extension.open()
  const report = await extension.fill(tabId, DEEP.id)
  expect(report.fields.filter((f) => f.status !== 'filled')).toEqual([])
  const m = await model(page)
  expect(m.costCenter).toMatch(/^KST-\d{4}$/)
  expect(m.poNumber).not.toBe('')
  expect(m.delivery.zip).toMatch(/^\d{5}$/)
  expect(m.address.zip).toMatch(/^\d{5}$/)
  expect(m.delivery.zip).not.toBe(m.address.zip)   // Slots A und B kommen aus verschiedenen Adressen; Gleichheit ist bei 8.000 PLZ praktisch ausgeschlossen
})

test('nimmt Felder in Komponente und Rahmen per Klick auf', async ({ extension }) => {
  await extension.seed([APP], [EMPTY])
  const { page, tabId } = await extension.open()
  await extension.record(tabId, EMPTY.id)
  await page.locator('wc-text-field input').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen' }).click()
  await page.frameLocator('iframe[name="delivery"]').locator('#zip').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen' }).click()
  await expect(page.getByTestId('captured-box')).toHaveCount(2)
  await page.getByRole('region', { name: 'Aufnahme' }).getByRole('button', { name: 'Speichern' }).click()
  const saved = ((await extension.local()).templates as Template[]).find((t) => t.id === EMPTY.id)
  expect(saved?.fields.map((f) => [f.locator.name, f.locator.scope])).toEqual([['cost_center', ['wc-text-field']], ['zip', ['iframe:delivery']]])
  expect(saved?.fields[0]?.label).toBe('Kostenstelle')
})
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run tests/recorder && npm run test:e2e`
Expected: FAIL – Popover öffnet nicht für Rahmen, Testseite hat die Felder noch nicht.

- [ ] **Step 3: Testseite erweitern**

`components.ts` definiert beide Custom Elements mit offenem Shadow Root (vanilla `HTMLElement`, `connectedCallback`); `wc-text-field` rendert `<label for="input">${label}</label><input id="input" ${required}>` und löst bei `input` ein `new Event('input', { bubbles: true, composed: true })` am Wirt aus (nur, falls das innere Ereignis nicht ohnehin `composed` ist; echte Tastatureingaben sind es). `frame.html`/`frame.ts`: Formular mit `street`, `zip`, `city`; `input`-Listener → `parent.postMessage({ type: 'delivery', value }, location.origin)`. `TestForm.vue`: Komponenten und Rahmen unter der Firmenadresse, `window.addEventListener('message', …)` schreibt `model.delivery`.

- [ ] **Step 4: Recorder umstellen**

`measure` → `viewportRect`; `popoverStyle` → `viewportRect(el)`; `attachPageListeners(doc: Document)` mit `WeakSet<Document>`, aufgerufen beim Mount für `doc` und `frameDocuments(doc)` und erneut in `scheduleMeasure`; Scroll-Listener auch an `frameDoc.defaultView`. Beim Unmount alle Listener entfernen (Liste der Dokumente merken).

- [ ] **Step 5: Tests, Typecheck, Lint, Browsertest**

Run: `npm test && npm run typecheck && npm run lint && npm run test:e2e`
Expected: alles grün; Browsertest 8 passed (5 aus PR #5, 1 aus Vorhaben A, 2 neue).

- [ ] **Step 6: Dokumentation und Commit**

README unter „Funktionen“ beim Punkt „Viele Feldarten“: „… auch in Web-Components (offenes Shadow DOM) und in eingebetteten Formularen derselben Adresse.“ Checkliste Abschnitt 3: zwei Punkte für Aufnahme in Komponente und Rahmen, Abschnitt 1 Punkt 4 erwähnt die neuen Felder.

```bash
git add src/recorder/Recorder.vue test-site tests/recorder tests/e2e README.md docs/manual-test-checklist.md
git commit -m "feat: record fields in web components and same-origin frames"
```
