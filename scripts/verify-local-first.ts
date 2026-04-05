import { existsSync } from 'fs'
import {
  getRouterUrl,
  localEnvFile,
  parseEnvFile,
  providerEnvFile,
  rootDir,
  runCommand,
} from './local-first-utils.js'

const bunExecutable = process.execPath

function fail(message: string): never {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

function pass(message: string): void {
  console.log(`PASS: ${message}`)
}

function extractCommandNames(helpText: string): string[] {
  const lines = helpText.split(/\r?\n/)
  const commandsIndex = lines.findIndex(line => line.trim() === 'Commands:')
  if (commandsIndex < 0) {
    return []
  }

  const commandNames: string[] = []
  for (const line of lines.slice(commandsIndex + 1)) {
    if (!line.trim()) {
      continue
    }
    if (!line.startsWith('  ')) {
      break
    }

    const match = line.match(/^\s{2}(\S+)/)
    if (match?.[1]) {
      commandNames.push(match[1])
    }
  }

  return commandNames
}

function ensureSuccess(
  result: { status: number | null; stdout: string; stderr: string },
  label: string,
): void {
  if (result.status !== 0) {
    fail(`${label}\n${result.stderr || result.stdout}`)
  }
}

if (!existsSync(localEnvFile) || !existsSync(providerEnvFile)) {
  const setup = runCommand(bunExecutable, ['./scripts/setup-local-first.ts'], {
    stdio: 'inherit',
  })
  ensureSuccess(setup, 'setup-local-first failed')
}

const providerEnv = parseEnvFile(providerEnvFile)
if (!providerEnv.OLLAMA_GENERAL_MODEL) {
  fail('providers.local.env is missing OLLAMA_GENERAL_MODEL')
}
if (!providerEnv.ROUTER_LONG_CONTEXT) {
  fail('providers.local.env is missing ROUTER_LONG_CONTEXT')
}
pass('provider env includes general-model routing')

const startRouter = runCommand(bunExecutable, ['./scripts/start-router.ts'], {
  stdio: 'inherit',
})
ensureSuccess(startRouter, 'router start failed')
pass('router started')

const helpResult = runCommand(
  bunExecutable,
  ['--env-file=.env.local-first', './src/entrypoints/cli.tsx', '--help'],
  { stdio: 'pipe' },
)
ensureSuccess(helpResult, 'local-first help command failed')

const commandNames = extractCommandNames(helpResult.stdout)
const forbiddenCommands = ['auth', 'setup-token', 'update|upgrade']
for (const command of forbiddenCommands) {
  if (commandNames.includes(command)) {
    fail(`forbidden command still visible in --help: ${command}`)
  }
}
pass('first-party commands hidden from --help')

for (const hiddenOption of ['--chrome', '--no-chrome']) {
  if (helpResult.stdout.includes(hiddenOption)) {
    fail(`first-party option still visible in --help: ${hiddenOption}`)
  }
}
pass('first-party options hidden from --help')

const routerResponse = await fetch(`${getRouterUrl()}/v1/messages`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': 'local-router',
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: 'Reply with exactly: OK',
      },
    ],
  }),
})

if (!routerResponse.ok) {
  fail(`router message request failed: ${routerResponse.status} ${await routerResponse.text()}`)
}

const routerJson = (await routerResponse.json()) as {
  content?: Array<{ text?: string }>
}
const routerText = routerJson.content?.[0]?.text?.trim()
if (routerText !== 'OK') {
  fail(`router returned unexpected text: ${JSON.stringify(routerJson)}`)
}
pass('router /v1/messages path works')

const printResult = runCommand(
  bunExecutable,
  ['./scripts/start-local-first.ts', '-p', 'Reply with exactly: OK'],
  {
    cwd: rootDir,
    stdio: 'pipe',
  },
)
ensureSuccess(printResult, 'start-local-first print mode failed')
if (printResult.stdout.trim() !== 'OK') {
  fail(`frontend returned unexpected print output: ${printResult.stdout}`)
}
pass('frontend print mode works through local router')

const hybridStart = runCommand(
  bunExecutable,
  ['./scripts/start-router.ts', '--hybrid'],
  {
    stdio: 'inherit',
  },
)
ensureSuccess(hybridStart, 'hybrid router start failed')
pass('hybrid router started')

const hybridConfigResponse = await fetch(`${getRouterUrl()}/api/config`, {
  headers: {
    'x-api-key': 'local-router',
  },
})

if (!hybridConfigResponse.ok) {
  fail(
    `hybrid router config request failed: ${hybridConfigResponse.status} ${await hybridConfigResponse.text()}`,
  )
}

const hybridConfig = (await hybridConfigResponse.json()) as {
  Providers?: Array<{ name?: string }>
  Router?: Record<string, string>
}
const providerNames = new Set(
  (hybridConfig.Providers ?? []).map(provider => provider.name).filter(Boolean),
)
for (const provider of ['ollama', 'openai', 'deepseek', 'dashscope']) {
  if (!providerNames.has(provider)) {
    fail(`hybrid router missing provider: ${provider}`)
  }
}
pass('hybrid router exposes all expected providers')

if (
  hybridConfig.Router?.longContext !== providerEnv.ROUTER_LONG_CONTEXT
) {
  fail(
    `hybrid router longContext mismatch: expected ${providerEnv.ROUTER_LONG_CONTEXT}, got ${hybridConfig.Router?.longContext}`,
  )
}
pass('hybrid router uses configured long-context route')

const hybridResponse = await fetch(`${getRouterUrl()}/v1/messages`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': 'local-router',
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: 'Reply with exactly: OK',
      },
    ],
  }),
})

if (!hybridResponse.ok) {
  fail(
    `hybrid router message request failed: ${hybridResponse.status} ${await hybridResponse.text()}`,
  )
}

const hybridJson = (await hybridResponse.json()) as {
  content?: Array<{ text?: string }>
}
if (hybridJson.content?.[0]?.text?.trim() !== 'OK') {
  fail(`hybrid router returned unexpected text: ${JSON.stringify(hybridJson)}`)
}
pass('hybrid router default route still works with local model')

console.log('All local-first checks passed.')
