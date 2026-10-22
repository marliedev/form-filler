# Produktvideo Form Filler – Konzept

Stand: 22.10.2026. Status: Entwurf, zur Freigabe.

## 1. Zweck

Ein kurzes, stummes 2D-Animationsvideo, das Entwicklern im GitHub-Repository in unter einer Minute zeigt, was Form Filler kann und wie leicht der Weg von „Seite offen“ bis „Formular gefüllt“ ist. Wer es gesehen hat, soll die Erweiterung installieren wollen und wissen, wie die drei Kernabläufe aussehen: App erkennen, Vorlage aufnehmen, ausfüllen.

Zielgruppe: Entwicklerinnen und Entwickler, die das Repository auf GitHub öffnen. Abspielort: README (Teaser-GIF oben, volles Video als Player weiter unten).

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Die vier Inhalte aus der Anforderung sichtbar machen: Vorlagen aufnehmen, automatische URL-/App-Erkennung samt Verwaltung, Autoausfüllen, Tastenkürzel.
- Intro mit Icon, Titel, Claim und „developed by“, das in die Vorstellung überleitet.
- Moderne 2D-Animation im Markenstil (siehe Abschnitt 6) mit gezielten Effekten: Glow, Lichtstreifen, Zoom, Klick-Ripple, Tipp-Effekt.
- Ohne Ton vollständig verständlich.
- Vollständig reproduzierbar aus Quelldateien im Repository, mit einem Befehl neu zu rendern.

**Nicht-Ziele**
- Keine Sprecherstimme, keine Musik, keine Untertitel-Spur.
- Keine englische Fassung (eigenes Ticket, zusammen mit englischem README).
- Keine Bildschirmaufnahme der echten Erweiterung. Die Oberfläche wird nachgebaut.
- Kein Schnittprogramm, keine Timeline-Datei eines Videowerkzeugs.

**Anti-Ziele (das wäre ein Fehlschlag, auch wenn es technisch läuft)**
- Es sieht aus wie ein generischer SaaS-Erklärfilm (abstrakte Blobs, Stock-Cursor, Rule-of-Three-Texte).
- Firmen-, App- oder Personendaten aus dem beruflichen Umfeld tauchen auf. Alles im Video ist erfunden und neutral.
- Die gezeigte Oberfläche weicht sichtbar von der echten Erweiterung ab (andere Farben, andere Beschriftungen).
- Das Teaser-GIF wird größer als 5 MB oder sieht verwaschen aus.

## 3. Rahmenbedingungen

- **Sprache:** Deutsch. Oberfläche und Einblendungen sprechen dieselbe Sprache wie die Erweiterung.
- **Marke:** Design-System Martin Liesche. Tokens aus `src/theme/tokens.css`, Schriften Bricolage Grotesque (Überschriften, im Repo) und Wotfard (Fließtext, nur lokal unter `src/theme/fonts/local/`, nicht im Repo). Ohne Wotfard rendert das Video mit der Systemschrift; die finale Fassung wird auf einem Rechner mit Wotfard gerendert.
- **Keine Secrets, keine beruflichen Namen.** Demo-App und Daten sind erfunden (Abschnitt 5).
- **Formate und Grenzen**
  - Volles Video: MP4 (H.264, yuv420p), 1920 × 1080, 30 fps, 50–60 s, Ziel ≤ 10 MB (GitHub-Upload-Grenze für Videos im Free-Plan, H.264 empfohlen; Quelle: [docs.github.com, Attaching files](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)). Wird nicht eingecheckt; Martin lädt es einmal über den GitHub-Editor hoch, der Player-Link landet im README.
  - Teaser: GIF, 960 × 540, 20 fps, 10–12 s, Endlosschleife, Ziel ≤ 5 MB, eingecheckt unter `docs/media/teaser.gif`.
