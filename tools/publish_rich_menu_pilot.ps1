param(
  [string]$WebAppUrl = "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec",
  [string]$MenuPath = "docs\rich_menu\samsung_source_menu_v1.json",
  [string]$ImagePath = "docs\rich_menu\samsung_source_menu_v1.png"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedMenu = (Resolve-Path -LiteralPath (Join-Path $projectRoot $MenuPath)).Path
$resolvedImage = (Resolve-Path -LiteralPath (Join-Path $projectRoot $ImagePath)).Path
$secret = [Environment]::GetEnvironmentVariable("GAS_MAINTENANCE_SECRET")
if ([string]::IsNullOrWhiteSpace($secret)) {
  throw "GAS_MAINTENANCE_SECRET is not set."
}

$menu = Get-Content -LiteralPath $resolvedMenu -Raw -Encoding UTF8 | ConvertFrom-Json
$imageBytes = [System.IO.File]::ReadAllBytes($resolvedImage)
if ($imageBytes.Length -gt 1MB) {
  throw "Rich Menu PNG exceeds LINE's 1 MB limit."
}

$body = @{
  action = "provision_rich_menu_pilot"
  secret = $secret
  menu = $menu
  imageBase64 = [Convert]::ToBase64String($imageBytes)
} | ConvertTo-Json -Depth 12 -Compress

$response = Invoke-RestMethod -Uri $WebAppUrl -Method Post -ContentType "application/json; charset=utf-8" -Body $body
if (-not $response.success) {
  throw "Rich Menu pilot provisioning failed: $($response.error)"
}

[pscustomobject]@{
  richMenuId = $response.result.richMenuId
  linkedMenuId = $response.result.linkedMenuId
  previousAdminMenuId = $response.result.previousAdminMenuId
  defaultMenuId = $response.result.defaultMenuId
  defaultUnchanged = $response.result.defaultUnchanged
} | ConvertTo-Json -Depth 4
