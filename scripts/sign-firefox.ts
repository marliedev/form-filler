/* `npm run sign:firefox`: builds the Firefox target, lints it the way AMO does, uploads it for
   signing as a self-distributed ("unlisted") add-on and stores the signed .xpi locally.
   Credentials come from `.env` (see `.env.example`), never from the repository. */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { missingKeys, parseEnvFile } from './dotenv'

const SOURCE_DIR = '.output/firefox-mv3'
const ARTIFACTS_DIR = '.output/firefox-signed'
const REQUIRED = ['WEB_EXT_API_KEY', 'WEB_EXT_API_SECRET'] as const

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { stdio: 'inherit', env })
  if (result.status !== 0) fail(`${command} ${args[0] ?? ''} ist fehlgeschlagen.`)
}

const fileEnv = existsSync('.env') ? parseEnvFile(readFileSync('.env', 'utf8')) : {}
const env = { ...fileEnv, ...process.env }
const missing = missingKeys(env as Record<string, string>, REQUIRED)
if (missing.length > 0) {
  fail(`Fehlende Zugangsdaten: ${missing.join(', ')}. Schlüsselpaar unter https://addons.mozilla.org/developers/addon/api/key/ erzeugen und in .env eintragen (Vorlage: .env.example).`)
}

const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version
console.log(`Signiere Form Filler ${version} für Firefox (unlisted) …`)

run('npx', ['wxt', 'build', '-b', 'firefox'], env)
// Errors stop here; warnings (e.g. innerHTML in bundled libraries) are informational and do not block signing.
run('npx', ['web-ext', 'lint', '--source-dir', SOURCE_DIR], env)
// web-ext reads WEB_EXT_API_KEY / WEB_EXT_API_SECRET from the environment.
run('npx', ['web-ext', 'sign', '--source-dir', SOURCE_DIR, '--artifacts-dir', ARTIFACTS_DIR, '--channel', 'unlisted'], env)

console.log(`Fertig. Die signierte .xpi liegt in ${ARTIFACTS_DIR}/. Für die nächste Signierung die Version in package.json erhöhen.`)
