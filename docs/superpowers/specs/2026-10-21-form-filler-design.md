# Form Filler – Design

Stand: 2026-10-21 · Status: Entwurf zur Freigabe

## Zweck und Warum

Martin testet regelmäßig mehrstufige Formulare in internen Web-Anwendungen (zunächst die
interne Ziel-App: Kundenanlage, Benutzeranlage). Allein Schritt 1 der Kundenanlage hat
ca. 12 Felder (Firmenanschrift, Rechnungsadresse, Kundennummer, Kostenstelle, …). Diese bei
jedem Testlauf von Hand zu befüllen, kostet Zeit.

Gebaut wird eine **Browser-Erweiterung**, die Formulare per Klick mit **realistischen,
zufälligen und in sich stimmigen Fakedaten** befüllt – gesteuert über **selbst erfasste und
pflegbare Vorlagen** pro App und Formular.

Erfolg: Martin öffnet die Kundenanlage der Ziel-App, klickt die Erweiterung an, klickt bei
„Kundenanlage · Schritt 1“ auf „Füllen“ – alle Felder sind korrekt befüllt, das Formular
lässt sich ohne Nacharbeit absenden. Ändert sich das Formular, passt er die Vorlage selbst
an, ohne Code.

## Ziele

- Formulare per Klick (oder Tastenkürzel) mit Fakedaten befüllen.
- Vorlagen selbst erfassen (Felder auf der Seite anklicken) und pflegen (Tabelle).
- Fakedaten realistisch (deutsch), feldspezifisch, pro Durchlauf stimmig und nicht
  wiederholend.
- Mehrstufige Prozesse mit durchgehend demselben Fake-Datensatz.
- Läuft in Dia (macOS) und Arc/Dia (Windows).

## Nicht-Ziele

- Kein Modus mit absichtlich ungültigen Daten (später nachrüstbar).
- Keine Team-Synchronisation, kein Cloud-Speicher. Übertragung nur per JSON-Export/-Import.
- Kein automatisches Weiterklicken/Absenden durch die Schritte.
- Keine Veröffentlichung im Chrome Web Store; Installation als entpackte Erweiterung.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)

- **Daten verlassen den Rechner.** Keine externen APIs, kein Tracking, keine
  Remote-Ressourcen. Alles läuft lokal in der Erweiterung.
- **Bezüge zur Ziel-App im Repo.** Das Repo bleibt generisch; Vorlagen, App-Adressen,
  Kostenstellen etc. existieren nur im Browser-Speicher bzw. in Martins Export-Dateien.
  Keine Beispielvorlagen der Ziel-App im Code, keine Seed-Daten mit Firmenbezug.
- **Stilles Scheitern.** Ein Feld, das nicht gefunden oder nicht befüllt werden konnte, muss
  sichtbar gemeldet werden – nie stillschweigend übersprungen.
- **„Optisch befüllt, intern leer“.** Felder müssen so befüllt werden, dass das
  Formular-Framework der Seite den Wert registriert (Validierung, Weiter-Button).

## Rahmenbedingungen

- Chromium-Erweiterung nach Manifest V3 (Dia und Arc unterstützen Chrome-Erweiterungen).
- TypeScript strict, kein `any`. UI in Vue 3 (`<script setup>`, Composition API).
  Styling Tailwind. Tests mit Vitest.
- Fakedaten-Basis: `@faker-js/faker` mit Locale `de` (Installation erfordert Martins
  Freigabe).
- Eigenes privates Repo `~/Business/Personal/form-filler`, Arbeit auf Feature-Branches,
  Conventional Commits auf Englisch, Code-Kommentare auf Englisch, Doku auf Deutsch.
- WCAG 2.2 AA für Popup, Aufnahme-Overlay und Pflege-Tab (Tastaturbedienung, Fokus,
  Kontrast, Labels).
- Zielformulare: überwiegend native Elemente (input, select, textarea, radio, checkbox,
  `type="date"`), teils barrierefreie Eigenentwicklungen (ARIA-Muster wie combobox/listbox,
  radiogroup, Datepicker).
- Erste Ziel-App ist mit **Laravel + Inertia.js + Vue** gebaut: **keine iframes,
  kein Shadow DOM**, Schrittwechsel per Inertia ohne Neuladen der Seite. Werte müssen so
  gesetzt werden, dass Vue-`v-model` sie übernimmt. iframes und Shadow DOM werden nicht
  unterstützt (bewusst, kein Bedarf).

## Entscheidungen (mit Martin abgestimmt)

### Bedienung im Alltag – Popup „Schnellzugriff“ (Variante B)

