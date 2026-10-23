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

- **Leer** heißt: Textfeld oder Textarea ohne Inhalt; Auswahlliste auf der Platzhalter-Option (leerer Wert) oder ohne Auswahl; Radiogruppe ohne gewählte Option; Combobox und Auswahl-Button mit ihrem Platzhaltertext. Eine Checkbox hat immer einen Zustand; angehakt gilt sie als fremd, wenn weder Form Filler sie angehakt hat noch sie beim ersten Kontakt schon so stand; eine nicht angehakte Checkbox wird gefüllt.
- **Vorbelegungen der Seite** (Entscheidung vom 2026-10-23 nach dem Review, ersetzt die Regel „HTML-Standardwert zählt als leer“): Textfelder, Textareas und Datumsfelder werden nur gefüllt, wenn sie leer sind oder den eigenen Wert zeigen. Was die Seite dort vorbelegt, egal ob per HTML oder per Skript, bleibt wie getippter Text stehen; wer es füllen will, leert das Feld. Auswahlfelder (Auswahlliste, Radiogruppe, Checkbox, Combobox, Auswahl-Button) lassen sich von Hand nicht leeren; darum gilt der Zustand, den sie beim ersten Kontakt mit Form Filler auf dieser Seite zeigen, als Vorbelegung und ist füllbar, egal ob die Seite ihn per HTML oder per Skript gesetzt hat. Preis: Eine Auswahl, die die Testerin vor dem ersten Lauf trifft, sieht wie eine Vorbelegung aus und wird gefüllt; nach dem ersten Lauf bleibt jede Änderung von Hand stehen. Grund für den Wechsel: React hält das `value`-Attribut mit der Eingabe synchron, mit der HTML-Standard-Regel sähe dort jede Eingabe wie eine Vorbelegung aus; per Skript vorgewählte Radiogruppen wären nie füllbar.
- **Eigen** heißt: Der aktuelle Zustand des Feldes ist genau der, den Form Filler zuletzt in dieses Feld geschrieben hat. Hat die Testerin den Wert seitdem verändert, ist er fremd. Baut die Seite ein Feld neu auf (Schritt zurück in einem mehrstufigen Prozess, eingeblendeter Abschnitt), erkennt Form Filler seinen Wert am Feld wieder: Es merkt sich geschriebene Werte auch je Feldbeschreibung (Locator), nicht nur je Element. Meine Festlegung; das Risiko, dass eine Testerin exakt denselben Wert tippt wie die Zufallsdaten, ist vernachlässigbar.
- **Bericht:** Ausgelassene Felder bekommen den Status „bereits ausgefüllt“. Sie zählen zur Gesamtzahl, sind aber kein Problem: „11 von 12 befüllt · 1 bereits ausgefüllt“, Badge ✓. In den Details stehen sie neutral, nicht als Warnung.
- **Rückgängig:** Nach einem Lauf mit mindestens einem befüllten Feld zeigt das Popup neben der Statuszeile den Knopf „Rückgängig“. Er setzt die Felder des letzten Laufs auf den Zustand vor dem Lauf zurück, meldet „Letzter Lauf zurückgenommen · N Felder“ und verschwindet. Gab es auf der Seite nichts mehr zurückzunehmen (Seite neu geladen), meldet das Popup das statt zu scheitern und vergisst den veralteten Bericht samt Badge. Der Datensatz des Tabs bleibt bestehen; „Neuer Datensatz“ ist davon unabhängig.
- **Nach Rückgängig** gelten die zurückgesetzten Felder mit ihrem Zustand davor wieder als eigene: Ein weiterer Lauf ersetzt sie, statt sie als „bereits ausgefüllt“ zu melden. Zurückgenommen wird vom letzten Feld zum ersten, damit Abschnitte, die ein früheres Feld einblendet, noch da sind, wenn sie an der Reihe sind.
- **Was Rückgängig nicht anfasst**, meine Festlegungen: Felder, die die Testerin nach dem Lauf von Hand geändert hat (aktueller Zustand ≠ geschriebener Zustand), bleiben stehen; ebenso Felder, die die Seite seit dem Lauf entfernt hat (Schritt gewechselt). Radiogruppen, in denen vor dem Lauf nichts gewählt war, lassen sich per Klick nicht abwählen und bleiben stehen; ebenso Comboboxen und Auswahl-Buttons, die vorher nur ihren Platzhalter zeigten. Der Hinweis nennt solche Felder in Formularreihenfolge: „Letzter Lauf zurückgenommen · 9 Felder · nicht zurückgesetzt: Rolle, Land“.
- Mehrere Läufe hintereinander: Rückgängig betrifft nur den letzten. Felder, die der letzte Lauf übersprungen hat, bleiben wie sie sind.

## Technische Festlegungen

