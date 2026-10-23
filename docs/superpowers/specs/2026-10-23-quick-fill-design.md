# Schnellfüllen ohne Vorlage – Design

Stand: 2026-10-23. Produktentscheidung vom 2026-10-23: flüchtiges Füllen, danach „Als Vorlage speichern“ anbieten (Option A).

## Absicht

Wer ein Formular nur einmal mit gültigen Daten sehen will, muss heute erst eine App anlegen, die Berechtigung erteilen und jedes Feld aufnehmen. Die Erkennung, die der Recorder beim Anklicken eines Feldes nutzt (Beschriftung, Feldname, `autocomplete` → Datentyp), soll in einem Schritt auf die ganze Seite angewendet werden. Aufnahme bleibt der Weg für mehrstufige Prozesse und Sonderfälle; was die Erkennung gefunden hat, lässt sich dafür als Vorlage behalten.

## Ziele

- Ein Klick im Popup füllt alle erkennbaren Felder der aktuellen Seite: ohne App, ohne Vorlage, ohne Berechtigungsdialog.
- Der Bericht zeigt wie bei Vorlagen, was befüllt wurde und was nicht.
- Die Erkennung lässt sich mit einem Klick als Vorlage behalten; fehlt die App, wird sie dabei angelegt.
- Modus „Nur Pflicht“ und „Neuer Datensatz“ gelten auch hier.

## Nicht-Ziele

- Keine Verbesserung der Erkennung aus dem Ergebnis (kein Lernen).
- Kein Schnellfüllen per Tastenkürzel; das Kürzel bleibt bei Vorlagen.
- Keine Formulare in iframes oder Shadow DOM (eigenes Vorhaben C).
- Kein Absenden des Formulars.

## Anti-Ziele

- Schnellfüllen verändert weder Vorlagen noch den Datensatz eines laufenden Prozesses.
- Felder außerhalb des Formulars (Seitensuche) werden nicht befüllt.
- Das Popup vergisst die Erkennung nicht, bevor sie gespeichert werden konnte.

## Voraussetzungen

Baut auf `main` nach dem Merge der PRs #5 (Browsertest), #7 (Datensatz-Zeile im Popup) und #8 (Kürzel wählt die Vorlage) auf. Die Datensatz-Zeile und die Umfang-Umschaltung, die unten vorausgesetzt werden, stammen aus #7 bzw. dem heutigen Popup.

## Ablauf aus Nutzersicht

1. Popup auf einer http(s)-Seite öffnen. Der Knopf **„Ohne Vorlage füllen“** steht
   - ohne erkannte App: als Hauptaktion über dem Formular „Neue App für diese Seite“, mit der Zeile „Erkennt die Felder selbst und füllt sie mit Testdaten.“ Diese Ansicht bekommt dafür die Umfang-Umschaltung („Alle Felder“ / „Nur Pflicht“) und die Datensatz-Zeile, die es bisher nur mit App gibt. Meine Festlegung: Sonst füllt „Nur Pflicht“ dort unsichtbar und ohne Ausweg.
   - mit App, aber ohne Vorlagen: als Hauptaktion anstelle von „Noch keine Vorlagen für diese App.“
   - mit App und Vorlagen: als Nebenaktion (Textknopf) unter „+ Neue Vorlage“.
2. Klick: Die Seite wird erkannt und befüllt. Statuszeile „Schnellfüllen: 11 von 14 befüllt · 3 nicht gefunden“, Badge und aufklappbarer Bericht wie bei Vorlagen. Der Bericht nennt jedes erkannte Feld mit Beschriftung.
3. Nach einem Lauf zeigt das Popup **„Als Vorlage speichern“** neben der Statuszeile, auch nach erneutem Öffnen, solange der Tab noch die Seite des Laufs zeigt (gleiche Adresse ohne Query und Fragment). Nach einem Seitenwechsel oder einem neuen Lauf ist das Angebot weg. Vorlagenname und URL-Muster werden aus Titel und Adresse zum Zeitpunkt des Laufs vorbelegt, nicht aus der aktuellen Seite. Meine Festlegung.
   - Mit App: Eingabe des Vorlagennamens (vorbelegt mit dem Seitentitel), „Speichern“ → Vorlage mit den erkannten Feldern; Statuszeile „Vorlage „…“ gespeichert – Felder im Pflege-Tab prüfen.“
   - Ohne App: Das Formular „Neue App für diese Seite“ öffnet sich mit einem dritten Feld „Vorlage“ (Name, vorbelegt mit dem Seitentitel). „App anlegen“ legt App und Vorlage in einem Zug an; der Berechtigungsdialog erscheint wie bisher.
4. Nicht gefundene oder mehrdeutige Felder des Laufs sind in der gespeicherten Vorlage als fehlend markiert, damit der Pflege-Tab sofort zeigt, was zu prüfen ist.

## Erkennung

