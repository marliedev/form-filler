import { describe, expect, it } from 'vitest'
import { missingKeys, parseEnvFile } from '../../scripts/dotenv'

describe('parseEnvFile', () => {
  it('reads KEY=VALUE lines, trims, strips quotes and ignores comments and blanks', () => {
    const text = `
# AMO credentials
WEB_EXT_API_KEY=user:123:456
WEB_EXT_API_SECRET = "abc def"
EMPTY=
`
    expect(parseEnvFile(text)).toEqual({ WEB_EXT_API_KEY: 'user:123:456', WEB_EXT_API_SECRET: 'abc def', EMPTY: '' })
  })

  it('keeps an equals sign inside the value', () => {
    expect(parseEnvFile('TOKEN=a=b==')).toEqual({ TOKEN: 'a=b==' })
  })
})

describe('missingKeys', () => {
  it('names every required key that is absent or empty', () => {
    expect(missingKeys({ A: 'x', B: '' }, ['A', 'B', 'C'])).toEqual(['B', 'C'])
    expect(missingKeys({ A: 'x' }, ['A'])).toEqual([])
  })
})
