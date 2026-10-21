# Form Filler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chromium-Erweiterung (Dia/Arc), die Formulare anhand selbst erfasster Vorlagen mit stimmigen, zufälligen deutschen Fakedaten befüllt.

**Architecture:** WXT-Projekt (Manifest V3) mit drei Oberflächen: Popup (Schnellzugriff), Pflege-Tab (Vorlagen-Tabelle) und Aufnahme-Overlay (Content-Script-UI). Reine Logik (Datensatz, Werte, Prüfziffern, Feld-Erkennung, Befüllen) liegt framework-frei in `src/` und ist mit Vitest getestet. Background bzw. Popup erzeugen den Datensatz (`storage.session`, pro Tab + Prozess) und schicken ihn mit der Vorlage an das injizierte Content-Script, das die Felder nacheinander befüllt und einen Bericht zurückgibt.

**Tech Stack:** WXT, Vue 3 (`<script setup>`), TypeScript strict, Tailwind CSS v4, `@faker-js/faker` (`fakerDE`), zod, Vitest + happy-dom + @vue/test-utils, ESLint (typescript-eslint, eslint-plugin-vue), vue-tsc. Paketmanager npm.

**Spec:** `docs/superpowers/specs/2026-10-21-form-filler-design.md`

## Global Constraints

- Keine Netzwerkzugriffe zur Laufzeit; keine Remote-Ressourcen; kein `storage.sync`.
- Keine Bezüge zur Ziel-App oder zum Arbeitgeber in Code, Tests, Fixtures, Seed-Daten oder Commits.
- TypeScript strict, kein `any`; Code-Kommentare Englisch, nur für das Warum.
- Conventional Commits (Englisch), Arbeit nur auf Branch `feat/form-filler-mvp`, nie auf `main`. Kein Remote/Push ohne Martins Ansage.
- Paket-Installation erst nach Martins ausdrücklicher Freigabe (Task 1).
- UI: WCAG 2.2 AA (Tastaturbedienung, sichtbarer Fokus, Kontrast ≥ 4.5:1, Labels, `aria-live` für Statusmeldungen). UI-Texte Deutsch.
- iframes und Shadow DOM der Zielseiten werden nicht unterstützt.
- Ein nicht gefundenes / nicht befüllbares Feld wird immer im Bericht gemeldet, nie still übersprungen.

## Review Focus

1. **Gleichlautende Labels** (Straße in Firmen- und Rechnungsadresse): Erkennung nutzt `name`/`id` zur Unterscheidung; bleibt es mehrdeutig → Status `ambiguous`, nicht raten. → Test in Task 6.
2. **Platzhalter-Option** („Bitte wählen“, `value=""` oder `disabled`) wird bei zufälliger Auswahl nie gewählt. → Test in Task 7.
3. **`maxlength` + Kennung**: Grundwert wird gekürzt, damit `Wert · T1234` passt; passt die Kennung allein nicht, entfällt sie. → Test in Task 5.
4. **Bedingt eingeblendetes Feld** (erscheint erst nach Befüllen eines vorherigen): wird gefunden, weil jedes Feld erst nach dem vorherigen gesucht wird und dazwischen ein Frame gewartet wird. → Test in Task 7.
5. **Kaputte oder fremde Import-Datei**: klare Fehlermeldung, nichts wird teilweise geschrieben. → Test in Task 2.

---

## Dateistruktur

```
form-filler/
  wxt.config.ts  package.json  tsconfig.json  eslint.config.js  vitest.config.ts  README.md
  entrypoints/
    background.ts                 # shortcut command, tab cleanup, fill dispatch for shortcut
    content.ts                    # runtime-registered; handles fill + record messages
    popup/{index.html,main.ts,App.vue}
    manage/{index.html,main.ts,App.vue}
  src/
    model/types.ts                # all domain types
    model/schema.ts               # zod schemas, export/import
    storage/repository.ts         # apps/templates CRUD in storage.local
    storage/datasetStore.ts       # dataset per tab+process in storage.session
    data/plz-de.json  data/README.md (license attribution)
    generators/checksums.ts       # IBAN, VAT id, Leitweg-ID
    generators/dataset.ts         # createDataset, ensureSlots
    generators/resolve.ts         # resolveValue (catalog), applyRunId
    generators/pattern.ts         # pattern placeholders
    generators/catalog.ts         # DataType metadata (labels, groups, slot kind)
    dom/locator.ts                # describeElement, findElement
    dom/suggest.ts                # suggestDataType
    dom/fill.ts                   # fillElement per control kind
    fill/runFill.ts               # content-side orchestration -> FillReport
    fill/dispatch.ts              # extension-side: dataset + inject + message
    fill/appMatch.ts              # matchApp(url, apps)
    recorder/Recorder.vue  recorder/mountRecorder.ts
    ui/                           # shared Vue components (Toggle, Segmented, ...)
  scripts/build-plz.ts
  test-site/{index.html,vite.config.ts,src/main.ts,src/TestForm.vue,src/AriaCombobox.vue}
  tests/…                         # mirrors src/
```

---

### Task 1: Projekt-Grundgerüst, Tooling, Spec-Commit

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `.gitignore`, `entrypoints/popup/*` (Platzhalter „Form Filler“), `tests/smoke.test.ts`

