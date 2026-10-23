# Manuelle Testcheckliste

Voraussetzung: `npm ci && npm run build`, Erweiterung aus `.output/chrome-mv3` geladen, `npm run test-site` läuft. Jeder Punkt: Schritt → erwartetes Ergebnis.

## 1. Ende-zu-Ende mit der Testseite

Die Punkte 3–5, 7 und 9 laufen automatisiert mit `npm run test:e2e` (Chromium). Hier bleiben sie für die Abnahme in anderen Browsern.

- [ ] 1. Testseite öffnen, Popup öffnen → Hinweis „Neue App für diese Seite“, URL-Muster mit `origin/*` vorbelegt.
- [ ] 2. App anlegen, Berechtigung erteilen → App ist gespeichert, Popup zeigt „erkannt“.
- [ ] 3. Vorlage „Schritt 1“ aufnehmen: alle Feldarten, Person 2, Adresse B → alle Felder erscheinen grün markiert mit Typ · Slot; Speichern zeigt „Vorlage gespeichert“.
- [ ] 4. Füllen mit „Alle“ → alle Felder befüllt (auch Kostenstelle, Bestellnummer und die Lieferadresse im Rahmen), Bericht „N von N befüllt“, Badge ✓ grün.
- [ ] 5. Füllen mit „Nur Pflicht“ → nur Pflichtfelder befüllt.
- [ ] 6. Formular absenden → keine Validierungsfehler der Seite.
- [ ] 7. Schritt 2 füllen → gleiche Kennung wie in Schritt 1.
- [ ] 8. „Neuer Datensatz“, erneut füllen → neue Kennung; Badge geleert.
- [ ] 9. Ein Feld in der Testseite umbenennen, füllen → ⚠ im Popup-Bericht, Badge zeigt Problemanzahl rot, im Pflege-Tab ist das Feld als fehlend markiert.
- [ ] 10. Tastenkürzel Alt+Shift+F auf der Seite → Fill läuft, Badge aktualisiert; nach Schritt 1 füllt das Kürzel Schritt 2, nach dem letzten Schritt wieder Schritt 1. Auf einer Seite ohne Vorlage → Schnellfüllen, Statuszeile „Schnellfüllen: …“.
- [ ] 11. Export im Pflege-Tab → JSON-Datei mit sinnvollem Dateinamen wird geladen.
- [ ] 12. Erweiterung neu laden, Import der Datei → Apps und Vorlagen wieder vorhanden; Konfliktdialog erscheint bei vorhandenen Einträgen.

## 2. Popup

- [ ] Popup schließt sich, während der Chrome-Berechtigungsdialog offen ist → nach Erteilen ist die App trotzdem gespeichert (bzw. beim erneuten Öffnen sauber nachholbar), keine inkonsistenten Daten.
- [ ] Badge-Verhalten bei Navigation: nach Navigation/Reload des Tabs bleibt oder verschwindet der Badge wie vorgesehen; Tab schließen räumt Report und Datensätze auf.
- [ ] Gesperrte Seiten (`chrome://`, Web Store) → verständliche Meldung statt Fehler.
- [ ] Popup zeigt beim Öffnen den letzten Bericht des Tabs.
- [ ] „Andere App wählen“ und „⋯“-Menü (Felder aufnehmen / Bearbeiten): Esc schließt, Fokus kehrt zurück.
- [ ] Fill während einer aktiven Aufnahme → Overlay bleibt bestehen, Fill läuft.
- [ ] „Ohne Vorlage füllen“ in allen drei Zuständen (keine App: Hauptaktion über dem App-Formular; App ohne Vorlagen: Hauptaktion; App mit Vorlagen: Textknopf unter „+ Neue Vorlage“) → Statuszeile „Schnellfüllen: N von M befüllt …“, Badge, Bericht mit Feldbeschriftungen.
- [ ] Nach dem Lauf „Als Vorlage speichern“: mit App → Namensformular (Seitentitel vorbelegt), Vorlage erscheint in der Liste, Problemfelder im Pflege-Tab als fehlend markiert; ohne App → Formular „Neue App“ mit Feld „Vorlage aus Schnellfüllen“, „App und Vorlage anlegen“ legt beides an.
- [ ] Seitenwechsel im Tab nach einem Lauf → „Als Vorlage speichern“ ist weg; „Neuer Datensatz“ lässt das Angebot bestehen.

## 3. Aufnahme

