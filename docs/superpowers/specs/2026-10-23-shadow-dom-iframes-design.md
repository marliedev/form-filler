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
- Keine geschlossenen Shadow Roots. Erweiterungen könnten sie lesen (`chrome.dom.openOrClosedShadowRoot`, in Firefox `openOrClosedShadowRoot()`), aber die genannten Bibliotheken nutzen offene; der Mehraufwand (eigene Zuordnung beim Aufnehmen) lohnt erst bei einem echten Fall.
- Keine Komponentenmuster jenseits der zwei häufigen (siehe „Komponentenmuster“): keine Slots, keine Radiogruppen aus mehreren Komponenten, keine Auswahllisten, die eine Komponente als Overlay ans Seitenende hängt. Solche Felder bleiben, was sie heute sind: nicht aufnehmbar oder „nicht gefunden“.

## Anti-Ziele

- Ein Feld im Hauptdokument darf durch die tiefere Suche nicht plötzlich „mehrdeutig“ werden, nur weil in einem Rahmen oder einer Komponente ein gleichnamiges Feld liegt, das der Nutzer nie aufgenommen hat. Bestehende Vorlagen müssen unverändert funktionieren. (Siehe „Ort des Feldes“.)
- Der Recorder darf auf Seiten mit vielen Komponenten nicht träge werden.
- Fehlende Rechte auf einen fremden Rahmen dürfen keinen Fehler auslösen; der Rahmen wird still übersprungen.

## Ablauf aus Nutzersicht

Nichts Neues zu lernen. Aufnahme: Feld in der Komponente oder im Rahmen anklicken, Popover erscheint am Feld, „Übernehmen“, „Speichern“. Füllen: wie bisher per Popup oder Kürzel; der Bericht nennt die Felder wie alle anderen. Pflege-Tab: unverändert.

## Ort des Feldes

- Die Suche läuft in Dokumentreihenfolge; der Inhalt einer Komponente oder eines Rahmens steht an der Stelle seines Wirts bzw. seines `iframe`-Elements.
- Der Locator merkt sich beim Aufnehmen, wo ein Feld liegt: ein neues optionales Feld `scope`, die Kette der Grenzen vom Hauptdokument bis zum Feld, je Grenze ein Eintrag wie `iframe:Lieferadresse` (Name, sonst Titel, sonst ID des Rahmens) oder `wc-text-field#cost-center` (Tag des Wirts, mit ID falls vorhanden). Felder im Hauptdokument haben `scope: []`; Vorlagen ohne `scope` (alle bisherigen) gelten als Hauptdokument.
- Punktevergabe: Stimmt die Kette überein, +3 wie beim Label. So gewinnt das Feld im Hauptdokument gegen ein gleichnamiges in einem Rahmen, ein im Rahmen aufgenommenes Feld gegen das gleichnamige im Hauptdokument, und bestehende Vorlagen verhalten sich wie heute. Zwei baugleiche Komponenten ohne ID oder Namen am Wirt bleiben „mehrdeutig“, genau wie zwei gleiche Felder im Hauptdokument heute; das meldet der Recorder beim Aufnehmen als „nicht wiederfindbar“. Meine Festlegung; sie ersetzt das frühere Nicht-Ziel „keine Änderung am Datenmodell“: das Feld ist optional und abwärtskompatibel, Export und Import bleiben gültig.

## Komponentenmuster

Zwei Muster decken die genannten Bibliotheken im Alltag ab und werden unterstützt; die Testseite baut beide getreu nach, ohne neue Abhängigkeit:

1. **Alles im Shadow Root:** Label und Feld liegen in der Komponente, Name, Label oder Pflichtmarkierung stehen aber oft am Wirt (`<wc-text-field name="cost_center" label="Kostenstelle" required>`). Beim Beschreiben eines inneren Feldes werden die Attribute `name`, `label`, `aria-label`, `placeholder` und `required` des Wirts als Rückfall genutzt, wenn das Feld selbst nichts Passendes trägt; der Typvorschlag sieht damit dieselben Wörter wie bei einem normalen Feld.
2. **Label außen, Feld innen:** Ein `<label for="…">` im Hauptdokument zeigt auf den Wirt (`<wc-input id="…">`), das eigentliche `input` liegt im Shadow Root. Das Label des Wirts gilt dann für das innere Feld.

Meine Festlegung, bitte prüfen: Das sind drei statt zwei Tickets. Wer nur Eigenbau-Komponenten mit Label und Feld im selben Shadow Root braucht, kann Muster 1 (Wirt-Rückfall) und 2 streichen und spart ein Ticket; dann bleiben Ionic, Vaadin und UI5 aber praktisch außen vor, weil sie Name und Label am Wirt tragen.

## Technische Festlegungen

- Neues Modul `src/dom/deep.ts` mit reinen Hilfsfunktionen:
  - `deepQuerySelectorAll(root: ParentNode, selector: string): Element[]`: Treffer im Root, dann rekursiv in jeden offenen `shadowRoot` und in jedes `iframe`, dessen `contentDocument` zugreifbar ist (Zugriff in `try/catch`; fremde Rahmen werden übersprungen). Ergebnis in Dokumentreihenfolge wie oben beschrieben.
  - `rootOf(el: Element): Document | ShadowRoot`: `el.getRootNode()`, für Label- und ID-Suche innerhalb desselben Baums.
  - `deepClosest(el: Element, selector: string): Element | null`: wie `closest`, läuft aber über Shadow-Wirte und `frameElement` hinaus.
  - `viewportRect(el: Element): DOMRect`: Rechteck relativ zum obersten Viewport; summiert die Rechtecke der umschließenden `iframe`-Elemente.
  - `frameDocuments(root: Document): Document[]`: alle zugreifbaren iframe-Dokumente (rekursiv), für die Event-Listener des Recorders.
  - `scopeOf(el: Element): string[]`: die Kette aus „Ort des Feldes“; `hostOf(el: Element): Element | null`: der Shadow-Wirt des Baums, in dem `el` liegt.