**Interfaces:**
- Produces: npm-Skripte `dev`, `build`, `typecheck` (`vue-tsc --noEmit`), `lint`, `test` (`vitest run`), `test-site`.

- [ ] **Step 1: Martin um Freigabe der Pakete bitten** (STOPP bis Freigabe): `wxt @wxt-dev/module-vue vue @faker-js/faker zod tailwindcss @tailwindcss/vite` sowie dev: `typescript vue-tsc vitest happy-dom @vue/test-utils eslint typescript-eslint eslint-plugin-vue vite @vitejs/plugin-vue tsx`.
- [ ] **Step 2: Git-Repo anlegen**: `git init -b main && git checkout -b feat/form-filler-mvp`; Spec + Plan committen: `docs: add form filler design and implementation plan`.
- [ ] **Step 3: WXT mit Vue-Modul einrichten**, `wxt.config.ts`: `modules: ['@wxt-dev/module-vue']`, Manifest: `name: 'Form Filler'`, `permissions: ['storage','activeTab','scripting','tabs']`, `optional_host_permissions: ['<all_urls>']`, `commands: { 'fill-last': { suggested_key: { default: 'Alt+Shift+F' }, description: 'Fill with last used template' } }`. Tailwind via `@tailwindcss/vite`. `tsconfig` strict + `noUncheckedIndexedAccess`.
- [ ] **Step 4: Vitest** mit `WxtVitest()` aus `wxt/testing`, Environment `happy-dom`. Smoke-Test `expect(1).toBe(1)`.
- [ ] **Step 5: Verifizieren**: `npm run build && npm run typecheck && npm run lint && npm test` → alles grün, `.output/chrome-mv3` existiert.
- [ ] **Step 6: Commit** `chore: scaffold wxt extension with vue, tailwind and vitest`

---

### Task 2: Domänenmodell, Speicher, Export/Import

**Files:**
- Create: `src/model/types.ts`, `src/model/schema.ts`, `src/storage/repository.ts`
- Test: `tests/model/schema.test.ts`, `tests/storage/repository.test.ts`

**Interfaces:**
- Produces (`types.ts`):

```ts
export type ControlKind = 'text' | 'textarea' | 'select' | 'radiogroup' | 'checkbox' | 'date' | 'combobox';

export interface FieldLocator {
  kind: ControlKind;
  name?: string; id?: string; label?: string; ariaLabel?: string; placeholder?: string;
  inputType?: string;
}

export type SimpleTypeId =
  | 'companyName' | 'legalForm' | 'vatId' | 'taxNumber' | 'tradeRegister' | 'industry'
  | 'salutation' | 'firstName' | 'lastName' | 'jobTitle'
  | 'streetWithNumber' | 'streetName' | 'houseNumber' | 'zip' | 'city' | 'country' | 'addressLine2'
  | 'email' | 'phone' | 'mobile' | 'website'
  | 'iban' | 'bic' | 'bankName'
  | 'invoiceEmail' | 'leitwegId' | 'text';

export type DataTypeConfig =
  | { type: SimpleTypeId }
  | { type: 'birthDate'; minAge: number }
  | { type: 'date'; range: 'past' | 'future' | 'between'; from?: string; to?: string }  // ISO dates
  | { type: 'number'; min: number; max: number }
  | { type: 'fixed'; value: string }
  | { type: 'choice'; mode: 'random' | 'subset' | 'fixed'; values: string[] }
  | { type: 'checkbox'; checked: boolean | 'random' }
  | { type: 'list'; values: string[] }
  | { type: 'pattern'; pattern: string }
  | { type: 'empty' };

export interface FieldRule {
  id: string; label: string; locator: FieldLocator; config: DataTypeConfig;
  slot: string | null;          // person '1','2',… / address 'A','B',…; null for company/general
  required: boolean; appendRunId: boolean;
}

export interface Template {
  id: string; appId: string; name: string;
  process: { name: string; step: number } | null;
  fields: FieldRule[];          // array order = fill order
  lastMissing: string[];        // FieldRule ids not found/filled on last run
}

export interface AppDef { id: string; name: string; urlPatterns: string[] }   // '*' wildcard

export interface ExportFile { format: 'form-filler'; version: 1; apps: AppDef[]; templates: Template[] }
```

- Produces (`schema.ts`): `parseExport(json: string): { ok: true; data: ExportFile } | { ok: false; error: string }`, `buildExport(apps: AppDef[], templates: Template[]): string` (pretty JSON).
- Produces (`repository.ts`): `listApps(): Promise<AppDef[]>`, `saveApp(app: AppDef): Promise<void>`, `deleteApp(id: string): Promise<void>` (löscht zugehörige Vorlagen), `listTemplates(appId?: string): Promise<Template[]>`, `getTemplate(id: string): Promise<Template | undefined>`, `saveTemplate(t: Template): Promise<void>`, `deleteTemplate(id: string): Promise<void>`, `importExport(data: ExportFile, onConflict: 'overwrite' | 'copy'): Promise<{ apps: number; templates: number }>`, `getPrefs(): Promise<Prefs>`, `setPrefs(p: Partial<Prefs>): Promise<void>` mit `Prefs = { mode: 'all' | 'required'; lastTemplateId: string | null }`. Speicher: `browser.storage.local`, Schlüssel `apps`, `templates`, `prefs`. Konflikt = gleiche `id`; `copy` vergibt neue ids (`crypto.randomUUID()`), Vorlagen-Name + „ (Kopie)“.

