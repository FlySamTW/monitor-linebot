param(
  [string]$WebAppUrl = "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec",
  [string]$PromptPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($PromptPath)) {
  $PromptPath = Join-Path (Split-Path -Parent $PSScriptRoot) "Prompt.csv"
}

if (-not (Test-Path -LiteralPath $PromptPath)) {
  throw "Prompt file not found: $PromptPath"
}

$secret = $env:GAS_ADMIN_SECRET
if ([string]::IsNullOrWhiteSpace($secret)) {
  throw "Missing GAS_ADMIN_SECRET env var. It must match the GAS Script Properties GEMINI_API_KEY."
}

$promptText = Get-Content -LiteralPath $PromptPath -Raw -Encoding UTF8
$payload = @{
  action = "update_prompt_c3"
  secret = $secret
  content = $promptText
} | ConvertTo-Json -Depth 4

$response = Invoke-RestMethod `
  -Uri $WebAppUrl `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body $payload

if (-not $response.success) {
  $message = if ($response.error) { $response.error } else { "Unknown error" }
  throw "Prompt!C3 sync failed: $message"
}

$version = $response.result.version
$length = $response.result.length
Write-Host "Prompt!C3 sync completed: v$version ($length chars)"
