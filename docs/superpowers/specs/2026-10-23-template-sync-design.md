# Vorlagen im Team abgleichen – Design

Stand: 2026-10-23. Produktentscheidungen: Die gemeinsame Datei ist ohne Anmeldung erreichbar (Option A); beim Abgleich gewinnt die Quelle, lokal geänderte Fassungen bleiben als Kopie erhalten (Option A).

## Absicht

Ein Team testet dieselben Anwendungen. Heute wandern Vorlagen als Export-Datei von Hand durchs Team; wer eine Vorlage verbessert, muss alle anderen versorgen. Mit einer Vorlagen-Quelle je App pflegt eine Person die Datei, alle anderen drücken „Abgleichen“.

## Ziele

- Jede App kann eine **Vorlagen-Quelle** haben: die Adresse einer Export-Datei im bekannten Format (wie „Exportieren“ sie erzeugt). Die Adresse wird in den App-Einstellungen des Pflege-Tabs gepflegt.
- **Abgleichen** je App und **Alle abgleichen** im Pflege-Tab holen die Datei und bringen die Vorlagen der App auf den Stand der Quelle: neue werden angelegt, geänderte ersetzt, in der Quelle entfernte werden lokal entfernt.
- Lokal geänderte abgeglichene Vorlagen gehen nicht verloren: Ihre Fassung bleibt als Kopie „… (lokal)“ bestehen, die Fassung der Quelle kommt daneben.
- Das Ergebnis ist in einem Satz sichtbar: „Abgeglichen: 2 neu, 1 aktualisiert, 1 lokal geändert (Kopie), 0 entfernt.“
- Die Berechtigung des Browsers wird nur für die Adresse der Quelle angefragt, beim Speichern der Adresse, mit der Nutzergeste des Klicks.

## Nicht-Ziele

- Kein automatischer Abgleich im Hintergrund; Abgleich nur auf Knopfdruck. (Später denkbar: beim Öffnen des Pflege-Tabs.)
- Keine Quellen hinter einer Anmeldung; ein Abruf, der HTML statt JSON liefert (Login-Seite), scheitert mit einer verständlichen Meldung.
- Kein Hochladen aus der Erweiterung in die Quelle; die Quelle wird mit „Exportieren“ und den Mitteln des Teams gepflegt.
- Keine Zusammenführung auf Feldebene; eine Vorlage wird als Ganzes ersetzt.
- Keine Freigabe-Seiten als Quelle: Die Adresse muss die Datei selbst liefern (Raw- oder Download-Adresse). Liefert sie eine Webseite oder leitet sie auf einen anderen Host weiter, scheitert der Abgleich mit dem Hinweis, die direkte Download-Adresse einzutragen. Die README nennt das mit Beispielen (GitHub „Raw“, Nextcloud/SharePoint „Direktlink“).

## Anti-Ziele

- Ein Abgleich darf nie eine Vorlage löschen oder überschreiben, die lokal verändert wurde, ohne dass die lokale Fassung als Kopie erhalten bleibt.
- Lokal angelegte Vorlagen (ohne Quelle) werden vom Abgleich nicht angefasst.
- Ein fehlgeschlagener Abruf ändert nichts.
- Ein Abgleich löscht nie alle Vorlagen einer App auf einen Schlag: Fehlt die zugeordnete App in der Datei oder hat sie dort keine Vorlagen mehr, bricht der Abgleich mit einer Meldung ab und ändert nichts.

## Ablauf aus Nutzersicht

