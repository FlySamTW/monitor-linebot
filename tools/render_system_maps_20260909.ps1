$ErrorActionPreference='Stop'
$dir=Join-Path $PSScriptRoot '../deliverables/system_maps_20260909'
$deck=(Resolve-Path (Join-Path $dir 'Samsung_LINE_Bot_功能全貌與技術架構.pptx')).Path
$app=New-Object -ComObject PowerPoint.Application
$presentation=$null
try {
 $presentation=$app.Presentations.Open($deck,$true,$false,$false)
 $names=@('功能全貌','技術架構')
 for($i=1;$i -le 2;$i++){
  $presentation.Slides.Item($i).Export((Join-Path (Resolve-Path $dir).Path ($names[$i-1]+'.png')),'PNG',6000,4000)
  $presentation.Slides.Item($i).Export((Join-Path (Resolve-Path $dir).Path ($names[$i-1]+'-preview.png')),'PNG',1500,1000)
 }
 Write-Output ('Native PowerPoint export: '+$presentation.Slides.Count+' slides')
} finally {
 if($presentation){$presentation.Close();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)}
 [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)
}