- `src/model/types.ts`: `FieldLocator.scope?: string[]`; Schema (`src/model/schema.ts`) nimmt das Feld optional auf.
- `src/dom/locator.ts`: `listControls` (aus Vorhaben A) nutzt `deepQuerySelectorAll`; `describeElement` setzt `scope` und nutzt die Wirt-Attribute als Rückfall (Muster 1) sowie ein Label, dessen `for` auf den Wirt zeigt (Muster 2); `rawLabel`, `textOfIds` und die Label-Suche per `for` nutzen `rootOf(el)` statt `ownerDocument`; `score` vergibt +3 für übereinstimmenden `scope` (fehlender `scope` im Locator zählt als `[]`); `isRequired` sieht auch `required`/`aria-required` am Wirt; `isVisible` läuft über Shadow-Wirte und `frameElement` nach oben, damit ein Feld in einem ausgeblendeten Rahmen als unsichtbar gilt.
- `src/dom/suggest.ts`: unverändert, es liest den Locator (Label, Name, aria-label) und bekommt die Wirt-Werte so mit; das `autocomplete`-Attribut wird am Feld und am Wirt gelesen.
- `src/dom/fill.ts`: `radioLabel`, `nativeGroup` (ohne `form`) und `openListbox` nutzen `rootOf`. Die ausgelösten Ereignisse (`input`, `change`, Maus- und Tastaturereignisse) werden `composed: true`, damit sie wie echte Nutzereingaben aus der Komponente herausdringen und Bindungen am Wirt (z. B. `v-model` auf `<wc-text-field>`) den Wert sehen. Wert-Setter bleiben (sie arbeiten mit `ownerDocument.defaultView`, also dem Fenster des Rahmens).
- Recorder (`Recorder.vue`, `useRecorder.ts`): Die Listener für `focusin`, `mouseover` und `keydown` werden zusätzlich an jedes zugreifbare iframe-Dokument gehängt; die Liste wird bei jedem Mess-Tick (`scheduleMeasure`) ergänzt, damit später geladene Rahmen dazukommen (idempotent über ein `WeakSet`). `composedPath()[0]` bleibt das Ziel. Markierungen, Hover-Rahmen, Pending-Rahmen und Popover nutzen `viewportRect` statt `getBoundingClientRect`. Scroll-Ereignisse in Rahmen lösen ebenfalls `scheduleMeasure` aus (Listener am Rahmenfenster). `isLocatable` und `existingFor` nutzen die tiefe Suche über `findElement`.
- Schnellfüllen (A): `EXCLUDED_ANCESTORS` wird mit `deepClosest` geprüft.
- Testseite: bekommt zwei Web-Components nach den beiden Mustern (`<wc-text-field name="cost_center" label="Kostenstelle" required>` mit Label und `input` im Shadow Root und Wert-Bindung über ein nach außen dringendes `input`-Ereignis; `<label for="po-number">Bestellnummer</label><wc-input id="po-number">` mit dem `input` im Shadow Root) und einen Rahmen `<iframe src="/frame.html" name="delivery" title="Lieferadresse">` mit Straße, PLZ, Ort unter denselben Feldnamen wie die Hauptseite (gleiche Herkunft, eigene Vite-Seite `test-site/frame.html`), damit der Browsertest den Gleichstandsfall abdeckt. Das Modell der Hauptseite zeigt die Werte aus Komponenten und Rahmen mit an (per `postMessage` aus dem Rahmen oder direktem Zugriff, Wahl des Builders).
- Tests: `deep.ts` in happy-dom (Shadow Root über `attachShadow({ mode: 'open' })`, iframe über `srcdoc`, Reihenfolge, Überspringen eines nicht zugreifbaren Rahmens, `viewportRect` mit Rahmen-Offset, `scopeOf`); `locator` mit Feldern im Shadow Root (Muster 1 und 2, `scope` im Locator, Gleichstand Hauptdokument gegen Rahmen in beide Richtungen, alte Vorlage ohne `scope` findet das Hauptdokument-Feld, Radiogruppe im Shadow Root, Combobox mit Listbox im Shadow Root); `fill` mit `composed`-Ereignissen (Listener am Wirt sieht `input`); Recorder-Tests mit `focusin` aus dem Shadow Root; Browsertest (nach Merge von PR #5): Vorlage mit Feldern aus Komponenten und Rahmen füllen (Bericht „N von N“, Modell zeigt die Werte, Hauptseiten-PLZ und Rahmen-PLZ getrennt), Aufnahme per Klick in Komponente und Rahmen (Popover sichtbar, Markierung an der richtigen Stelle, Locator mit `scope`).

## Risiken

- Leistung: Die tiefe Suche besucht jeden Wirt und jeden Rahmen; der Recorder misst bei Scroll und Resize neu. Builder prüft die Mess-Schleife auf einer Seite mit einigen hundert Komponenten und entscheidet über eine Zwischenspeicherung je Tick.
- Rahmen, die erst später laden: Felder darin fehlen beim Füllen, wenn der Rahmen noch leer ist; der Bericht meldet sie als „nicht gefunden“. Kein Warten auf Rahmen (Festlegung; das Problem gibt es bei langsam gerenderten Seiten heute schon).

## Aufwand

Drei Tickets: (1) `deep.ts`, `scope` im Locator, tiefe Suche in Locator und Füllen mit Unit-Tests; (2) Komponentenmuster 1 und 2 (Wirt-Rückfall, Label auf Wirt, `composed`-Ereignisse) mit Unit-Tests; (3) Recorder, Testseite und Browsertest.
