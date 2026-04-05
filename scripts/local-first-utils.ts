import { spawn, spawnSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

export const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
export const routerDir = join(rootDir, 'router', 'claude-code-router')
export const localEnvFile = join(rootDir, '.env.local-first')
export const localEnvExampleFile = join(rootDir, '.env.local-first.example')
export const providerEnvFile = join(routerDir, 'providers.local.env')
export const providerEnvExampleFile = join(
  routerDir,
  'providers.env.example',
)
export const minimalRouterConfigFile = join(
  routerDir,
  'config.ollama.minimal.json',
)
export const hybridRouterConfigFile = join(
  routerDir,
  'config.hybrid.example.json',
)
export const ccrHomeDir = join(homedir(), '.claude-code-router')
export const ccrConfigFile = join(ccrHomeDir, 'config.json')

const ROUTER_HOST = '127.0.0.1'
const ROUTER_PORT = '3456'
const ROUTER_URL = `http://${ROUTER_HOST}:${ROUTER_PORT}`

export function getRouterUrl(): string {
  return ROUTER_URL
}

export function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
}

function resolveEnvPlaceholder(
  value: unknown,
  env: Record<string, string>,
): unknown {
  if (typeof value === 'string') {
    const directMatch = value.match(/^\$([A-Z0-9_]+)$/)
    const bracedMatch = value.match(/^\$\{([A-Z0-9_]+)\}$/)
    const key = directMatch?.[1] ?? bracedMatch?.[1]
    if (key) {
      return env[key] ?? value
    }

    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => resolveEnvPlaceholder(item, env))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveEnvPlaceholder(item, env),
      ]),
    )
  }

  return value
}

export function syncCcrConfigFile(
  sourcePath: string,
  env: Record<string, string>,
): string | null {
  ensureParentDir(ccrConfigFile)
  const rawSourceContent = readFileSync(sourcePath, 'utf8')
  const sourceContent = JSON.stringify(
    resolveEnvPlaceholder(JSON.parse(rawSourceContent), env),
    null,
    2,
  )
  let backupPath: string | null = null

  if (existsSync(ccrConfigFile)) {
    const currentContent = readFileSync(ccrConfigFile, 'utf8')
    if (currentContent === sourceContent) {
      return null
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
    backupPath = join(ccrHomeDir, `config.codex-backup.${timestamp}.json`)
    writeFileSync(backupPath, currentContent, 'utf8')
  }

  writeFileSync(ccrConfigFile, sourceContent, 'utf8')
  return backupPath
}

export function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {}
  }

  const result: Record<string, string> = {}
  const content = readFileSync(filePath, 'utf8')

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const equalsIndex = line.indexOf('=')
    if (equalsIndex <= 0) {
      continue
    }

    const key = line.slice(0, equalsIndex).trim()
    let value = line.slice(equalsIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    result[key] = value
  }

  return result
}

export function writeEnvFile(
  filePath: string,
  values: Record<string, string>,
  order: string[],
  comments?: string[],
): void {
  ensureParentDir(filePath)
  const written = new Set<string>()
  const lines: string[] = []

  if (comments?.length) {
    lines.push(...comments.map(comment => `# ${comment}`), '')
  }

  for (const key of order) {
    if (values[key] !== undefined) {
      lines.push(`${key}=${values[key]}`)
      written.add(key)
    }
  }

  for (const [key, value] of Object.entries(values).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (written.has(key)) {
      continue
    }
    lines.push(`${key}=${value}`)
  }

  writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
}

export function commandExists(command: string): boolean {
  const lookup = process.platform === 'win32' ? 'where' : 'which'
  const result = spawnSync(lookup, [command], { stdio: 'ignore' })
  return result.status === 0
}

export function runCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string
    env?: Record<string, string>
    shell?: boolean
    stdio?: 'inherit' | 'pipe'
  },
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd: options?.cwd ?? rootDir,
    env: {
      ...process.env,
      ...options?.env,
    },
    encoding: 'utf8',
    shell: options?.shell ?? false,
    stdio: options?.stdio ?? 'pipe',
  })

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

