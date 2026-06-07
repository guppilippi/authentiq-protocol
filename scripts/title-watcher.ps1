if (-not $env:WT_SESSION) { return }

$aqTitleFile = "$env:TEMP\aq-title-$($env:WT_SESSION).txt"
'' | Set-Content $aqTitleFile -Encoding UTF8

$watcher = [System.IO.FileSystemWatcher]::new(
    [System.IO.Path]::GetDirectoryName($aqTitleFile),
    [System.IO.Path]::GetFileName($aqTitleFile)
)
$watcher.EnableRaisingEvents = $true

Register-ObjectEvent -InputObject $watcher -EventName Changed -SourceIdentifier "AQTitleWatcher" -MessageData $aqTitleFile -Action {
    Start-Sleep -Milliseconds 100
    $t = (Get-Content $Event.MessageData -Encoding UTF8 -ErrorAction SilentlyContinue) -join ''
    if ($t) {
        $cmd = "[Console]::Write([char]27 + ""]0;$t"" + [char]7)"
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
        $psi = [System.Diagnostics.ProcessStartInfo]::new('powershell.exe')
        $psi.Arguments = "-NoLogo -NoProfile -NonInteractive -EncodedCommand $encoded"
        $psi.UseShellExecute = $false
        $p = [System.Diagnostics.Process]::Start($psi)
        $p.WaitForExit(3000) | Out-Null
    }
} | Out-Null
