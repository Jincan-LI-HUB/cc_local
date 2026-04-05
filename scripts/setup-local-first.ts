import {
  chooseDefaultOllamaModel,
  chooseGeneralOllamaModel,
  chooseThinkOllamaModel,
  detectOllamaModels,
  getRouterUrl,
  localEnvExampleFile,
  localEnvFile,
  localFirstEnvOrder,
  parseEnvFile,
  providerEnvFile,
  providerEnvOrder,
  writeEnvFile,
} from './local-first-utils.js'

function formatLocalModelLabel(model: string): string {
  return model
    .replace(/:latest$/i, '')
    .replace(/-/g, ' ')
    .replace(/:/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function shouldResetGeneratedLabel(label: string | undefined): boolean {
  return (
    !label ||
    /\(Local(?: [A-Za-z]+)?\)$/i.test(label) ||
    generatedLabels.has(label)
  )
}

async function filterToolCapableModels(models: string[]): Promise<string[]> {
  const supported: string[] = []

  for (const model of models) {
    try {
      const response = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: 'Bearer ollama',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: 'Reply with exactly: OK and do not call tools.',
            },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'echo_test',
                description: 'Echoes the input',
                parameters: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                  },
                  required: ['text'],
                },
              },
            },
          ],
          tool_choice: 'none',
          max_tokens: 16,
        }),
      })

      if (response.ok) {
        supported.push(model)
      }
    } catch {
      return []
    }
  }

  return supported
}

const detectedModels = detectOllamaModels()
const toolCapableModels = await filterToolCapableModels(detectedModels)
const generatedLabels = new Set(detectedModels.map(formatLocalModelLabel))
const defaultModel =
  chooseDefaultOllamaModel(
    toolCapableModels.length ? toolCapableModels : detectedModels,
  ) ?? 'qwen2.5-coder:latest'
const thinkModel =
  chooseThinkOllamaModel(
    toolCapableModels.length ? toolCapableModels : detectedModels,
    defaultModel,
  ) ??
  'qwen3-coder:latest'
const generalModel =
  chooseGeneralOllamaModel(
    toolCapableModels.length ? toolCapableModels : detectedModels,
    [defaultModel, thinkModel],
  ) ??
  'gemma4:31b'

const localEnv = {
  ...parseEnvFile(localEnvExampleFile),
  ...parseEnvFile(localEnvFile),
}

localEnv.CLAUDE_CODE_LOCAL_FIRST ??= '1'
localEnv.DISABLE_TELEMETRY ??= '1'
localEnv.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ??= '1'
localEnv.DISABLE_COST_WARNINGS ??= '1'
localEnv.ANTHROPIC_BASE_URL ??= getRouterUrl()
localEnv.ANTHROPIC_AUTH_TOKEN ??= 'local-router'
localEnv.API_TIMEOUT_MS ??= '600000'
if (
  toolCapableModels.length > 0 &&
  (!localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL ||
    !toolCapableModels.includes(localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL))
) {
  localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL = defaultModel
  localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME = formatLocalModelLabel(
    localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL,
  )
  localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION =
    'Default local coding model via the Anthropic-compatible gateway'
} else {
  localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL ??= defaultModel
  if (shouldResetGeneratedLabel(localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME)) {
    localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME = formatLocalModelLabel(
      localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL,
    )
  } else {
    localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME ??= formatLocalModelLabel(
      localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL,
    )
  }
  localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION ??=
    'Default local coding model via the Anthropic-compatible gateway'
}
localEnv.ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES ??= ''
if (
  toolCapableModels.length > 0 &&
  (!localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL ||
    !toolCapableModels.includes(localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL))
) {
  localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL = thinkModel
  localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME = formatLocalModelLabel(
    localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL,
  )
  localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION =
    'Local reasoning model via the Anthropic-compatible gateway'
} else {
  localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL ??= thinkModel
  if (shouldResetGeneratedLabel(localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME)) {
    localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME = formatLocalModelLabel(
      localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL,
    )
  } else {
    localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME ??= formatLocalModelLabel(
      localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL,
    )
  }
  localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION ??=
    'Local reasoning model via the Anthropic-compatible gateway'
}
localEnv.ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES ??= 'thinking'
if (
  toolCapableModels.length > 0 &&
  (!localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL ||
    !toolCapableModels.includes(localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL))
) {
  localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL = generalModel
  localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME = formatLocalModelLabel(
    localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL,
  )
  localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION =
    'Fast local general-purpose model via the Anthropic-compatible gateway'
} else {
  localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL ??= generalModel
  if (shouldResetGeneratedLabel(localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME)) {
    localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME = formatLocalModelLabel(
      localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL,
    )
  } else {
    localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME ??= formatLocalModelLabel(
      localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL,
    )
  }
  localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION ??=
    'Fast local general-purpose model via the Anthropic-compatible gateway'
}
localEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES ??= ''
if (
  toolCapableModels.length > 0 &&
  (!localEnv.ANTHROPIC_MODEL ||
    !toolCapableModels.includes(localEnv.ANTHROPIC_MODEL))
) {
  localEnv.ANTHROPIC_MODEL = defaultModel
} else {
  localEnv.ANTHROPIC_MODEL ??= defaultModel
}

