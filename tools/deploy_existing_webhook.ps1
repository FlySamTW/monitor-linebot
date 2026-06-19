param(
  [string]$DeploymentId = "AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA",
  [string]$VersionDescription = "",
  [int]$HealthRetries = 6,
  [int]$HealthRetrySeconds = 5
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Assert-CommandExists {
  param([string]$Name)

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "$Name not found. Please install and login before deploying."
  }
}

function Get-LocalGasBuild {
  $sourcePath = Join-Path $repoRoot "linebot.gs"
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "linebot.gs not found."
  }

  $source = Get-Content -LiteralPath $sourcePath -Raw
  $version = [regex]::Match($source, 'const GAS_VERSION = "([^"]+)"').Groups[1].Value
  $build = [regex]::Match($source, 'const BUILD_TIMESTAMP = "([^"]+)"').Groups[1].Value

  if ([string]::IsNullOrWhiteSpace($version)) {
    throw "Cannot find GAS_VERSION in linebot.gs."
  }

  [pscustomobject]@{
    Version = $version
    Build = $build
  }
}

function Invoke-Clasp {
  param(
    [string[]]$Arguments,
    [string]$LogPath = ""
  )

  $output = & clasp @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  $text = ($output | Out-String).Trim()
  if ($LogPath) {
    $text | Set-Content -LiteralPath $LogPath -Encoding UTF8
  }
  if ($text) {
    Write-Host $text
  }
  if ($exitCode -ne 0) {
    $error = "clasp $($Arguments -join ' ') failed with exit code $exitCode."
    if ($text) {
      $error += " $text"
    }
    throw $error
  }
  return $text
}

function Get-ClaspVersionCount {
  $output = & clasp versions 2>&1
  $exitCode = $LASTEXITCODE
  $text = ($output | Out-String).Trim()
  if ($exitCode -ne 0) {
    $error = "clasp versions failed with exit code $exitCode."
    if ($text) {
      $error += " $text"
    }
    throw $error
  }
  $match = [regex]::Match($text, "Found\s+(\d+)\s+versions")
  if (-not $match.Success) {
    throw "Could not parse Apps Script version count from clasp versions output."
  }
  return [int]$match.Groups[1].Value
}

function Stop-ForVersionLimit {
  Write-Host "[BLOCKED] Apps Script has reached the 200-version limit." -ForegroundColor Yellow
  Write-Host "Delete old unused versions in Apps Script Project History, then run this script again."
  Write-Host "Do not create a new deployment ID."
  exit 2
}

function New-GasVersion {
  param([string]$Description)

  $logPath = Join-Path $env:TEMP "clasp_version_$([guid]::NewGuid().ToString('N')).txt"
  try {
    $text = Invoke-Clasp -Arguments @("version", $Description) -LogPath $logPath
  } catch {
    $message = $_.Exception.Message
    if ($message -match "Cannot create more versions") {
      Stop-ForVersionLimit
    }
    throw
  } finally {
    if (Test-Path -LiteralPath $logPath) {
      Remove-Item -LiteralPath $logPath -Force
    }
  }

  $match = [regex]::Match($text, "Created version\s+(\d+)")
  if (-not $match.Success) {
    throw "Could not parse created GAS version number from clasp output."
  }

  return [int]$match.Groups[1].Value
}

function Get-FormalHealth {
  param([string]$Id)

  $url = "https://script.google.com/macros/s/$Id/exec?health=1"
  return (Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 60).Content.Trim()
}

Assert-CommandExists "clasp"

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot ".clasp.json"))) {
  throw ".clasp.json not found. Run this from a cloned GAS project."
}

$build = Get-LocalGasBuild
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
if ([string]::IsNullOrWhiteSpace($VersionDescription)) {
  $VersionDescription = "$($build.Version) $timestamp"
}

Write-Host "=== Deploy Existing GAS Webhook ==="
Write-Host "Local version : $($build.Version) [$($build.Build)]"
Write-Host "Deployment ID : $DeploymentId"
Write-Host "Prompt source : Google Sheet Prompt!C3 (not Prompt.csv)"
Write-Host ""

Write-Host "[Preflight] Check Apps Script version capacity before pushing HEAD..."
$versionCount = Get-ClaspVersionCount
Write-Host "Current Apps Script version count: $versionCount"
if ($versionCount -ge 200) {
  Stop-ForVersionLimit
}
Write-Host ""

Write-Host "[1/4] Push code to Apps Script HEAD..."
Invoke-Clasp -Arguments @("push", "-f") | Out-Null

Write-Host ""
Write-Host "[2/4] Create Apps Script version..."
$gasVersionNumber = New-GasVersion -Description $VersionDescription
Write-Host "Created GAS version: $gasVersionNumber"

Write-Host ""
Write-Host "[3/4] Update existing deployment..."
Invoke-Clasp -Arguments @("deploy", "-i", $DeploymentId, "-V", [string]$gasVersionNumber) | Out-Null

Write-Host ""
Write-Host "[4/4] Verify deployed health..."
$lastHealth = ""
for ($i = 1; $i -le [Math]::Max(1, $HealthRetries); $i++) {
  try {
    $lastHealth = Get-FormalHealth -Id $DeploymentId
    Write-Host "Health check ${i}/${HealthRetries}: $lastHealth"
    if ($lastHealth -match [regex]::Escape($build.Version)) {
      Write-Host ""
      Write-Host "[DONE] Existing deployment is now serving $($build.Version)." -ForegroundColor Green
      Write-Host "[NOTE] Prompt was not modified. Runtime prompt remains Google Sheet Prompt!C3."
      exit 0
    }
  } catch {
    $lastHealth = "[ERROR] $($_.Exception.Message)"
    Write-Host "Health check ${i}/${HealthRetries}: $lastHealth"
  }

  if ($i -lt $HealthRetries) {
    Start-Sleep -Seconds ([Math]::Max(1, $HealthRetrySeconds))
  }
}

throw "Deployment completed, but health did not report $($build.Version). Last health: $lastHealth"
