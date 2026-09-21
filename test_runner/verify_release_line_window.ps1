$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $repoRoot 'tools\release_line_window.ps1')
$testDirectory = Join-Path $repoRoot ('output\line_window_test_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDirectory | Out-Null
$lineWindowPath = Join-Path $testDirectory 'window.json'
$receiptPath = Join-Path $testDirectory 'receipt.json'
$source = Get-Content -LiteralPath (Join-Path $repoRoot 'linebot.gs') -Raw
$r = [pscustomobject]@{lineToolAccessible=$true;cloudWindowReadback=$true;modelComparisonReviewed=$true;surface='line';
  version=[regex]::Match($source,'const GAS_VERSION = "([^"]+)"').Groups[1].Value;
  build=[regex]::Match($source,'const BUILD_TIMESTAMP = "([^"]+)"').Groups[1].Value;
  batch='v324-cost-remediation';cap=10;actorHash=('a' * 64);spent=3.85;reserved=0;
  startsAt=[DateTimeOffset]::UtcNow.AddSeconds(-5).ToString('o');expiresAt=[DateTimeOffset]::UtcNow.AddMinutes(20).ToString('o')}
function Save-Receipt { $r | ConvertTo-Json | Set-Content -LiteralPath $receiptPath -Encoding UTF8 }
function Expect-Blocked {
  param([string]$Pattern)
  $rejected = $false
  try { Assert-LineCandidateReady $receiptPath | Out-Null } catch { if ($_.Exception.Message -notmatch $Pattern) { throw }; $rejected = $true }
  if (-not $rejected) { throw "Expected guard: $Pattern" }
}
Save-Receipt
Assert-LineCandidateReady $receiptPath | Out-Null
$r.lineToolAccessible=$false;Save-Receipt;Expect-Blocked 'LINE access';$r.lineToolAccessible=$true
$r.surface='testui';Save-Receipt;Expect-Blocked 'LINE access';$r.surface='line'
$r.modelComparisonReviewed=$false;Save-Receipt;Expect-Blocked 'comparison';$r.modelComparisonReviewed=$true
$r.spent=10;Save-Receipt;Expect-Blocked 'remaining budget';$r.spent=3.85
$r.expiresAt=[DateTimeOffset]::UtcNow.AddMinutes(31).ToString('o');Save-Receipt;Expect-Blocked '30 minutes'
$r.expiresAt=[DateTimeOffset]::UtcNow.AddSeconds(-1).ToString('o');Save-Receipt;Expect-Blocked '30 minutes'
$script:rollbackArgs=$null
function powershell.exe { $script:rollbackArgs=$args; $global:LASTEXITCODE=0 }
Write-LineReleaseWindow ([pscustomobject]@{id='fixture';phase='candidate';expiresAt=[DateTimeOffset]::UtcNow.AddSeconds(-1).ToString('o');deploymentId='existing';priorVersion=1505})
Watch-LineReleaseWindow 'fixture'
if ($script:rollbackArgs -notcontains '-RollbackVersion' -or $script:rollbackArgs -notcontains 1505) { throw 'Watchdog did not call guarded rollback.' }
Set-LineReleasePhase 'accepted'
$script:rollbackArgs=$null;Watch-LineReleaseWindow 'fixture'
if ($null -ne $script:rollbackArgs) { throw 'Finalized release must not be rolled back by watchdog.' }
Write-Host 'PASS candidate blocks missing LINE, TestUI, expired/long windows and exhausted budget; watchdog expires and honors finalization; realCloudWrites=0'