export function spawnCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string
    env?: Record<string, string>
    detached?: boolean
    shell?: boolean
    stdio?: 'inherit' | 'ignore'
  },
) {
  return spawn(command, args, {
    cwd: options?.cwd ?? rootDir,
    env: {
      ...process.env,
      ...options?.env,
    },
    detached: options?.detached ?? false,
    shell: options?.shell ?? false,
    stdio: options?.stdio ?? 'inherit',
  })
}

export function detectOllamaModels(): string[] {
  if (!commandExists('ollama')) {
    return []
  }

  const result = runCommand('ollama', ['list'])
  if (result.status !== 0) {
    return []
  }

  return result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(/\s{2,}/)[0]?.trim())
    .filter((model): model is string => Boolean(model))
}

function scoreDefaultModel(model: string): number {
  const name = model.toLowerCase()
  let score = 0
  if (name.includes('coder')) score += 50
  if (name.includes('code')) score += 20
  if (name.includes('deepseek')) score += 15
  if (name.includes('qwen')) score += 10
  if (name.includes('gemma')) score += 5
  if (name.includes('vision')) score -= 10
  return score
}

function scoreThinkModel(model: string): number {
  const name = model.toLowerCase()
  let score = 0
  if (name.includes('reason')) score += 50
  if (name.includes('thinking')) score += 40
  if (name.includes('qwen')) score += 20
  if (name.includes('deepseek')) score += 15
  if (name.includes('gemma')) score += 10
  if (name.includes('coder')) score += 5
  return score
}

function scoreGeneralModel(model: string): number {
  const name = model.toLowerCase()
  let score = 0
  if (name.includes('gemma')) score += 40
  if (name.includes('qwen')) score += 25
  if (name.includes('chat')) score += 20
  if (name.includes('instruct')) score += 15
  if (name.includes('deepseek')) score += 10
  if (name.includes('coder')) score -= 10
  if (name.includes('vision')) score -= 15
  return score
}

export function chooseDefaultOllamaModel(models: string[]): string | null {
  if (!models.length) {
    return null
  }

  return [...models].sort((a, b) => scoreDefaultModel(b) - scoreDefaultModel(a))[0]
}

export function chooseThinkOllamaModel(
  models: string[],
  defaultModel: string | null,
): string | null {
  if (!models.length) {
    return null
  }

  const ranked = [...models].sort(
    (a, b) => scoreThinkModel(b) - scoreThinkModel(a),
  )
  const preferred = ranked.find(model => model !== defaultModel)
  return preferred ?? ranked[0] ?? defaultModel
}

export function chooseGeneralOllamaModel(
  models: string[],
  excludedModels: Array<string | null>,
): string | null {
  if (!models.length) {
    return null
  }

  const excluded = new Set(excludedModels.filter(Boolean))
  const ranked = [...models].sort(
    (a, b) => scoreGeneralModel(b) - scoreGeneralModel(a),
  )
  const preferred = ranked.find(model => !excluded.has(model))
  return preferred ?? ranked[0] ?? excludedModels.find(Boolean) ?? null
}

export async function waitForHttpReady(
  url: string,
  timeoutMs = 15000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': 'local-router',
        },
      })
      if (response.ok) {
        return true
      }
    } catch {
      // Keep polling until timeout.
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return false
}

export function buildRouterEnv(): Record<string, string> {
  return parseEnvFile(providerEnvFile)
}

export const localFirstEnvOrder = [
  'CLAUDE_CODE_LOCAL_FIRST',
  'DISABLE_TELEMETRY',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'DISABLE_COST_WARNINGS',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'API_TIMEOUT_MS',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES',
]

export const providerEnvOrder = [
  'OLLAMA_MODEL',
  'OLLAMA_THINK_MODEL',
  'OLLAMA_GENERAL_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_LONG_CONTEXT_MODEL',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_MODEL',
  'DEEPSEEK_REASONING_MODEL',
  'DASHSCOPE_API_KEY',
  'QWEN_MODEL',
  'ROUTER_DEFAULT',
  'ROUTER_BACKGROUND',
  'ROUTER_THINK',
  'ROUTER_LONG_CONTEXT',
]