- [ ] **Step 1: Tests schreiben**
  - `parseExport` akzeptiert Ergebnis von `buildExport` (Roundtrip identisch).
  - `parseExport('nicht json')` → `{ ok: false }`, `error` enthält „kein gültiges JSON“.
  - `parseExport` mit `format: 'other'` oder `version: 2` → `ok: false`, Fehler nennt das Feld.
  - `parseExport` mit Vorlage ohne `fields` → `ok: false`.
  - Repository (mit `fakeBrowser`): `saveTemplate` + `listTemplates('app1')` filtert nach App; `deleteApp` entfernt Vorlagen der App; `importExport(..., 'copy')` bei gleicher id → zwei Vorlagen, eine mit „ (Kopie)“; `importExport` mit ungültigen Daten wird nie aufgerufen (Validierung vorher) – Test: nach fehlgeschlagenem `parseExport` ist der Speicher unverändert (Review Focus 5).
- [ ] **Step 2: Tests laufen lassen** → FAIL (Module fehlen).
- [ ] **Step 3: Implementieren** – zod-Schemas spiegeln `types.ts`; Typen aus `types.ts` sind maßgeblich, Schema per `satisfies z.ZodType<ExportFile>` abgesichert. Fehlertexte Deutsch.
- [ ] **Step 4: Tests** → PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** `feat: add domain model, storage repository and json export/import`

---

### Task 3: PLZ-Daten und Prüfziffern

**Files:**
- Create: `scripts/build-plz.ts`, `src/data/plz-de.json`, `src/data/README.md`, `src/generators/checksums.ts`
- Test: `tests/generators/checksums.test.ts`, `tests/data/plz.test.ts`

**Interfaces:**
- Produces: `src/data/plz-de.json` als `[string, string][]` (PLZ, Ort), dedupliziert; `isValidIban(iban: string): boolean`, `vatIdCheckDigit(first8: string): number`, `createVatId(rand: () => number): string`, `leitwegCheckDigits(body: string): string`, `createLeitwegId(rand: () => number): string`.

- [ ] **Step 1: Datenquelle** *(Entscheidung Claude, weicht vom Beispiel „OpenGeoDB“ in der Spec ab)*: GeoNames Postal Codes `DE.zip` (Lizenz CC BY 4.0, eindeutig). Herunterladen in einen leeren Ordner im Scratchpad, `scripts/build-plz.ts <pfad/DE.txt>` liest Spalte 2 (PLZ) und 3 (Ort), dedupliziert, schreibt JSON. `src/data/README.md`: Quelle, Lizenz, Attribution, Abrufdatum. Falls die Lizenz beim Abruf nicht mehr CC BY ist: STOPP, Martin fragen.
- [ ] **Step 2: Tests schreiben**
  - PLZ: Liste hat > 5000 Einträge; jede PLZ `/^\d{5}$/`; Paar `['41061','Mönchengladbach']` enthalten.
  - `vatIdCheckDigit('13669597') === 6`, `('81156986') === 9`, `('12927339') === 8`.
  - `createVatId` (100 Läufe): `/^DE[1-9]\d{8}$/` und letzte Ziffer = `vatIdCheckDigit` der ersten 8.
  - `leitwegCheckDigits('040110001234512345') === '06'`.
  - `createLeitwegId` (100 Läufe): Format `/^\d{2,12}(-[A-Z0-9]{1,30})?-\d{2}$/`, Prüfziffer stimmt.
  - `isValidIban('DE89370400440532013000') === true`, mit vertauschter Ziffer `false`.
- [ ] **Step 3: Tests** → FAIL.
- [ ] **Step 4: Implementieren.** USt-IdNr.: ISO 7064 MOD 11,10 (product=10; je Ziffer `s=(d+product)%10||10; product=(2*s)%11`; Prüfziffer `11-product`, 10→0). Leitweg-ID: ISO 7064 MOD 97-10 über die Ziffern/Buchstaben ohne Bindestriche (Buchstaben A=10…Z=35), `98 - (BigInt(n + '00') % 97n)`, zweistellig. IBAN: Standard-MOD-97 mit BigInt.
- [ ] **Step 5: Tests** → PASS.
- [ ] **Step 6: Commit** `feat: add german zip dataset and checksum generators`

---

### Task 4: Datensatz-Generator

**Files:**
- Create: `src/generators/dataset.ts`
- Test: `tests/generators/dataset.test.ts`

**Interfaces:**
- Consumes: `plz-de.json`, `createVatId`, `createLeitwegId` (Task 3), `Template` (Task 2).
- Produces:

```ts
export interface Address { street: string; houseNumber: string; zip: string; city: string; country: 'Deutschland'; line2: string }
export interface Person { salutation: 'Herr' | 'Frau'; firstName: string; lastName: string; birthDate: string; jobTitle: string; email: string; phone: string; mobile: string }
export interface Company { name: string; legalForm: string; domain: string; industry: string; vatId: string; taxNumber: string; tradeRegister: string; iban: string; bic: string; bankName: string; leitwegId: string; phone: string }
export interface Dataset { runId: string; createdAt: string; company: Company; persons: Record<string, Person>; addresses: Record<string, Address> }

export function createDataset(f: Faker): Dataset;              // persons {'1'}, addresses {'A' = company address}
export function ensureSlots(ds: Dataset, t: Template, f: Faker): Dataset;   // pure; adds missing slots used by t
```

- [ ] **Step 1: Tests schreiben** (mit `fakerDE.seed(…)` wo Determinismus nötig)
  - `runId` passt `/^T\d{4}$/`.
  - Adresse: `[zip, city]` ist ein Paar aus `plz-de.json`.
  - E-Mail Person 1: `vorname.nachname@<company.domain>` in Kleinbuchstaben, Umlaute ersetzt (`ä→ae, ö→oe, ü→ue, ß→ss`), nur `[a-z0-9.-]` im Lokalteil.
  - `company.domain` leitet sich aus dem Firmennamen ab (Slug ohne Rechtsform + `.de`), z. B. „Brandt Logistik GmbH“ → `brandt-logistik.de`.
  - Kein Wiederholen: 200 Datensätze ohne Seed → ≥ 190 verschiedene Firmennamen und ≥ 150 verschiedene PLZ.
  - `ensureSlots` mit Vorlage, die Slot `'2'` (Person) und `'B'` (Adresse) nutzt → beide vorhanden, `'1'`/`'A'` unverändert (gleiche Werte), Person 2 hat dieselbe Firmen-Domain.
- [ ] **Step 2: Tests** → FAIL.
- [ ] **Step 3: Implementieren.** Firmenname: `${lastName} ${Branchenwort} ${Rechtsform}` (Branchenwörter und Rechtsformen GmbH, AG, KG, GmbH & Co. KG, e. K., UG (haftungsbeschränkt) als lokale Listen). Slot-Art (Person vs. Adresse) liefert `slotKindFor(config)` aus `catalog.ts` (Task 5 legt die Datei an; hier vorab mit Person-Typen `salutation…mobile, birthDate` und Adress-Typen `streetWithNumber…addressLine2` anlegen). Steuernummer `\d{3}/\d{4}/\d{4}`, Handelsregister `HRB \d{4,6}`, IBAN `f.finance.iban(false, 'DE')`, BIC `f.finance.bic()`.
- [ ] **Step 4: Tests** → PASS.
- [ ] **Step 5: Commit** `feat: generate coherent fake datasets with person and address slots`

---

### Task 5: Werte auflösen (Datentyp-Katalog, Muster, Kennung)

**Files:**
- Create/Modify: `src/generators/catalog.ts`, `src/generators/resolve.ts`, `src/generators/pattern.ts`
- Test: `tests/generators/resolve.test.ts`, `tests/generators/pattern.test.ts`

**Interfaces:**
- Consumes: `Dataset` (Task 4), `FieldRule`, `DataTypeConfig` (Task 2).
- Produces:

```ts
// catalog.ts
export interface DataTypeMeta { type: DataTypeConfig['type']; label: string; group: 'Firma' | 'Person' | 'Adresse' | 'Kontakt' | 'Bank' | 'E-Rechnung' | 'Allgemein' | 'Steuerung'; slotKind: 'person' | 'address' | null; controls: ControlKind[] }
export const DATA_TYPES: readonly DataTypeMeta[];
export function slotKindFor(config: DataTypeConfig): 'person' | 'address' | null;

// resolve.ts
export type FieldValue =
  | { kind: 'text'; value: string }
  | { kind: 'date'; iso: string }
  | { kind: 'choice'; mode: 'random' | 'subset' | 'fixed'; values: string[] }
  | { kind: 'checkbox'; checked: boolean }
  | { kind: 'skip' };
export function resolveValue(rule: FieldRule, ds: Dataset, f: Faker): FieldValue;
export function applyRunId(value: string, runId: string, maxLength: number | null): string;

// pattern.ts — placeholders: {zahl:N} digits, {buchstabe:N} A–Z, {kennung} runId, {datum} YYYYMMDD
export function expandPattern(pattern: string, runId: string, f: Faker): string;
```

- [ ] **Step 1: Tests schreiben**
  - `resolveValue` mit `{type:'zip'}`, Slot `'B'` → `text` = `ds.addresses.B.zip`.
  - `{type:'email'}`, Slot `'2'` → E-Mail von Person 2; `{type:'invoiceEmail'}` → `rechnung@<domain>`.
  - `{type:'salutation'}` → `choice` mit `mode:'fixed'`, `values:[person.salutation]` (damit Dropdown/Radio passend gewählt wird).
  - `{type:'list', values:['4711','4712']}` → `text` ∈ values. `{type:'empty'}` → `skip`. `{type:'checkbox', checked:true}` → `checkbox true`.
  - `{type:'birthDate', minAge:18}` → `date` mindestens 18 Jahre zurück.
  - `appendRunId:true` → `"Brandt Logistik GmbH · T1342"`.
  - `applyRunId('Brandt Logistik GmbH','T1342',15)` → Länge ≤ 15 und endet auf `· T1342`; `applyRunId('Abc','T1342',5)` → `'Abc'` (Kennung entfällt) (Review Focus 3).
  - `expandPattern('TEST-{zahl:6}', …)` → `/^TEST-\d{6}$/`; `'{kennung}-X'` → `'T1342-X'`; unbekannter Platzhalter `{foo}` bleibt wörtlich stehen.
  - Jeder `SimpleTypeId` hat einen Eintrag in `DATA_TYPES` (Test iteriert über eine Liste aller Ids).
