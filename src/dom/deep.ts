/* Reaches the parts of a page a content script can see beyond its own document: open shadow
   roots and frames of the same origin. Pure DOM, no extension APIs. Nodes in a frame belong to
   another realm, so checks use tag names and node types instead of `instanceof`. */

export type Root = Document | ShadowRoot

function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && 'host' in node
}

function isFrame(el: Element): el is HTMLIFrameElement {
  return el.localName === 'iframe'
}

/** The frame's document, or null when the browser refuses access (another origin). */
function frameDocument(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument
  } catch {
    return null
  }
}

/** Document or shadow root the element lives in: where its labels and ids are looked up. */
export function rootOf(el: Element): Root {
  const root = el.getRootNode()
  return isShadowRoot(root) ? root : el.ownerDocument
}

/** Element by id within one tree; shadow roots have no getElementById in every engine. */
export function byId(root: Root, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`)
}

/** Host of the shadow root the element lives in, null in a document. */
export function hostOf(el: Element): Element | null {
  const root = el.getRootNode()
  return isShadowRoot(root) ? root.host : null
}

/** The `iframe` element whose document contains the node, null in the top document. */
export function frameElementOf(node: Node): HTMLIFrameElement | null {
  const doc = node.nodeType === Node.DOCUMENT_NODE ? (node as Document) : node.ownerDocument
  const win = doc?.defaultView
  if (!doc || !win) return null
  try {
    const direct = win.frameElement
    if (direct && isFrame(direct)) return direct
    // Engines without frameElement (test DOMs): the parent document's frame that holds this document.
    const parent = win.parent
    if (!parent || parent === win) return null
    const found = deepQuerySelectorAll(parent.document, 'iframe').find((el) => isFrame(el) && frameDocument(el) === doc)
    return found && isFrame(found) ? found : null
  } catch {
    return null
  }
}

/** Next element upwards, continuing at the shadow host or the frame element where `parentElement` ends. */
export function parentOf(el: Element): Element | null {
  return el.parentElement ?? hostOf(el) ?? frameElementOf(el)
}

/** Like `closest`, but continues at shadow hosts and frame elements. */
export function deepClosest(el: Element, selector: string): Element | null {
  for (let node: Element | null = el; node; node = hostOf(node) ?? frameElementOf(node)) {
    const hit = node.closest(selector)
    if (hit) return hit
  }
  return null
}

function isFollowing(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

function collect(root: ParentNode, selector: string, out: Element[]): void {
  // Matches come from the engine; hosts and frames need a walk, but only cheap property checks.
  const matches = Array.from(root.querySelectorAll(selector))
  const nested = Array.from(root.querySelectorAll('*')).filter((el) => el.shadowRoot !== null || isFrame(el))
  // A frame or host can match the selector itself; the set keeps it from being visited twice.
  const ordered = [...new Set([...matches, ...nested])].sort((a, b) => (isFollowing(a, b) ? -1 : 1))
  for (const el of ordered) {
    if (matches.includes(el)) out.push(el)
    if (el.shadowRoot) collect(el.shadowRoot, selector, out)
    if (isFrame(el)) {
      const doc = frameDocument(el)
      if (doc) collect(doc, selector, out)
    }
  }
}

/**
 * `querySelectorAll` across open shadow roots and accessible frames, in document order: the
 * content of a host or frame follows its host or frame element.
 */
export function deepQuerySelectorAll(root: ParentNode, selector: string): Element[] {
  const out: Element[] = []
  collect(root, selector, out)
  return out
}

/** All accessible frame documents below `root`, recursively, in document order. */
export function frameDocuments(root: ParentNode): Document[] {
  const docs: Document[] = []
  for (const el of deepQuerySelectorAll(root, 'iframe')) {
    if (!isFrame(el)) continue
    const doc = frameDocument(el)
    if (doc) docs.push(doc)
  }
  return docs
}

function hostEntry(host: Element): string {
  return host.id ? `${host.localName}#${host.id}` : host.localName
}

function frameEntry(frame: HTMLIFrameElement): string {
  return `iframe:${frame.getAttribute('name') || frame.getAttribute('title') || frame.id || ''}`
}

/** Chain of boundaries from the top document down to the element: `iframe:<name>` and `<tag>#<id>` entries. */
export function scopeOf(el: Element): string[] {
  const chain: string[] = []
  for (let node: Element | null = el; node; ) {
    const host = hostOf(node)
    if (host) {
      chain.unshift(hostEntry(host))
      node = host
      continue
    }
    const frame = frameElementOf(node)
    if (frame) {
      chain.unshift(frameEntry(frame))
      node = frame
      continue
    }
    node = null
  }
  return chain
}

/** Bounding rect relative to the top document's viewport: adds the offsets of enclosing frames. */
export function viewportRect(el: Element): DOMRect {
  const own = el.getBoundingClientRect()
  let left = own.left
  let top = own.top
  for (let frame = frameElementOf(el); frame; frame = frameElementOf(frame)) {
    const rect = frame.getBoundingClientRect()
    left += rect.left
    top += rect.top
  }
  const { width, height } = own
  return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({ left, top, width, height }) } as DOMRect
}
