param(
  [string]$WebAppUrl = "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec",
  [string]$PromptPath = "",
  [switch]$ConfirmOverwrite
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($PromptPath)) {
  throw "PromptPath is required. This tool writes to Google Sheet Prompt!C3, so the source file must be explicit."
}

if (-not $ConfirmOverwrite) {
  throw "Refusing to update Prompt!C3 without -ConfirmOverwrite. This prevents accidental Prompt.csv uploads."
}

if (-not (Test-Path -LiteralPath $PromptPath)) {
  throw "Prompt file not found: $PromptPath"
}

# Windows PowerShell 5 can silently corrupt a Unicode request body. Relaunch
# this same guarded script in PowerShell 7 before any cloud write occurs.
if ($PSVersionTable.PSVersion.Major -lt 7) {
  $pwsh7 = "C:\Program Files\PowerShell\7\pwsh.exe"
  if (-not (Test-Path -LiteralPath $pwsh7)) {
    throw "PowerShell 7 is required for UTF-8 Prompt sync: $pwsh7"
  }
  $resolvedPromptPath = (Resolve-Path -LiteralPath $PromptPath).Path
  & $pwsh7 `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File $PSCommandPath `
    -WebAppUrl $WebAppUrl `
    -PromptPath $resolvedPromptPath `
    -ConfirmOverwrite
  exit $LASTEXITCODE
}

$secret = $env:GAS_MAINTENANCE_SECRET
if ([string]::IsNullOrWhiteSpace($secret)) {
  throw "Missing GAS_MAINTENANCE_SECRET env var. It must match the GAS Script Properties MAINTENANCE_SECRET or OPENCODE_WRITE_SECRET; Gemini API keys are never accepted."
}

$promptText = Get-Content -LiteralPath $PromptPath -Raw -Encoding UTF8
$payload = @{
  action = "update_prompt_c3"
  secret = $secret
  content = $promptText
} | ConvertTo-Json -Depth 4
$payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$response = Invoke-RestMethod `
  -Uri $WebAppUrl `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body $payloadBytes

if (-not $response.success) {
  $message = if ($response.error) { $response.error } else { "Unknown error" }
  throw "Prompt!C3 sync failed: $message"
}

$version = $response.result.version
$length = $response.result.length
$expectedLength = $promptText.Trim().Length
$expectedVersionMatch = [regex]::Match($promptText, 'Prompt v([\d.]+)')
$expectedVersion = if ($expectedVersionMatch.Success) { $expectedVersionMatch.Groups[1].Value } else { "unknown" }
if ([int]$length -ne $expectedLength -or [string]$version -ne $expectedVersion) {
  throw "Prompt!C3 read-back mismatch: expected v$expectedVersion ($expectedLength chars), got v$version ($length chars)"
}
Write-Host "Prompt!C3 sync completed: v$version ($length chars)"
