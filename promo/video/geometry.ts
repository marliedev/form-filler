/* Stage coordinates of everything the cursor visits. Measured once, before any tween exists:
   GSAP applies fromTo/set start values immediately, so measuring later would read a moved DOM. */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** One layout state to measure in: which hidden elements to show (and how) and which to hide. */
export interface MeasurePass {
  show?: readonly [selector: string, display: string][]
  hide?: readonly string[]
  selectors: readonly string[]
}

export class Geometry {
  private readonly rects = new Map<string, Rect>()

  constructor(private readonly root: HTMLElement) {}

  /** Rect of the first match, relative to the stage; zero-sized when the element is missing. */
  rect(selector: string): Rect {
    const cached = this.rects.get(selector)
    if (cached) return cached
    const el = this.root.querySelector<HTMLElement>(selector)
    const origin = this.root.getBoundingClientRect()
    const r = el?.getBoundingClientRect()
    const rect: Rect = r
      ? { x: r.left - origin.left, y: r.top - origin.top, width: r.width, height: r.height }
      : { x: 0, y: 0, width: 0, height: 0 }
    this.rects.set(selector, rect)
    return rect
  }

  /** A point inside a rect, by fractions of its width and height (defaults to the centre). */
  point(selector: string, fx = 0.5, fy = 0.5): Point {
    const r = this.rect(selector)
    return { x: r.x + r.width * fx, y: r.y + r.height * fy }
  }

  field(key: string, fx = 0.5, fy = 0.5): Point {
    return this.point(`[data-field=${key}]`, fx, fy)
  }
}

/** Measures each pass in its own layout state and restores the DOM afterwards. */
export function measure(root: HTMLElement, passes: readonly MeasurePass[]): Geometry {
  const geo = new Geometry(root)
  for (const pass of passes) {
    const restore: (() => void)[] = []
    const toggle = (selector: string, display: string): void => {
      const el = root.querySelector<HTMLElement>(selector)
      if (!el) return
      const previous = el.style.display
      el.style.display = display
      restore.push(() => { el.style.display = previous })
    }
    for (const [selector, display] of pass.show ?? []) toggle(selector, display)
    for (const selector of pass.hide ?? []) toggle(selector, 'none')
    for (const selector of pass.selectors) geo.rect(selector)
    for (const undo of restore.reverse()) undo()
  }
  return geo
}

/** Where a stage point ends up once the window layer is scaled around `origin`. */
export function zoomed(p: Point, origin: Point, scale: number): Point {
  return { x: origin.x + (p.x - origin.x) * scale, y: origin.y + (p.y - origin.y) * scale }
}
