# Formulare in Shadow DOM und iframes – Design

Stand: 2026-10-23. Produktentscheidung: offene Shadow Roots und iframes derselben Adresse (Option A); fremde iframes bleiben außen vor.

## Absicht

Aufnahme und Füllen sehen heute nur das Hauptdokument. Formulare aus Web-Components (Lit, Stencil, Ionic, Vaadin, SAP UI5 Web Components und ähnliche, alle mit offenem Shadow DOM) und Formulare in eingebetteten Rahmen derselben App melden „Feld nicht gefunden“, oder der Recorder reagiert nicht auf Klicks. Beides soll sich für Nutzer nicht von normalen Seiten unterscheiden.

## Ziele

- Felder in offenen Shadow Roots und in iframes derselben Herkunft (Origin) werden aufgenommen, wiedergefunden und gefüllt wie Felder im Hauptdokument, auch verschachtelt (Shadow Root in iframe, iframe in Shadow Root).
- Der Recorder markiert solche Felder an der richtigen Stelle, öffnet das Popover daneben und behandelt Tastatur und Fokus wie bisher.
- Schnellfüllen (Vorhaben A) profitiert automatisch, weil es dieselbe Kandidatensuche nutzt.

## Nicht-Ziele

- Keine iframes fremder Herkunft (Zahlungsanbieter, eingebettete Fremddienste); sie brauchen eigene Berechtigungen und bleiben wie heute unsichtbar.
- Keine geschlossenen Shadow Roots (für Erweiterungen nicht lesbar).
- Keine Änderung am Datenmodell: Locator und Vorlagen bleiben wie sie sind.

## Anti-Ziele

- Ein Feld im Hauptdokument darf durch die tiefere Suche nicht plötzlich „mehrdeutig“ werden, nur weil in einem Rahmen ein gleichnamiges Feld liegt, das der Nutzer nie aufgenommen hat. (Siehe „Reihenfolge und Eindeutigkeit“.)
- Der Recorder darf auf Seiten mit vielen Komponenten nicht träge werden.
- Fehlende Rechte auf einen fremden Rahmen dürfen keinen Fehler auslösen; der Rahmen wird still übersprungen.

## Ablauf aus Nutzersicht

Nichts Neues zu lernen. Aufnahme: Feld in der Komponente oder im Rahmen anklicken, Popover erscheint am Feld, „Übernehmen“, „Speichern“. Füllen: wie bisher per Popup oder Kürzel; der Bericht nennt die Felder wie alle anderen. Pflege-Tab: unverändert.

## Reihenfolge und Eindeutigkeit

- Die Suche läuft in Dokumentreihenfolge; der Inhalt einer Komponente oder eines Rahmens steht an der Stelle seines Wirts bzw. seines `iframe`-Elements.
- Eindeutigkeit bleibt wie heute: die Kandidaten mit der höchsten Übereinstimmung gewinnen, mehrere gleich gute Treffer sind „mehrdeutig“. Ein Treffer im Hauptdokument mit Name, ID und Label schlägt einen Rahmen-Treffer mit nur gleichem Namen (Punktevergabe wie bisher). Meine Festlegung: keine Bevorzugung des Hauptdokuments bei Gleichstand, denn die Vorlage soll das Feld dort finden, wo es beim Aufnehmen war; Gleichstand war schon immer „mehrdeutig“.

## Technische Festlegungen

- Neues Modul `src/dom/deep.ts` mit reinen Hilfsfunktionen:
  - `deepQuerySelectorAll(root: ParentNode, selector: string): Element[]`: Treffer im Root, dann rekursiv in jeden offenen `shadowRoot` und in jedes `iframe`, dessen `contentDocument` zugreifbar ist (Zugriff in `try/catch`; fremde Rahmen werden übersprungen). Ergebnis in Dokumentreihenfolge wie oben beschrieben.
  - `rootOf(el: Element): Document | ShadowRoot`: `el.getRootNode()`, für Label- und ID-Suche innerhalb desselben Baums.
  - `deepClosest(el: Element, selector: string): Element | null`: wie `closest`, läuft aber über Shadow-Wirte und `frameElement` hinaus.
  - `viewportRect(el: Element): DOMRect`: Rechteck relativ zum obersten Viewport; summiert die Rechtecke der umschließenden `iframe`-Elemente.
  - `frameDocuments(root: Document): Document[]`: alle zugreifbaren iframe-Dokumente (rekursiv), für die Event-Listener des Recorders.