- [ ] **Step 2: Tests** → FAIL.
- [ ] **Step 3: Implementieren.** Gruppen und Labels laut Spec-Tabelle; Slot-lose Personen/Adressfelder nutzen `'1'` bzw. `'A'`.
- [ ] **Step 4: Tests** → PASS.
- [ ] **Step 5: Commit** `feat: resolve field values from data type catalog`

---

### Task 6: Feld-Erkennung und Typ-Vorschlag

**Files:**
- Create: `src/dom/locator.ts`, `src/dom/suggest.ts`
- Test: `tests/dom/locator.test.ts`, `tests/dom/suggest.test.ts`

**Interfaces:**
- Produces:

```ts
export type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLElement; // HTMLElement = role=combobox/radiogroup
export function describeElement(el: FormControl): FieldLocator;
export type FindResult = { status: 'found'; el: FormControl } | { status: 'missing' } | { status: 'ambiguous'; count: number };
export function findElement(root: ParentNode, loc: FieldLocator): FindResult;
export function normalizeLabel(text: string): string;  // trim, collapse whitespace incl. nbsp, strip trailing '*' and ':', lowercase
export function isRequired(el: FormControl): boolean;  // required | aria-required=true | label ends with '*'
export function suggestDataType(el: FormControl): DataTypeConfig;
```

- [ ] **Step 1: Tests schreiben** (happy-dom, Markup inline)
  - Label über `for`, umschließendes `<label>` und `aria-labelledby` wird erkannt.
  - `normalizeLabel('  PLZ&nbsp;* ')` → `'plz'`.
  - Vorlage per Label „PLZ“ findet Feld auch, nachdem Felder im DOM umsortiert wurden.
  - Zwei Felder mit Label „Straße“, `name="company_street"` / `name="billing_street"` → Locator mit `name` findet genau das richtige; Locator nur mit Label → `ambiguous`, `count: 2` (Review Focus 1).
  - Feld entfernt → `missing`. Andere `kind` mit gleichem Label → nicht gefunden.
  - Radiogruppe: `describeElement` auf ein Radio → `kind:'radiogroup'`, `name` der Gruppe; Label aus `<legend>` bzw. `role=radiogroup` + `aria-labelledby`.
  - `<div role="combobox">` → `kind:'combobox'`.
  - `suggestDataType`: Label „PLZ“ → `{type:'zip'}`; `autocomplete="email"` → `email`; „Kostenstelle“ → `{type:'list', values:[]}`; `<select>` ohne Treffer → `{type:'choice', mode:'random', values:[]}`; `type="date"` → `{type:'date', range:'past'}`; Checkbox → `{type:'checkbox', checked:true}`; „IBAN“, „USt-IdNr.“, „Leitweg-ID“, „Kundennummer“ → `iban`, `vatId`, `leitwegId`, `{type:'pattern', pattern:'TEST-{zahl:6}'}`; unbekannt → `text`.
- [ ] **Step 2: Tests** → FAIL.
- [ ] **Step 3: Implementieren.** Trefferbewertung: `name` 4, `id` 3, Label 3, `aria-label` 2, Placeholder 1; nur Kandidaten mit gleicher `kind`; gültig ab Score ≥ 3; gleicher Höchstscore bei > 1 Kandidat → `ambiguous`. Versteckte Elemente (`hidden`, `type=hidden`, `display:none` laut `getComputedStyle`) sind keine Kandidaten. Vorschlag per Schlüsselwort-Tabelle (Deutsch) über Label/Name/`autocomplete`.
- [ ] **Step 4: Tests** → PASS.
- [ ] **Step 5: Commit** `feat: locate form fields by stable attributes and suggest data types`

---

### Task 7: Befüllen je Elementtyp + Testseite

**Files:**
- Create: `src/dom/fill.ts`, `test-site/index.html`, `test-site/vite.config.ts`, `test-site/src/main.ts`, `test-site/src/TestForm.vue`, `test-site/src/AriaCombobox.vue`
- Test: `tests/dom/fill.test.ts`, `tests/dom/fill-vue.test.ts`

**Interfaces:**
- Consumes: `FieldValue` (Task 5), `FormControl` (Task 6).
- Produces:

```ts
export type FillOutcome = { status: 'filled'; shown: string } | { status: 'failed'; reason: string };
export function fillElement(el: FormControl, v: FieldValue, kind: ControlKind): Promise<FillOutcome>;
export function nextFrame(): Promise<void>;
```