- Die Erweiterung erkennt die **App anhand der aktuellen Adresse** (pro App hinterlegte
  URL-Muster; eine App kann mehrere Umgebungen/Adressen haben).
- Popup zeigt: App-Name mit Hinweis „erkannt“, Umschalter **„Alle Felder“ / „Nur
  Pflicht“**, Liste der Vorlagen dieser App mit je einem **„Füllen“**-Knopf, Rückfall
  „Andere App wählen“, Knopf **„Neuer Datensatz“**, Zugang zu Einstellungen/Pflege-Tab.
- **Tastenkürzel** füllt mit der zuletzt genutzten Vorlage (Vorschlag ⌥⇧F, umbelegbar).
- Nach dem Füllen eine **Statuszeile** („11 von 12 befüllt · 1 nicht gefunden“), aufklappbar
  zum Feld-Protokoll (Feld, Status ✓ / ⚠ nicht gefunden / ⚠ nicht befüllbar).

### Vorlagen erfassen und pflegen (Variante B)

- **Aufnehmen auf der Seite:** Aufnahme-Modus starten → Felder auf der Seite werden beim
  Überfahren hervorgehoben → Klick öffnet eine kleine Auswahl direkt am Feld:
  Datentyp (vorgeschlagen aus Label, Name, Feldtyp, `autocomplete`), Pflicht-Haken
  (vorbelegt aus `required`, `aria-required` oder „*“ im Label). Bereits erfasste Felder
  sind markiert. Leiste unten: Anzahl Felder, Esc beendet, Speichern.
- **Pflegen in Tabelle** (eigener Tab der Erweiterung): Pro Feld Datentyp, Optionen des
  Datentyps, Pflicht-Schalter, Löschen, Reihenfolge per Ziehen (zusätzlich per Tastatur),
  Markierung ⚠ für Felder, die beim letzten Füllen nicht gefunden wurden, Knopf
  „+ Felder aufnehmen“ (zurück zur Seite), Export/Import.
- Vorlagen sind vollständig bearbeitbar: Felder hinzufügen, entfernen, neu zuordnen,
  Pflicht/optional umschalten, umsortieren.
- **Reihenfolge** bestimmt die Füllreihenfolge (relevant, wenn ein Feld ein anderes erst
  einblendet).

### Feld-Wiedererkennung

- Felder werden **über stabile Merkmale** erkannt (z. B. `name`, `id`, zugehöriges
  Label, `aria-label`, Platzhalter), **nicht über ihre Position**. Umsortieren oder neue
  Felder im Formular dürfen bestehende Zuordnungen nicht brechen.
- Nicht gefundene Felder → im Protokoll sichtbar, in der Tabelle mit ⚠ markiert.

### Fakedaten

- **Stimmiger Datensatz pro Durchlauf:** PLZ ↔ Ort passen zusammen, E-Mail-Domain passt
  zur Firma, E-Mail-Lokalteil zur Person, Rechnungs-E-Mail zur Firma.
- **Kein Wiederholen:** großer Wertevorrat; für PLZ/Ort eine **lokal eingebettete Liste
  mit mehreren tausend echten deutschen PLZ-Ort-Paaren** (offene Quelle, z. B.
  OpenGeoDB; Lizenz vor Einbau prüfen und im Repo dokumentieren).
- **Mehrstufige Prozesse:** Vorlagen können zu einem Prozess gehören (z. B. „Kundenanlage“
  mit Schritt 1, 2, …). Alle Schritte eines Prozesses nutzen **denselben Datensatz**. Ein
  neuer Datensatz entsteht, wenn Schritt 1 erneut gefüllt wird oder per „Neuer Datensatz“.
- **Mehrere Personen und Adressen pro Datensatz:** Ein Datensatz besteht aus einer Firma
  und benannten Slots (Person 1, Person 2, …; Adresse A, Adresse B, …), die alle zur selben
  Firma gehören und in sich stimmig sind. Beim Erfassen und in der Pflege-Tabelle wird
  jedem personen- bzw. adressbezogenen Feld ein Slot zugeordnet (eigene Spalte). Das
  Vorlagenformat trägt Slots von Anfang an.
- **Lebensdauer des Datensatzes** *(Entscheidung Claude)*: pro Tab und Prozess, bis zum
  Browser-Neustart. Zwei Tabs mit demselben Prozess haben getrennte Datensätze (und
  Kennungen).
- **Prozesse sind unabhängig:** Jeder Prozess erzeugt seine eigene Fake-Firma; die
  Benutzeranlage knüpft nicht an die Firma der Kundenanlage an. (Später ohne Formatbruch
  nachrüstbar: „Firma aus Prozess X übernehmen“.)
