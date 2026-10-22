# % GPU engine 3D cua MOI tien trinh chrome do Playwright mo (profile playwright_*), cong theo moc thoi gian.
# Dung: powershell -NoProfile -File gpu-util.ps1 -Seconds 8  -> in mot dong JSON.
param([int]$Seconds = 8)
$pids = @(Get-CimInstance Win32_Process -Filter "name='chrome.exe'" |
  Where-Object { $_.CommandLine -match 'playwright' } | ForEach-Object { [int]$_.ProcessId })
if ($pids.Count -eq 0) { '{"error":"no playwright chrome"}'; exit 0 }
# Counter dang rate: Get-Counter tu lay 2 lan doc; >=2 mau cach 1 s.
$n = [math]::Max(2, $Seconds)
$sets = Get-Counter '\GPU Engine(*engtype_3D)\Utilization Percentage' -SampleInterval 1 -MaxSamples $n
$perTick = @()
$hit = @{}
foreach ($set in $sets) {
  $sum = 0.0
  foreach ($c in $set.CounterSamples) {
    if ($c.InstanceName -match '^pid_(\d+)_' -and $pids -contains [int]$Matches[1]) {
      $sum += $c.CookedValue
      $hit[$Matches[1]] = 1
    }
  }
  $perTick += $sum
}
$m = $perTick | Measure-Object -Average -Maximum
"{`"pids`":`"$(($hit.Keys | Sort-Object) -join ',')`",`"avgPct`":$([math]::Round($m.Average,1)),`"maxPct`":$([math]::Round($m.Maximum,1)),`"ticks`":$($m.Count)}"
