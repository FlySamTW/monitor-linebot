param(
  [string]$DeploymentId = "AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Get-LocalGasVersion {
  $source = Get-Content (Join-Path $repoRoot "linebot.gs") -Raw
  $version = [regex]::Match($source, 'const GAS_VERSION = "([^"]+)"').Groups[1].Value
  $build = [regex]::Match($source, 'const BUILD_TIMESTAMP = "([^"]+)"').Groups[1].Value
  [pscustomobject]@{
    Version = $version
    Build = $build
  }
}

function Get-DeployedHealth {
  $url = "https://script.google.com/macros/s/$DeploymentId/exec?health=1"
  try {
    return (Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 60).Content.Trim()
  } catch {
    return "[ERROR] $($_.Exception.Message)"
  }
}

function Get-ClaspVersions {
  $raw = & clasp versions 2>&1
  $text = ($raw | Out-String).Trim()
  $count = 0
  if ($text -match "Found\s+(\d+)\s+versions") {
    $count = [int]$Matches[1]
  }
  [pscustomobject]@{
    Count = $count
    Raw = $text
  }
}

function Get-ClaspDeployments {
  $raw = & clasp deployments 2>&1
  ($raw | Out-String).Trim()
}

$local = Get-LocalGasVersion
$versions = Get-ClaspVersions
$deployments = Get-ClaspDeployments
$health = Get-DeployedHealth

Write-Host "=== GAS Deploy Readiness ==="
Write-Host "Local linebot.gs : $($local.Version) [$($local.Build)]"
Write-Host "Formal health    : $health"
Write-Host "Version count    : $($versions.Count)"
Write-Host ""
Write-Host "Deployments:"
Write-Host $deployments
Write-Host ""

if ($versions.Count -ge 200) {
  Write-Host "[BLOCKED] Apps Script is at the 200-version limit." -ForegroundColor Yellow
  Write-Host "Delete old versions in Apps Script Project History, then run deploy.bat again."
  Write-Host "Do not create a new deployment ID."
  exit 2
}

if ($health -notmatch [regex]::Escape($local.Version)) {
  Write-Host "[PENDING] Formal deployment does not match local version yet." -ForegroundColor Yellow
  Write-Host "Run deploy.bat to update the existing deployment."
  exit 1
}

Write-Host "[OK] Formal deployment matches local version." -ForegroundColor Green
