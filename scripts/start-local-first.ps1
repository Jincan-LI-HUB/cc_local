param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ClaudeArgs
)

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local-first"

if (-not (Test-Path $envFile)) {
  Write-Error "Missing $envFile. Create it from .env.local-first.example first."
  exit 1
}

bun --env-file=$envFile ./src/entrypoints/cli.tsx @ClaudeArgs
