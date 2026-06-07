$KEY      = "C:\Projects\rebelware.ppk"
$PI       = "192.168.1.76"
$USER     = "momoa"
$PORT     = "2212"
$DEST     = "/var/www/sftp/szoke/sftp/sftp"
$DATAROOT = "$DEST/data"

Write-Host "[reset] Feltoltes /tmp-be..."
& "pscp" -P $PORT -i $KEY "server\resetData.js" "${USER}@${PI}:/tmp/"
if (-not $?) {
    Write-Host "[reset] SCP hiba"
    Read-Host "Enter: bezaras"
    exit 1
}

Write-Host "[reset] Adatok torlese a Pi-n..."
& "plink" -ssh -P $PORT -i $KEY -l $USER $PI @"
set -e
sudo rm -rf $DEST/data/blobs/* $DEST/data/tokens/* $DEST/data/wallets/* $DEST/data/trash/*
echo '{}' | sudo tee $DEST/data/ownership.json > /dev/null
echo '[reset] Kesz.'
"@
if (-not $?) {
    Write-Host "[reset] Hiba"
    Read-Host "Enter: bezaras"
    exit 1
}

Read-Host "Enter: bezaras"
