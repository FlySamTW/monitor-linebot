# Loaded only by the single release entrypoint. Snapshots never include ScriptProperties.
function Get-ReleaseFileHash {
  param([string]$Path)
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($Path)))).Replace('-', '').ToLowerInvariant() }
  finally { $hasher.Dispose() }
}
function Save-CloudHeadSnapshot {
  $scriptId = (Get-Content -LiteralPath (Join-Path $repoRoot '.clasp.json') -Raw -Encoding UTF8 | ConvertFrom-Json).scriptId
  $folder = Join-Path $repoRoot ('output\release_state\head_' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $folder | Out-Null
  Push-Location $folder
  try { $cloneOutput = Invoke-ClaspCapture -Arguments @('-P', $folder, 'clone', $scriptId, '--rootDir', $folder) } finally { Pop-Location }
  $config = Get-Content -LiteralPath (Join-Path $folder '.clasp.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($config.scriptId -ne $scriptId) { throw 'Cloud HEAD snapshot script ID mismatch.' }
  $files = @(Get-ChildItem -LiteralPath $folder -File | Where-Object { $_.Name -ne '.clasp.json' } | ForEach-Object {
    [pscustomobject]@{ name = $_.Name; sha256 = Get-ReleaseFileHash $_.FullName }
  })
  if ($files.Count -lt 2 -or -not (Test-Path -LiteralPath (Join-Path $folder 'appsscript.json'))) { throw 'Cloud HEAD snapshot incomplete.' }
  $cloudCount = [regex]::Match($cloneOutput, 'Cloned\s+(\d+)\s+files')
  if (-not $cloudCount.Success -or [int]$cloudCount.Groups[1].Value -ne $files.Count) { throw 'Cloud HEAD snapshot file count mismatch.' }
  $snapshot = [pscustomobject]@{ scriptId = $scriptId; directory = $folder; files = $files; at = (Get-Date).ToUniversalTime().ToString('o') }
  $snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $folder 'snapshot.json') -Encoding UTF8
  return $snapshot
}

function Restore-CloudHeadSnapshot {
  param($Snapshot)
  $base = [IO.Path]::GetFullPath((Join-Path $repoRoot 'output\release_state')) + [IO.Path]::DirectorySeparatorChar
  $folder = [IO.Path]::GetFullPath([string]$Snapshot.directory)
  if (-not $folder.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) { throw 'HEAD backup outside release_state.' }
  $scriptId = (Get-Content -LiteralPath (Join-Path $repoRoot '.clasp.json') -Raw -Encoding UTF8 | ConvertFrom-Json).scriptId
  $config = Get-Content -LiteralPath (Join-Path $folder '.clasp.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($Snapshot.scriptId -ne $scriptId -or $config.scriptId -ne $scriptId) { throw 'HEAD restore script ID mismatch.' }
  $contentDirectory = if ($config.rootDir) { [IO.Path]::GetFullPath((Join-Path $folder $config.rootDir)) } else { $folder }
  if ($contentDirectory -ne $folder) { throw 'HEAD restore rootDir escaped snapshot directory.' }
  foreach ($file in $Snapshot.files) {
    if ([IO.Path]::GetFileName([string]$file.name) -ne $file.name) { throw 'Invalid snapshot filename.' }
    if ((Get-ReleaseFileHash (Join-Path $folder $file.name)) -ne $file.sha256) { throw 'HEAD backup hash mismatch.' }
  }
  # Use an explicit allowlist so receipt JSON cannot become GAS files.
  $ignoreLines = @('**/*', '!appsscript.json') + @($Snapshot.files | Where-Object { $_.name -ne 'appsscript.json' } | ForEach-Object { '!' + $_.name })
  [IO.File]::WriteAllText((Join-Path $folder '.claspignore'), ($ignoreLines -join "`n"), (New-Object Text.UTF8Encoding($false)))
  Push-Location $folder
  try { Invoke-ClaspCapture -Arguments @('push', '-f') | Out-Null } finally { Pop-Location }
  $readback = Save-CloudHeadSnapshot
  $expected = @($Snapshot.files | Sort-Object name | ForEach-Object { $_.name + ':' + $_.sha256 })
  $actual = @($readback.files | Sort-Object name | ForEach-Object { $_.name + ':' + $_.sha256 })
  if (Compare-Object $expected $actual) { throw 'Restored cloud HEAD did not match snapshot.' }
  Write-Host '[RESTORED] Cloud HEAD hash readback matched; properties and ledgers preserved.'
}
