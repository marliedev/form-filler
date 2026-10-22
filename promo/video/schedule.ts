export type SceneId = 'intro' | 'problem' | 'detect' | 'record' | 'fill' | 'shortcut' | 'manage' | 'outro'

/** Scene order and durations in seconds (spec §4); starts are derived, never typed by hand. */
export const SCENES: readonly { id: SceneId; duration: number }[] = [
  { id: 'intro', duration: 6 },
  { id: 'problem', duration: 5 },
  { id: 'detect', duration: 8 },
  { id: 'record', duration: 14 },
  { id: 'fill', duration: 10 },
  { id: 'shortcut', duration: 5 },
  { id: 'manage', duration: 5 },
  { id: 'outro', duration: 4 },
]

export function sceneStart(id: SceneId): number {
  let start = 0
  for (const scene of SCENES) {
    if (scene.id === id) return start
    start += scene.duration
  }
  throw new Error(`unknown scene ${id}`)
}

export function sceneDuration(id: SceneId): number {
  const scene = SCENES.find((s) => s.id === id)
  if (!scene) throw new Error(`unknown scene ${id}`)
  return scene.duration
}

export const TOTAL: number = SCENES.reduce((sum, s) => sum + s.duration, 0)

/** The README teaser is its own short timeline, not a cut of the full one. */
export const TEASER_DURATION = 11
