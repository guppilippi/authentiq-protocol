param([string]$Title)
"$Title" | Set-Content "$env:TEMP\aq-title-$($env:WT_SESSION).txt" -Encoding UTF8
