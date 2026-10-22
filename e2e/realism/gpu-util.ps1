# % GPU engine 3D cua tien trinh GPU cua Chrome do Playwright mo (profile playwright_*), lay mau moi giay.
# Dung: powershell -NoProfile -File gpu-util.ps1 -Seconds 8  -> in mot dong JSON.
param([int]$Seconds = 8)
$gpu = Get-CimInstance Win32_Process -Filter "name='chrome.exe'" |
  Where-Object { $_.CommandLine -match 'gpu-process' -and $_.CommandLine -match 'playwright' } |
  Select-Object -First 1
if (-not $gpu) { '{"error":"no playwright gpu-process"}'; exit 0 }
$procId = $gpu.ProcessId
$samples = (Get-Counter '\GPU Engine(*engtype_3D)\Utilization Percentage' -SampleInterval 1 -MaxSamples $Seconds).CounterSamples |
  Where-Object { $_.InstanceName -match "^pid_$($procId)_" }
# Moi lan lay mau co the co nhieu engine/luid: cong theo moc thoi gian.
$perTick = $samples | Group-Object { $_.Timestamp } | ForEach-Object { ($_.Group | Measure-Object CookedValue -Sum).Sum }
$m = $perTick | Measure-Object -Average -Maximum
$luids = ($samples | ForEach-Object { ($_.InstanceName -split '_')[3..4] -join '_' } | Sort-Object -Unique) -join ','
"{`"pid`":$procId,`"avgPct`":$([math]::Round($m.Average,1)),`"maxPct`":$([math]::Round($m.Maximum,1)),`"ticks`":$($m.Count),`"luids`":`"$luids`"}"
