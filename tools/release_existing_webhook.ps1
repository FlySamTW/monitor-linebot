param(
  [string]$DeploymentId = "AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA",
  [string]$VersionDescription = "",
  [switch]$SkipStaticTests,
  [switch]$SkipReadinessCheck,
  [switch]$SkipWebhookVersionCheck,
  [switch]$DryRun,
  [switch]$StageOnly,
  [switch]$PublishForUserLineTest,
  [string]$UserLineTestAuthorization = '',
  [switch]$BeginLineAcceptance,
  [switch]$FinalizeLineAcceptance,
  [string]$LineReadinessReceipt = '',
  [string]$WatchLineAcceptance = '',
  [int]$RollbackVersion = 0
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

function Invoke-ClaspCapture {
  param([string[]]$Arguments)
  $output = & clasp @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  $text = ($output | Out-String).Trim()
  if ($exitCode -ne 0) {
    throw "clasp $($Arguments -join ' ') failed with exit code $exitCode. $text"
  }
  return $text
}

function Get-ExistingDeploymentVersion {
  param([string]$Id)
  $text = Invoke-ClaspCapture -Arguments @("deployments")
  $escapedId = [regex]::Escape($Id)
  $match = [regex]::Match($text, "(?m)^-\s+$escapedId\s+@([0-9]+)\s*$")
  if (-not $match.Success) {
    throw "Could not read a numeric version for existing deployment $Id."
  }
  return [int]$match.Groups[1].Value
}

function Get-ExistingDeploymentHealth {
  param([string]$Id)
  $url = "https://script.google.com/macros/s/$Id/exec?health=1&releaseCheck=$([guid]::NewGuid().ToString('N'))"
  $body = & curl.exe --silent --show-error --fail --location --max-time 25 $url
  if ($LASTEXITCODE -ne 0) { throw 'Formal health unavailable; cloud mutation stopped.' }
  return ($body | Out-String).Trim()
}

function Parse-ExistingDeploymentHealth {
  param([string]$Health)
  $match = [regex]::Match($Health, "^OK\s+-\s+Current Version:\s+([^\s]+)\s+\[([^\]]+)\]$")
  if (-not $match.Success) {
    throw "Formal health response is not a verified version/build receipt: $Health"
  }
  return [pscustomobject]@{ GasVersion = $match.Groups[1].Value; Build = $match.Groups[2].Value }
}

$rollbackEvidencePath = Join-Path $repoRoot "output\release_state\pre_release_formal.json"
. (Join-Path $PSScriptRoot 'release_head_snapshot.ps1')
. (Join-Path $PSScriptRoot 'release_line_window.ps1')

function Save-PreReleaseRollbackEvidence {
  param([string]$Id)
  $version = Get-ExistingDeploymentVersion -Id $Id
  $health = Get-ExistingDeploymentHealth -Id $Id
  $parsed = Parse-ExistingDeploymentHealth -Health $health
  $head = Save-CloudHeadSnapshot
  $folder = Split-Path -Parent $rollbackEvidencePath
  if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
  [pscustomobject]@{
    schemaVersion = 2
    cloudHead = $head
    deploymentId = $Id
    version = $version
    gasVersion = $parsed.GasVersion
    build = $parsed.Build
    health = $health
    recordedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $rollbackEvidencePath -Encoding UTF8
  Copy-Item -LiteralPath $rollbackEvidencePath -Destination (Join-Path $head.directory 'pre_release_formal.json')
  return (Get-Content -LiteralPath $rollbackEvidencePath -Raw | ConvertFrom-Json)
}

function Read-VerifiedRollbackEvidence {
  param([string]$Id, [int]$Version)
  if (-not (Test-Path -LiteralPath $rollbackEvidencePath)) {
    throw "Rollback evidence is missing: $rollbackEvidencePath"
  }
  $evidence = Get-Content -LiteralPath $rollbackEvidencePath -Raw | ConvertFrom-Json
  if ($evidence.schemaVersion -ne 2 -or -not $evidence.cloudHead -or $evidence.deploymentId -ne $Id -or [int]$evidence.version -ne $Version -or
      [string]::IsNullOrWhiteSpace([string]$evidence.gasVersion) -or [string]::IsNullOrWhiteSpace([string]$evidence.build)) {
    throw "RollbackVersion must match the saved pre-release evidence for the same deployment."
  }
  return $evidence
}

function Invoke-VerifiedRollback {
  param([string]$Id, [int]$Version, $Evidence, [switch]$WhatIfOnly)
  if ($WhatIfOnly) {
    Write-Host "DRY RUN: clasp deploy -i $Id -V $Version"
    Write-Host 'DRY RUN: restore and verify saved cloud HEAD'
    return
  }
  Invoke-ClaspCapture -Arguments @("deploy", "-i", $Id, "-V", [string]$Version) | Out-Null
  $afterVersion = Get-ExistingDeploymentVersion -Id $Id
  if ($afterVersion -ne $Version) {
    throw "Rollback readback mismatch: expected @$Version but found @$afterVersion."
  }
  $health = Get-ExistingDeploymentHealth -Id $Id
  $parsed = Parse-ExistingDeploymentHealth -Health $health
  if ($parsed.GasVersion -ne [string]$Evidence.gasVersion -or $parsed.Build -ne [string]$Evidence.build) {
    throw "Rollback health mismatch: expected $($Evidence.gasVersion) [$($Evidence.build)] but got $($parsed.GasVersion) [$($parsed.Build)]."
  }
  Write-Host "[ROLLED BACK] Existing deployment restored to @$Version / $($parsed.GasVersion) [$($parsed.Build)]." -ForegroundColor Green
  Restore-CloudHeadSnapshot -Snapshot $Evidence.cloudHead
}

Assert-CommandExists "npm"
Assert-CommandExists "powershell"
Assert-CommandExists "git"
Assert-CommandExists "clasp"
Assert-CommandExists "curl.exe"

if ($WatchLineAcceptance) { Watch-LineReleaseWindow -Id $WatchLineAcceptance; exit 0 }
if ($PublishForUserLineTest -and ($StageOnly -or $BeginLineAcceptance -or $FinalizeLineAcceptance -or $RollbackVersion -or $SkipReadinessCheck -or $SkipWebhookVersionCheck)) { throw 'User LINE test publication cannot combine modes or skip cloud health checks.' }
if ($PublishForUserLineTest -and -not $UserLineTestAuthorization) { throw 'Explicit user instruction to publish before LINE acceptance is required.' }
$releaseMutex = New-Object Threading.Mutex($false, 'Local\SamsungLineBotExistingWebhookRelease')
try { $releaseLockTaken = $releaseMutex.WaitOne(30000) } catch [Threading.AbandonedMutexException] { $releaseLockTaken = $true }
if (-not $releaseLockTaken) { throw 'Another release holds the project write lock.' }
$activeWindow = Read-LineReleaseWindow
if ($activeWindow -and $activeWindow.phase -in @('armed','candidate') -and $activeWindow.deploymentId -ne $DeploymentId) { throw 'Active candidate belongs to a different deployment.' }
if ($BeginLineAcceptance -and ($StageOnly -or $FinalizeLineAcceptance -or $RollbackVersion -or $SkipStaticTests -or $SkipReadinessCheck -or $SkipWebhookVersionCheck)) { throw 'LINE candidate release cannot skip checks or combine release modes.' }
if ($activeWindow -and $activeWindow.phase -in @('armed','candidate') -and -not ($FinalizeLineAcceptance -or $RollbackVersion)) { throw 'An active LINE release must be finalized or rolled back first.' }
if ($FinalizeLineAcceptance) {
  try {
  if ($StageOnly -or $RollbackVersion -or -not $activeWindow -or $activeWindow.phase -ne 'candidate') { throw 'No active candidate available to finalize.' }
  if ([DateTimeOffset]::UtcNow -ge [DateTimeOffset]::Parse($activeWindow.expiresAt)) { throw 'Candidate acceptance expired; rollback required.' }
  & node (Join-Path $testRunner 'verify_cost_policy_release.js') --formal
  if ($LASTEXITCODE -ne 0) { throw 'Final LINE evidence guard failed; candidate remains subject to rollback.' }
  if ((Get-ExistingDeploymentVersion -Id $DeploymentId) -ne $activeWindow.candidateVersion) { throw 'Candidate deployment was changed externally.' }
  $finalHealth = Parse-ExistingDeploymentHealth (Get-ExistingDeploymentHealth -Id $DeploymentId)
  if ($finalHealth.GasVersion -ne $activeWindow.version -or $finalHealth.Build -ne $activeWindow.build) { throw 'Candidate health mismatch.' }
  if ([DateTimeOffset]::UtcNow -ge [DateTimeOffset]::Parse($activeWindow.expiresAt)) { throw 'Candidate window expired during final checks.' }
  if (-not $DryRun) {
    Set-LineReleasePhase 'accepted'
    Write-Host '[ACCEPTED] Existing candidate finalized without rebuilding or creating another deployment.'
  } else { Write-Host '[DRY RUN] Evidence checked; candidate was not finalized.' }
  exit 0
  } catch {
    $finalizeFailure = $_
    if ($activeWindow -and $activeWindow.phase -eq 'candidate' -and -not $DryRun) {
      $prior = Read-VerifiedRollbackEvidence -Id $DeploymentId -Version $activeWindow.priorVersion
      Invoke-VerifiedRollback -Id $DeploymentId -Version $activeWindow.priorVersion -Evidence $prior
      Set-LineReleasePhase 'rolled_back'
    }
    throw $finalizeFailure
  }
}
$lineReadiness = $null
if ($BeginLineAcceptance) { $lineReadiness = Assert-LineCandidateReady $LineReadinessReceipt }

if ($RollbackVersion -lt 0) {
  throw "RollbackVersion must be a positive existing Apps Script version."
}
if ($RollbackVersion -gt 0) {
  if ($StageOnly) { throw "RollbackVersion and StageOnly are mutually exclusive." }
  if (-not [string]::IsNullOrWhiteSpace($VersionDescription)) { throw "RollbackVersion cannot be combined with a normal VersionDescription release." }
  $rollbackEvidence = Read-VerifiedRollbackEvidence -Id $DeploymentId -Version $RollbackVersion
  Write-Host "=== Rollback Existing GAS Webhook ==="
  Write-Host "Deployment ID : $DeploymentId"
  Write-Host "Target version: @$RollbackVersion / $($rollbackEvidence.gasVersion) [$($rollbackEvidence.build)]"
  if ($DryRun) {
    Invoke-VerifiedRollback -Id $DeploymentId -Version $RollbackVersion -Evidence $rollbackEvidence -WhatIfOnly
    Write-Host "[DRY RUN ONLY] No push, version creation, deployment change, cost reset, or index mutation was performed."
    exit 0
  }
  Invoke-VerifiedRollback -Id $DeploymentId -Version $RollbackVersion -Evidence $rollbackEvidence
  Set-LineReleasePhase 'rolled_back'
  exit 0
}

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
      if ($staticExitCode -eq 0) {
        npm run test:contract
        $staticExitCode = $LASTEXITCODE
      }
      if ($staticExitCode -eq 0) {
        npm run test:production-contract
        $staticExitCode = $LASTEXITCODE
      }
      if ($staticExitCode -eq 0) {
        npm run test:release
        $staticExitCode = $LASTEXITCODE
      }
      if ($staticExitCode -eq 0 -and $BeginLineAcceptance) {
        node verify_20_journeys_v307.js
        $staticExitCode = $LASTEXITCODE
      }
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

$preReleaseRollbackEvidence = $null
if (-not $DryRun) {
  $gateArgs = @((Join-Path $testRunner "verify_cost_policy_release.js"))
  if ($PublishForUserLineTest) { $gateArgs += @('--user-line-test', $UserLineTestAuthorization) }
  elseif (-not $StageOnly -and -not $BeginLineAcceptance) { $gateArgs += '--formal' }
  & node @gateArgs
  if ($LASTEXITCODE -ne 0) { throw "Live model/cost evidence guard failed." }
  $preReleaseRollbackEvidence = Save-PreReleaseRollbackEvidence -Id $DeploymentId
  if ($PublishForUserLineTest) {
    Copy-Item -LiteralPath $UserLineTestAuthorization -Destination (Join-Path $preReleaseRollbackEvidence.cloudHead.directory 'user_line_test_authorization.json')
    Write-Host '[USER DIRECTED] Publish existing webhook for the user to test in LINE. Live acceptance remains false.'
  }
  Write-Host "Saved rollback evidence: @$($preReleaseRollbackEvidence.version) / $($preReleaseRollbackEvidence.gasVersion) [$($preReleaseRollbackEvidence.build)]"
  if ($BeginLineAcceptance) {
    $lineReadiness = Assert-LineCandidateReady $LineReadinessReceipt
    Start-LineReleaseWatchdog -Receipt $lineReadiness -Evidence $preReleaseRollbackEvidence
  }
}

# Cover push failures and every post-deployment readiness/health failure, including HEAD changes.
trap {
  $releaseFailure = $_
  if ($preReleaseRollbackEvidence -and -not $DryRun) {
    try {
      Write-Host '[RECOVERY] executing one verified rollback of deployment and cloud HEAD'
      Invoke-VerifiedRollback -Id $DeploymentId -Version ([int]$preReleaseRollbackEvidence.version) -Evidence $preReleaseRollbackEvidence
      Set-LineReleasePhase 'rolled_back'
    } catch { Write-Error -ErrorAction Continue ("Release recovery failed: " + $_.Exception.Message) }
  }
  throw $releaseFailure
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
  if ($StageOnly) { $args += "-StageOnly" }

  if ($DryRun) {
    Write-Host "DRY RUN: powershell $($args -join ' ')"
    return
  }

  & powershell @args
  $deployExitCode = $LASTEXITCODE
  if ($deployExitCode -ne 0) {
    throw "deploy_existing_webhook.ps1 failed with exit code $deployExitCode. Recovery required."
  }
  if ($BeginLineAcceptance) {
    $w = Read-LineReleaseWindow
    if ([DateTimeOffset]::UtcNow -ge [DateTimeOffset]::Parse($w.expiresAt)) { throw 'Candidate window expired during deployment.' }
    $w.candidateVersion = Get-ExistingDeploymentVersion -Id $DeploymentId
    $w.phase = 'candidate'; Write-LineReleaseWindow $w
  }
}

if ($StageOnly) {
  if ($DryRun) {
    Write-Host "[DRY RUN ONLY] No tests or upload executed; formal deployment was not changed."
  } else {
    Write-Host "[STAGED ONLY] Static, production-contract and whitespace guards passed. Candidate HEAD only; formal deployment was not changed."
  }
  exit 0
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
  if ($PublishForUserLineTest) {
    $health = Parse-ExistingDeploymentHealth (Get-ExistingDeploymentHealth -Id $DeploymentId)
    [pscustomobject]@{status='published_pending_user_line_test';deploymentId=$DeploymentId;
      gasVersion=$health.GasVersion;build=$health.Build;version=(Get-ExistingDeploymentVersion -Id $DeploymentId);
      priorVersion=$preReleaseRollbackEvidence.version;liveAccepted=$false;recordedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')} |
      ConvertTo-Json | Set-Content -LiteralPath (Join-Path $repoRoot 'output/release_state/published_pending_line.json') -Encoding UTF8
    Write-Host '[PUBLISHED / LINE PENDING] Existing webhook is updated for user testing. This does not mark live acceptance complete.' -ForegroundColor Green
  } elseif ($BeginLineAcceptance) {
    Write-Host '[CANDIDATE ONLY] Existing LINE webhook updated for bounded acceptance. Finalize before deadline or watchdog restores deployment and HEAD.' -ForegroundColor Yellow
  } else {
    Write-Host "[DONE] GAS code was pushed, the existing deployment was updated, and Prompt!C3 was not modified." -ForegroundColor Green
  }
}
