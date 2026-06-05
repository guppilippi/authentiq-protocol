$KEY     = "C:\Projects\rebelware.ppk"
$PI      = "192.168.1.76"
$USER    = "momoa"
$PORT    = "2212"
$DEST    = "/var/www/sftp/szoke/sftp/sftp/"
$SERVICE = "aq-server.service"

$files = @(
    "server\aqServer.js",
    "server\aqAuth.js",
    "server\aqData.js",
    "server\util.js"
)

Write-Host "[deploy] Feltoltes /tmp-be..."
& "pscp" -P $PORT -i $KEY @files "${USER}@${PI}:/tmp/"
if (-not $?) {
    Write-Host "[deploy] SCP hiba"
    Read-Host "Enter: bezaras"
    exit 1
}

Write-Host "[deploy] Masolas + ujrainditas..."
& "plink" -ssh -P $PORT -i $KEY -l $USER $PI `
    "sudo cp /tmp/aqServer.js /tmp/aqAuth.js /tmp/aqData.js /tmp/util.js $DEST && sudo systemctl restart $SERVICE && sudo rm -f /tmp/aqServer.js /tmp/aqAuth.js /tmp/aqData.js /tmp/util.js && echo '[deploy] Kesz.'"
if (-not $?) {
    Write-Host "[deploy] Hiba"
    Read-Host "Enter: bezaras"
    exit 1
}

Read-Host "[deploy] Sikeres. Enter: bezaras"