- **Eindeutige Kennung pro Durchlauf** (z. B. „T1342“), pro Feld an-/abschaltbar und an
  den Wert angehängt (z. B. „Brandt Logistik GmbH · T1342“), damit eindeutige Felder nicht
  kollidieren und Testdaten wiederauffindbar sind. Innerhalb eines Datensatzes überall
  dieselbe Kennung.
- **Füllmodus „Nur Pflicht“** befüllt ausschließlich als Pflicht markierte Felder und
  lässt andere unberührt.

### Datentyp-Katalog

| Gruppe | Typen |
|---|---|
| Firma | Firmenname, Rechtsform, USt-IdNr. (formal gültig), Steuernummer, Handelsregister-Nr., Branche |
| Person | Anrede, Vorname, Nachname, Geburtsdatum (Mindestalter einstellbar), Position |
| Adresse | Straße + Hausnummer (kombiniert oder getrennt), PLZ, Ort, Land, Adresszusatz |
| Kontakt | E-Mail, Telefon, Mobilnummer, Website |
| Bank | IBAN (gültige Prüfziffer), BIC, Bankname |
| E-Rechnung | Rechnungspostfach (E-Mail, passend zur Firma), Leitweg-ID (gültige Prüfziffer) |
| Allgemein | Datum (Vergangenheit/Zukunft/Bereich), Zahl (min/max), Freitext/Notiz |
| Steuerung | **Festwert**; **Auswahl** (zufällig, zufällig aus Teilmenge, oder fester Eintrag – für Dropdowns, Radios, Checkboxen, z. B. Rolle „Teilnehmer/Lernmanager“); **Aus Liste** (eigene Werteliste, zufällige Wahl – z. B. gültige Kostenstellen); **Muster** mit Platzhaltern (z. B. `TEST-{zahl:6}` für Kundennummer); **Leer lassen** |
| Verknüpfung | Rechnungsadresse = Firmenanschrift oder eigene stimmige Adresse |

Der Katalog muss erweiterbar sein (neuer Typ = neuer Generator, ohne Umbau).

### Speicherung und Austausch

- Vorlagen, Apps, Listen lokal im Speicher der Erweiterung (kein Sync-Speicher, damit
  nichts über Browser-Konten synchronisiert wird).
- **Export/Import als JSON-Datei** (alles oder einzelne Apps), z. B. Mac → Windows.
  Import prüft das Format und meldet Konflikte (gleichnamige Vorlage überschreiben oder
  als Kopie anlegen).

## Dem Builder überlassen

- Build-Werkzeug/Erweiterungs-Framework (Vorschlag: WXT oder Vite + CRXJS – marktbewährt,
  Vue-fähig) und genaue Ordnerstruktur.
- Konkrete Strategie für Feld-Merkmale und Trefferpriorität, solange sie positionsunabhängig
  ist und Mehrdeutigkeiten meldet statt zu raten.
- Technik des Befüllens (native Value-Setter + passende Events; ARIA-Combobox/Listbox per
  simuliertem Öffnen und Option-Klick), solange das Anti-Ziel „optisch befüllt, intern
  leer“ eingehalten wird.
- Berechtigungsmodell (bevorzugt minimal: `activeTab`/`scripting`, Host-Rechte nur für
  hinterlegte App-Adressen, falls für das Tastenkürzel nötig).
- Format der Durchlauf-Kennung, Heuristik für Datentyp-Vorschläge, JSON-Schema mit
  Versionsfeld.
- Visuelles Feinkonzept auf Basis der abgestimmten Wireframes (Popup B, Pflege-Tabelle B).

## Tests

**Abnahme** *(Entscheidung Claude)*: Im Repo liegt eine neutrale Testseite (Vue, ohne
Bezug zur Ziel-App), die die relevanten Muster nachbildet – native Felder aller Typen, ARIA-Combobox,
Datepicker, Felder mit `v-model`, ein Schrittwechsel ohne Neuladen, ein bedingt
eingeblendetes Feld. Die fachliche Abnahme in der Ziel-App macht Martin manuell.

Vitest für Logik: Generatoren (Prüfziffern IBAN/USt-IdNr./Leitweg-ID, Stimmigkeit des
Datensatzes, Muster-Platzhalter), Feld-Wiedererkennung, Füll-Logik je Elementtyp (DOM-Tests),
Import-Validierung. Keine Tests für rein kosmetische UI.

## Offene Punkte außerhalb des Projekts

- Ob ein privat entwickeltes Werkzeug im beruflichen Kontext eingesetzt werden darf, klärt
  Martin intern (IT-Richtlinien).