- **Genehmigung nötig (Pakete):** `gsap` und `playwright` als devDependencies; `ffmpeg` per Homebrew. Das in Playwrights Cache liegende ffmpeg kann nur WebM (VP8), weder MP4 noch GIF. Playwright steuert den installierten Chrome (`channel: 'chrome'`), lädt also keinen eigenen Browser. Die Freigabe ist der erste Schritt des Plans; ohne sie endet die Umsetzung bei der Vorschau im Browser, und Rendern, Dateigröße und GIF-Qualität bleiben unbelegt.
- **Code gewinnt:** Wo dieses Konzept und die echte Erweiterung bei Beschriftungen, Zuständen oder Formaten auseinanderlaufen, gilt der Code der Erweiterung. Nur die Daten sind erfunden, und zwar im echten Format.
- **Git:** Feature-Branch, PR nach `main`. Render-Ausgaben außer dem Teaser-GIF sind gitignored.

## 4. Storyboard

Gesamtlänge etwa 55 s. Zeiten sind Richtwerte; der Rhythmus wird beim Bauen in der Vorschau feinjustiert. Alle Einblendungen stehen unten links auf der Bühne (Abschnitt 6), Überschriften in Bricolage, Nebentext in Wotfard.

| # | Zeit | Szene | Was passiert | Einblendung |
|---|---|---|---|---|
| 0 | 0–6 s | Intro | Dunkle Bühne, schwacher Indigo-Glow in der Mitte. Das Icon skaliert ein; der Teal-Pegel im Icon steigt von leer auf seine Ruhehöhe (das Icon „füllt sich“). Titel erscheint, darunter der Claim, dann klein „developed by“ mit Signet und Name. Übergang: Das Icon schrumpft und fliegt in die Symbolleiste des Browserfensters, das von unten hereinfährt. | „Form Filler“ · „Einmal aufnehmen. Immer ausfüllen.“ · „developed by ◆ Martin Liesche“ |
| 1 | 6–11 s | Das Problem | Browserfenster mit dem Formular „Kundenanlage · Schritt 1“, 12 leere Felder. Der Cursor tippt mühsam „Max“ ins erste Feld, zögert, löscht. Dann noch einmal, schneller: „Nordlicht“, Wisch, leer. Kein Zähler; die Einblendung trägt die Aussage. | „12 Felder. Jeder Testlauf. Von Hand.“ |
| 2 | 11–19 s | App erkennen | Klick auf das Icon in der Symbolleiste, Zoom auf das Popup; die Seite dahinter wird mit einem dunklen Schleier (55 %) abgedunkelt, damit das Popup trägt. Es zeigt „Für diese Seite ist keine App hinterlegt“ und das Formular „Neue App für diese Seite“; das URL-Muster `https://portal.example.com/*` ist bereits vorbelegt. Der Name „Kundenportal“ wird getippt, „App anlegen“. Berechtigungsdialog kurz, „Zulassen“. Der Popup-Kopf zeigt jetzt „Kundenportal“ mit dem Zusatz „An der Adresse erkannt“. | „Erkennt die App an der URL.“ · „Einmal anlegen, ab jetzt automatisch.“ |
| 3 | 19–33 s | Vorlage aufnehmen | Klick auf die Kachel „+ Neue Vorlage“, Name „Kundenanlage“, „Anlegen und Felder aufnehmen“. Popup schließt, unten erscheint die Aufnahme-Leiste mit pulsierendem Punkt „Aufnahme · 0 Felder“. Der Cursor klickt „Firma“: Feldrahmen leuchtet, das Feld-Fenster öffnet sich mit dem vorgeschlagenen Datentyp „Firmenname“ und erkanntem Pflichtfeld, „Übernehmen“. Das Feld behält wie in der echten Aufnahme einen grünen Rahmen mit dem Typ-Label; Zähler springt auf 1. Zweites Feld „E-Mail“ ebenso. Dann Zeitraffer: Der Cursor hüpft durch die restlichen Felder, jedes bekommt seinen grünen Rahmen, der Zähler tickt bis 12. „Speichern“, grüner Hinweis „✓ Vorlage gespeichert“. | „Felder anklicken. Der Datentyp wird vorgeschlagen.“ · „Pflichtfelder erkennt sie selbst.“ · „Speichern. Fertig.“ |
| 4 | 33–43 s | Ausfüllen | Popup öffnet sich, Zeile „Kundenanlage“ mit „Füllen“. Klick. Ein diagonaler Lichtstreifen fährt über das Formular, die Felder füllen sich kaskadierend von oben nach unten (Werte tippen sich in 60–80 ms ein, jedes Feld pulst kurz Teal). Während der Kaskade zeigt das Popup seinen Beschäftigt-Zustand wie die echte Erweiterung; erst danach den Status: Farbpunkt grün, „Kundenanlage: 12 von 12 befüllt“; am Icon erscheint das grüne Badge „✓“ (mit `back.out` eingeploppt). Kurzer Zoom auf die Kundennummer mit angehängter Kennung „· T4821“. Dann „Füllen“ erneut: Alle Werte wechseln sichtbar (andere Person, andere Firma, andere Stadt). | „Ein Klick.“ · „Jedes Mal neue, stimmige Daten.“ |
| 5 | 43–48 s | Tastenkürzel | Popup ist zu. Drei Tastenkappen „Alt“ „⇧“ „F“ ploppen unten rechts ein und drücken sich nacheinander nieder. Das Formular füllt sich erneut, ohne dass das Popup aufgeht. | „Oder per Tastenkürzel.“ |
| 6 | 48–53 s | Verwalten | Schnitt auf die Verwaltungsseite: Vorlage „Kundenanlage“ mit Feldtabelle. Eine Zeile wird per Drag nach oben gezogen, ein Pflichtfeld-Schalter umgelegt, Klick auf „Exportieren“, eine JSON-Datei fliegt als kleines Dokument-Symbol heraus. | „Vorlagen pflegen, exportieren, teilen.“ |
| 7 | 53–57 s | Outro | Alles blendet auf die dunkle Bühne. Icon, Titel, darunter die Repo-Adresse und die Browser-Zeile. Ganz unten klein das Copyright. Endbild hält 2 s. | „Form Filler“ · „github.com/marliedev/form-filler“ · „Für Dia, Arc, Chrome und andere Chromium-Browser“ · „© 2026 Martin Liesche“ |

