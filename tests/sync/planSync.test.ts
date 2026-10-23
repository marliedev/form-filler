import { describe, expect, it } from 'vitest'
import type { FieldRule, Template } from '../../src/model/types'
import { SourceError } from '../../src/sync/fetchSource'
import { applyPlan, copyName, fingerprintOf, planSync, summaryText } from '../../src/sync/planSync'

function field(id: string, patch: Partial<FieldRule> = {}): FieldRule {
  return { id, label: id.toUpperCase(), locator: { kind: 'text', name: id }, config: { type: 'companyName' }, slot: null, required: false, appendRunId: false, ...patch }
}

/** A template as the export file of the team holds it. */
function remote(id: string, name: string, fields: FieldRule[] = [field('a')]): Template {
  return { id, appId: 'file-app', name, process: null, fields, lastMissing: [] }
}

/** A local template synced earlier from `src` and untouched since. */
function synced(src: Template, id = `local-${src.id}`): Template {
  return { ...src, id, appId: 'local', lastMissing: [], source: { templateId: src.id, fingerprint: fingerprintOf(src) } }
}

const r1 = remote('src-1', 'Kunde')
const r2 = remote('src-2', 'Kontakt', [field('b')])

describe('fingerprintOf', () => {
  it('ignores key order, id, app, missing markers and source, but not field order or content', () => {
    const a = remote('x', 'Kunde', [field('a', { locator: { name: 'a', kind: 'text' } })])
    const b: Template = { ...remote('y', 'Kunde'), appId: 'other', lastMissing: ['a'], source: { templateId: 'q', fingerprint: 'f' } }
    expect(fingerprintOf(a)).toBe(fingerprintOf(b))
    expect(fingerprintOf(remote('x', 'Kunde', [field('a'), field('b')]))).not.toBe(fingerprintOf(remote('x', 'Kunde', [field('b'), field('a')])))
    expect(fingerprintOf(remote('x', 'Kunden'))).not.toBe(fingerprintOf(remote('x', 'Kunde')))
  })
})

describe('planSync', () => {
  it('creates templates that are new in the source', () => {
    const plan = planSync([], [r1, r2])
    expect(plan.actions).toEqual([{ kind: 'create', source: r1 }, { kind: 'create', source: r2 }])
    expect(plan.summary).toEqual({ created: 2, updated: 0, copied: 0, removed: 0 })
  })

  it('leaves a synced template alone while neither side changed', () => {
    const local = synced(r1)
    expect(planSync([local], [r1]).actions).toEqual([{ kind: 'unchanged', local }])
  })

  it('replaces a locally unchanged template when the source changed', () => {
    const local = synced(r1)
    const changed = remote('src-1', 'Kunde neu')
    const plan = planSync([local], [changed])
    expect(plan.actions).toEqual([{ kind: 'replace', local, source: changed }])
    expect(plan.summary).toEqual({ created: 0, updated: 1, copied: 0, removed: 0 })
  })

  it('keeps a locally changed template as a copy and takes the source version', () => {
    const local = { ...synced(r1), name: 'Kunde (meins)' }
    const plan = planSync([local], [r1])
    expect(plan.actions).toEqual([{ kind: 'copyAndReplace', local, source: r1 }])
    expect(plan.summary).toEqual({ created: 0, updated: 1, copied: 1, removed: 0 })
  })

  it('adopts an already imported template with the same id and content, copies it when the content differs', () => {
    const same: Template = { ...r1, appId: 'local' }
    expect(planSync([same], [r1]).actions).toEqual([{ kind: 'adopt', local: same, source: r1 }])
    const edited: Template = { ...same, fields: [field('z')] }
    expect(planSync([edited], [r1]).actions).toEqual([{ kind: 'copyAndReplace', local: edited, source: r1 }])
  })

  it('re-marks a locally edited template that now equals the source version instead of copying it', () => {
    // The maintainer edits, exports and uploads: the local edit and the new source version are the same.
    const edited = remote('src-1', 'Kunde neu')
    const local: Template = { ...edited, id: 'local-1', appId: 'local', source: { templateId: 'src-1', fingerprint: fingerprintOf(r1) } }
    const plan = planSync([local], [edited])
    expect(plan.actions).toEqual([{ kind: 'adopt', local, source: edited }])
    expect(plan.summary).toEqual({ created: 0, updated: 0, copied: 0, removed: 0 })
  })

  it('treats a detached template (address changed) like an imported one: re-adopts by file id, never removes', () => {
    const detached: Template = { ...synced(r1), source: { templateId: 'src-1', fingerprint: fingerprintOf(r1), detached: true } }
    expect(planSync([detached], [r1]).actions).toEqual([{ kind: 'adopt', local: detached, source: r1 }])
    const changed = remote('src-1', 'Kunde neu')
    expect(planSync([detached], [changed]).actions).toEqual([{ kind: 'copyAndReplace', local: detached, source: changed }])
    expect(planSync([detached], [r2]).actions).toEqual([{ kind: 'unchanged', local: detached }, { kind: 'create', source: r2 }])
  })

  it('removes synced templates gone from the source and keeps changed ones as a copy', () => {
    const gone = synced(r2)
    const changedGone = { ...synced(r2, 'local-2b'), name: 'Kontakt (meins)' }
    const plan = planSync([gone, changedGone], [r1])
    expect(plan.actions).toEqual([{ kind: 'remove', local: gone }, { kind: 'copyAndRemove', local: changedGone }, { kind: 'create', source: r1 }])
    expect(plan.summary).toEqual({ created: 1, updated: 0, copied: 1, removed: 2 })
  })

  it('never touches local-only templates', () => {
    const mine: Template = { id: 'mine', appId: 'local', name: 'Eigene', process: null, fields: [], lastMissing: [] }
    expect(planSync([mine], [r1]).actions).toEqual([{ kind: 'unchanged', local: mine }, { kind: 'create', source: r1 }])
  })

  it('refuses an empty source instead of removing everything', () => {
    expect(() => planSync([synced(r1)], [])).toThrow(new SourceError('Die Quelle enthält keine Vorlagen für diese App; nichts geändert.'))
  })
})