- `src/dom/locator.ts`: `listControls` (aus Vorhaben A) nutzt `deepQuerySelectorAll`; `rawLabel`, `textOfIds` und die Label-Suche per `for` nutzen `rootOf(el)` statt `ownerDocument`; `isVisible` läuft über Shadow-Wirte und `frameElement` nach oben, damit ein Feld in einem ausgeblendeten Rahmen als unsichtbar gilt.
- `src/dom/fill.ts`: `radioLabel`, `nativeGroup` (ohne `form`) und `openListbox` nutzen `rootOf`; Events und Wert-Setter bleiben (sie arbeiten mit `ownerDocument.defaultView`, also dem Fenster des Rahmens).
- Recorder (`Recorder.vue`, `useRecorder.ts`): Die Listener für `focusin`, `mouseover` und `keydown` werden zusätzlich an jedes zugreifbare iframe-Dokument gehängt; die Liste wird bei jedem Mess-Tick (`scheduleMeasure`) ergänzt, damit später geladene Rahmen dazukommen (idempotent über ein `WeakSet`). `composedPath()[0]` bleibt das Ziel. Markierungen, Hover-Rahmen, Pending-Rahmen und Popover nutzen `viewportRect` statt `getBoundingClientRect`. Scroll-Ereignisse in Rahmen lösen ebenfalls `scheduleMeasure` aus (Listener am Rahmenfenster). `isLocatable` und `existingFor` nutzen die tiefe Suche über `findElement`.
- Schnellfüllen (A): `EXCLUDED_ANCESTORS` wird mit `deepClosest` geprüft.
- Testseite: bekommt eine Web-Component (`<wc-text-field label="Kostenstelle" name="cost_center">` mit offenem Shadow Root, Label und `input` darin) und einen Rahmen `<iframe src="/frame.html" title="Lieferadresse">` mit Straße, PLZ, Ort (gleiche Herkunft, eigene Vite-Seite `test-site/frame.html`). Das Modell der Hauptseite zeigt die Werte aus Komponente und Rahmen mit an (per `postMessage` aus dem Rahmen oder direktem Zugriff, Wahl des Builders).
- Tests: `deep.ts` in happy-dom (Shadow Root über `attachShadow({ mode: 'open' })`, iframe über `srcdoc`, Reihenfolge, Überspringen eines nicht zugreifbaren Rahmens, `viewportRect` mit Rahmen-Offset); `locator`/`fill` mit Feldern im Shadow Root (Label per `for` im selben Baum, Radiogruppe im Shadow Root, Combobox mit Listbox im Shadow Root); Recorder-Tests mit `focusin` aus dem Shadow Root; Browsertest (nach Merge von PR #5): Vorlage mit Feldern aus Komponente und Rahmen füllen (Bericht „N von N“), Aufnahme per Klick in Komponente und Rahmen (Popover sichtbar, Markierung an der richtigen Stelle).

## Risiken

- Leistung: Die tiefe Suche besucht jeden Wirt und jeden Rahmen; der Recorder misst bei Scroll und Resize neu. Builder prüft die Mess-Schleife auf einer Seite mit einigen hundert Komponenten und entscheidet über eine Zwischenspeicherung je Tick.
- Rahmen, die erst später laden: Felder darin fehlen beim Füllen, wenn der Rahmen noch leer ist; der Bericht meldet sie als „nicht gefunden“. Kein Warten auf Rahmen (Festlegung; das Problem gibt es bei langsam gerenderten Seiten heute schon).

## Aufwand

Zwei Tickets: (1) `deep.ts`, Locator und Füllen mit Unit-Tests; (2) Recorder, Testseite und Browsertest.
