# Automatische Updates für Firefox – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firefox holt neue Versionen selbst über eine Update-Datei im Repo und GitHub-Releases; ein fortsetzbarer Befehl veröffentlicht eine Version.

**Architecture:** `updates.json` liegt in der Repo-Wurzel und wird über `raw.githubusercontent.com` ausgeliefert; die `.xpi` hängt am GitHub-Release `v<version>`. Reine Teile (`scripts/updates.ts`, `scripts/release-steps.ts`) sind getestet; `scripts/release-firefox.ts` führt die noch fehlenden Schritte aus.

**Tech Stack:** WXT (Manifest), tsx, web-ext (bestehendes Signieren), gh CLI, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-firefox-auto-update-design.md`

## Global Constraints

- Basis `main` nach Merge von B; Branch `feat/firefox-auto-update`.
- `update_url`: `https://raw.githubusercontent.com/marliedev/form-filler/main/updates.json`, nur im Firefox-Manifest; Add-on-Kennung `form-filler@martinliesche.de`.
- Download-Link: `https://github.com/marliedev/form-filler/releases/download/v<version>/form-filler-<version>.xpi`.
- `updates.json` darf eine Version nie zweimal enthalten; der Befehl schreibt nie auf `main`, sondern auf `release/v<version>`.
- gh-Konto `marliedev` muss aktiv sein (`gh auth status`), sonst Abbruch vor dem Signieren.
- Kommentare Englisch, Conventional Commits auf Englisch, keine KI-Attribution.

## Review Focus

- Abbruch nach dem Signieren (Netz, Konto) und erneuter Aufruf → setzt mit der vorhandenen `.xpi` fort, signiert nicht erneut (Test in Task 2).
- Version steht schon in `updates.json` → Abbruch vor allem anderen (Test in Task 1 und 2).
- Release existiert mit anderer Datei → Abbruch mit Meldung, nichts überschrieben (Test in Task 2).

---

### Task 1: Update-Datei, Manifest, reine Helfer, README

**Files:**
- Create: `updates.json` (leere Liste), `scripts/updates.ts`
- Modify: `wxt.config.ts`, `README.md` (Datenschutz: Update-Abruf; Firefox-Abschnitt: neuer Ablauf), `CHANGELOG.md` (Unreleased-Hinweis)
- Test: `tests/scripts/updates.test.ts`

**Interfaces:** `scripts/updates.ts`: `export interface UpdatesFile { addons: Record<string, { updates: { version: string; update_link: string }[] }> }`; `ADDON_ID`; `releaseLink(version: string): string`; `addRelease(file: UpdatesFile, version: string): UpdatesFile` (wirft bei doppelter Version, hängt an); `parseUpdates(text: string): UpdatesFile` (validiert Form); `hasVersion(file, version): boolean`.

- [ ] **Step 1: Failing tests**: anhängen, Duplikat wirft, Link-Format, Parsen einer leeren Datei, ungültige Datei wirft.
- [ ] **Step 2: Run** `npx vitest run tests/scripts` → FAIL.
- [ ] **Step 3: Implementieren**; `wxt.config.ts`: `gecko.update_url` ergänzen; `updates.json`: `{ "addons": { "form-filler@martinliesche.de": { "updates": [] } } }`.
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck && npm run lint && npx wxt build -b firefox` und `grep update_url .output/firefox-mv3/manifest.json` → PASS, Adresse im Manifest; `npm run build` → Chrome-Manifest ohne `update_url`.
- [ ] **Step 5: Commit** `feat: update manifest and helpers for Firefox self-updates`

---

### Task 2: Release-Befehl

**Files:**
- Create: `scripts/release-steps.ts`, `scripts/release-firefox.ts`
- Modify: `package.json` (`release:firefox`), `README.md`
- Test: `tests/scripts/release-steps.test.ts`

**Interfaces:** `release-steps.ts`: `export interface ReleaseState { version: string; clean: boolean; onMain: boolean; upToDate: boolean; ghAccount: string; inUpdates: boolean; signedPath: string | null; releaseAssets: string[] | null; branchExists: boolean }`; `export type Step = 'sign' | 'rename' | 'release' | 'updates' | 'branch'`; `planRelease(state: ReleaseState): { steps: Step[] } | { error: string }` (Fehler: unsauber, nicht auf `main`, nicht aktuell, falsches Konto, Version schon in `updates.json`, Release mit anderer Datei, Branch existiert; sonst die fehlenden Schritte in fester Reihenfolge). `release-firefox.ts`: liest den Zustand (`git status --porcelain`, `git rev-parse --abbrev-ref HEAD`, `git fetch` + Vergleich, `gh auth status`, `updates.json`, `.output/firefox-signed/`, `gh release view`, `git branch --list`), ruft `planRelease`, führt Schritte aus (Signieren über `npm run sign:firefox`, Umbenennen, `gh release create v<version> <xpi> --title "Form Filler <version>" --notes-file <Changelog-Abschnitt>`, `updates.json` schreiben, `git checkout -b release/v<version>`, Commit `chore: publish <version> for Firefox updates`, `git push -u`), druckt den PR-Link (`gh pr create` mit Standardtext) und die nächsten Schritte.

- [ ] **Step 1: Failing tests** (`planRelease`): sauberer Start → alle fünf Schritte; `.xpi` vorhanden → ohne `sign`; Release mit gleicher Datei vorhanden → ohne `sign`/`rename`/`release`; Version in `updates.json` → Fehler; falsches Konto → Fehler; Release mit anderer Datei → Fehler.
- [ ] **Step 2: Run** `npx vitest run tests/scripts` → FAIL.
- [ ] **Step 3: Implementieren**; `package.json`: `"release:firefox": "tsx scripts/release-firefox.ts"`.
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck && npm run lint` → PASS. README-Abschnitt „Firefox: signieren und verteilen“ auf den neuen Ablauf (fünf Schritte) umschreiben, Probe-Lauf mit 0.2.90/0.2.91 beschreiben.
- [ ] **Step 5: Commit** `feat: resumable Firefox release command`

Nach dem Merge: Probe-Releases 0.2.90 und 0.2.91 auf dem Rechner des Product Owners (siehe Spec), dann 0.3.0.
