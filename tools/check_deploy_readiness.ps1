param(
  [string]$DeploymentId = "AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA",
  [switch]$SkipRemoteHead
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

function Get-ProjectConfig {
  $path = Join-Path $repoRoot ".clasp.json"
  if (-not (Test-Path $path)) {
    throw ".clasp.json not found."
  }
  Get-Content $path -Raw | ConvertFrom-Json
}

function Get-ClaspAuthToken {
  $path = Join-Path $env:USERPROFILE ".clasprc.json"
  if (-not (Test-Path $path)) {
    return $null
  }
  $auth = Get-Content $path -Raw | ConvertFrom-Json
  if ($auth.tokens -and $auth.tokens.default -and $auth.tokens.default.access_token) {
    return $auth.tokens.default.access_token
  }
  if ($auth.token -and $auth.token.access_token) {
    return $auth.token.access_token
  }
  return $null
}

function Get-RemoteHeadVersion {
  param(
    [string]$ScriptId,
    [string]$AccessToken
  )

  if (-not $AccessToken) {
    return [pscustomobject]@{
      Available = $false
      Error = "No clasp access token found."
      Version = ""
      Build = ""
      HasBadApiText = $null
    }
  }

  try {
    $uri = "https://script.googleapis.com/v1/projects/$ScriptId/content"
    $response = Invoke-RestMethod -Method Get -Uri $uri -Headers @{ Authorization = "Bearer $AccessToken" }
    $linebot = $response.files | Where-Object { $_.name -eq "linebot" -and $_.type -eq "SERVER_JS" } | Select-Object -First 1
    if (-not $linebot) {
      throw "Remote linebot source not found."
    }
    $source = [string]$linebot.source
    $version = [regex]::Match($source, 'const GAS_VERSION = "([^"]+)"').Groups[1].Value
    $build = [regex]::Match($source, 'const BUILD_TIMESTAMP = "([^"]+)"').Groups[1].Value
    $paidPlanText = -join ([char[]](0x5347, 0x7D1A, 0x4ED8, 0x8CBB, 0x65B9, 0x6848))
    $formalRequestText = -join ([char[]](0x60A8, 0x7684, 0x8ACB, 0x6C42))
    [pscustomobject]@{
      Available = $true
      Error = ""
      Version = $version
      Build = $build
      HasBadApiText = ($source.Contains($paidPlanText) -or ($source.Contains("AI") -and $source.Contains($formalRequestText)))
    }
  } catch {
    [pscustomobject]@{
      Available = $false
      Error = $_.Exception.Message
      Version = ""
      Build = ""
      HasBadApiText = $null
    }
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

$project = Get-ProjectConfig
$local = Get-LocalGasVersion
$versions = Get-ClaspVersions
$deployments = Get-ClaspDeployments
$health = Get-DeployedHealth
$remoteHead = $null
if (-not $SkipRemoteHead) {
  $remoteHead = Get-RemoteHeadVersion -ScriptId $project.scriptId -AccessToken (Get-ClaspAuthToken)
}

Write-Host "=== GAS Deploy Readiness ==="
Write-Host "Local linebot.gs : $($local.Version) [$($local.Build)]"
if ($remoteHead) {
  if ($remoteHead.Available) {
    Write-Host "Remote HEAD      : $($remoteHead.Version) [$($remoteHead.Build)]"
    Write-Host "Bad API wording  : $($remoteHead.HasBadApiText)"
  } else {
    Write-Host "Remote HEAD      : [UNKNOWN] $($remoteHead.Error)"
  }
}
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

if ($remoteHead -and $remoteHead.Available -and $remoteHead.Version -ne $local.Version) {
  Write-Host "[PENDING] Apps Script HEAD does not match local linebot.gs." -ForegroundColor Yellow
  Write-Host "Run clasp push -f before deploying."
  exit 3
}

if ($remoteHead -and $remoteHead.Available -and $remoteHead.HasBadApiText) {
  Write-Host "[PENDING] Apps Script HEAD still contains old internal API failure wording." -ForegroundColor Yellow
  Write-Host "Check linebot.gs and run clasp push -f again."
  exit 4
}

if ($health -notmatch [regex]::Escape($local.Version)) {
  Write-Host "[PENDING] Formal deployment does not match local version yet." -ForegroundColor Yellow
  Write-Host "Run deploy.bat to update the existing deployment."
  exit 1
}

Write-Host "[OK] Formal deployment matches local version." -ForegroundColor Green
