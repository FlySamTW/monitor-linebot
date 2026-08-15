param(
  [string]$DeploymentId = "AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA",
  [string]$VersionDescription = "",
  [switch]$SkipStaticTests,
  [switch]$SkipReadinessCheck,
  [switch]$SkipWebhookVersionCheck,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$testRunner = Join-Path $repoRoot "test_runner"
Set-Location $repoRoot

function Invoke-Step {
  param(
    [string]$Title,
    [scriptblock]$Script
  )

  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
  & $Script
}

function Assert-CommandExists {
  param([string]$Name)

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "$Name not found. Please install it before release."
  }
}

Assert-CommandExists "npm"
Assert-CommandExists "powershell"
Assert-CommandExists "git"

Write-Host "=== Release Existing GAS Webhook ==="
Write-Host "Deployment ID : $DeploymentId"
Write-Host "Prompt source : Google Sheet Prompt!C3 (not Prompt.csv)"
Write-Host "Prompt sync   : skipped by design"
if ($DryRun) {
  Write-Host "Mode          : DRY RUN (no commands will be executed)" -ForegroundColor Yellow
}

if (-not $SkipStaticTests) {
  Invoke-Step "1/5 Static SOP guards" {
    if ($DryRun) {
      Write-Host "DRY RUN: npm run test:static"
      return
    }
    Push-Location $testRunner
    $staticExitCode = 0
    try {
      npm run test:static
      $staticExitCode = $LASTEXITCODE
    } finally {
      Pop-Location
    }
    if ($staticExitCode -ne 0) {
      throw "npm run test:static failed with exit code $staticExitCode. Release stopped."
    }
  }
} else {
  Write-Host ""
  Write-Host "=== 1/5 Static SOP guards skipped ===" -ForegroundColor Yellow
}

Invoke-Step "2/5 Git whitespace guard" {
  if ($DryRun) {
    Write-Host "DRY RUN: git diff --check"
    Write-Host "DRY RUN: git diff --cached --check"
    return
  }

  & git diff --check
  if ($LASTEXITCODE -ne 0) {
    throw "git diff --check failed. Fix whitespace errors before release."
  }
  & git diff --cached --check
  if ($LASTEXITCODE -ne 0) {
    throw "git diff --cached --check failed. Fix staged whitespace errors before release."
  }
}

Invoke-Step "3/5 Push GAS and update existing deployment" {
  $args = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    (Join-Path $repoRoot "tools\deploy_existing_webhook.ps1"),
    "-DeploymentId",
    $DeploymentId
  )

  if (-not [string]::IsNullOrWhiteSpace($VersionDescription)) {
    $args += @("-VersionDescription", $VersionDescription)
  }

  if ($DryRun) {
    Write-Host "DRY RUN: powershell $($args -join ' ')"
    return
  }

  & powershell @args
  if ($LASTEXITCODE -ne 0) {
    throw "deploy_existing_webhook.ps1 failed with exit code $LASTEXITCODE. Release stopped."
  }
}

if (-not $SkipReadinessCheck) {
  Invoke-Step "4/5 Deployment readiness check" {
    if ($DryRun) {
      Write-Host "DRY RUN: tools\check_deploy_readiness.ps1"
      return
    }
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot "tools\check_deploy_readiness.ps1")
    if ($LASTEXITCODE -ne 0) {
      throw "check_deploy_readiness.ps1 failed with exit code $LASTEXITCODE. Release stopped."
    }
  }
} else {
  Write-Host ""
  Write-Host "=== 4/5 Deployment readiness check skipped ===" -ForegroundColor Yellow
}

if (-not $SkipWebhookVersionCheck) {
  Invoke-Step "5/5 Formal TestUI version guard" {
    if ($DryRun) {
      Write-Host "DRY RUN: npm run check:webhook-version"
      return
    }
    Push-Location $testRunner
    $versionGuardExitCode = 0
    try {
      npm run check:webhook-version
      $versionGuardExitCode = $LASTEXITCODE
    } finally {
      Pop-Location
    }
    if ($versionGuardExitCode -ne 0) {
      throw "npm run check:webhook-version failed with exit code $versionGuardExitCode. Release stopped."
    }
  }
} else {
  Write-Host ""
  Write-Host "=== 5/5 Formal TestUI version guard skipped ===" -ForegroundColor Yellow
}

Write-Host ""
if ($DryRun) {
  Write-Host "[DONE] Dry run completed. No GAS code, deployment, or Prompt!C3 changes were made." -ForegroundColor Green
} else {
  Write-Host "[DONE] GAS code was pushed, the existing deployment was updated, and Prompt!C3 was not modified." -ForegroundColor Green
}
