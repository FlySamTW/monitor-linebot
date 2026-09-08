param(
  [Parameter(Mandatory=$true)][string]$SettingsFile,
  [Parameter(Mandatory=$true)][string]$Python,
  [switch]$DryRun
)
$ErrorActionPreference='Stop'
$settingsPath=(Resolve-Path -LiteralPath $SettingsFile).Path
$pythonPath=(Resolve-Path -LiteralPath $Python).Path
$runner=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'run_manual_index_worker.ps1')).Path
$reportPath=Join-Path (Split-Path $settingsPath) 'last-run.json'
$proofPath=Join-Path (Split-Path $settingsPath) 'activation-proof.json'
if(Test-Path -LiteralPath $proofPath) {$reportPath=$proofPath}
$report=Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json
# A local extract or an empty list is not cloud end-to-end acceptance.
if(-not $report.ok -or @($report.completed).Count -lt 1) {throw 'A successful cloud prepare/probe report is required before installing the task'}
$taskName='SamsungLineBot-ManualPageIndex'
$existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if($existing -and @($existing.Actions | Where-Object {$_.Arguments -notlike '*run_manual_index_worker.ps1*'}).Count) {throw 'Task name belongs to a different workflow'}
$arguments='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$runner+'" -SettingsFile "'+$settingsPath+'" -Python "'+$pythonPath+'"'
if($DryRun) {Write-Output 'DRY RUN: daily 09:30 and user logon; start when available; ignore overlap; 2h limit; no credentials in arguments'; exit 0}
if($reportPath -ne $proofPath) {Copy-Item -LiteralPath $reportPath -Destination $proofPath}
$powerShellPath=(Get-Command powershell.exe -ErrorAction Stop).Source
$action=New-ScheduledTaskAction -Execute $powerShellPath -Argument $arguments -WorkingDirectory (Split-Path $PSScriptRoot)
$triggers=@((New-ScheduledTaskTrigger -Daily -At '09:30'),(New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)))
$options=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal=New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings $options -Principal $principal -Description 'Samsung LINE Bot: verified PDF revision -> full page index -> immutable cloud readback. No LLM indexing fee.' -Force | Select-Object TaskName,State
