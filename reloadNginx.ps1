$KEY  = "C:\Projects\rebelware.ppk"
$PI   = "192.168.1.76"
$USER = "momoa"
$PORT = "2212"

Write-Host "[reload] Nginx reload..."
& "plink" -ssh -P $PORT -i $KEY -l $USER $PI "sudo nginx -t && sudo systemctl reload nginx && echo '[OK]'"
if (-not $?) {
    Write-Host "[reload] Hiba"
    Read-Host "Enter: bezaras"
    exit 1
}

Read-Host "Enter: bezaras"
