import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deepClosest, deepQuerySelectorAll, frameDocuments, frameElementOf, hostOf, rootOf, scopeOf, viewportRect } from '../../src/dom/deep'
import { frame, frameDoc, q, shadow } from './deepHelpers'

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) } as DOMRect
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('deepQuerySelectorAll', () => {
  it('walks shadow roots and same-origin frames in document order', async () => {
    document.body.innerHTML = '<input name="a"><x-host></x-host><input name="d">'
    const outer = shadow(q('x-host'), '<input name="b"><y-host></y-host>')
    shadow(q('y-host', outer), '<input name="c">')
    await frame('<input name="e">')
    expect(deepQuerySelectorAll(document, 'input').map((el) => el.getAttribute('name'))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('skips frames whose document is not accessible', async () => {
    document.body.innerHTML = '<input name="a">'
    const foreign = await frame('<input name="x">')
    Object.defineProperty(foreign, 'contentDocument', { get: () => { throw new Error('cross-origin') } })
    expect(deepQuerySelectorAll(document, 'input').map((el) => el.getAttribute('name'))).toEqual(['a'])
  })
})

describe('rootOf, hostOf, frameElementOf', () => {
  it('report the tree, the shadow host and the frame element of a node', async () => {
    document.body.innerHTML = '<x-host></x-host><input name="main">'
    const root = shadow(q('x-host'), '<input name="inner">')
    const inner = q('input', root)
    expect(rootOf(inner)).toBe(root)
    expect(hostOf(inner)).toBe(q('x-host'))
    expect(frameElementOf(inner)).toBeNull()
    const main = q('input[name="main"]')
    expect(rootOf(main)).toBe(document)
    expect(hostOf(main)).toBeNull()
    const f = await frame('<input name="framed">', 'name="delivery"')
    const framed = q('input', frameDoc(f))
    expect(frameElementOf(framed)).toBe(f)
    expect(rootOf(framed)).toBe(frameDoc(f))
  })
})

describe('scopeOf', () => {
  it('names frames by name, title or id and hosts by tag and id', async () => {
    document.body.innerHTML = '<input name="main"><wc-input id="po"></wc-input><wc-text-field></wc-text-field>'
    expect(scopeOf(q('input[name="main"]'))).toEqual([])
    expect(scopeOf(q('input', shadow(q('wc-input'), '<input>')))).toEqual(['wc-input#po'])
    expect(scopeOf(q('input', shadow(q('wc-text-field'), '<input>')))).toEqual(['wc-text-field'])
    const named = await frame('<input>', 'name="delivery"')
    expect(scopeOf(q('input', frameDoc(named)))).toEqual(['iframe:delivery'])
    const titled = await frame('<input>', 'title="T"')
    expect(scopeOf(q('input', frameDoc(titled)))).toEqual(['iframe:T'])
    const anonymous = await frame('<input>')
    expect(scopeOf(q('input', frameDoc(anonymous)))).toEqual(['iframe:'])
    const nested = await frame('<wc-input id="po"></wc-input>', 'name="delivery"')
    const host = q('wc-input', frameDoc(nested))
    expect(scopeOf(q('input', shadow(host, '<input>')))).toEqual(['iframe:delivery', 'wc-input#po'])
  })
})

describe('viewportRect', () => {
  it('adds the offsets of enclosing frames', async () => {
    const f = await frame('<input name="x">')
    const inner = q('input', frameDoc(f))
    vi.spyOn(f, 'getBoundingClientRect').mockReturnValue(rect(100, 50, 300, 200))
    vi.spyOn(inner, 'getBoundingClientRect').mockReturnValue(rect(10, 20, 30, 10))
    const r = viewportRect(inner)
    expect([r.left, r.top, r.width, r.height, r.right, r.bottom]).toEqual([110, 70, 30, 10, 140, 80])
  })

  it('adds the frame border and clips to the frame', async () => {
    const f = await frame('<input name="x"><input name="y"><input name="z">')
    Object.defineProperty(f, 'clientLeft', { value: 2 })
    Object.defineProperty(f, 'clientTop', { value: 3 })
    vi.spyOn(f, 'getBoundingClientRect').mockReturnValue(rect(100, 50, 300, 200))
    const [x, y, z] = Array.from(frameDoc(f).querySelectorAll('input'))
    if (!x || !y || !z) throw new Error('frame inputs')
    vi.spyOn(x, 'getBoundingClientRect').mockReturnValue(rect(10, 20, 30, 10))
    vi.spyOn(y, 'getBoundingClientRect').mockReturnValue(rect(-20, 20, 30, 10))
    vi.spyOn(z, 'getBoundingClientRect').mockReturnValue(rect(400, 20, 30, 10))
    const rx = viewportRect(x)
    expect([rx.left, rx.top, rx.width, rx.height]).toEqual([112, 73, 30, 10])
    const ry = viewportRect(y)
    expect([ry.left, ry.width]).toEqual([102, 10])
    const rz = viewportRect(z)
    expect([rz.width, rz.height]).toEqual([0, 0])
  })

  it('returns the plain rect for main-document and shadow elements', () => {
    document.body.innerHTML = '<x-host></x-host>'
    const inner = q('input', shadow(q('x-host'), '<input>'))
    vi.spyOn(inner, 'getBoundingClientRect').mockReturnValue(rect(5, 6, 7, 8))
    const r = viewportRect(inner)
    expect([r.left, r.top, r.width, r.height]).toEqual([5, 6, 7, 8])
  })
})

describe('deepClosest', () => {
  it('crosses hosts and frame elements', async () => {
    document.body.innerHTML = '<header><x-host></x-host></header><main></main>'
    const inner = q('input', shadow(q('x-host'), '<input>'))
    expect(deepClosest(inner, 'header')).toBe(q('header'))
    expect(deepClosest(inner, 'main')).toBeNull()
    const f = await frame('<div><input></div>', '', q('main'))
    expect(deepClosest(q('input', frameDoc(f)), 'main')).toBe(q('main'))
  })
})

describe('frameDocuments', () => {
  it('lists accessible frame documents recursively, in document order', async () => {
    const first = await frame('<p>first</p>')
    const second = await frame('<p>second</p>')
    const nested = await frame('<p>nested</p>', '', frameDoc(second).body)
    expect(frameDocuments(document)).toEqual([frameDoc(first), frameDoc(second), frameDoc(nested)])
  })
})
