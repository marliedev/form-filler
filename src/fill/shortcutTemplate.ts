import type { Template } from '../model/types'

function stepOf(t: Template): number {
  return t.process?.step ?? 0
}

/**
 * Template the shortcut fills on a page of a known app, given the app's templates in list order
 * and the template used last (from any app): the only candidate; the next step of the process
 * used last, starting over after its last step; the last used one when it has no process;
 * otherwise the first candidate.
 */
export function chooseShortcutTemplate(candidates: readonly Template[], last: Template | null): Template | null {
  const first = candidates[0]
  if (first === undefined) return null
  if (candidates.length === 1) return first
  if (last === null || !candidates.some((t) => t.id === last.id)) return first
  const process = last.process
  if (process === null) return last
  const steps = candidates
    .filter((t) => t.process?.name === process.name)
    .sort((a, b) => stepOf(a) - stepOf(b))
  return steps.find((t) => stepOf(t) > process.step) ?? steps[0] ?? last
}