1. Pflege-Tab, App-Einstellungen: Feld „Vorlagen-Quelle (Adresse)“, daneben „Speichern“ wie bisher. Beim Speichern fragt der Browser die Berechtigung für die Adresse ab (einmalig). Mit gesetzter Quelle erscheint der Knopf **„Abgleichen“** neben den App-Einstellungen; in der Kopfzeile des Pflege-Tabs gibt es **„Alle abgleichen“**, sobald mindestens eine App eine Quelle hat.
2. Erster Abgleich: Die Datei enthält Apps und Vorlagen des Herausgebers. Welche App der Datei zur lokalen App gehört, ergibt sich aus dem URL-Muster (gleiches Muster), sonst aus der einzigen App in der Datei; passt beides nicht, nennt die Meldung die Apps der Datei, und die Quelle bleibt ohne Zuordnung, bis die Adresse auf eine passende Datei zeigt. Die Zuordnung wird an der lokalen App gespeichert; lokale Kennung, Berechtigung und URL-Muster der App bleiben unberührt.
3. Jeder weitere Abgleich: Vorlagen der zugeordneten App aus der Datei werden mit den lokalen abgeglichenen Vorlagen dieser App verglichen (Kennung der Vorlage in der Datei). Neu → angelegt. Geändert in der Quelle, lokal unverändert → ersetzt. Lokal verändert → lokale Fassung wird zur Kopie „… (lokal)“ ohne Quellen-Kennzeichen, die Fassung der Quelle ersetzt das Original. In der Quelle nicht mehr vorhanden → lokal entfernt, bei lokaler Änderung stattdessen zur Kopie „… (lokal)“.
   - **Bereits importierte Vorlagen** (gleiche Kennung wie in der Datei, aber ohne Quellen-Kennzeichen, etwa aus einem früheren Import oder bei der Person, die die Datei pflegt) werden übernommen: gleicher Inhalt → nur gekennzeichnet; anderer Inhalt → lokale Fassung wird zur Kopie „… (lokal)“, die Fassung der Quelle ersetzt sie. Nichts geht verloren. Meine Festlegung.
   - **Dieselbe Datei für mehrere lokale Apps** (Test- und Staging-Umgebung) ist erlaubt: Abgeglichene Vorlagen bekommen lokal eine eigene Kennung und merken sich die Kennung aus der Datei; zwei Apps mit derselben Quelle stehlen sich keine Vorlagen. Meine Festlegung.
   - **Adresse geändert oder geleert:** Beim Speichern einer anderen oder leeren Adresse verlieren die Vorlagen der App ihr Quellen-Kennzeichen (sie bleiben als lokale Vorlagen erhalten), und die Zuordnung wird zurückgesetzt. Der nächste Abgleich gegen die neue Datei behandelt sie wie bereits importierte Vorlagen. So kann ein Umzug der Datei nie Vorlagen löschen. Meine Festlegung.
   - **Schutz vor Massenlöschung:** Fehlt die zugeordnete App in der Datei (etwa weil versehentlich eine andere App exportiert wurde) oder enthält sie dort keine Vorlagen, bricht der Abgleich ab: „Die Quelle enthält die zugeordnete App nicht mehr (Kennung …). Quelle prüfen; nichts geändert.“ Eine Neuzuordnung passiert nur nach Adresswechsel. Meine Festlegung.
4. Statuszeile nennt das Ergebnis; die Vorlagenliste zeigt abgeglichene Vorlagen mit einem kleinen Hinweis „Quelle“.
5. „Neuer Datensatz“, Füllen, Aufnahme: unverändert. Eine abgeglichene Vorlage lässt sich wie jede andere bearbeiten; die Änderung bleibt bis zum nächsten Abgleich und wird dann zur Kopie.

## Technische Festlegungen

