import { afterEach, describe, expect, it } from 'vitest'
import { applyLocalTheme, localThemeCss } from '../../src/theme/localTheme'

describe('applyLocalTheme', () => {
  afterEach(() => {
    document.head.querySelectorAll('style[data-theme="local"]').forEach((el) => el.remove())
  })

  it('adds nothing when there is no local override', () => {
    applyLocalTheme(document, '')
    expect(document.head.querySelector('style[data-theme="local"]')).toBeNull()
  })

  it('appends the override after the existing styles', () => {
    const bundled = document.createElement('style')
    document.head.append(bundled)
    applyLocalTheme(document, ':root { --color-brand: #000; }')
    const style = document.head.lastElementChild
    expect(style?.getAttribute('data-theme')).toBe('local')
    expect(style?.textContent).toBe(':root { --color-brand: #000; }')
    bundled.remove()
  })

  it('is empty in the repository, where theme.local.css is gitignored', () => {
    expect(localThemeCss).toBe('')
  })
})
