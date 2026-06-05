#$env:AQ_DATA_ROOT = "C:\Projects\AuthentiQ\server\data"

npx -y concurrently -n "WEB,BUILD,CID,RPC" -c "green,yellow,cyan,magenta" `
  "npx serve -l 8080 ." `
  "npm --prefix .\loader run watch" `
  "node .\server\cidServer.js" `
  "node .\server\rpcServer.js"