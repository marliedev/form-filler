# Nur eigene Werte überschreiben und Rückgängig – Design

Stand: 2026-10-23. Produktentscheidung: Füllen überschreibt nur Werte, die Form Filler selbst eingetragen hat (Option A); dazu kommt „Rückgängig“ für den letzten Lauf.

## Absicht

Füllen soll Eingaben der Testerin nicht zerstören. Wer eine echte Kundennummer eingetragen hat und sich den Rest füllen lässt, behält sie. Wer die Daten doch nicht will, nimmt den Lauf mit einem Klick zurück.

## Ziele

- Felder, deren Inhalt nicht von Form Filler stammt, bleiben beim Füllen unberührt und erscheinen im Bericht als „bereits ausgefüllt“.
- Werte, die Form Filler selbst eingetragen hat, werden bei einem weiteren Lauf ersetzt, etwa nach „Neuer Datensatz“ oder mit einer anderen Vorlage.
- „Rückgängig“ setzt alle Felder des letzten Laufs auf den Zustand vor diesem Lauf zurück: Text, Auswahl, Radio, Checkbox und, soweit die Seite es zulässt, Combobox und Auswahl-Button.
- Gilt für Vorlagen, Schnellfüllen und Tastenkürzel gleichermaßen; kein Schalter, nichts zu lernen.

## Nicht-Ziele

- Kein Schalter zum erzwungenen Überschreiben fremder Werte. Wer ein fremdes Feld neu füllen will, leert es oder nimmt den letzten Lauf zurück.
- Keine Merkfähigkeit über ein Neuladen der Seite hinaus: danach gilt jeder Inhalt als fremd, und es gibt nichts zurückzunehmen.
- Rückgängig stellt keine Folgen auf der Seite zurück, die ein Wert ausgelöst hat (nachgeladene Abschnitte, Validierungsmeldungen).
- Kein Beobachten der Seite vor dem ersten Lauf: Form Filler sieht ein Feld erst, wenn es zum ersten Mal füllt. Was eine Testerin in einer Combobox vor dem ersten Lauf gewählt hat, kann es nicht von der Vorbelegung der Seite unterscheiden (siehe „Vorbelegungen“).

## Anti-Ziele

- Ein leeres Feld gilt nie als „bereits ausgefüllt“.
- Rückgängig schreibt nie in ein Feld, das der letzte Lauf nicht angefasst hat.
- Fremde Werte dürfen durch einen zweiten Lauf nicht verloren gehen, auch nicht nach „Neuer Datensatz“.

## Verhalten

- **Leer** heißt: Textfeld oder Textarea ohne Inhalt; Auswahlliste auf der Platzhalter-Option (leerer Wert) oder ohne Auswahl; Radiogruppe ohne gewählte Option; Combobox und Auswahl-Button mit ihrem Platzhaltertext. Eine Checkbox hat immer einen Zustand; sie gilt als fremd, wenn sie angehakt ist, ohne dass Form Filler sie angehakt hat; eine nicht angehakte Checkbox wird gefüllt.
- **Vorbelegungen der Seite zählen als leer.** Was die Seite selbst voreinstellt, ist keine Eingabe der Testerin und wird gefüllt: Bei nativen Feldern ist das der HTML-Standardwert (`defaultValue`, `defaultChecked`, `defaultSelected`; eine Auswahlliste ohne Platzhalter-Option steht auf ihrer ersten oder als `selected` markierten Option). Bei Comboboxen und Auswahl-Buttons gilt der Text, den das Feld beim ersten Kontakt mit Form Filler auf dieser Seite zeigt, als Platzhalter. Grenze, meine Festlegung: Vorbelegungen, die eine Seite per Skript setzt (Vue, React) und die vom HTML-Standard abweichen, sehen wie Eingaben aus und bleiben stehen; wer sie füllen will, leert das Feld oder wählt den Platzhalter. Eine vor dem ersten Lauf von Hand gewählte Combobox gilt als Vorbelegung und wird gefüllt.
- **Eigen** heißt: Der aktuelle Zustand des Feldes ist genau der, den Form Filler zuletzt in dieses Feld geschrieben hat. Hat die Testerin den Wert seitdem verändert, ist er fremd. Baut die Seite ein Feld neu auf (Schritt zurück in einem mehrstufigen Prozess, eingeblendeter Abschnitt), erkennt Form Filler seinen Wert am Feld wieder: Es merkt sich geschriebene Werte auch je Feldbeschreibung (Locator), nicht nur je Element. Meine Festlegung; das Risiko, dass eine Testerin exakt denselben Wert tippt wie die Zufallsdaten, ist vernachlässigbar.
- **Bericht:** Ausgelassene Felder bekommen den Status „bereits ausgefüllt“. Sie zählen zur Gesamtzahl, sind aber kein Problem: „11 von 12 befüllt · 1 bereits ausgefüllt“, Badge ✓. In den Details stehen sie neutral, nicht als Warnung.
- **Rückgängig:** Nach einem Lauf mit mindestens einem befüllten Feld zeigt das Popup neben der Statuszeile den Knopf „Rückgängig“. Er setzt die Felder des letzten Laufs auf den Zustand vor dem Lauf zurück, meldet „Letzter Lauf zurückgenommen · N Felder“ und verschwindet. Gab es auf der Seite nichts mehr zurückzunehmen (Seite neu geladen), meldet das Popup das statt zu scheitern. Der Datensatz des Tabs bleibt bestehen; „Neuer Datensatz“ ist davon unabhängig.
- **Was Rückgängig nicht anfasst**, meine Festlegungen: Felder, die die Testerin nach dem Lauf von Hand geändert hat (aktueller Zustand ≠ geschriebener Zustand), bleiben stehen. Radiogruppen, in denen vor dem Lauf nichts gewählt war, lassen sich per Klick nicht abwählen und bleiben stehen; ebenso Comboboxen und Auswahl-Buttons, die vorher nur ihren Platzhalter zeigten. Der Hinweis nennt solche Felder: „Letzter Lauf zurückgenommen · 9 Felder · nicht zurückgesetzt: Rolle, Land“.
- Mehrere Läufe hintereinander: Rückgängig betrifft nur den letzten. Felder, die der letzte Lauf übersprungen hat, bleiben wie sie sind.

