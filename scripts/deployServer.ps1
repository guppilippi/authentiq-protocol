$KEY     = "C:\Projects\guppilippi"
$PI      = "192.168.1.76"
$USER    = "root"
$PORT    = "2212"
$DEST    = "/opt/authentiq/server/"
$SERVICE = "aq-server"

Write-Host "[deploy] Build..."
New-Item -ItemType Directory -Force "server\js" | Out-Null
$env:NODE_PATH = Resolve-Path "loader\node_modules"
& "loader\node_modules\.bin\esbuild" "server\aqServer.js" --bundle --platform=node --format=esm "--outfile=server\js\aqServer.js"
Remove-Item Env:\NODE_PATH
if (-not $?) {
    Write-Host "[deploy] Build hiba"
    Read-Host "Enter: bezaras"
    exit 1
}

Write-Host "[deploy] Feltoltes..."
& "scp" -P $PORT -i $KEY -o StrictHostKeyChecking=accept-new "server\js\aqServer.js" "${USER}@${PI}:/tmp/"
if (-not $?) {
    Write-Host "[deploy] SCP hiba"
    Read-Host "Enter: bezaras"
    exit 1
}

Write-Host "[deploy] Deploy..."
& "ssh" -p $PORT -i $KEY -o StrictHostKeyChecking=accept-new "${USER}@${PI}" "mkdir -p $DEST && cp /tmp/aqServer.js $DEST && rc-service $SERVICE restart && rm -f /tmp/aqServer.js && echo '[deploy] Kesz.'"
if (-not $?) {
    Write-Host "[deploy] Hiba"
    Read-Host "Enter: bezaras"
    exit 1
}

Read-Host "[deploy] Sikeres. Enter: bezaras"
