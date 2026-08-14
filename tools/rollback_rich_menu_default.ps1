param(
  [string]$WebAppUrl = "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec"
)

$ErrorActionPreference = "Stop"
$secret = [Environment]::GetEnvironmentVariable("GAS_MAINTENANCE_SECRET")
if ([string]::IsNullOrWhiteSpace($secret)) {
  throw "GAS_MAINTENANCE_SECRET is not set."
}

$body = @{
  action = "rollback_rich_menu_default"
  secret = $secret
} | ConvertTo-Json -Compress

$response = Invoke-RestMethod -Uri $WebAppUrl -Method Post -ContentType "application/json; charset=utf-8" -Body $body
if (-not $response.success) {
  throw "Rich Menu default rollback failed: $($response.error)"
}

$response.result | ConvertTo-Json -Depth 4
