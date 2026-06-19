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
