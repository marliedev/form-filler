# Form Filler

Chromium-Erweiterung (Manifest V3), die Webformulare mit zusammenhängenden deutschen Testdaten befüllt. Die Felder einer Seite werden einmal als Vorlage aufgenommen; danach genügt ein Klick oder ein Tastenkürzel. Datensätze bleiben über mehrteilige Prozesse hinweg konsistent (gleiche Kennung, gleiche Person, gleiche Adresse).

## Funktionen

- **Vorlagen per Aufnahme:** Felder einer Seite anklicken, Datentyp prüfen, speichern. Kein Code, keine Selektoren von Hand.
- **Realistische deutsche Testdaten:** Namen, Adressen mit passender PLZ und Ort, Telefon, E-Mail, IBAN, Datum, Firmen und mehr. Jeder Durchlauf erzeugt neue Werte.
- **Stimmige Datensätze:** Zusammengehörige Felder passen zueinander, auch über mehrere Formularschritte hinweg.
- **Viele Feldarten:** Textfelder, Selects, Radio-Buttons, Checkboxen, Datumsfelder sowie eigene, barrierefreie Komponenten (ARIA-Combobox, ARIA-Radiogroup).
- **Pflegbar:** Felder ergänzen, entfernen, umsortieren und als Pflicht oder optional markieren. Export und Import als JSON.
- **Lokal:** Keine Server, kein Tracking, keine Synchronisierung.

## Installation

Die Erweiterung ist nicht im Chrome Web Store. Du baust sie einmal lokal und lädst sie als entpackte Erweiterung.

### Voraussetzungen

- [Git](https://git-scm.com)
- [Node.js](https://nodejs.org) in einer aktuellen LTS-Version (getestet mit Node.js 22) samt npm
- Ein Chromium-Browser, z. B. Dia, Arc, Chrome, Edge oder Brave

### 1. Herunterladen und bauen

```sh
git clone https://github.com/marliedev/form-filler.git
cd form-filler
npm ci
npm run build
```

Das Ergebnis liegt im Ordner `.output/chrome-mv3`.

### 2. Im Browser laden

Der Ablauf ist bei allen Chromium-Browsern gleich:

1. Die Erweiterungsseite öffnen: `chrome://extensions` in die Adresszeile eingeben oder über das Browsermenü „Erweiterungen verwalten“.
2. Den **Entwicklermodus** einschalten (meist ein Schalter oben rechts).
3. **„Entpackte Erweiterung laden“** wählen und den Ordner `.output/chrome-mv3` auswählen.
4. Die Erweiterung an die Symbolleiste anheften, damit das Popup mit einem Klick erreichbar ist.

Die genauen Menü- und Schaltflächennamen können je nach Browser und Version abweichen.

### 3. Aktualisieren

```sh
git pull
npm ci
npm run build
```

Danach auf der Erweiterungsseite bei Form Filler auf **Neu laden** klicken und offene Tabs der Zielseite neu laden. Apps und Vorlagen bleiben dabei erhalten.

### Häufige Probleme

- **Popup meldet fehlende Berechtigung:** Die Erweiterung fragt pro App einmal nach Zugriff auf die Seite. Ohne diese Freigabe kann sie dort weder aufnehmen noch füllen.
- **Nach einem Update passiert auf der Seite nichts:** Den Tab neu laden. Bereits offene Seiten laufen sonst noch mit der alten Version.
- **`npm ci` schlägt fehl:** Node.js-Version prüfen (`node -v`) und gegebenenfalls auf die aktuelle LTS-Version aktualisieren.

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

## Eigenes Theme (lokal)

Die Oberfläche nutzt ein dunkles Standard-Theme. Farben lassen sich lokal anpassen, ohne das Repository zu ändern:

1. `src/theme/theme.local.example.css` nach `src/theme/theme.local.css` kopieren.
2. In der Kopie nur die gewünschten Variablen (z. B. `--color-brand`, `--color-surface`) einkommentieren und ändern.
3. Neu bauen (`npm run build`) und die Erweiterung neu laden.

Die Datei gilt für Popup, Verwaltungsseite und die Aufnahme-Leiste. Sie ist per `.gitignore` ausgeschlossen und wird nie eingecheckt. Fehlt sie, baut die Erweiterung unverändert mit dem Standard-Theme. Beim Anpassen auf ausreichenden Kontrast achten (Text mindestens 4,5:1).

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
