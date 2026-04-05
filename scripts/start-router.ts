import {
  buildRouterEnv,
  ccrConfigFile,
  commandExists,
  getRouterUrl,
  hybridRouterConfigFile,
  localEnvFile,
  minimalRouterConfigFile,
  parseEnvFile,
  providerEnvFile,
  runCommand,
  syncCcrConfigFile,
  spawnCommand,
  waitForHttpReady,
} from './local-first-utils.js'

const args = process.argv.slice(2)
const useHybrid = args.includes('--hybrid')
const stopOnly = args.includes('--stop')
const statusOnly = args.includes('--status')
const daemonMode = !args.includes('--foreground')

if (!commandExists('ccr')) {
  console.error(
    'Missing `ccr`. Install it with `npm install -g @musistudio/claude-code-router` first.',
  )
  process.exit(1)
}

if (!commandExists('ollama')) {
  console.warn(
    'Ollama was not found in PATH. Hybrid mode can still work if you only use remote providers.',
  )
}

if (!parseEnvFile(providerEnvFile).OLLAMA_MODEL && !useHybrid) {
  console.error(
    `Missing ${providerEnvFile}. Run \`bun run setup:local-first\` first.`,
  )
  process.exit(1)
}

const configPath = useHybrid ? hybridRouterConfigFile : minimalRouterConfigFile
const env = {
  ...buildRouterEnv(),
  ...parseEnvFile(localEnvFile),
}

const backupPath = syncCcrConfigFile(configPath, env)
if (backupPath) {
  console.log(`Backed up existing CCR config to ${backupPath}`)
}
console.log(`Synced CCR config to ${ccrConfigFile}`)

if (stopOnly) {
  const result = runCommand('ccr', ['stop'], { env, shell: true })
  if (result.stdout.trim()) {
    console.log(result.stdout.trim())
  }
  if (result.stderr.trim()) {
    console.error(result.stderr.trim())
  }
  process.exit(result.status ?? 1)
}

if (statusOnly) {
  const result = runCommand('ccr', ['status'], { env, shell: true })
  if (result.stdout.trim()) {
    console.log(result.stdout.trim())
  }
  if (result.stderr.trim()) {
    console.error(result.stderr.trim())
  }
  process.exit(result.status ?? 1)
}

const healthUrl = `${getRouterUrl()}/api/config`
if (daemonMode) {
  const result = runCommand('ccr', ['restart'], {
    env,
    shell: true,
  })
  if (result.stdout.trim()) {
    console.log(result.stdout.trim())
  }
  if (result.stderr.trim()) {
    console.error(result.stderr.trim())
  }

  const ready = await waitForHttpReady(healthUrl, 20000)
  if (!ready) {
    console.error(
      `Router failed to become ready at ${healthUrl}. Run \`bun run router:start -- --foreground\` to inspect startup output.`,
    )
    process.exit(1)
  }

  console.log(`Router is ready at ${getRouterUrl()}`)
  process.exit(result.status ?? 0)
}

const child = spawnCommand('ccr', ['restart'], {
  env,
  shell: true,
  stdio: 'inherit',
})

child.on('exit', code => {
  process.exit(code ?? 1)
})

child.on('error', error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
