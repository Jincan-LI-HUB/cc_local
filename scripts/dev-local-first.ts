import { existsSync } from 'fs'
import {
  buildLocalFirstCliEnv,
  getRouterUrl,
  localEnvFile,
  providerEnvFile,
  runCommand,
  spawnCommand,
  waitForHttpReady,
} from './local-first-utils.js'

const bunExecutable = process.execPath
const routerHealthUrl = `${getRouterUrl()}/api/config`
const routerStartupAttempts = 3

async function ensureRouterReady(): Promise<void> {
  for (let attempt = 1; attempt <= routerStartupAttempts; attempt += 1) {
    const ready = await waitForHttpReady(routerHealthUrl, attempt === 1 ? 1500 : 5000)
    if (ready) {
      return
    }

    console.log(
      `Starting local router (attempt ${attempt}/${routerStartupAttempts})...`,
    )
    const start = runCommand(bunExecutable, ['./scripts/start-router.ts'], {
      stdio: 'inherit',
    })
    if (start.status !== 0 && attempt === routerStartupAttempts) {
      process.exit(start.status ?? 1)
    }

    const readyAfterStart = await waitForHttpReady(routerHealthUrl, 30000)
    if (readyAfterStart) {
      return
    }

    if (attempt < routerStartupAttempts) {
      console.warn('Router is still not ready. Retrying startup...')
    }
  }

  console.error(
    `Router failed to become ready at ${routerHealthUrl}. Try \`bun run router:start\` first, then run \`bun run start:local-first\`.`,
  )
  process.exit(1)
}

if (!existsSync(localEnvFile) || !existsSync(providerEnvFile)) {
  const setup = runCommand(bunExecutable, ['./scripts/setup-local-first.ts'], {
    stdio: 'inherit',
  })
  if (setup.status !== 0) {
    process.exit(setup.status ?? 1)
  }
}

await ensureRouterReady()

const child = spawnCommand(
  bunExecutable,
  ['./scripts/start-local-first.ts', ...process.argv.slice(2)],
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