**Teaser-GIF:** Ausschnitt aus Szene 4, vom Klick auf „Füllen“ bis zum Status „12 von 12“ und dem zweiten Füllen mit neuen Daten (10–12 s). Am Ende 0,8 s Standbild, dann Schleife. Ohne Intro, ohne Einblendungen außer „Ein Klick.“ und „Jedes Mal neue, stimmige Daten.“.

## 5. Demo-Inhalt (erfunden, neutral)

- **App:** „Kundenportal“, URL `https://portal.example.com/kunden/neu`, Seitentitel „Kundenanlage · Schritt 1“. Helle Seite (#f4f5f7, Text #1f2430), Felder 36 px hoch, Radius 6 px, schlichte Labels. Bewusst „irgendeine interne Web-App“, keine echte Marke.
- **12 Felder in dieser Reihenfolge:** Firma*, Anrede* (Select), Vorname*, Nachname*, E-Mail*, Telefon, Straße*, PLZ*, Ort*, Kundennummer* (mit Kennung), Rechnungs-E-Mail, IBAN. Sternchen = Pflichtfeld, so wie die Erweiterung es erkennt.
- **Datensatz 1:** Nordlicht Medien GmbH · Frau · Lena · Hoffmann · lena.hoffmann@nordlicht-medien.example · 0221 2893817 · Hohenzollernring 42 · 50672 · Köln · K-2041 · T4821 · rechnung@nordlicht-medien.example · DE89 3704 0044 0532 0130 00
- **Datensatz 2 (zweites Füllen):** Brandt & Söhne KG · Herr · Jonas · Brandt · jonas.brandt@brandt-soehne.example · 0341 5587120 · Karl-Liebknecht-Straße 18 · 04107 · Leipzig · K-2041 · T7306 · rechnung@brandt-soehne.example · DE02 1203 0000 0000 2020 51
- **Kennung:** im echten Format `T` plus vier Ziffern (`T4821` bzw. `T7306`), mit dem echten Trennzeichen an die Kundennummer angehängt.

## 6. Bildsprache

- **Bühne:** 1920 × 1080, Hintergrund `--color-bg` (#121116) mit einem weichen radialen Indigo-Glow (primary-500 bei 18 % Deckung, Radius ≈ 700 px) hinter dem Browserfenster. Kein Blob.
- **Textzone:** Das untere Fünftel der Bühne (230 px) gehört den Einblendungen. Eine Ebene über dem Browserfenster blendet dort mit einem Verlauf nach `--color-bg` über (transparent → deckend auf den oberen 30 % der Zone). So bleiben Einblendungen auch bei Zooms, wenn das Fenster nach unten über die Zone hinauswächst, immer auf dunklem Grund. Cursor und Tastenkappen liegen über dieser Ebene.
- **Browserfenster:** 1440 × 810, horizontal mittig, Oberkante bei 60 px, Radius 16 px, dunkle Chrome-Leiste in `--color-surface` mit drei Fensterpunkten, Adressleiste mit der Demo-URL, rechts die Symbolleiste mit dem Form-Filler-Icon (16 px-Fassung) und zwei grauen Platzhalter-Icons. Seiteninhalt hell (Abschnitt 5). Schatten 0 40 px 80 px rgb(0 0 0 / .5). Zooms skalieren das Fenster um einen Fokuspunkt nahe dem gezeigten Element (Abschnitt „Kamera“).
- **Erweiterungs-Oberflächen** (Popup 360 px breit, Feld-Fenster 304 px, Aufnahme-Leiste, Verwaltungsseite) werden mit denselben Tokens und Utility-Klassen wie die echte Erweiterung gebaut (`bg-surface`, `text-brand-fg`, `rounded-xl` usw.), damit Farben, Radien und Beschriftungen exakt übereinstimmen. Referenz: `entrypoints/popup/App.vue`, `src/recorder/CapturePopover.vue`, `src/recorder/Recorder.vue`, `src/manage/TemplateTable.vue`.
- **Cursor:** eigener Pfeil (weiß, Kontur #110078, 28 px, weicher Schatten). Bewegung mit `power2.inOut`, 350–600 ms je Strecke. Klick: der Pfeil skaliert kurz auf 0,9 und ein Ring in `--color-brand-fg` weitet sich von der Spitze aus (300 ms, Deckung läuft gegen 0).
- **Tipp-Effekt:** Zeichen für Zeichen, 55–70 ms je Zeichen beim „Menschen“ (Szene 1, Namen eingeben), 25–35 ms beim Ausfüllen durch die Erweiterung. Textcursor blinkt nur bei der menschlichen Eingabe.
- **Kamera:** Zooms skalieren nur die Fensterebene (Browserfenster samt Popup, Feld-Fenster und Leiste) um den jeweiligen Fokuspunkt, 1,0 → 1,6–2,0, `power2.inOut`, 700 ms. Textzone, Einblendungen, Cursor und Tastenkappen liegen in eigenen Ebenen darüber und wachsen nicht mit. Nie mehr als ein Zoom je Szene hinein und wieder heraus.
- **Effekte:** Füll-Glow = Box-Shadow in `--color-brand-2` (Teal), 0 → 1 → 0 in 500 ms. Lichtstreifen = 200 px breites, 20° gedrehtes Band aus weiß 0 → 12 % → 0, das in 900 ms über das Formular fährt. Aufnahme-Punkt pulsiert 1,2 s. Status-Farbpunkte wie in der Erweiterung (success/warning/error).
- **Einblendungen:** unten links, 96 px Rand, Überschrift Bricolage 600, 56 px, `--color-text`; Nebentext Wotfard 300, 28 px, `--color-muted`. Einblenden: 24 px von unten + Deckung, 400 ms, `power3.out`; Ausblenden 250 ms. Keine ALL-CAPS-Labels, keine Nummerierung.
- **Tastenkappen (Szene 5):** 88 × 88 px, `--color-surface`, 1 px `--color-line`, Beschriftung Bricolage 600, unten eine 4 px dunklere Kante, die beim Drücken auf 1 px zusammenschrumpft.
- **Zeitkurven:** Standard `power2.out` für Erscheinen, `power2.inOut` für Bewegungen, `back.out(1.4)` nur für die Tastenkappen und den Badge-Zähler.

## 7. Technik

- **Quelle:** `promo/video/` mit `index.html` (Bühne und Szenen-Markup), `styles.css`, `timeline.js` (eine GSAP-Timeline, eine Funktion je Szene, die an die Haupt-Timeline gehängt wird), `data.js` (Demo-Inhalte aus Abschnitt 5), `render.mjs`, `vite.config.ts`.
- **Vite** dient die Seite aus, damit Schriften und Tailwind-Utilities wie in der Erweiterung funktionieren (`@tailwindcss/vite` und `src/theme/tokens.css` werden wiederverwendet). `npm run video:preview` öffnet die Vorschau mit Play-Knopf und Scrubber (Bereichsregler über die gesamte Timeline), `npm run video:render` rendert.
- **Determinismus:** Die Timeline ist pausiert; das Render-Skript setzt sie pro Bild mit `tl.seek(t)` auf den exakten Zeitpunkt und fotografiert die Bühne. Keine CSS-Transitions oder CSS-Animationen, keine Zufallswerte, keine `Date`-Abhängigkeit. `document.fonts.ready` wird vor dem ersten Bild abgewartet.
- **Rendern:** Playwright startet den installierten Chrome (1920 × 1080, Scale 1), schreibt PNG-Bilder nach `promo/video/out/frames/`, danach ffmpeg:
  - MP4: `-c:v libx264 -pix_fmt yuv420p -crf 22 -preset slow -movflags +faststart`, 30 fps.
  - GIF: eigener Durchlauf im Teaser-Modus derselben Timeline (Szene 4 mit eigener, engerer Kamera auf Formular und Popup, Zoom etwa 1,4, Glow hinter dem Fenster reduziert), dann 960 × 540, 20 fps, Zweipass mit `palettegen`/`paletteuse` (Dithering `bayer:bayer_scale=3`). Überschreitet das GIF 5 MB, in dieser Reihenfolge reduzieren: 1. 15 fps, 2. Ausschnitt auf 9 s kürzen, 3. Palette ohne Dithering. Nie unter 960 px Breite, nie weichzeichnen.
- **Dauer:** rund 1 700 Bilder; Rendern etwa 2–4 Minuten. `promo/video/out/` ist gitignored.
- **README:** Teaser-GIF direkt unter der Überschrift, Alt-Text „Form Filler füllt ein Formular mit einem Klick“. Abschnitt „Video“ mit dem Player-Link (von Martin nach dem Upload eingetragen) und einer Zeile, wie man das Video neu rendert.

## 8. Vom Builder zu entscheiden

- Genaue Zeitpunkte und Dauern innerhalb der Richtwerte, nach Gefühl in der Vorschau.
- Reihenfolge und Gestaltung der Platzhalter-Icons in der Symbolleiste.
- Wie der Berechtigungsdialog angedeutet wird (vereinfachte Browser-Blase genügt; er muss nicht dem echten Dialog gleichen).
- Ob die Verwaltungsseite im Video 1:1 der echten Tabelle folgt oder auf die drei gezeigten Aktionen reduziert wird.
- Frame-Format beim Rendern (PNG oder JPEG), solange das Ergebnis frei von sichtbaren Artefakten bleibt.

## 9. Entscheidungen in diesem Konzept, die Martin nicht ausdrücklich getroffen hat

- Szene 1 („Das Problem“) als kurzer Einstieg vor den Funktionen.
- Die Länge von etwa 55 s und der Verzicht auf Ton.
- Das Nachbauen der Oberfläche mit den echten Tokens statt mit frei gezeichneten Mockups.
- GSAP + Playwright + ffmpeg als Werkzeugkette und Vite als Server für die Vorschau.
- Demo-App „Kundenportal“, die zwölf Felder und beide Datensätze.
- Zweites Füllen in Szene 4 als Bild für „nicht immer dieselben Daten“.
- Das Teaser-GIF zeigt nur den Füll-Moment, kein Intro, und bekommt eine eigene, engere Kamera, damit Popup und Status im README lesbar bleiben.
- „Code gewinnt“ bei Beschriftungen und Zuständen: grünes „✓“-Badge statt einer Zahl (eine Zahl bedeutet in der Erweiterung „Probleme“), Statuszeile und Buttons im echten Wortlaut, Kennung im echten Format.
