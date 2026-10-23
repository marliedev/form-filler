# Vorlagen im Team abgleichen – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jede App kann eine Vorlagen-Quelle (Adresse einer Export-Datei) haben; „Abgleichen“ bringt ihre Vorlagen auf den Stand der Quelle, ohne lokale Arbeit zu verlieren.

**Architecture:** Reine Funktionen planen den Abgleich (`planSync`) und prüfen die Datei (`fetchSource` mit dem bestehenden Export-Schema); `useManage` orchestriert Berechtigung, Zuordnung und Schreiben; der Pflege-Tab bekommt Feld und Knöpfe. Abgeglichene Vorlagen tragen `source` mit Kennung aus der Datei und Fingerabdruck.

**Tech Stack:** WXT 0.21, Vue 3, TypeScript strict, zod, Vitest + happy-dom + fake-browser, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-template-sync-design.md`

## Global Constraints

- Basis `main` nach Merge von D; Branch `feat/template-sync`.
- Datenmodell: `AppDef.source?: { url: string; appId: string | null }`, `Template.source?: { templateId: string; fingerprint: string }`; Fingerabdruck = `JSON.stringify({ name, process, fields })` der Fassung aus der Quelle.
- Export und Duplizieren entfernen `source`.
- Adressen nur `http:`/`https:`; Berechtigung für `origin + '/*'` vor dem ersten `await` anfragen.
- Texte exakt: Feld „Vorlagen-Quelle (Adresse)“, Knöpfe „Abgleichen“ und „Alle abgleichen“, Hinweis „Quelle“ in der Liste, Zusammenfassung „Abgeglichen: N neu, N aktualisiert, N lokal geändert (Kopie), N entfernt“, Kopie `<Name> (lokal)` bzw. `(lokal 2)`; Fehler „Quelle nicht erreichbar.“, „Die Adresse liefert keine Form-Filler-Export-Datei. Bei Freigabe-Links die direkte Download-Adresse eintragen.“, „Keine passende App in der Datei: <Namen>.“, „Die Quelle enthält die zugeordnete App nicht mehr (Kennung …). Quelle prüfen; nichts geändert.“, „Die Quelle enthält keine Vorlagen für diese App; nichts geändert.“
- Abruf: `fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) })`, Antwort > 5 MB abweisen.
- Kein `any`, Kommentare Englisch, Conventional Commits auf Englisch, keine KI-Attribution.

## Review Focus

- Zwei lokale Apps mit derselben Quelle → beide behalten ihre Vorlagen nach „Alle abgleichen“ (Test in Task 1 und 2).
- Datei mit der App, aber ohne Vorlagen → Abbruch mit Meldung, nichts gelöscht (Test in Task 1 und 2).
- Adresse ändern, dann abgleichen gegen eine Datei mit anderer App-Kennung → keine Vorlage verschwindet (Test in Task 2).
- Abruf liefert HTML (Freigabe-Seite) → Meldung mit Hinweis auf die Download-Adresse (Test in Task 1).
- Berechtigung verweigert → Quelle wird nicht gespeichert, alte Quelle bleibt (Test in Task 2).

---

### Task 1: Datenmodell, `planSync`, `fetchSource`

**Files:**
- Modify: `src/model/types.ts`, `src/model/schema.ts` (optionale `source`-Felder; `buildExport` entfernt `source`), `src/manage/useManage.ts` (nur `duplicateTemplate` entfernt `source`)
- Create: `src/sync/planSync.ts`, `src/sync/fetchSource.ts`
- Test: `tests/model/schema.test.ts`, `tests/sync/planSync.test.ts`, `tests/sync/fetchSource.test.ts`, `tests/manage/useManage.test.ts` (Duplikat ohne `source`)

**Interfaces:**
- Produces (`planSync.ts`):
  ```ts
  export type SyncAction =
    | { kind: 'adopt'; local: Template; source: Template }          // same id, same content → mark
    | { kind: 'create'; source: Template }                           // new local id
    | { kind: 'replace'; local: Template; source: Template }         // unchanged locally
    | { kind: 'copyAndReplace'; local: Template; source: Template }  // locally changed
    | { kind: 'remove'; local: Template }
    | { kind: 'copyAndRemove'; local: Template }
    | { kind: 'unchanged'; local: Template }
  export interface SyncPlan { actions: SyncAction[]; summary: { created: number; updated: number; copied: number; removed: number } }
  export function fingerprintOf(t: Template): string
  /** `local`: all templates of the local app; `remote`: the templates of the mapped app in the file. Throws SyncError('empty') for an empty remote. */
  export function planSync(local: readonly Template[], remote: readonly Template[]): SyncPlan
  /** Applies a plan: returns the new template list of the app (ids for created/copied via createId). */
  export function applyPlan(plan: SyncPlan, appId: string, others: readonly Template[]): Template[]
  export function copyName(name: string, taken: readonly string[]): string   // '… (lokal)', '… (lokal 2)'
  export function summaryText(summary: SyncPlan['summary']): string
  ```
- Produces (`fetchSource.ts`): `export class SourceError extends Error { constructor(message: string) }`; `fetchSource(url: string, fetchImpl = fetch): Promise<ExportFile>`.

- [ ] **Step 1: Failing tests** (`tests/sync/planSync.test.ts`): je Aktion ein Fall; `adopt` bei gleicher Kennung ohne `source`; `copyAndReplace` bei lokal geändertem Fingerabdruck; zwei lokale Apps (Vorlagen mit `source.templateId` der anderen App bleiben unberührt, weil `local` nur die eigene App enthält und `create` neue Kennungen vergibt); leeres `remote` wirft; `copyName` zählt hoch; `summaryText`. `tests/sync/fetchSource.test.ts`: gültige Datei; HTML-Antwort → Meldung mit „Download-Adresse“; ungültiges JSON; `content-length` > 5 MB; Netzfehler → „Quelle nicht erreichbar.“; `file:`-Adresse abgewiesen. `tests/model/schema.test.ts`: `source` auf App und Vorlage wird akzeptiert und beim Export entfernt.

- [ ] **Step 2: Run** `npx vitest run tests/sync tests/model tests/manage` → FAIL (Module fehlen).

- [ ] **Step 3: Implementieren.** `planSync`: Zuordnung lokal↔remote über `source.templateId`, ersatzweise gleiche Kennung; `fingerprintOf` stabil (Felder in Reihenfolge, Locator-Schlüssel sortiert).

- [ ] **Step 4: Run** `npx vitest run` → PASS.

- [ ] **Step 5: Commit** `feat: plan template syncs from an export file and read source files`

---

### Task 2: Abgleich im Pflege-Zustand

**Files:**
- Modify: `src/manage/useManage.ts`, `src/storage/repository.ts` (`replaceTemplatesOfApp(appId, templates)`), `src/sync/sync.ts` (neu: Orchestrierung je App)
- Test: `tests/manage/useManage.test.ts`, `tests/sync/sync.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces (`sync.ts`): `syncApp(app: AppDef, fetchImpl?): Promise<{ app: AppDef; templates: Template[]; summary: SyncPlan['summary'] }>` (holt Datei, ordnet App zu: `app.source.appId` → sonst gleiches URL-Muster → sonst einzige App → sonst `SourceError('Keine passende App in der Datei: …')`; fehlende zugeordnete App → `SourceError('Die Quelle enthält die zugeordnete App nicht mehr …')`). `useManage`: `saveApp(app: AppDef & { sourceUrl?: string })` → setzt `source`, fragt Berechtigung für die Adresse an, bei geänderter/geleerter Adresse `stripSource` auf alle Vorlagen der App und `source.appId = null`; `syncApp(id): Promise<boolean>`, `syncAll(): Promise<void>` (Notiz je App zusammengefasst, Fehler gesammelt).