- Erkannt werden alle sichtbaren, unterstützten Steuerelemente des Hauptdokuments in Dokumentreihenfolge: `input`, `select`, `textarea`, ARIA-Combobox, ARIA-Radiogroup; je Radiogruppe ein Eintrag (wie beim Aufnehmen).
- Ausgeschlossen: deaktivierte und schreibgeschützte Felder, Suchfelder (`type="search"`, `role="searchbox"`), Felder im Aufnahme-Overlay sowie die Eingabetypen, die der Recorder ignoriert (button, submit, reset, hidden, file, image).
- Ausgeschlossen sind außerdem Felder in Kopf-, Navigations-, Fuß- und Suchbereichen der Seite (`header`, `nav`, `footer`, `role="banner"`, `role="navigation"`, `role="contentinfo"`, `role="search"`). Alles andere gilt als Formular, ob in einem `<form>` oder nicht; mehrere Formulare auf einer Seite werden alle befüllt. Meine Festlegung: Eine Seitensuche oder Login-Box im Kopf bleibt so unberührt, ein Registrierungsformular ohne `<form>`-Element wird trotzdem erkannt. Bitte prüfen.
- Je Feld entsteht dieselbe Regel, die der Recorder vorschlagen würde: Locator, Beschriftung (sichtbares Label, sonst Name, sonst „Feld“), vorgeschlagener Datentyp, Pflicht aus `required`, `aria-required` oder Stern im Label, Kennung aus.
- Slots: Die erste Person ist 1, die erste Adresse A. Taucht ein Datentyp derselben Familie erneut auf, der im aktuellen Slot schon vergeben ist (zweites „PLZ“, zweiter „Vorname“), beginnt der nächste Slot (B bzw. 2), und die folgenden Felder dieser Familie gehören dazu. Meine Festlegung: Firmen- und Rechnungsadresse bekommen so verschiedene Anschriften, zwei Ansprechpartner verschiedene Namen; der Recorder selbst zählt nicht hoch, dort wählt der Mensch. Bitte prüfen.
- Unbekannte Textfelder bekommen „Freitext“, Auswahlfelder ohne bekannte Werte eine zufällige Option, Checkboxen werden angehakt. Das entspricht den Vorschlägen des Recorders. Neu für Recorder und Schnellfüllen: Passwortfelder (`type="password"`) bekommen den Festwert `Test1234!`, damit „Passwort“ und „Passwort wiederholen“ übereinstimmen. Meine Festlegung.
- Felder, deren Locator nicht eindeutig zu ihnen zurückführt, bleiben im Lauf und erscheinen im Bericht als „mehrdeutig“ oder „nicht gefunden“ (sichtbar ist besser als still). Meine Festlegung.

## Datensatz

Jeder Schnellfüll-Lauf beginnt einen neuen Datensatz, genau wie eine Vorlage ohne Prozess. Er erscheint in der Datensatz-Zeile des Popups und wird mit dem Tab verworfen. Meine Festlegung: konsistent mit dem bestehenden Verhalten; wer dieselben Daten noch einmal braucht, nimmt eine Vorlage.

## Berechtigungen

Der Klick im Popup gewährt `activeTab`; Erkennung und Füllen laufen damit ohne Host-Berechtigung. „Als Vorlage speichern“ ohne App fragt die Berechtigung über den Klick auf „App anlegen“ wie heute (Nutzergeste nötig).

## Technische Festlegungen

- Neue Nachricht `scan` an das Content-Script; Antwort `{ ok: true, fields: FieldRule[] }` oder `{ ok: false, error: string }`.
- Erkennung als reine Funktion `scanControls(root): FieldRule[]` in `src/dom/scan.ts`; sie nutzt `describeElement`, `displayLabel`, `isRequired`, `suggestDataType` und `slotFor`. Die Kandidatensuche aus `findElement` wird als `listControls(root)` in `locator.ts` herausgelöst und von beiden genutzt.
- `dispatch.ts`: `quickFill(tabId, mode)` → scan → Ad-hoc-Vorlage (`id: 'quick'`, `name: 'Schnellfüllen'`, `process: null`, `appId: ''`) → Datensatz über `getOrCreateDataset` → Füllen → Bericht merken (wie `dispatchFill`, aber ohne `lastTemplateId` und ohne `lastMissing`). Der Füll-Teil von `dispatchFill` nimmt dafür ein Vorlagenobjekt statt einer ID.
- Erkannte Regeln, Problemfelder, Adresse und Titel des Laufs liegen je Tab in `storage.session` unter `quick:<tabId>`; `clearDatasetsForTab` räumt sie mit auf (Tab geschlossen, „Neuer Datensatz“ lässt sie bestehen). Das Popup zeigt „Als Vorlage speichern“ nur, wenn die gespeicherte Adresse zur aktuellen Tab-Adresse passt.
- `src/dom/scan.ts` bringt die Slot-Zählung als reine Funktion mit (`assignSlots(rules)`), getrennt testbar.
- `usePopup`: `quickFill()`, `quickFields` (aus der Sitzung beim Laden), `saveQuickTemplate(name)` bei vorhandener App, `createAppForCurrentPage(name, pattern, templateName?)` legt zusätzlich die Vorlage an, wenn Regeln vorliegen. Der Seitentitel kommt aus `tab.title`.
- Statuszeile: Berichte mit `templateId: 'quick'` bekommen das Präfix „Schnellfüllen“.
- Tests: `scanControls` in happy-dom (alle Feldarten, Radiogruppe einmal, Suche, Kopf-/Fußbereiche und deaktivierte Felder ausgeschlossen, Passwort als Festwert, Slot-Zählung bei zweiter Adresse und zweiter Person, Pflicht); `quickFill` mit fakeBrowser; `usePopup` (Lauf, Speichern mit und ohne App); Popup-Komponente (Knopf in den drei Zuständen, „Als Vorlage speichern“ nach dem Lauf, drittes Feld im App-Formular); ein Browsertest-Szenario (nach Merge von PR #5): Schnellfüllen auf der Testseite befüllt die zwölf beim Scan sichtbaren Felder.

## Aufwand

Drei Tickets: (1) Erkennung, Nachricht und `quickFill`; (2) Popup: Knopf, Lauf, Statuszeile; (3) „Als Vorlage speichern“ mit App-Anlage und Browsertest.