const providerEnv = {
  ...parseEnvFile(providerEnvFile),
}
const legacyThinkLongContext = providerEnv.ROUTER_LONG_CONTEXT
const shouldPreferToolCapableDefault =
  toolCapableModels.length > 0 &&
  (!providerEnv.OLLAMA_MODEL ||
    !toolCapableModels.includes(providerEnv.OLLAMA_MODEL))
const shouldPreferToolCapableThink =
  toolCapableModels.length > 0 &&
  (!providerEnv.OLLAMA_THINK_MODEL ||
    !toolCapableModels.includes(providerEnv.OLLAMA_THINK_MODEL))
const shouldPreferToolCapableGeneral =
  toolCapableModels.length > 0 &&
  (!providerEnv.OLLAMA_GENERAL_MODEL ||
    !toolCapableModels.includes(providerEnv.OLLAMA_GENERAL_MODEL))

if (shouldPreferToolCapableDefault) {
  providerEnv.OLLAMA_MODEL = defaultModel
} else {
  providerEnv.OLLAMA_MODEL ??= defaultModel
}
if (shouldPreferToolCapableThink) {
  providerEnv.OLLAMA_THINK_MODEL = thinkModel
} else {
  providerEnv.OLLAMA_THINK_MODEL ??= thinkModel
}
if (shouldPreferToolCapableGeneral) {
  providerEnv.OLLAMA_GENERAL_MODEL = generalModel
} else {
  providerEnv.OLLAMA_GENERAL_MODEL ??= generalModel
}
providerEnv.OPENAI_API_KEY ??= ''
providerEnv.OPENAI_MODEL ??= 'gpt-4.1-mini'
providerEnv.OPENAI_LONG_CONTEXT_MODEL ??= 'gpt-4.1'
providerEnv.DEEPSEEK_API_KEY ??= ''
providerEnv.DEEPSEEK_MODEL ??= 'deepseek-chat'
providerEnv.DEEPSEEK_REASONING_MODEL ??= 'deepseek-reasoner'
providerEnv.DASHSCOPE_API_KEY ??= ''
providerEnv.QWEN_MODEL ??= 'qwen3-coder-plus'
if (
  toolCapableModels.length > 0 &&
  (!providerEnv.ROUTER_DEFAULT ||
    providerEnv.ROUTER_DEFAULT === 'ollama,deepseek-coder:6.7b')
) {
  providerEnv.ROUTER_DEFAULT = `ollama,${providerEnv.OLLAMA_MODEL}`
} else {
  providerEnv.ROUTER_DEFAULT ??= `ollama,${providerEnv.OLLAMA_MODEL}`
}
if (
  toolCapableModels.length > 0 &&
  (!providerEnv.ROUTER_BACKGROUND ||
    providerEnv.ROUTER_BACKGROUND === 'ollama,deepseek-coder:6.7b')
) {
  providerEnv.ROUTER_BACKGROUND = `ollama,${providerEnv.OLLAMA_MODEL}`
} else {
  providerEnv.ROUTER_BACKGROUND ??= `ollama,${providerEnv.OLLAMA_MODEL}`
}
if (shouldPreferToolCapableThink || !providerEnv.ROUTER_THINK) {
  providerEnv.ROUTER_THINK = `ollama,${providerEnv.OLLAMA_THINK_MODEL}`
} else {
  providerEnv.ROUTER_THINK ??= `ollama,${providerEnv.OLLAMA_THINK_MODEL}`
}
if (
  !legacyThinkLongContext ||
  legacyThinkLongContext === `ollama,${providerEnv.OLLAMA_THINK_MODEL}` ||
  legacyThinkLongContext === 'ollama,qwen3-coder:latest'
) {
  providerEnv.ROUTER_LONG_CONTEXT = `ollama,${providerEnv.OLLAMA_GENERAL_MODEL}`
} else {
  providerEnv.ROUTER_LONG_CONTEXT = legacyThinkLongContext
}

writeEnvFile(localEnvFile, localEnv, localFirstEnvOrder, [
  'Generated by scripts/setup-local-first.ts',
  'Adjust ANTHROPIC_BASE_URL only if your local router listens elsewhere.',
])

writeEnvFile(providerEnvFile, providerEnv, providerEnvOrder, [
  'Generated by scripts/setup-local-first.ts',
  'Override provider keys here when you want hybrid routing.',
])

console.log(`Wrote ${localEnvFile}`)
console.log(`Wrote ${providerEnvFile}`)

if (detectedModels.length) {
  console.log(`Detected Ollama models: ${detectedModels.join(', ')}`)
  if (toolCapableModels.length) {
    console.log(`Tool-capable Ollama models: ${toolCapableModels.join(', ')}`)
  } else {
    console.log(
      'No tool-capable Ollama models were detected. Falling back to the best available local models.',
    )
  }
  console.log(`Selected default model: ${providerEnv.OLLAMA_MODEL}`)
  console.log(`Selected think model: ${providerEnv.OLLAMA_THINK_MODEL}`)
  console.log(`Selected general model: ${providerEnv.OLLAMA_GENERAL_MODEL}`)
} else {
  console.log(
    'No local Ollama models were detected. The generated file keeps placeholder values until you pull a model.',
  )
}
