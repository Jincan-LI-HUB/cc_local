import { existsSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import {
  type McpJsonConfig,
  type McpServerConfig,
  McpJsonConfigSchema,
  McpServerConfigSchema,
} from '../src/services/mcp/types.js'
import { safeParseJSON } from '../src/utils/json.js'
import { jsonStringify } from '../src/utils/slowOperations.js'
import {
  ensureParentDir,
  mcpEnvExampleFile,
  mcpEnvFile,
  rootDir,
  writeEnvFile,
} from './local-first-utils.js'

const projectMcpFile = join(rootDir, '.mcp.json')

type SanitizedValue = {
  value: string
  envValues: Record<string, string>
  envExampleValues: Record<string, string>
}

type ImportResult = {
  imported: string[]
  envVars: string[]
  warnings: string[]
}

function getDefaultDesktopConfigPath(): string {
  return join(
    process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
    'Claude',
    'claude_desktop_config.json',
  )
}

function sanitizeIdentifier(value: string): string {
  const normalized = value
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
  return normalized || 'VALUE'
}

function makeEnvName(serverName: string, key: string): string {
  return `MCP_${sanitizeIdentifier(serverName)}_${sanitizeIdentifier(key)}`
}

function looksSensitiveKey(key: string): boolean {
  return /(token|secret|password|passwd|api[_-]?key|bearer|authorization|cookie|dsn|connection|string|pat)/i.test(
    key,
  )
}

function looksConnectionString(value: string): boolean {
  return /^(postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\//i.test(value)
}

function looksJwt(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
}

function looksOpaqueSecret(value: string): boolean {
  if (value.length < 16) {
    return false
  }
  if (
    value.startsWith('-') ||
    /[\\/]/.test(value) ||
    /^[A-Za-z]:/.test(value) ||
    value.includes(' ')
  ) {
    return false
  }
  if (looksJwt(value)) {
    return true
  }
  if (/^(github_pat_|gh[pousr]_|sk-|xox[baprs]-)/i.test(value)) {
    return true
  }
  if (/^[0-9a-f]{24,}$/i.test(value)) {
    return true
  }
  if (/^[a-z]+(?:-[a-z]+)+$/.test(value)) {
    return false
  }
  return (
    /^[A-Za-z0-9_-]{16,}$/.test(value) &&
    (/\d/.test(value) || /[A-Z]/.test(value) || value.includes('_'))
  )
}

function sanitizeStringValue(
  serverName: string,
  key: string,
  value: string,
): SanitizedValue {
  const bearerMatch = value.match(/^(authorization:\s*Bearer\s+)(.+)$/i)
  if (bearerMatch?.[1] && bearerMatch[2]) {
    const envName = makeEnvName(serverName, `${key}_bearer_token`)
    return {
      value: `${bearerMatch[1]}\${${envName}}`,
      envValues: { [envName]: bearerMatch[2] },
      envExampleValues: { [envName]: 'REPLACE_ME' },
    }
  }

  if (looksConnectionString(value)) {
    const envName = makeEnvName(serverName, `${key}_connection_string`)
    return {
      value: `\${${envName}}`,
      envValues: { [envName]: value },
      envExampleValues: { [envName]: 'REPLACE_ME' },
    }
  }

  if (looksSensitiveKey(key) || looksOpaqueSecret(value)) {
    const envName = makeEnvName(serverName, key)
    return {
      value: `\${${envName}}`,
      envValues: { [envName]: value },
      envExampleValues: { [envName]: 'REPLACE_ME' },
    }
  }

  return {
    value,
    envValues: {},
    envExampleValues: {},
  }
}

function mergeRecords(
  target: Record<string, string>,
  source: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (target[key] === undefined) {
      target[key] = value
    }
  }
}

function normalizeWindowsCommand(config: McpServerConfig): McpServerConfig {
  if (
    process.platform === 'win32' &&
    (!config.type || config.type === 'stdio') &&
    config.command === 'npx'
  ) {
    return {
      ...config,
      command: 'npx.cmd',
    }
  }
  return config
}

function sanitizeServerConfig(
  serverName: string,
  config: McpServerConfig,
): {
  config: McpServerConfig
  envValues: Record<string, string>
  envExampleValues: Record<string, string>
  warnings: string[]
} {
  const normalized = normalizeWindowsCommand(config)
  const envValues: Record<string, string> = {}
  const envExampleValues: Record<string, string> = {}
  const warnings: string[] = []

  if (!normalized.type || normalized.type === 'stdio') {
    const nextEnv =
      normalized.env === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(normalized.env).map(([key, value]) => {
              const sanitized = sanitizeStringValue(serverName, key, value)
              mergeRecords(envValues, sanitized.envValues)
              mergeRecords(envExampleValues, sanitized.envExampleValues)
              return [key, sanitized.value]
            }),
          )

    const nextArgs = (normalized.args ?? []).map((arg, index) => {
      const sanitized = sanitizeStringValue(serverName, `arg_${index + 1}`, arg)
      mergeRecords(envValues, sanitized.envValues)
      mergeRecords(envExampleValues, sanitized.envExampleValues)
      return sanitized.value
    })

    if (
      serverName === 'filesystem' &&
      nextArgs.some(arg => /^[A-Za-z]:\\?$/.test(arg))
    ) {
      warnings.push(
        `Server "${serverName}" still exposes a full drive path. Review whether you really want that scope in this project.`,
      )
    }

    return {
      config: {
        ...normalized,
        args: nextArgs,
        ...(nextEnv ? { env: nextEnv } : {}),
      },
      envValues,
      envExampleValues,
      warnings,
    }
  }

  if ('headers' in normalized && normalized.headers) {
    const nextHeaders = Object.fromEntries(
      Object.entries(normalized.headers).map(([key, value]) => {
        const sanitized = sanitizeStringValue(serverName, key, value)
        mergeRecords(envValues, sanitized.envValues)
        mergeRecords(envExampleValues, sanitized.envExampleValues)
        return [key, sanitized.value]
      }),
    )

    return {
      config: {
        ...normalized,
        headers: nextHeaders,
      },
      envValues,
      envExampleValues,
      warnings,
    }
  }

  return {
    config: normalized,
    envValues,
    envExampleValues,
    warnings,
  }
}

