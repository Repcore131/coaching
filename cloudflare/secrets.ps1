# Les deux secrets du serveur léger, et rien d'autre.
#   powershell -ExecutionPolicy Bypass -File C:\RepCore-web\cloudflare\secrets.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$vapid = Join-Path $env:USERPROFILE 'RepCore-secrets\vapid-privee.txt'
Write-Host "1/2  Clé des notifications (automatique)." -ForegroundColor Cyan
(Get-Content $vapid -Raw).Trim() | npx --yes wrangler@4 secret put VAPID_PRIVATE_KEY
if ($LASTEXITCODE -ne 0) { throw "La clé des notifications n'a pas été posée." }
Write-Host ""
Write-Host "2/2  Code secret de la base Firebase : colle-le puis Entrée." -ForegroundColor Cyan
Write-Host "     Console Firebase > Paramètres du projet > Comptes de service > Codes secrets de la base de données > Afficher."
npx --yes wrangler@4 secret put FIREBASE_DB_SECRET
if ($LASTEXITCODE -ne 0) { throw "Le code secret de la base n'a pas été posé." }
Start-Sleep -Seconds 5
(Invoke-WebRequest -UseBasicParsing 'https://repcore-serveur.repcore.workers.dev/sante').Content | Write-Host
Write-Host "Terminé. Dis à Claude : « c'est fait »." -ForegroundColor Green