## Technische Festlegungen

- Das Content-Script führt je Seite ein Gedächtnis (`src/fill/ownership.ts`): je Element (WeakMap) und je Feldbeschreibung (Schlüssel: JSON des Locators ohne `scope`-unabhängige Zufälle, also der komplette Locator) den zuletzt geschriebenen Zustand; je Combobox/Auswahl-Button den beim ersten Kontakt angezeigten Text als Platzhalter; dazu die Liste der Felder des letzten Laufs mit Element, Zustand davor und geschriebenem Zustand. Es lebt im Seitenkontext und endet mit dem Neuladen; das deckt die Nicht-Ziele ab.
- Zustand eines Feldes als vergleichbarer Wert (`currentState(el, kind)` in `src/dom/fill.ts`): Text und Datum als Wert; Auswahlliste als gewählter Wert; Radiogruppe als gewählter Wert; Checkbox als an/aus; Combobox und Auswahl-Button als angezeigter Text. `defaultState(el, kind)` liefert den HTML-Standard (für ARIA-Felder den gemerkten Platzhaltertext). Ein Feld ist **füllbar**, wenn sein Zustand leer ist, dem Standard entspricht oder eigen ist (je Element oder je Feldbeschreibung); sonst `kept`.
- `runFill` prüft vor jedem Feld die Füllbarkeit; nach dem Füllen merkt es Zustand davor und geschriebenen Zustand. `FieldReport.status` erhält `kept`, `STATUS_TEXT` den Text „bereits ausgefüllt“, `problemCount` zählt ihn nicht, `summarizeReport` nennt ihn.
- Neue Nachricht `undo` an das Content-Script; Antwort `{ ok: true; restored: number; kept: string[] } | { ok: false; error: string }` (`kept` = Beschriftungen der nicht zurückgesetzten Felder). Zurückgesetzt wird nur, was noch den geschriebenen Zustand trägt. Das Zurücksetzen nutzt die Füll-Primitiven (Wert setzen mit Ereignissen, Option wählen, Radio/Checkbox klicken), damit Bindungen der Seite den alten Wert sehen; Radiogruppen ohne vorherige Auswahl und ARIA-Felder, die vorher den Platzhalter zeigten, bleiben und landen in `kept`.
- `dispatch.ts`: `undoLastRun(tabId)` injiziert das Content-Script und sendet `undo`; der Bericht des Tabs wird gelöscht, der Badge geleert. `usePopup`: `undo()`, `canUndo` (letzter Bericht hat befüllte Felder und wurde nicht zurückgenommen). Popup: Knopf „Rückgängig“ in der Statuszeile, Hinweis in der Statuszeile. Der Hintergrund setzt `canUndo` beim Neuladen des Tabs (`tabs.onUpdated` mit Status `loading`) zurück, damit der Knopf nicht ins Leere zeigt.
- Tastenkürzel und Schnellfüllen laufen durch `runFill` und bekommen das Verhalten ohne Änderung.
- Tests: `fill`/`runFill` (fremder Wert bleibt, eigener wird ersetzt, leeres Feld wird gefüllt, HTML-Vorbelegung wird gefüllt, Auswahlliste ohne Platzhalter, Checkbox-Regel, Combobox mit Platzhaltertext, Bericht mit `kept`); `ownership` (je Element, je Feldbeschreibung nach Neuaufbau, Platzhalter, letzter Lauf); `undo` je Feldart inkl. der nicht rücksetzbaren Fälle und von Hand geänderter Werte; `dispatch`/`usePopup`/Popup-Komponente (Knopf, Hinweis mit `kept`, Tab neu geladen); Browsertest: Wert von Hand eintragen, füllen, Wert bleibt; „Neuer Datensatz“ und erneut füllen ersetzt nur eigene Werte; Schritt 1 füllen, „Weiter“, „Zurück“, erneut füllen ersetzt die eigenen Werte; Rückgängig stellt Text-, Auswahl- und Checkbox-Felder her und nennt Rolle, Land und Anliegen als nicht zurückgesetzt.

## Aufwand

Zwei Tickets: (1) Zustand, Gedächtnis, `kept` im Bericht; (2) Rückgängig in Content-Script, Dispatch und Popup samt Browsertest.