function getAvailableName(
  existing: Record<string, McpServerConfig>,
  desiredName: string,
): string {
  if (existing[desiredName] === undefined) {
    return desiredName
  }

  let counter = 1
  let candidate = `${desiredName}_desktop`
  while (existing[candidate] !== undefined) {
    counter += 1
    candidate = `${desiredName}_desktop_${counter}`
  }
  return candidate
}

function readProjectMcpConfig(): McpJsonConfig {
  if (!existsSync(projectMcpFile)) {
    return { mcpServers: {} }
  }

  const parsed = safeParseJSON(readFileSync(projectMcpFile, 'utf8'))
  const result = McpJsonConfigSchema().safeParse(parsed)
  if (!result.success) {
    throw new Error(`Existing .mcp.json is invalid: ${result.error.message}`)
  }
  return result.data
}

function readDesktopMcpServers(
  desktopConfigPath: string,
): Record<string, McpServerConfig> {
  if (!existsSync(desktopConfigPath)) {
    throw new Error(`Claude Desktop config not found: ${desktopConfigPath}`)
  }

  const parsed = safeParseJSON(readFileSync(desktopConfigPath, 'utf8'))
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Claude Desktop config is not valid JSON')
  }

  const rawServers = (parsed as Record<string, unknown>).mcpServers
  if (!rawServers || typeof rawServers !== 'object') {
    return {}
  }

  const servers: Record<string, McpServerConfig> = {}
  for (const [name, value] of Object.entries(rawServers)) {
    const result = McpServerConfigSchema().safeParse(value)
    if (result.success) {
      servers[name] = result.data
    }
  }
  return servers
}

function writeProjectMcpConfig(config: McpJsonConfig): void {
  ensureParentDir(projectMcpFile)
  writeFileSync(projectMcpFile, `${jsonStringify(config, null, 2)}\n`, 'utf8')
}

function importDesktopMcp(desktopConfigPath: string): ImportResult {
  const projectConfig = readProjectMcpConfig()
  const desktopServers = readDesktopMcpServers(desktopConfigPath)
  const existingSecrets = existsSync(mcpEnvFile) ? readFileSync(mcpEnvFile, 'utf8') : ''
  const currentSecretEnv: Record<string, string> = {}

  if (existingSecrets) {
    for (const rawLine of existingSecrets.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const index = line.indexOf('=')
      if (index <= 0) continue
      currentSecretEnv[line.slice(0, index).trim()] = line
        .slice(index + 1)
        .trim()
    }
  }

  const nextSecretEnv = { ...currentSecretEnv }
  const exampleEnv: Record<string, string> = {}
  const imported: string[] = []
  const warnings: string[] = []

  for (const [desktopName, serverConfig] of Object.entries(desktopServers)) {
    const finalName = getAvailableName(projectConfig.mcpServers, desktopName)
    const sanitized = sanitizeServerConfig(finalName, serverConfig)
    projectConfig.mcpServers[finalName] = sanitized.config
    mergeRecords(nextSecretEnv, sanitized.envValues)
    mergeRecords(exampleEnv, sanitized.envExampleValues)
    imported.push(finalName)
    warnings.push(...sanitized.warnings)
  }

  writeProjectMcpConfig(projectConfig)
  writeEnvFile(
    mcpEnvFile,
    nextSecretEnv,
    Object.keys(nextSecretEnv).sort(),
    [
      'Auto-generated from Claude Desktop MCP import.',
      'This file is gitignored and loaded automatically by local-first scripts.',
    ],
  )
  writeEnvFile(
    mcpEnvExampleFile,
    exampleEnv,
    Object.keys(exampleEnv).sort(),
    [
      'Example MCP secrets file generated from Claude Desktop import.',
      'Real values live in .env.mcp.local.',
    ],
  )

  return {
    imported,
    envVars: Object.keys(exampleEnv).sort(),
    warnings,
  }
}

const sourceFlagIndex = process.argv.findIndex(arg => arg === '--source')
const sourcePath =
  sourceFlagIndex >= 0 && process.argv[sourceFlagIndex + 1]
    ? process.argv[sourceFlagIndex + 1]!
    : getDefaultDesktopConfigPath()

const result = importDesktopMcp(sourcePath)

console.log(`Imported ${result.imported.length} Claude Desktop MCP servers into ${projectMcpFile}`)
if (result.imported.length > 0) {
  console.log(`Servers: ${result.imported.join(', ')}`)
}
if (result.envVars.length > 0) {
  console.log(`Generated MCP env vars in ${mcpEnvFile}: ${result.envVars.join(', ')}`)
}
if (result.warnings.length > 0) {
  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`)
  }
}
