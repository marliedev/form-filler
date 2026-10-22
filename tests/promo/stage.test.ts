import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FIELDS } from '../../promo/video/data'
import { renderStage } from '../../promo/video/stage'

const html = renderStage()

/** Visible wording, whitespace collapsed, so nested spans (e.g. a coloured check mark) do not matter. */
function visibleText(markup: string): string {
  const host = document.createElement('div')
  host.innerHTML = markup
  return (host.textContent ?? '').replace(/\s+/g, ' ')
}

describe('renderStage', () => {
  it('contains every field label and the real extension wording', () => {
    const text = visibleText(html)
    for (const f of FIELDS) expect(text).toContain(f.label)
    for (const s of [
      'An der Adresse erkannt', 'Neue App für diese Seite', 'App anlegen', '+ Neue Vorlage', 'Füllen',
      'Anlegen und Felder aufnehmen', 'Aufnahme', 'Beenden', 'Speichern', 'Übernehmen', '✓ Vorlage gespeichert',
      'Pflichtfeld', 'Kennung anhängen', 'Exportieren', 'github.com/marliedev/form-filler', '© 2026 Martin Liesche',
    ]) expect(text).toContain(s)
  })

  it('addresses every animated element by data-el', () => {
    for (const el of [
      'glow', 'window', 'browser', 'url', 'page', 'veil', 'popup', 'popup-noapp', 'popup-app', 'status', 'popover',
      'bar', 'saved', 'permission', 'manage', 'band', 'intro', 'icon-liquid', 'title', 'claim', 'by', 'outro',
      'captions', 'caption-title', 'caption-sub', 'cursor', 'ripple', 'keys', 'badge', 'toolbar-icon',
    ]) expect(html).toContain(`data-el="${el}"`)
    for (const f of FIELDS) {
      expect(html).toContain(`data-field="${f.key}"`)
      expect(html).toContain(`data-captured="${f.key}"`)
    }
    for (const key of ['alt', 'shift', 'f']) expect(html).toContain(`data-key="${key}"`)
  })

  it('never uses time-dependent CSS', () => {
    expect(html).not.toMatch(/\b(transition|animate-|duration-)/)
    const css = readFileSync('promo/video/styles.css', 'utf8')
    expect(css).not.toMatch(/transition|@keyframes/)
  })
})
