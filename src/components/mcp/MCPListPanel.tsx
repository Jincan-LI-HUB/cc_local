import React, { useMemo, useState } from 'react'
import figures from 'figures'
import type { CommandResultDisplay } from '../../commands.js'
import { Box, color, Link, Text, useTheme } from '../../ink.js'
import { useKeybindings } from '../../keybindings/useKeybinding.js'
import type { ConfigScope } from '../../services/mcp/types.js'
import { describeMcpConfigFilePath } from '../../services/mcp/utils.js'
import { isDebugMode } from '../../utils/debug.js'
import { isLocalFirstMode } from '../../utils/localFirst.js'
import { plural } from '../../utils/stringUtils.js'
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js'
import { Byline } from '../design-system/Byline.js'
import { Dialog } from '../design-system/Dialog.js'
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js'
import { McpParsingWarnings } from './McpParsingWarnings.js'
import type { AgentMcpServerInfo, ServerInfo } from './types.js'

type Props = {
  servers: ServerInfo[]
  agentServers?: AgentMcpServerInfo[]
  hiddenBuiltInCount?: number
  onSelectServer: (server: ServerInfo) => void
  onSelectAgentServer?: (agentServer: AgentMcpServerInfo) => void
  onComplete: (
    result?: string,
    options?: {
      display?: CommandResultDisplay
    },
  ) => void
  defaultTab?: string
}

type SelectableItem =
  | {
      type: 'server'
      server: ServerInfo
    }
  | {
      type: 'agent-server'
      agentServer: AgentMcpServerInfo
    }

const SCOPE_ORDER: ConfigScope[] = ['project', 'local', 'user', 'enterprise']

function getScopeHeading(scope: ConfigScope): { label: string; path?: string } {
  switch (scope) {
    case 'project':
      return {
        label: 'Project MCPs',
        path: describeMcpConfigFilePath(scope),
      }
    case 'user':
      return {
        label: 'User MCPs',
        path: describeMcpConfigFilePath(scope),
      }
    case 'local':
      return {
        label: 'Local MCPs',
        path: describeMcpConfigFilePath(scope),
      }
    case 'enterprise':
      return {
        label: 'Enterprise MCPs',
      }
    case 'dynamic':
      return {
        label: 'Built-in MCPs',
        path: 'always available',
      }
    default:
      return {
        label: String(scope),
      }
  }
}

function groupServersByScope(serverList: ServerInfo[]): Map<ConfigScope, ServerInfo[]> {
  const groups = new Map<ConfigScope, ServerInfo[]>()

  for (const server of serverList) {
    const scope = server.scope
    if (!groups.has(scope)) {
      groups.set(scope, [])
    }
    groups.get(scope)!.push(server)
  }

  for (const group of groups.values()) {
    group.sort((a, b) => a.name.localeCompare(b.name))
  }

  return groups
}

