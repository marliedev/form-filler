# Form Filler

Chromium-Erweiterung (Manifest V3), die Webformulare mit zusammenhängenden deutschen Testdaten befüllt. Die Felder einer Seite werden einmal als Vorlage aufgenommen; danach genügt ein Klick oder ein Tastenkürzel. Datensätze bleiben über mehrteilige Prozesse hinweg konsistent (gleiche Kennung, gleiche Person, gleiche Adresse).

## Installation (entpackte Erweiterung)

Voraussetzung: Node.js und npm.

```sh
npm ci
npm run build
```

Das Ergebnis liegt in `.output/chrome-mv3`.

Laden in Dia (macOS) sowie Arc oder Dia (Windows) – der Ablauf ist bei allen Chromium-Browsern gleich:

1. Die Erweiterungsseite des Browsers öffnen (z. B. `chrome://extensions` bzw. über das Browsermenü „Erweiterungen verwalten“).
2. Den **Entwicklermodus** aktivieren.
3. **„Entpackte Erweiterung laden“** wählen und den Ordner `.output/chrome-mv3` auswählen.

Die genauen Menü- und Schaltflächennamen können je nach Browser und Version abweichen. Nach einem neuen Build die Erweiterung auf der Erweiterungsseite neu laden.

## Erste Schritte

1. Die Zielseite öffnen und das Popup der Erweiterung starten.
2. **Neue App für diese Seite** anlegen (Name und URL-Muster) und die angeforderte Berechtigung für die Seite erteilen.
3. **Neue Vorlage** anlegen; die Aufnahme startet auf der Seite.
4. Felder anklicken bzw. fokussieren, Datentyp und Optionen im Popover prüfen und übernehmen, mit „Speichern“ beenden.
5. Im Popup **Füllen** wählen („Alle“ oder „Nur Pflicht“). Nicht gefundene oder nicht befüllbare Felder werden im Bericht mit Warnung angezeigt.

Bei mehrteiligen Prozessen bleibt die Kennung zwischen den Schritten gleich; **Neuer Datensatz** beginnt einen neuen Durchlauf.

## Tastenkürzel

Standard: **Alt+Shift+F** füllt die aktuelle Seite mit der zuletzt genutzten Vorlage. Ändern lässt sich das Kürzel auf der Kürzel-Seite der Erweiterungsverwaltung des Browsers (bei Chromium-Browsern meist `chrome://extensions/shortcuts`).

## Datenschutz

Alle Daten bleiben lokal im Browser: Apps und Vorlagen in `storage.local`, Füllstände und Berichte pro Tab in `storage.session`. Es gibt keine Synchronisierung (`storage.sync` wird nicht verwendet) und keine Netzwerkzugriffe zur Laufzeit.

## Export und Import

Im Pflege-Tab („Vorlagen verwalten“, Zahnrad im Popup) lassen sich Apps und Vorlagen als JSON-Datei exportieren und wieder importieren. Bei Konflikten fragt der Import nach.

## Keine App-Vorlagen im Repository

App-spezifische Vorlagen und Exporte gehören nicht ins Repository. Sie bleiben lokal bzw. werden außerhalb des Repos weitergegeben.

## Testseite

```sh
npm run test-site
```

Startet eine lokale Testseite mit allen unterstützten Feldarten für Aufnahme- und Füll-Tests.

## Entwicklung

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsmodus (WXT) |
| `npm run build` | Produktions-Build nach `.output/chrome-mv3` |
| `npm run typecheck` | Typprüfung (vue-tsc) |
| `npm run lint` | ESLint |
| `npm test` | Unit-Tests (Vitest) |
| `npm run test-site` | Lokale Testseite |

Manuelle Prüfungen im echten Browser: [docs/manual-test-checklist.md](docs/manual-test-checklist.md).

## Datenquellen

Die Postleitzahlen-Daten stammen von [GeoNames](https://www.geonames.org) und stehen unter [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Details: [src/data/README.md](src/data/README.md).