- [ ] **Step 1: Failing tests**: `saveApp` mit Adresse → `permissions.request({ origins: ['https://host/*'] })`, verweigert → unverändert; Adresswechsel entfernt `source` der Vorlagen; `syncApp` mit gemocktem `fetch`: Zuordnung über Muster, einzige App, keine Zuordnung → Fehler; App fehlt → Fehler, nichts geändert; voller Lauf → Zusammenfassung in `notice`, Vorlagen gespeichert; zwei Apps mit derselben Datei; `syncAll` sammelt Fehler.

- [ ] **Step 2: Run** `npx vitest run tests/manage tests/sync` → FAIL.

- [ ] **Step 3: Implementieren.** Schreiben serialisiert (`serialized`), Berechtigung vor dem ersten `await` wie in `saveApp` heute.

- [ ] **Step 4: Run** `npx vitest run && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 5: Commit** `feat: sync an app's templates from its source`

---

### Task 3: Pflege-Tab, Testseite, Browsertest, README

**Files:**
- Modify: `src/manage/AppList.vue` (Feld „Vorlagen-Quelle (Adresse)“ unter den URL-Mustern, Knopf „Abgleichen“ neben „Exportieren“ wenn Quelle gesetzt; Hinweis „Quelle“ an abgeglichenen Vorlagen in der Liste), `entrypoints/manage/App.vue` („Alle abgleichen“ in der Kopfzeile, wenn eine App eine Quelle hat), `tests/e2e/fixtures.ts` (`extensionId`, `openManage()`), `README.md` (Abschnitt „Vorlagen im Team“ mit Raw-/Direktlink-Hinweisen; Export-Abschnitt), `docs/manual-test-checklist.md`
- Create: `test-site/public/templates.json` (Export-Datei mit App `urlPatterns: ['http://localhost:5179/*']` und zwei Vorlagen), `tests/e2e/sync.spec.ts`
- Test: `tests/manage/AppList.test.ts` (falls vorhanden, sonst `tests/manage/TemplateTable.test.ts` erweitern), Browsertest

- [ ] **Step 1: Failing tests**: Komponente (Feld, Knopf nur mit Quelle, Hinweis „Quelle“); Browsertest:

```ts
test('gleicht Vorlagen aus der Quelle ab und behält lokale Änderungen als Kopie', async ({ extension }) => {
  await extension.seed([{ ...APP, source: { url: `${SITE_URL}/templates.json`, appId: null } }], [])
  const manage = await extension.openManage()
  await manage.getByRole('button', { name: 'Abgleichen' }).click()
  await expect(manage.getByRole('status')).toContainText('Abgeglichen: 2 neu')
  // zweiter Abgleich ohne Änderung → "0 neu, 0 aktualisiert"
})
```

- [ ] **Step 2: Run** `npm run test:e2e` → FAIL; dann implementieren; `npm run test:e2e` → alle bestanden.

- [ ] **Step 3: README und Checkliste.**

- [ ] **Step 4: Commit** `feat: template source and sync in the manage tab`