export function MCPListPanel({
  servers,
  agentServers = [],
  hiddenBuiltInCount = 0,
  onSelectServer,
  onSelectAgentServer,
  onComplete,
}: Props): React.ReactNode {
  const [theme] = useTheme()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const debugMode = isDebugMode()
  const localFirstMode = isLocalFirstMode()

  const regularServers = useMemo(
    () => servers.filter(server => server.client.config.type !== 'claudeai-proxy'),
    [servers],
  )
  const serversByScope = useMemo(
    () => groupServersByScope(regularServers),
    [regularServers],
  )
  const claudeAiServers = useMemo(
    () =>
      servers
        .filter(server => server.client.config.type === 'claudeai-proxy')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [servers],
  )
  const dynamicServers = useMemo(
    () => (serversByScope.get('dynamic') ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    [serversByScope],
  )

  const selectableItems = useMemo<SelectableItem[]>(() => {
    const items: SelectableItem[] = []

    for (const scope of SCOPE_ORDER) {
      const scopeServers = serversByScope.get(scope) ?? []
      for (const server of scopeServers) {
        items.push({ type: 'server', server })
      }
    }

    for (const server of claudeAiServers) {
      items.push({ type: 'server', server })
    }

    for (const agentServer of agentServers) {
      items.push({ type: 'agent-server', agentServer })
    }

    if (!localFirstMode) {
      for (const server of dynamicServers) {
        items.push({ type: 'server', server })
      }
    }

    return items
  }, [agentServers, claudeAiServers, dynamicServers, localFirstMode, serversByScope])

  const visibleFailedClients = servers.some(
    server =>
      server.client.type === 'failed' &&
      (!localFirstMode || !server.name.startsWith('plugin:')),
  )

  useKeybindings(
    {
      'confirm:previous': () => {
        if (selectableItems.length === 0) {
          return
        }
        setSelectedIndex(prev =>
          prev === 0 ? selectableItems.length - 1 : prev - 1,
        )
      },
      'confirm:next': () => {
        if (selectableItems.length === 0) {
          return
        }
        setSelectedIndex(prev =>
          prev === selectableItems.length - 1 ? 0 : prev + 1,
        )
      },
      'confirm:yes': () => {
        const item = selectableItems[selectedIndex]
        if (!item) {
          return
        }
        if (item.type === 'server') {
          onSelectServer(item.server)
          return
        }
        onSelectAgentServer?.(item.agentServer)
      },
      'confirm:no': () => {
        onComplete('MCP dialog dismissed', {
          display: 'system',
        })
      },
    },
    {
      context: 'Confirmation',
    },
  )

  if (servers.length === 0 && agentServers.length === 0 && hiddenBuiltInCount === 0) {
    return null
  }

  const getServerIndex = (server: ServerInfo): number =>
    selectableItems.findIndex(
      item => item.type === 'server' && item.server === server,
    )

  const getAgentServerIndex = (agentServer: AgentMcpServerInfo): number =>
    selectableItems.findIndex(
      item => item.type === 'agent-server' && item.agentServer === agentServer,
    )

  const renderServerItem = (server: ServerInfo): React.ReactNode => {
    const index = getServerIndex(server)
    const isSelected = selectedIndex === index

    let statusIcon: string
    let statusText: string

    switch (server.client.type) {
      case 'disabled':
        statusIcon = color('inactive', theme)(figures.radioOff)
        statusText = 'disabled'
        break
      case 'connected':
        statusIcon = color('success', theme)(figures.tick)
        statusText = 'connected'
        break
      case 'pending': {
        statusIcon = color('inactive', theme)(figures.radioOff)
        const { reconnectAttempt, maxReconnectAttempts } = server.client
        statusText =
          reconnectAttempt && maxReconnectAttempts
            ? `reconnecting (${reconnectAttempt}/${maxReconnectAttempts})...`
            : 'connecting...'
        break
      }
      case 'needs-auth':
        statusIcon = color('warning', theme)(figures.triangleUpOutline)
        statusText = 'needs authentication'
        break
      default:
        statusIcon = color('error', theme)(figures.cross)
        statusText = 'failed'
        break
    }

    return (
      <Box key={`${server.name}-${index}`}>
        <Text color={isSelected ? 'suggestion' : undefined}>
          {isSelected ? `${figures.pointer} ` : '  '}
        </Text>
        <Text color={isSelected ? 'suggestion' : undefined}>{server.name}</Text>
        <Text dimColor={!isSelected}> . {statusIcon} </Text>
        <Text dimColor={!isSelected}>{statusText}</Text>
      </Box>
    )
  }

  const renderAgentServerItem = (
    agentServer: AgentMcpServerInfo,
  ): React.ReactNode => {
    const index = getAgentServerIndex(agentServer)
    const isSelected = selectedIndex === index
    const statusIcon = agentServer.needsAuth
      ? color('warning', theme)(figures.triangleUpOutline)
      : color('inactive', theme)(figures.radioOff)
    const statusText = agentServer.needsAuth ? 'may need auth' : 'agent-only'

    return (
      <Box key={`agent-${agentServer.name}-${index}`}>
        <Text color={isSelected ? 'suggestion' : undefined}>
          {isSelected ? `${figures.pointer} ` : '  '}
        </Text>
        <Text color={isSelected ? 'suggestion' : undefined}>
          {agentServer.name}
        </Text>
        <Text dimColor={!isSelected}> . {statusIcon} </Text>
        <Text dimColor={!isSelected}>{statusText}</Text>
      </Box>
    )
  }

  const totalVisibleServers = servers.length + agentServers.length - hiddenBuiltInCount
  const dynamicHeading = getScopeHeading('dynamic')

  return (
    <Box flexDirection="column">
      <McpParsingWarnings />
      <Dialog
        title="Manage MCP servers"
        subtitle={`${totalVisibleServers} ${plural(totalVisibleServers, 'server')}`}
        onCancel={() =>
          onComplete('MCP dialog dismissed', {
            display: 'system',
          })
        }
        hideInputGuide={true}
      >
        <Box flexDirection="column">
          {SCOPE_ORDER.map(scope => {
            const scopeServers = serversByScope.get(scope) ?? []
            if (scopeServers.length === 0) {
              return null
            }
            const heading = getScopeHeading(scope)
            return (
              <Box key={scope} flexDirection="column" marginBottom={1}>
                <Box paddingLeft={2}>
                  <Text bold={true}>{heading.label}</Text>
                  {heading.path ? <Text dimColor={true}> ({heading.path})</Text> : null}
                </Box>
                {scopeServers.map(renderServerItem)}
              </Box>
            )
          })}

          {claudeAiServers.length > 0 ? (
            <Box flexDirection="column" marginBottom={1}>
              <Box paddingLeft={2}>
                <Text bold={true}>claude.ai</Text>
              </Box>
              {claudeAiServers.map(renderServerItem)}
            </Box>
          ) : null}

          {agentServers.length > 0 ? (
            <Box flexDirection="column" marginBottom={1}>
              <Box paddingLeft={2}>
                <Text bold={true}>Agent MCPs</Text>
              </Box>
              {[...new Set(agentServers.flatMap(server => server.sourceAgents))].map(
                agentName => (
                  <Box key={agentName} flexDirection="column" marginTop={1}>
                    <Box paddingLeft={2}>
                      <Text dimColor={true}>@{agentName}</Text>
                    </Box>
                    {agentServers
                      .filter(server => server.sourceAgents.includes(agentName))
                      .map(renderAgentServerItem)}
                  </Box>
                ),
              )}
            </Box>
          ) : null}

          {!localFirstMode && dynamicServers.length > 0 ? (
            <Box flexDirection="column" marginBottom={1}>
              <Box paddingLeft={2}>
                <Text bold={true}>{dynamicHeading.label}</Text>
                {dynamicHeading.path ? (
                  <Text dimColor={true}> ({dynamicHeading.path})</Text>
                ) : null}
              </Box>
              {dynamicServers.map(renderServerItem)}
            </Box>
          ) : null}

          {localFirstMode && hiddenBuiltInCount > 0 ? (
            <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
              <Text dimColor={true}>
                Built-in plugin MCPs are hidden in local-first mode to keep this
                view focused on your project MCPs.
              </Text>
              <Text dimColor={true}>
                Hidden built-in MCPs: {hiddenBuiltInCount}. Use{' '}
                <Text bold={true}>claude mcp list</Text> for full diagnostics.
              </Text>
            </Box>
          ) : null}

          <Box flexDirection="column">
            {visibleFailedClients ? (
              <Text dimColor={true}>
                {debugMode
                  ? '※ Error logs shown inline with --debug'
                  : '※ Run claude --debug to see error logs'}
              </Text>
            ) : null}
            <Text dimColor={true}>
              <Link url="https://code.claude.com/docs/en/mcp">
                https://code.claude.com/docs/en/mcp
              </Link>{' '}
              for help
            </Text>
          </Box>
        </Box>
      </Dialog>
      <Box paddingX={1}>
        <Text dimColor={true} italic={true}>
          <Byline>
            <KeyboardShortcutHint shortcut="↑↓" action="navigate" />
            <KeyboardShortcutHint shortcut="Enter" action="confirm" />
            <ConfigurableShortcutHint
              action="confirm:no"
              context="Confirmation"
              fallback="Esc"
              description="cancel"
            />
          </Byline>
        </Text>
      </Box>
    </Box>
  )
}
