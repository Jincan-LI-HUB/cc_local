import { existsSync } from 'fs'
import {
  getRouterUrl,
  localEnvFile,
  providerEnvFile,
  runCommand,
  spawnCommand,
  waitForHttpReady,
} from './local-first-utils.js'

const bunExecutable = process.execPath

if (!existsSync(localEnvFile) || !existsSync(providerEnvFile)) {
  const setup = runCommand(bunExecutable, ['./scripts/setup-local-first.ts'], {
    stdio: 'inherit',
  })
  if (setup.status !== 0) {
    process.exit(setup.status ?? 1)
  }
}

const healthUrl = `${getRouterUrl()}/api/config`
const ready = await waitForHttpReady(healthUrl, 1000)

if (!ready) {
  const start = runCommand(bunExecutable, ['./scripts/start-router.ts'], {
    stdio: 'inherit',
  })
  if (start.status !== 0) {
    process.exit(start.status ?? 1)
  }
}

const child = spawnCommand(
  bunExecutable,
  ['--env-file=.env.local-first', './src/entrypoints/cli.tsx', ...process.argv.slice(2)],
  {
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
