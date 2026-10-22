/* Minimal .env reader for the release scripts; no dependency, no interpolation. */

export function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

export function missingKeys(env: Record<string, string>, required: readonly string[]): string[] {
  return required.filter((key) => !env[key])
}
