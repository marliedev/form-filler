# Daten

## plz-de.json

Deutsche Postleitzahlen mit Ortsnamen als `[PLZ, Ort][]`, dedupliziert (16.480 Einträge).

- Quelle: GeoNames Postal Codes, <https://download.geonames.org/export/zip/DE.zip>
- Lizenz: Creative Commons Attribution 4.0 (<https://creativecommons.org/licenses/by/4.0/>)
- Attribution: Postleitzahlen-Daten von GeoNames, <https://www.geonames.org>
- Abrufdatum: 2026-10-21
- Erzeugung: `npx tsx scripts/build-plz.ts <pfad/zu/DE.txt>`. Einträge mit rein numerischem Bundesland-Code (Großkunden-PLZ von Firmen und Behörden) werden verworfen, da der "Ort" dort kein Ortsname ist.
