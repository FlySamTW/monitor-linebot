param([Parameter(Mandatory=$true)][string]$SettingsFile,[string]$Python='python')
$ErrorActionPreference='Stop'
$mutex=New-Object System.Threading.Mutex($false,'Local\SamsungManualIndexWorker')
$held=$false
$report=Join-Path (Split-Path $SettingsFile) 'last-run.json'
try {
  try {$held=$mutex.WaitOne(0)} catch [System.Threading.AbandonedMutexException] {$held=$true}
  if(-not $held) {exit 0}
  $settings=Get-Content -LiteralPath $SettingsFile -Raw -Encoding UTF8 | ConvertFrom-Json
  if($settings.endpoint -ne 'https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec') {throw 'Unexpected worker target'}
  $env:PYTHONUTF8='1'
  & $Python (Join-Path $PSScriptRoot 'manual_index_worker.py') --endpoint $settings.endpoint --secret-file $SettingsFile --report $report 2> (Join-Path (Split-Path $SettingsFile) 'last-error.txt')
  exit $LASTEXITCODE
} catch {
  # Scheduler has no interactive stderr. Persist type/id only, never settings or a request.
  @{ok=$false;error='WORKER_LAUNCH_FAILED';errorType=$_.Exception.GetType().Name;errorId=$_.FullyQualifiedErrorId;finishedAt=[DateTime]::UtcNow.ToString('o')} |
    ConvertTo-Json -Compress | Set-Content -LiteralPath $report -Encoding UTF8
  exit 1
} finally {if($held){$mutex.ReleaseMutex()};$mutex.Dispose()}