- Datenmodell: `AppDef.source?: { url: string; appId: string | null }` (Adresse, Kennung der App in der Datei, `null` bis zur ersten Zuordnung). `Template.source?: { templateId: string; fingerprint: string }` markiert abgeglichene Vorlagen: Kennung der Vorlage in der Datei und Fingerabdruck (`JSON.stringify` von Name, Prozess und Feldern der Fassung aus der Quelle). Die lokale Kennung der Vorlage ist davon unabhängig; neu angelegte abgeglichene Vorlagen bekommen eine neue, übernommene behalten ihre. „Lokal verändert“ heißt: aktueller Fingerabdruck ≠ gespeicherter. Schema (`src/model/schema.ts`) nimmt beide Felder optional auf; **Exportieren** und **Duplizieren** lassen `source` weg, damit eine exportierte Datei als Quelle taugt und Kopien lokal sind.
- Reine Funktion `planSync(local: Template[], remote: Template[]): SyncPlan` in `src/sync/planSync.ts`: `local` sind alle Vorlagen der lokalen App, `remote` die der zugeordneten App aus der Datei. Zuordnung lokal ↔ Datei über `source.templateId`, ersatzweise über gleiche Kennung (bereits importiert). Aktionen `adopt` (nur kennzeichnen), `create`, `replace`, `copyAndReplace`, `remove`, `copyAndRemove`, `unchanged`, dazu die Zusammenfassung für die Statuszeile; die Kopie heißt `<Name> (lokal)` (bei Wiederholung `(lokal 2)` usw.) mit neuer Kennung, ohne `source`, mit den Feldern und `lastMissing` der lokalen Fassung. Eine lokal geänderte Vorlage, deren Inhalt der neuen Fassung der Quelle gleicht (die pflegende Person hat ihre Änderung exportiert), wird nur neu gekennzeichnet, nicht kopiert. Leeres `remote` oder fehlende App → kein Plan, sondern Fehler. Festlegung nach dem Review: Beim Adresswechsel wird das Kennzeichen nicht entfernt, sondern als `detached` markiert (die Kennung aus der Datei bleibt bekannt, die Vorlage zählt nicht mehr als abgeglichen, kein Hinweis „Quelle“); der nächste Abgleich übernimmt solche Vorlagen über die Kennung wieder (gleicher Inhalt → kennzeichnen, anderer → Kopie) und entfernt sie nie. Ohne die Kennung entstünde nach jedem Umzug der Datei ein Duplikat je Vorlage. App und Vorlagen werden beim Adresswechsel und beim Abgleich in einem Schreibvorgang gespeichert (`saveAppWithTemplates`), damit kein halber Zustand entsteht. `src/sync/fetchSource.ts` holt die Datei (`fetch` mit `redirect: 'follow'`, Timeout 15 s, Größe höchstens 5 MB; Antwort, die nicht als JSON lesbar ist oder nicht dem Export-Schema entspricht → Meldung „Die Adresse liefert keine Form-Filler-Export-Datei. Bei Freigabe-Links die direkte Download-Adresse eintragen.“; Weiterleitung auf einen anderen Host → „Die Adresse leitet auf <Host> weiter. Bitte die direkte Download-Adresse eintragen.“; vom Browser blockierter Abruf (keine Berechtigung für den Weiterleitungs-Host, DNS, offline; der Browser nennt das Ziel nicht) → „Quelle nicht erreichbar. Bei Freigabe-Links die direkte Download-Adresse eintragen.“; Fehlerstatus → „Quelle nicht erreichbar.“). `src/sync/sync.ts` orchestriert je App: holen, App zuordnen, planen, speichern (serialisiert wie die übrigen Schreibvorgänge im Pflege-Tab).
- Berechtigung: `browser.permissions.request({ origins: [origin + '/*'] })` beim Speichern der Quelle, vor dem ersten `await` (Nutzergeste), wie bei „App anlegen“; ohne Zusage wird die Quelle nicht gespeichert. `http://` und `https://` sind erlaubt; andere Schemata werden abgewiesen.
- `useManage`: `saveApp` nimmt `source.url` mit und setzt bei geänderter oder geleerter Adresse die Zuordnung zurück und entfernt die Kennzeichen der Vorlagen dieser App; `syncApp(id)`, `syncAll()` (je App eigenes Ergebnis, Fehler einer App stoppen die anderen nicht), Ergebnis in `notice`, Fehler in `error` mit deutschem Text („Quelle nicht erreichbar“, „Die Adresse liefert keine Form-Filler-Export-Datei …“, „Keine passende App in der Datei: …“, „Die Quelle enthält die zugeordnete App nicht mehr …“).
- Pflege-Tab: Feld in `AppList.vue` (App-Einstellungen), Knopf „Abgleichen“ dort, „Alle abgleichen“ in `entrypoints/manage/App.vue`, Hinweis „Quelle“ in der Vorlagenliste.
- Tests: `planSync` vollständig (alle Aktionen inkl. Übernahme bereits importierter Vorlagen, Fingerabdruck, Namensvergabe der Kopie, zwei lokale Apps mit derselben Datei, leeres `remote`), `fetchSource` mit gemocktem `fetch` (ungültiges JSON, HTML, zu groß, Timeout), `useManage` (Zuordnung über Muster, einzige App, keine Zuordnung, App fehlt in der Datei, Adresswechsel entfernt Kennzeichen; Berechtigung verweigert), Pflege-Tab-Komponente; Browsertest: die Testseite liefert eine Export-Datei unter `/templates.json`, App mit Quelle anlegen, „Abgleichen“ im Pflege-Tab, Vorlagen erscheinen; Datei ändern, erneut abgleichen, lokale Änderung wird zur Kopie.

## Aufwand

Drei Tickets: (1) Datenmodell, `planSync`, `fetchSource`; (2) Abgleich in `useManage` mit Berechtigung, Zuordnung und Adresswechsel; (3) Pflege-Tab, Browsertest, README mit Hinweisen zu Raw- und Direktlinks.
