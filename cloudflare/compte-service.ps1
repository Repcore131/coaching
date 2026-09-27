# L'accès du serveur léger à la base : un compte de service Google, à la
# place de l'ancien code secret de la base (voir README, « Accès à la base »).
#   powershell -ExecutionPolicy Bypass -File C:\RepCore-web\cloudflare\compte-service.ps1
# Le fichier JSON de la clé reste HORS du dépôt :
#   C:\Users\kevin\RepCore-secrets\compte-service.json
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$fichier = Join-Path $env:USERPROFILE 'RepCore-secrets\compte-service.json'
if (-not (Test-Path $fichier)) { throw "Clé introuvable : $fichier (README, « Accès à la base », étapes 1 à 3)." }
Write-Host "1/3  Clé du compte de service -> secret FIREBASE_SERVICE_ACCOUNT." -ForegroundColor Cyan
(Get-Content $fichier -Raw).Trim() | npx --yes wrangler@4 secret put FIREBASE_SERVICE_ACCOUNT
if ($LASTEXITCODE -ne 0) { throw "La clé n'a pas été posée." }
Start-Sleep -Seconds 5
Write-Host "2/3  Vérification." -ForegroundColor Cyan
$s = (Invoke-WebRequest -UseBasicParsing 'https://repcore-serveur.repcore.workers.dev/sante').Content
Write-Host $s
if ($s -notmatch '"acces":"compte_service"') { throw "Le serveur n'utilise pas encore le compte de service : l'ancien secret reste en place." }
Write-Host "3/3  L'ancien code secret n'a plus d'usage : on le retire du serveur." -ForegroundColor Cyan
npx --yes wrangler@4 secret delete FIREBASE_DB_SECRET
Write-Host ""
Write-Host "Reste à le RÉVOQUER chez Firebase : Paramètres du projet > Comptes de service >"
Write-Host "Codes secrets de la base de données > supprimer. Tant qu'il existe, il ouvre toute la base." -ForegroundColor Yellow
