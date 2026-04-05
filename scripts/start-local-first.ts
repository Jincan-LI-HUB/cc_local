import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { buildLocalFirstCliEnv } from './local-first-utils.js'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const envFile = join(rootDir, '.env.local-first')
const bunExecutable = process.execPath

if (!existsSync(envFile)) {
  console.error(
    `Missing ${envFile}. Create it from .env.local-first.example first.`,
  )
  process.exit(1)
}

const child = spawn(
  bunExecutable,
  ['./src/entrypoints/cli.tsx', ...process.argv.slice(2)],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      ...buildLocalFirstCliEnv(),
    },
    stdio: 'inherit',
  },
)

child.on('exit', code => {
  process.exit(code ?? 1)
})

child.on('error', error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
