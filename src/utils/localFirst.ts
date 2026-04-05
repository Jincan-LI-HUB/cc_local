import { isEnvTruthy } from './envUtils.js'

export const LOCAL_FIRST_ENV_VAR = 'CLAUDE_CODE_LOCAL_FIRST'

/**
 * Local-first mode disables Claude first-party product surfaces while keeping
 * the local TUI/tooling workflow intact behind an Anthropic-compatible gateway.
 */
export function isLocalFirstMode(): boolean {
  return isEnvTruthy(process.env[LOCAL_FIRST_ENV_VAR])
}