- [ ] **Step 1: Testseite bauen** – `TestForm.vue` (neutral, fiktive Firma „Musterformular“): `v-model` für Text, Textarea, `type="date"`, Text-Datum (`DD.MM.YYYY`), Select mit Platzhalter „Bitte wählen“ (`value=""`), Radiogruppe „Rolle“ (Teilnehmer/Lernmanager/Admin), Checkbox „Rechnungsadresse abweichend“, die per `v-if` den Block Rechnungsadresse einblendet (gleiche Labels wie Firmenadresse, andere `name`), `AriaCombobox.vue` (APG-Muster: `role=combobox`, `aria-controls` → `role=listbox`, Optionen `role=option`, Auswahl auf `mousedown`), Feld mit `maxlength="20"`, „Weiter“ wechselt per `v-if` zu Schritt 2 ohne Neuladen. Model wird als `<pre data-testid="model">` ausgegeben. `npm run test-site` startet sie.
- [ ] **Step 2: Tests schreiben**
  - DOM: Text gesetzt + `input`- und `change`-Event je einmal ausgelöst; `el.value` gleich Wert.
  - Select `random` wählt nie die Platzhalter-Option (50 Läufe) (Review Focus 2); `subset` nur aus `values` (Abgleich über Text oder `value`, Groß/Klein egal); `fixed` mit nicht vorhandenem Wert → `failed`, Grund nennt den Wert.
  - Radio `fixed 'Lernmanager'` → genau dieses Radio `checked`.
  - Checkbox `checked:true` bei bereits gesetzter Box → bleibt gesetzt (kein Umschalten).
  - Text-Datum → `DD.MM.YYYY`, `type=date` → `YYYY-MM-DD`.
  - Vue (`mount(TestForm)`): nach `fillElement` auf Text, Select, Radio, Checkbox, Combobox enthält das Model die Werte (Anti-Ziel „optisch befüllt, intern leer“).
  - Combobox ohne erscheinende Listbox innerhalb 500 ms → `failed`, Grund „Auswahlliste nicht geöffnet“.
  - Bedingtes Feld: Checkbox „abweichend“ befüllen, `await nextFrame()`, danach `findElement` für `billing_street` → `found` (Review Focus 4).
