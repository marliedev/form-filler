import type { AppDef } from '../model/types'

function toRegExp(pattern: string): RegExp {
  const body = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}$`)
}

/** Specificity of a pattern: the number of literal (non-wildcard) characters. */
function specificity(pattern: string): number {
  return pattern.replace(/\*/g, '').length
}

/** Returns the app whose most specific matching pattern beats all others; ties keep list order. */
export function matchApp(url: string, apps: AppDef[]): AppDef | null {
  let best: AppDef | null = null
  let bestScore = -1
  for (const app of apps) {
    for (const pattern of app.urlPatterns) {
      if (!toRegExp(pattern).test(url)) continue
      const s = specificity(pattern)
      if (s > bestScore) {
        best = app
        bestScore = s
      }
    }
  }
  return best
}
