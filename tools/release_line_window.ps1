# Transaction state belongs to the single release entrypoint, not a second deploy path.
$lineWindowPath = Join-Path $repoRoot 'output\release_state\line_window.json'
function Read-LineReleaseWindow {
  if (Test-Path -LiteralPath $lineWindowPath) { return (Get-Content -LiteralPath $lineWindowPath -Raw -Encoding UTF8 | ConvertFrom-Json) }
  return $null
}
function Write-LineReleaseWindow {
  param($Window)
  $directory = Split-Path -Parent $lineWindowPath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $tempPath = $lineWindowPath + '.tmp'
  [IO.File]::WriteAllText($tempPath, ($Window | ConvertTo-Json -Depth 15), (New-Object Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $tempPath -Destination $lineWindowPath -Force
}
function Assert-LineCandidateReady {
  param([string]$ReceiptPath)
  if (-not $ReceiptPath -or -not (Test-Path -LiteralPath $ReceiptPath)) { throw 'Real LINE readiness receipt is required before candidate deployment.' }
  $r = Get-Content -LiteralPath $ReceiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $source = Get-Content -LiteralPath (Join-Path $repoRoot 'linebot.gs') -Raw
  $version = [regex]::Match($source, 'const GAS_VERSION = "([^"]+)"').Groups[1].Value
  $build = [regex]::Match($source, 'const BUILD_TIMESTAMP = "([^"]+)"').Groups[1].Value
  $review = Get-Content -LiteralPath (Join-Path $repoRoot 'config\provider_cost_review.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($r.lineToolAccessible -ne $true -or $r.cloudWindowReadback -ne $true -or $r.surface -ne 'line') { throw 'LINE access or cloud acceptance window is not verified; no TestUI substitution.' }
  if ($r.modelComparisonReviewed -ne $true) { throw 'Model availability, quality and complete cost comparison must be reviewed first.' }
  if ($r.version -ne $version -or $r.build -ne $build -or $r.batch -ne $review.verificationBatch -or $r.cap -ne $review.authorizedCapTwd -or $r.actorHash -notmatch '^[a-f0-9]{64}$') { throw 'LINE readiness receipt does not match candidate/budget/actor.' }
  $start = [DateTimeOffset]::Parse($r.startsAt)
  $end = [DateTimeOffset]::Parse($r.expiresAt)
  $now = [DateTimeOffset]::UtcNow
  if ($start -gt $now -or $end -le $now -or ($end - $start).TotalMinutes -gt 30 -or ($now - $start).TotalMinutes -gt 5) { throw 'LINE acceptance window must be fresh, active and at most 30 minutes.' }
  if ($null -eq $r.spent -or $null -eq $r.reserved -or $r.spent -lt 0 -or $r.reserved -lt 0 -or ($r.spent + $r.reserved) -ge $r.cap) { throw 'LINE batch has no verified remaining budget.' }
  return $r
}
function Set-LineReleasePhase {
  param([string]$Phase)
  $w = Read-LineReleaseWindow
  if ($w -and $w.phase -in @('armed','candidate')) { $w.phase = $Phase; Write-LineReleaseWindow $w }
}
function Start-LineReleaseWatchdog {
  param($Receipt, $Evidence)
  $w = [pscustomobject]@{id=[guid]::NewGuid().ToString('N');phase='armed';deploymentId=$DeploymentId;
    expiresAt=$Receipt.expiresAt;candidateVersion=0;version=$Receipt.version;build=$Receipt.build;
    priorVersion=$Evidence.version;receiptSha256=(Get-ReleaseFileHash $LineReadinessReceipt)}
  Write-LineReleaseWindow $w
  $entry = Join-Path $repoRoot 'tools\release_existing_webhook.ps1'
  $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $entry + '" -WatchLineAcceptance "' + $w.id + '"'
  Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput ($lineWindowPath + '.watchdog.log') -RedirectStandardError ($lineWindowPath + '.watchdog.error.log') |
    Out-Null
}
function Watch-LineReleaseWindow {
  param([string]$Id)
  while ($true) {
    $w = Read-LineReleaseWindow
    if (-not $w -or $w.id -ne $Id -or $w.phase -notin @('armed','candidate')) { return }
    if ([DateTimeOffset]::UtcNow -ge [DateTimeOffset]::Parse($w.expiresAt)) {
      # Invoke the same guarded entrypoint; never create/deploy by a separate command path.
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'tools\release_existing_webhook.ps1') -DeploymentId $w.deploymentId -RollbackVersion $w.priorVersion
      if ($LASTEXITCODE -ne 0) { throw 'LINE acceptance expired but rollback failed; immediate operator attention required.' }
      return
    }
    Start-Sleep -Seconds 5
  }
}
