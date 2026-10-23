# Changelog

Alle nennenswerten Änderungen der Erweiterung. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionsnummern nach [Semantic Versioning](https://semver.org/lang/de/). Jede Version lässt sich für Firefox nur einmal signieren, deshalb wird die Nummer vor jeder Verteilung erhöht.

## [0.2.0] – 2026-10-23

### Neu

- **Schnellfüllen ohne Vorlage.** „Ohne Vorlage füllen“ im Popup erkennt die Felder der Seite selbst und füllt sie sofort, ohne App und ohne Berechtigung; Kopf-, Fuß-, Navigations- und Suchbereiche sowie deaktivierte Felder bleiben außen vor. Eine zweite Adresse oder Person bekommt automatisch Slot B bzw. Person 2, Bestätigungsfelder („E-Mail wiederholen“) bleiben zusammen, Passwortfelder erhalten `Test1234!`, Auswahlfelder ohne passenden Vorschlag eine zufällige Option. „Als Vorlage speichern“ übernimmt die Erkennung in eine Vorlage und legt bei Bedarf die App mit an; nicht gefundene Felder sind darin als fehlend markiert.
- **Web-Components und eingebettete Formulare.** Felder in offenem Shadow DOM und in iframes derselben Adresse werden aufgenommen, wiedergefunden und gefüllt. Name, Label, Placeholder, `autocomplete` und Pflichtkennzeichen werden vom Komponenten-Wirt übernommen (Ionic, Vaadin, UI5 und ähnliche), ein äußeres `<label for>` auf den Wirt gilt für das Feld darin. Vorlagen merken sich den Ort eines Feldes; bestehende Vorlagen und Exporte funktionieren unverändert.
- **Auswahl-Buttons.** Buttons mit `aria-haspopup="listbox"` (Headless UI, Nuxt UI, Radix) gelten als Auswahlfeld; ihre Einträge werden auch ohne `aria-controls` gefunden, ebenso bei ARIA-Comboboxen ohne Verweis auf ihre Liste.
- **Mitdenkendes Tastenkürzel.** Alt+Shift+F nimmt auf einer Seite mit erkannter App deren einzige Vorlage, bei Prozessen den nächsten Schritt (nach dem letzten wieder den ersten), sonst die zuletzt genutzte Vorlage der App. Ohne erkannte App oder ohne Vorlage füllt es die Seite ohne Vorlage.
- **Datensatz im Popup.** Kennung, Firma und Person des aktiven Datensatzes stehen unter dem Umfang-Schalter, „Neuer Datensatz“ direkt daneben.
- **Vorlage duplizieren** im Pflege-Tab, mit neuen Feld-IDs und ohne Fehlend-Markierungen.
- **Versionsanzeige** in Popup und Pflege-Tab.
- **Browsertest** mit Playwright (`npm run test:e2e`) gegen die lokale Testseite: Füllen aller Feldarten, Nur-Pflicht-Modus, Datensatz über zwei Prozessschritte, fehlende Felder, Aufnahme per Klick, Schnellfüllen, Web-Components und Rahmen.

### Geändert

- Telefon- und Mobilnummern stammen aus den Rufnummernblöcken, die die Bundesnetzagentur für Medienproduktionen reserviert; BIC und Bankname sind echte Paare deutscher Banken.
- Füll-Ereignisse dringen aus Web-Components heraus (`composed`), damit Bindungen am Wirt den Wert sehen.
- „Neuer Datensatz“ ist aus dem ⋯-Menü der Vorlagen in die Datensatz-Zeile gewandert.
- Testseite: Web-Components „Kostenstelle“ und „Bestellnummer“, Rahmen „Lieferadresse“ und Auswahl-Button „Anliegen“.

### Behoben

- Radiogruppen gleichen Namens in Rahmen oder Komponenten wurden übersehen oder ins Hauptdokument gefüllt.
- Nach „Übernehmen“ in Komponenten und Rahmen sprang der Fokus auf „Speichern“ statt zurück ins Feld.
- Das Tastenkürzel füllte auf Seiten ohne erkannte App die zuletzt genutzte Vorlage statt ohne Vorlage.

## [0.1.0] – 2026-10-22

Erste Version: Vorlagen per Aufnahme, Füllen mit realistischen deutschen Testdaten, zusammenhängende Datensätze über mehrere Prozessschritte, Modus „Nur Pflicht“, Pflege-Tab mit Export und Import, Tastenkürzel Alt+Shift+F, Firefox-Build mit Signierung für die Verteilung im Team, Icon und Produktvideo.
