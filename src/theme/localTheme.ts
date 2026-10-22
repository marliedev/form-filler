// theme.local.css is optional and gitignored: the glob simply matches nothing when it is absent,
// whereas a plain import would fail the build.
const modules = import.meta.glob<string>('./theme.local.css', { eager: true, query: '?inline', import: 'default' })

/** Contents of the local theme override, or '' when there is none. */
export const localThemeCss: string = Object.values(modules).join('\n')

/** Appends the local override after the bundled styles so its variables win. */
export function applyLocalTheme(doc: Document = document, css: string = localThemeCss): void {
  if (!css) return
  const style = doc.createElement('style')
  style.dataset.theme = 'local'
  style.textContent = css
  doc.head.append(style)
}