- [ ] Overlay auf Seiten mit Tailwind v3 und Tailwind v4 → Darstellung unverändert, Seitenstile unbeeinflusst.
- [ ] Overlay auf Seite mit `html { font-size: 62.5% }` → Größen normal (nicht geschrumpft).
- [ ] Seiten mit Fokusfalle (Modal) → Fokus bleibt im Popover bedienbar.
- [ ] „Übernehmen“ gibt Fokus ans Seitenfeld zurück; Tab springt zum nächsten Feld.
- [ ] Esc im Popover → Popover zu, Fokus auf „Speichern“; Esc ohne Popover → Beenden, bei Änderungen mit Rückfrage.
- [ ] Zweites Radio einer Gruppe anklicken → bearbeitet vorhandenes Feld statt Duplikat.
- [ ] Freitext-Combobox (Autocomplete) mit Texttyp aufnehmen und füllen → wird als „nicht in der Auswahl“ gemeldet; ggf. Typ „Auswahl“ nutzen.
- [ ] Auswahl-Button „Anliegen“ (`aria-haspopup="listbox"`) anklicken → Popover mit Typ „Auswahl“; Füllen öffnet die Liste, wählt den Eintrag, der Button zeigt ihn an.
- [ ] Feld in einer Web-Component (Kostenstelle, Bestellnummer) anklicken → Popover mit Beschriftung vom Wirt bzw. vom äußeren Label, Markierung am Feld, nach Speichern Füllen möglich.
- [ ] Feld im Rahmen „Lieferadresse“ anklicken → Popover neben dem Feld, Markierung an der richtigen Stelle (auch nach Scrollen im Rahmen); gespeicherte Vorlage füllt Haupt- und Rahmen-PLZ getrennt.

## 4. Pflege-Tab

- [ ] Layout bei 1280 px und bei 800 px: Stapelung unter 900 px, Tabelle ohne abgeschnittene Spalten bzw. mit horizontalem Scroll im Tabellencontainer.
- [ ] Native Drag & Drop: Drag-Bild = Zeile, Einfügemarke vor Zielzeile, Drop speichert; Ziehen nach oben und unten.
- [ ] Dialoge (`<dialog>`): Fokusfalle, Esc schließt, Fokus kehrt zum Auslöser zurück.
- [ ] „+ Felder aufnehmen“ im echten Browser: Tab-/Fensterwechsel, Recorder startet, nach Speichern aktualisiert sich die Tabelle.
- [ ] Export-Dateiname, Import mit echter Export-Datei inkl. Konfliktdialog.

## 5. Tastatur und Screenreader

- [ ] Alle Bedienelemente per Tastatur erreichbar, Fokus überall sichtbar.
- [ ] Live-Regionen werden angesagt: Fill-Status im Popup, Übernehmen/Entfernen/Speichern im Recorder, Verschieben/Speichern im Pflege-Tab.
- [ ] Kontrast: Schalter (aus: zinc-500 auf Weiß; an: blue-700) und amber-800-Warnung mindestens 4,5:1 bzw. 3:1 für Bedienelemente.
- [ ] Segmented-Umschalter: Pfeiltasten wechseln mit Umlauf.

## 6. Windows / Arc

- [ ] Installation als entpackte Erweiterung in Arc und Dia unter Windows.
- [ ] Alt+Shift+F funktioniert bzw. lässt sich auf der Kürzel-Seite des Browsers belegen (kein Konflikt mit Sprachwechsel).
- [ ] Punkte aus Abschnitt 1 bis 4 stichprobenartig wiederholen.

## 7. Abnahme in der Ziel-App (Ergebnis notieren)

Abschnitt 1 mit einem echten Formular der Ziel-App durchspielen (Aufnahme, Füllen „Alle“ und „Nur Pflicht“, mehrstufiger Prozess, Absenden ohne Validierungsfehler). Keine App-spezifischen Vorlagen oder Exporte ins Repository übernehmen.

- Datum:
- Browser und Version:
- Geprüfte Formulare/Schritte:
- Ergebnis (bestanden / mit Einschränkungen / nicht bestanden):
- Auffälligkeiten und Folgeaufgaben:

## Firefox (Build aus `npm run build:firefox`, temporär über `about:debugging` geladen)

- [ ] 1. Punkte 1–6 der Testseite in Firefox → gleiches Ergebnis wie in Chromium; die Berechtigungsabfrage erscheint als Firefox-Dialog.
- [ ] 2. Popup-Fußzeile ohne Kürzel → Hinweis nennt `about:addons`, nicht `chrome://`.
- [ ] 3. Tastenkürzel Alt+Shift+F (bzw. das in `about:addons` gesetzte) → füllt mit der passenden Vorlage der App, ohne Vorlage per Schnellfüllen.
- [ ] 4. Firefox beenden und neu starten → das temporäre Add-on ist weg (erwartet); nach erneutem Laden sind Apps und Vorlagen noch da.

