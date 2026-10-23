# Automatische Updates für Firefox – Design

Stand: 2026-10-23. Produktentscheidung: Auto-Update kommt mit 0.3.0; 0.3.0 wird ein letztes Mal von Hand verteilt, danach holt Firefox neue Versionen selbst.

## Absicht

Das Team bekommt neue Versionen heute als `.xpi` im Chat und installiert sie von Hand. Firefox kann selbst signierte, selbst verteilte Add-ons automatisch aktualisieren, wenn das Add-on eine Update-Adresse kennt. Ein Release soll dann aus einem Befehl und einem Pull Request bestehen.

## Ziele

- Firefox prüft die Update-Adresse selbst (täglich und bei „Nach Updates suchen“) und installiert neue Versionen ohne Zutun.
- Ein Befehl `npm run release:firefox` signiert die aktuelle Version, legt das GitHub-Release mit der `.xpi` an und trägt die Version in die Update-Datei ein.
- Die README beschreibt den Ablauf in fünf Schritten.

## Voraussetzung

Firefox auf den Team-Rechnern muss `raw.githubusercontent.com` und `github.com` erreichen dürfen (Proxy, Firewall, Firefox-Richtlinien), und der tägliche Update-Abruf an GitHub (IP-Adresse, Browserkennung) muss im Team in Ordnung sein. Das ist mit dem Product Owner zu klären, bevor 0.3.0 signiert wird, denn die Adresse steckt danach fest in der verteilten Version. Die README (Abschnitt „Datenschutz“) nennt den Update-Abruf als einzigen Netzwerkzugriff der Erweiterung.

## Nicht-Ziele

- Kein Auto-Update für Chromium-Browser; das ginge nur über den Chrome Web Store (eigenes Vorhaben).
- Keine Beta-Kanäle, kein Zurückrollen.

## Anti-Ziele

- Eine Version darf nie zweimal in der Update-Datei stehen oder ein Release überschreiben.
- Der Befehl darf nichts auf `main` schreiben; Änderungen an der Update-Datei gehen wie alles andere über einen Pull Request.

## Ablauf

1. Version in `package.json` erhöhen, Changelog ergänzen, mergen.
2. Auf `main`: `npm run release:firefox`. Der Befehl prüft, dass der Arbeitsbaum sauber, `main` aktuell und das gh-Konto `marliedev` aktiv ist und dass die Version noch nicht in der Update-Datei steht. Dann führt er die Schritte aus, die noch fehlen, und überspringt erledigte: signieren (liegt `.output/firefox-signed/…-<version>.xpi` schon vor, wird sie verwendet, denn Mozilla signiert eine Version nur einmal), Datei in `form-filler-<version>.xpi` umbenennen, GitHub-Release `v<version>` mit der Datei anlegen (existiert es mit dieser Datei schon, weiter), Version mit Download-Adresse in `updates.json` eintragen, Branch `release/v<version>` mit Commit anlegen. Ein Abbruch durch Netz oder Konto lässt sich so mit demselben Befehl fortsetzen, ohne eine Versionsnummer zu verbrauchen. Meine Festlegung.
3. Pull Request für den Branch mergen. Ab dann liefert `main` die neue Update-Datei aus.
4. Firefox-Nutzer bekommen die Version beim nächsten Update-Lauf; Chromium-Nutzer bauen wie bisher.
5. Für das Team-Posting reicht der Hinweis auf die Version; kein Anhang mehr nötig.

## Technische Festlegungen

- `wxt.config.ts`, nur Firefox: `browser_specific_settings.gecko.update_url = 'https://raw.githubusercontent.com/marliedev/form-filler/main/updates.json'`. Die Datei liegt im Repo, damit der Pull-Request-Weg gilt und kein weiteres Hosting nötig ist.
- `updates.json` (Repo-Wurzel) im Format von Mozilla: `{ "addons": { "form-filler@martinliesche.de": { "updates": [ { "version": "0.3.0", "update_link": "https://github.com/marliedev/form-filler/releases/download/v0.3.0/form-filler-0.3.0.xpi" } ] } } }`. Download-Adressen müssen `https` sein; GitHub-Releases erfüllen das. Die `.xpi` ist signiert, daher akzeptiert Firefox sie als Update.
- `scripts/release-firefox.ts` (tsx), reine Teile in `scripts/updates.ts`: `addRelease(json, version, link)` (lehnt doppelte Versionen ab, sortiert nicht um) und `releaseLink(version)`. Der Rest ruft `git`, `npm run sign:firefox` und `gh` auf; Fehler brechen mit deutscher Meldung ab, bevor etwas veröffentlicht wird (Reihenfolge: prüfen → signieren → Release → Datei → Branch).
- Mindestversion und Kennung des Add-ons bleiben wie bisher (`form-filler@martinliesche.de`, Firefox 140).
- Tests: `scripts/updates.ts` mit Vitest (Eintrag anhängen, Duplikat abweisen, Link-Format), die Schritt-Erkennung des Release-Befehls mit gemockten Kommandos (jeder Schritt wird genau einmal übersprungen bzw. ausgeführt). Der Update-Weg wird **vor** der Verteilung von 0.3.0 einmal echt geprüft, ohne 0.3.x zu verbrauchen: zwei Probe-Versionen `0.2.90` und `0.2.91` auf dem Rechner des Product Owners (0.2.90 installieren, 0.2.91 veröffentlichen, in `about:addons` „Nach Updates suchen“ → 0.2.91 wird installiert). Erst danach wird 0.3.0 signiert und verteilt. Meine Festlegung; die Probe-Releases bleiben auf GitHub, das Team bekommt sie nie, weil es 0.2.x nie mit Update-Adresse hatte.

## Aufwand

Ein Ticket.
