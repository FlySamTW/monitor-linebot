$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $sourceRoot 'tools\release_head_snapshot.ps1')
$repoRoot = Join-Path $sourceRoot ('output\release_snapshot_test_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $repoRoot | Out-Null
'{"scriptId":"fixture-script"}' | Set-Content (Join-Path $repoRoot '.clasp.json')
$script:pushes = 0
function Invoke-ClaspCapture {
  param([string[]]$Arguments)
  if ($Arguments[0] -eq '-P' -and $Arguments[2] -eq 'clone') {
    '{"scriptId":"fixture-script"}' | Set-Content '.clasp.json'
    '{"timeZone":"Asia/Taipei"}' | Set-Content 'appsscript.json'
    'function fixture() {}' | Set-Content 'linebot.js'
    return 'Cloned 2 files'
  }
  if ($Arguments[0] -eq 'push') {
    $script:pushes++
    if (([IO.File]::ReadAllText((Join-Path (Get-Location) '.claspignore')))[0] -ne '*') { throw 'Ignore file BOM or allowlist missing' }
    return 'Pushed fixture only'
  }
  throw 'Unexpected command'
}
$snapshot = Save-CloudHeadSnapshot
Restore-CloudHeadSnapshot $snapshot
if ($script:pushes -ne 1) { throw 'Expected one restore' }
function Assert-Rejected {
  param([scriptblock]$Action, [string]$Pattern)
  $caught = $false
  try { & $Action } catch { if ($_.Exception.Message -notmatch $Pattern) { throw }; $caught = $true }
  if (-not $caught) { throw "Expected rejection: $Pattern" }
  if ($script:pushes -ne 1) { throw 'Rejected snapshot reached push' }
}
'tampered' | Set-Content (Join-Path $snapshot.directory 'linebot.js')
Assert-Rejected { Restore-CloudHeadSnapshot $snapshot } 'hash mismatch'
$snapshot.directory = $repoRoot
Assert-Rejected { Restore-CloudHeadSnapshot $snapshot } 'outside release_state'
Write-Host 'PASS cloud HEAD snapshot/restore/readback; tampering and outside paths blocked; realCloudWrites=0'