- [ ] **Step 3: Tests** → FAIL.
- [ ] **Step 4: Implementieren.** Text/Textarea/Datum: nativer Value-Setter aus dem Prototyp (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set`), dann `input` + `change` (bubbles), danach `focus()`/`blur()`. Select: `value` setzen + `change`/`input`. Radio/Checkbox: `click()` statt `checked` setzen. Combobox: `focus`, `click`, ggf. `ArrowDown`-Keydown; Listbox über `aria-controls`/`aria-owns`; Option per `mousedown`, `mouseup`, `click`. Nach dem Setzen Rücklesen; Abweichung → `failed`. Überlange Werte respektieren `maxLength` (Kürzen passiert vorher in `applyRunId`, hier nur übergeben).
- [ ] **Step 5: Tests** → PASS.
- [ ] **Step 6: Commit** `feat: fill native and aria form controls so vue v-model registers values`

---

### Task 8: Befüll-Ablauf, Datensatz-Speicher, Tastenkürzel

**Files:**
- Create: `src/fill/runFill.ts`, `src/fill/dispatch.ts`, `src/fill/appMatch.ts`, `src/storage/datasetStore.ts`, `entrypoints/content.ts`, `entrypoints/background.ts`
- Test: `tests/fill/runFill.test.ts`, `tests/fill/appMatch.test.ts`, `tests/storage/datasetStore.test.ts`, `tests/fill/dispatch.test.ts`

**Interfaces:**
- Consumes: Tasks 2–7.
- Produces:

```ts
// runFill.ts (content side)
export interface FieldReport { fieldId: string; label: string; status: 'filled' | 'skipped' | 'missing' | 'ambiguous' | 'failed'; detail?: string }
export interface FillReport { templateId: string; filled: number; total: number; fields: FieldReport[] }
export function runFill(root: ParentNode, t: Template, ds: Dataset, mode: 'all' | 'required', f: Faker): Promise<FillReport>;

// messages
export type ContentMessage =
  | { type: 'fill'; template: Template; dataset: Dataset; mode: 'all' | 'required' }
  | { type: 'record:start'; templateId: string };

// datasetStore.ts — storage.session key `ds:${tabId}:${processKey}`, processKey = process?.name ?? template.id
export function getOrCreateDataset(tabId: number, t: Template, f: Faker): Promise<Dataset>; // step 1 always creates new
export function clearDatasetsForTab(tabId: number): Promise<void>;

// appMatch.ts — '*' matches any chars; most specific (longest pattern without '*') wins
export function matchApp(url: string, apps: AppDef[]): AppDef | null;

// dispatch.ts (extension side)
export function dispatchFill(tabId: number, templateId: string, mode: 'all' | 'required'): Promise<FillReport>;
export function startRecording(tabId: number, templateId: string): Promise<void>;
```

- [ ] **Step 1: Tests schreiben**
  - `runFill` Modus `required`: nur Pflichtfelder bearbeitet, optionale Felder unverändert und im Bericht `skipped` (`total` = Anzahl Pflichtfelder).
  - `runFill`: Felder in Vorlagenreihenfolge, mit `nextFrame()` dazwischen; fehlendes Feld → `missing`, Rest wird trotzdem befüllt; `filled`/`total` stimmen.
  - `getOrCreateDataset`: Schritt 2 desselben Prozesses im selben Tab → gleicher `runId`; anderer Tab → anderer `runId`; Schritt 1 → immer neu; `ensureSlots` wird angewendet und gespeichert.
  - `clearDatasetsForTab(1)` löscht nur Schlüssel von Tab 1.
  - `matchApp('https://test.example.org/customers/create', [{urlPatterns:['https://*.example.org/*']},{urlPatterns:['https://test.example.org/*']}])` → zweite App; keine Übereinstimmung → `null`.
  - `dispatchFill` (mit `fakeBrowser`, `scripting`/`tabs.sendMessage` gemockt): speichert `lastTemplateId` in Prefs und `lastMissing` (ids mit Status `missing`/`ambiguous`/`failed`) in der Vorlage.
- [ ] **Step 2: Tests** → FAIL.
- [ ] **Step 3: Implementieren.** `content.ts` mit `registration: 'runtime'`, Injektion per `browser.scripting.executeScript({ files: ['/content-scripts/content.js'] })`, idempotent (Flag auf `window`). `background.ts`: `commands.onCommand('fill-last')` → aktiver Tab → `dispatchFill` mit Prefs; `tabs.onRemoved` → `clearDatasetsForTab`. Nachricht ohne gültige Vorlage → Bericht mit Fehler statt Exception.
- [ ] **Step 4: Tests** → PASS; `npm run build`.
- [ ] **Step 5: Commit** `feat: orchestrate fill runs with per-tab datasets and shortcut`

---

### Task 9: Popup „Schnellzugriff“

**Files:**
- Create: `entrypoints/popup/App.vue`, `src/ui/Segmented.vue`, `src/ui/FillReportView.vue`, `src/popup/usePopup.ts`
- Test: `tests/popup/usePopup.test.ts`

**Interfaces:**
- Consumes: `matchApp`, `listApps`, `listTemplates`, `getPrefs`/`setPrefs`, `dispatchFill`, `startRecording`, `clearDatasetsForTab`.
- Produces: `usePopup()` → `{ app: Ref<AppDef|null>, apps, templates, mode, report: Ref<FillReport|null>, busy, error, fill(templateId), newDataset(), chooseApp(id), createAppForCurrentPage(name), newTemplate(name), record(templateId), openManage() }`.

Aufbau laut abgestimmtem Wireframe B: Kopf „<App> · erkannt“ + Zahnrad (öffnet Pflege-Tab), Umschalter „Alle Felder | Nur Pflicht“, Vorlagen-Liste (Name, Prozess/Schritt klein, Knopf „Füllen“, Menü „Felder aufnehmen / Bearbeiten“), „+ Neue Vorlage“, „Neuer Datensatz“, „Andere App wählen“, Hinweis Tastenkürzel. Ohne erkannte App: „Neue App für diese Seite“ (Name + URL-Muster vorbelegt aus `origin + '/*'`, fordert `permissions.request({ origins })` an). Statuszeile mit `aria-live="polite"`, aufklappbar zu `FillReportView`.

- [ ] **Step 1: Tests schreiben** (Composable mit `fakeBrowser`): erkennt App für aktive URL; ohne Treffer `app === null`; `mode` wird aus Prefs geladen und beim Umschalten gespeichert; `fill` setzt `report`; Fehler aus `dispatchFill` landet in `error` (Text Deutsch), `busy` danach `false`.
- [ ] **Step 2: Tests** → FAIL. **Step 3: Implementieren.** **Step 4: Tests** → PASS.
- [ ] **Step 5: Manuell prüfen** (`npm run dev`, Testseite): Tastaturbedienung komplett, Fokus sichtbar, Kontrast, Breite 360 px, Status wird vorgelesen (VoiceOver).
- [ ] **Step 6: Commit** `feat: add quick access popup with app detection and fill status`

---

### Task 10: Aufnahme-Overlay

**Files:**
- Create: `src/recorder/Recorder.vue`, `src/recorder/mountRecorder.ts`, `src/recorder/useRecorder.ts`; Modify: `entrypoints/content.ts`
- Test: `tests/recorder/useRecorder.test.ts`

**Interfaces:**
- Consumes: `describeElement`, `suggestDataType`, `isRequired`, `DATA_TYPES`, `slotKindFor`, `getTemplate`/`saveTemplate`.
- Produces: `useRecorder(template: Template)` → `{ fields, pending: Ref<{el, rule}|null>, capture(el), accept(rule), remove(fieldId), save(), cancel() }`. UI via WXT `createShadowRootUi` (Isolation der eigenen Styles).

Verhalten: Aufnahme startet aus Popup (`record:start`). Formularelemente werden beim Überfahren hervorgehoben; **Fokus auf ein Formularelement** (per Klick oder Tab) öffnet das Popover am Feld: Datentyp (Vorschlag vorausgewählt, gruppiert nach `DATA_TYPES.group`), Slot-Auswahl nur bei `slotKind` (Person 1/2/…, Adresse A/B/… inkl. „neu“), Pflicht-Haken (vorbelegt aus `isRequired`), Kennung-Haken, Typ-Optionen (z. B. Werte bei „Aus Liste“). Bereits erfasste Felder grün markiert mit Typ-Etikett; Fokus auf erfasstes Feld öffnet es zum Bearbeiten. Leiste unten: „● Aufnahme · N Felder · Esc beendet · Speichern“. Esc schließt Popover, zweites Esc beendet (mit Rückfrage bei ungespeicherten Änderungen). Erneutes Erfassen eines bereits vorhandenen Locators ersetzt das Feld statt es zu verdoppeln.

- [ ] **Step 1: Tests schreiben**: `capture` füllt `pending.rule` mit Vorschlag + `required`; `accept` hängt neues Feld ans Ende; gleiches Element erneut → ersetzt; `save` schreibt Vorlage, Reihenfolge erhalten; `cancel` schreibt nichts.
- [ ] **Step 2: Tests** → FAIL. **Step 3: Implementieren.** **Step 4: Tests** → PASS.
- [ ] **Step 5: Manuell prüfen** auf der Testseite: alle Feldarten erfassbar, nur per Tastatur bedienbar, Overlay verändert keine Seitenstyles.
- [ ] **Step 6: Commit** `feat: add on-page recorder for capturing template fields`

---

### Task 11: Pflege-Tab

**Files:**
- Create: `entrypoints/manage/App.vue`, `src/manage/AppList.vue`, `src/manage/TemplateTable.vue`, `src/manage/ConfigEditor.vue`, `src/manage/useManage.ts`
- Test: `tests/manage/useManage.test.ts`

**Interfaces:**
- Consumes: Repository + Export/Import (Task 2), `DATA_TYPES`, `startRecording`.
- Produces: `useManage()` → `{ apps, selectedApp, templates, selectedTemplate, updateField(id, patch: Partial<FieldRule>), removeField(id), moveField(id, to: number), saveApp, removeApp, saveTemplateMeta(patch: Pick<Template,'name'|'process'>), exportAll(), exportApp(id), importFile(text, onConflict) → Promise<string /* Meldung */>, recordFields() }`.

Aufbau laut Wireframe B: links Apps (Name, URL-Muster bearbeitbar), Vorlagen der App; rechts Tabelle mit Spalten Ziehgriff · Feld · Datentyp · Slot · Pflicht · Kennung · Löschen; Zeile aufklappbar für `ConfigEditor` (Festwert, Auswahl-Modus + Werte, Liste, Muster mit Platzhalter-Hilfe, Datum, Zahl, Mindestalter). ⚠ mit Tooltip-Text „Beim letzten Füllen nicht gefunden“ für `lastMissing`. Prozessname + Schritt pro Vorlage. Reihenfolge per Ziehen **und** per Tastatur (Knöpfe „nach oben/unten“, WCAG 2.5.7). Löschen mit Bestätigung. Export als Download (`<a download>` mit Blob), Import per Dateiauswahl, Konflikt-Abfrage „Überschreiben / Als Kopie“. „+ Felder aufnehmen“ aktiviert den zuletzt genutzten Tab der App (`tabs.query` per URL-Muster) und startet die Aufnahme; kein passender Tab → Hinweis „Öffne zuerst die Seite der App“.

- [ ] **Step 1: Tests schreiben**: `moveField` ändert Reihenfolge und persistiert; `updateField` mit Typwechsel auf personbezogenen Typ setzt `slot` auf `'1'`, auf slotlosen Typ auf `null`; `importFile` mit ungültigem Text liefert Fehlermeldung und ändert nichts; Export einer App enthält nur deren Vorlagen.
- [ ] **Step 2: Tests** → FAIL. **Step 3: Implementieren.** **Step 4: Tests** → PASS.
- [ ] **Step 5: Manuell prüfen**: Tastatur, Fokus, Kontrast, Tabelle bei 1280 px und 800 px Breite nutzbar.
- [ ] **Step 6: Commit** `feat: add template management tab with table editor and export/import`

---

### Task 12: Ende-zu-Ende-Prüfung in Dia, README, Definition of Done

**Files:**
- Create: `README.md`

- [ ] **Step 1: README** (Deutsch): Zweck, Installation als entpackte Erweiterung in Dia (macOS) und Arc/Dia (Windows) aus `.output/chrome-mv3`, Tastenkürzel ändern, Daten bleiben lokal, Export/Import, Datenquelle PLZ (Attribution), Testseite starten, Hinweis: keine app-spezifischen Vorlagen ins Repo.
- [ ] **Step 2: Ende-zu-Ende in Dia** mit der Testseite: App anlegen → Vorlage „Schritt 1“ aufnehmen (alle Feldarten, Person 2, Adresse B) → Füllen „Alle“ und „Nur Pflicht“ → Formular absenden ohne Validierungsfehler → Schritt 2 füllen (gleiche Kennung) → „Neuer Datensatz“ → neue Kennung → Feld in Testseite umbenennen → ⚠ im Popup-Bericht und Pflege-Tab → Tastenkürzel → Export, Erweiterung neu laden, Import.
- [ ] **Step 3: Definition of Done**: `npm run typecheck && npm run lint && npm test && npm run build` grün; Suche nach den Namen von Ziel-App und Arbeitgeber in src, entrypoints, tests, test-site ohne Treffer.
- [ ] **Step 4: Übergabe an Martin**: Abnahme in der Ziel-App (Kundenanlage Schritt 1, Benutzeranlage) und Test in Arc auf Windows durch Martin.
- [ ] **Step 5: Commit** `docs: add readme with installation and usage`