- Das Content-Script führt je Seite ein Gedächtnis (`src/fill/ownership.ts`): je Element (WeakMap) und je Feldbeschreibung (Schlüssel: JSON des Locators ohne `scope`-unabhängige Zufälle, also der komplette Locator) den zuletzt geschriebenen Zustand; je Auswahlfeld (ebenfalls je Element und je Feldbeschreibung) den beim ersten Kontakt gezeigten Zustand als Vorbelegung; dazu die Liste der Felder des letzten Laufs mit Element, Feldschlüssel, Zustand davor und geschriebenem Zustand. Es lebt im Seitenkontext und endet mit dem Neuladen; das deckt die Nicht-Ziele ab.
- Zustand eines Feldes als vergleichbarer Wert (`currentState(el, kind)` in `src/dom/fill.ts`): Text und Datum als Wert; Auswahlliste als gewählter Wert; Radiogruppe als gewählter Wert; Checkbox als an/aus; Combobox und Auswahl-Button als angezeigter Text. Ein Feld ist **füllbar**, wenn sein Zustand leer oder eigen ist (je Element oder je Feldbeschreibung); ein Auswahlfeld auch, wenn es noch den beim ersten Kontakt gemerkten Zustand zeigt (der wird vor der Leer-Prüfung gemerkt, damit eine leere Combobox nicht erst eine spätere Wahl der Testerin als Vorbelegung lernt); sonst `kept`.
- `runFill` prüft vor jedem Feld die Füllbarkeit; nach dem Füllen merkt es Zustand davor und geschriebenen Zustand. `FieldReport.status` erhält `kept`, `STATUS_TEXT` den Text „bereits ausgefüllt“, `problemCount` zählt ihn nicht, `summarizeReport` nennt ihn.
- Neue Nachricht `undo` an das Content-Script; Antwort `{ ok: true; restored: number; kept: string[] } | { ok: false; error: string }` (`kept` = Beschriftungen der nicht zurückgesetzten Felder). Zurückgesetzt wird nur, was noch in der Seite hängt und noch den geschriebenen Zustand trägt, vom letzten Feld zum ersten; zurückgesetzte Felder gelten mit ihrem Zustand davor wieder als eigen. Das Zurücksetzen nutzt die Füll-Primitiven (Wert setzen mit Ereignissen, Option wählen, Radio/Checkbox klicken), damit Bindungen der Seite den alten Wert sehen; Auswahllisten werden direkt gesetzt und über den Tag erkannt, nicht per `instanceof` (Felder in Rahmen gehören einem anderen Realm). Radiogruppen ohne vorherige Auswahl und ARIA-Felder, die vorher den Platzhalter zeigten, bleiben und landen in `kept`.
- `dispatch.ts`: `undoLastRun(tabId)` injiziert das Content-Script und sendet `undo`; Bericht und Badge des Tabs werden in beiden Fällen gelöscht, auch wenn die Seite nichts mehr zurückzunehmen hat. `usePopup`: `undo()`, `canUndo` (letzter Bericht hat befüllte Felder und wurde nicht zurückgenommen). Popup: Knopf „Rückgängig“ in der Statuszeile, Hinweis in der Statuszeile. Kein Zurücksetzen über `tabs.onUpdated` (Festlegung bei der Umsetzung): Nach einem Neuladen antwortet das Content-Script „Nichts zum Zurücknehmen …“, das Popup zeigt das und vergisst den Bericht.
- Tastenkürzel und Schnellfüllen laufen durch `runFill` und bekommen das Verhalten ohne Änderung. Die Nachläufe des Schnellfüllens (nachträglich erschienene Felder) senden die Füll-Nachricht mit `continueRun: true`, damit sie den „letzten Lauf“ der Seite fortsetzen statt neu zu beginnen; Rückgängig nimmt so alle Durchläufe zurück.
- Tests: `fill`/`runFill` (fremder Wert bleibt, eigener wird ersetzt, leeres Feld wird gefüllt, Textvorbelegung bleibt, Auswahlvorbelegung per HTML oder Skript wird gefüllt, Auswahl von Hand nach dem ersten Lauf bleibt, auch in einer anfangs leeren Combobox, Bericht mit `kept`); `ownership` (je Element, je Feldbeschreibung nach Neuaufbau, Vorbelegung beim ersten Kontakt, `restored`, letzter Lauf); `undo` je Feldart inkl. der nicht rücksetzbaren Fälle, von Hand geänderter und entfernter Felder, umgekehrter Reihenfolge und erneutem Füllen nach Rückgängig; `dispatch`/`usePopup`/Popup-Komponente (Knopf, Hinweis mit `kept`, Tab neu geladen); Browsertest: Wert von Hand eintragen, füllen, Wert bleibt; „Neuer Datensatz“ und erneut füllen ersetzt nur eigene Werte; Rückgängig und ein weiterer Lauf ersetzt die Werte wieder; Schritt 1 füllen, „Weiter“, „Zurück“, erneut füllen ersetzt die eigenen Werte; Rückgängig stellt Text-, Auswahl- und Checkbox-Felder her, auch die Auswahlliste im Lieferrahmen, und nennt Rolle, Land und Anliegen als nicht zurückgesetzt.

## Aufwand

Zwei Tickets: (1) Zustand, Gedächtnis, `kept` im Bericht; (2) Rückgängig in Content-Script, Dispatch und Popup samt Browsertest.
