/* Shared helpers for tests that build open shadow roots and same-origin frames in happy-dom. */

export function q<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector)
  if (!el) throw new Error(`missing ${selector}`)
  return el
}

/** Attaches an open shadow root with `html` to `host`. */
export function shadow(host: Element, html: string): ShadowRoot {
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = html
  return root
}

/** Appends an `<iframe srcdoc>` to `parent` and waits until its document is available. */
export async function frame(html: string, attrs = '', parent: Element = document.body): Promise<HTMLIFrameElement> {
  parent.insertAdjacentHTML('beforeend', `<iframe ${attrs} srcdoc="${html.replace(/"/g, '&quot;')}"></iframe>`)
  const el = parent.lastElementChild as HTMLIFrameElement
  await new Promise((resolve) => setTimeout(resolve, 0))
  if (!el.contentDocument?.body) throw new Error('frame did not load')
  return el
}

/** The document of a loaded frame. */
export function frameDoc(el: HTMLIFrameElement): Document {
  const doc = el.contentDocument
  if (!doc) throw new Error('frame has no document')
  return doc
}
