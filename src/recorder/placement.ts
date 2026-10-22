import type { CSSProperties } from 'vue'

export const POPOVER_WIDTH = 304
const GAP = 8
/** Keeps the popover clear of the bottom bar. */
const BAR_SPACE = 72
/** Room for type, options and buttons without scrolling in the common case. */
export const POPOVER_MIN_HEIGHT = 360

interface Box {
  top: number
  bottom: number
  left: number
}

/**
 * Opens below the field when there is enough room, otherwise on the roomier side. It never gets
 * shorter than POPOVER_MIN_HEIGHT (or the usable viewport, if that is smaller): covering part of
 * the field beats squeezing the form until its buttons scroll away.
 */
export function popoverPlacement(rect: Box, vw: number, vh: number): CSSProperties {
  const left = Math.min(Math.max(rect.left, GAP), Math.max(GAP, vw - POPOVER_WIDTH - GAP))
  const usable = vh - BAR_SPACE - GAP
  const minHeight = Math.min(POPOVER_MIN_HEIGHT, usable)
  const spaceBelow = vh - BAR_SPACE - rect.bottom - GAP
  const spaceAbove = rect.top - 2 * GAP
  if (spaceBelow >= POPOVER_MIN_HEIGHT || spaceBelow >= spaceAbove) {
    const top = Math.max(GAP, Math.min(rect.bottom + GAP, vh - BAR_SPACE - minHeight))
    return { top: `${top}px`, left: `${left}px`, maxHeight: `${vh - BAR_SPACE - top}px` }
  }
  const bottom = Math.max(BAR_SPACE, Math.min(vh - rect.top + GAP, vh - GAP - minHeight))
  return { bottom: `${bottom}px`, left: `${left}px`, maxHeight: `${vh - bottom - GAP}px` }
}