describe('applyPlan', () => {
  it('marks adopted templates (also detached ones) and gives created ones a new local id with the source marker', () => {
    const same: Template = { ...r1, appId: 'local' }
    const result = applyPlan(planSync([same], [r1, r2]), 'local')
    expect(result[0]).toEqual({ ...same, source: { templateId: 'src-1', fingerprint: fingerprintOf(r1) } })
    const detached: Template = { ...synced(r1), source: { templateId: 'src-1', fingerprint: 'old', detached: true } }
    expect(applyPlan(planSync([detached], [r1]), 'local')[0]?.source).toEqual({ templateId: 'src-1', fingerprint: fingerprintOf(r1) })
    expect(result[1]?.id).not.toBe('src-2')
    expect(result[1]).toMatchObject({ appId: 'local', name: 'Kontakt', fields: r2.fields, lastMissing: [], source: { templateId: 'src-2', fingerprint: fingerprintOf(r2) } })
  })

  it('replaces content under the local id and puts the copy next to it without a source marker', () => {
    const local = { ...synced(r1), name: 'Kunde (meins)', lastMissing: ['a'] }
    const changed = remote('src-1', 'Kunde neu', [field('n')])
    const result = applyPlan(planSync([local], [changed]), 'local')
    expect(result.map((t) => t.name)).toEqual(['Kunde neu', 'Kunde (meins) (lokal)'])
    expect(result[0]).toEqual({ ...local, name: 'Kunde neu', fields: changed.fields, lastMissing: [], source: { templateId: 'src-1', fingerprint: fingerprintOf(changed) } })
    expect(result[1]).toMatchObject({ appId: 'local', fields: local.fields, lastMissing: ['a'] })
    expect(result[1]).not.toHaveProperty('source')
    expect(result[1]?.id).not.toBe(local.id)
  })

  it('drops removed templates and keeps a changed one only as its copy', () => {
    const gone = synced(r2)
    const changedGone = { ...synced(r2, 'l2'), name: 'Kontakt (meins)' }
    const result = applyPlan(planSync([gone, changedGone, synced(r1)], [r1]), 'local')
    expect(result.map((t) => t.name)).toEqual(['Kontakt (meins) (lokal)', 'Kunde'])
    expect(result[0]).not.toHaveProperty('source')
  })

  it('serves two local apps from the same file without stealing templates', () => {
    const forStaging = applyPlan(planSync([], [r1]), 'staging')
    const forTest = applyPlan(planSync([], [r1]), 'test')
    expect(forStaging[0]?.id).not.toBe(forTest[0]?.id)
    expect(forStaging[0]?.appId).toBe('staging')
    expect(forTest[0]?.appId).toBe('test')
    // Each app's next sync sees only its own templates and finds nothing to do.
    expect(planSync(forStaging, [r1]).actions.map((a) => a.kind)).toEqual(['unchanged'])
  })
})

describe('copyName', () => {
  it('appends (lokal) and counts up while the name is taken', () => {
    expect(copyName('Kunde', ['Kunde'])).toBe('Kunde (lokal)')
    expect(copyName('Kunde', ['Kunde', 'Kunde (lokal)'])).toBe('Kunde (lokal 2)')
    expect(copyName('Kunde', ['Kunde', 'Kunde (lokal)', 'Kunde (lokal 2)'])).toBe('Kunde (lokal 3)')
  })
})

describe('summaryText', () => {
  it('names all four counts', () => {
    expect(summaryText({ created: 2, updated: 1, copied: 1, removed: 0 })).toBe('Abgeglichen: 2 neu, 1 aktualisiert, 1 lokal geändert (Kopie), 0 entfernt.')
  })
})
