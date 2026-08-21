param(
  [string]$WebAppUrl = "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec",
  [string]$QaPath = "",
  [switch]$ConfirmWrite,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($QaPath)) {
  $QaPath = Join-Path (Split-Path $PSScriptRoot -Parent) "QA.csv"
}
if (-not (Test-Path -LiteralPath $QaPath)) {
  throw "QA source file not found: $QaPath"
}

$records = @(
  Get-Content -LiteralPath $QaPath -Encoding UTF8 |
    Where-Object { $_.StartsWith("QA2:") } |
    ForEach-Object {
      $jsonText = $_.Substring(4)
      $parsed = $jsonText | ConvertFrom-Json
      if (-not $parsed.id) {
        throw "QA2 row is missing id"
      }
      $_
    }
)

if ($records.Count -eq 0) {
  throw "No QA2 records found in $QaPath"
}

Write-Host "QA2 records ready: $($records.Count)"
if ($DryRun) {
  $records | ForEach-Object {
    $record = $_.Substring(4) | ConvertFrom-Json
    Write-Host " - $($record.id)"
  }
  exit 0
}

if (-not $ConfirmWrite) {
  throw "Refusing to write QA Sheet without -ConfirmWrite. Run -DryRun first."
}

$secret = [Environment]::GetEnvironmentVariable("GAS_MAINTENANCE_SECRET")
if ([string]::IsNullOrWhiteSpace($secret)) {
  throw "Missing GAS_MAINTENANCE_SECRET env var."
}

$payload = @{
  action = "upsert_qa2"
  secret = $secret
  records = $records
} | ConvertTo-Json -Depth 8

$response = Invoke-RestMethod `
  -Uri $WebAppUrl `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body $payload

if (-not $response.success) {
  $message = if ($response.error) { $response.error } else { "Unknown error" }
  throw "QA2 sync failed: $message"
}

Write-Host "QA2 sync completed: total=$($response.result.total), appended=$($response.result.appended), updated=$($response.result.updated)"
