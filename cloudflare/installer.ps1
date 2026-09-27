# ══ INSTALLER LE SERVEUR LÉGER — une commande, trois gestes de Kevin ══════
#
#   powershell -ExecutionPolicy Bypass -File C:\RepCore-web\cloudflare\installer.ps1
#
# Ce que TU fais pendant le script (et que personne ne peut faire à ta place) :
#   1. valider la connexion à Cloudflare dans le navigateur qui s'ouvre ;
#   2. si Cloudflare le demande, choisir le nom de ton sous-domaine workers.dev ;
#   3. coller le code secret de ta base Firebase quand il est demandé.
# Tout le reste est automatique. À la fin, l'adresse du serveur est écrite
# dans cloudflare\adresse.txt : Claude la branche dans l'app et publie.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$vapid = Join-Path $env:USERPROFILE 'RepCore-secrets\vapid-privee.txt'
if (-not (Test-Path $vapid)) { throw "Clé introuvable : $vapid" }

Write-Host ""
Write-Host "1/4  Connexion à Cloudflare : le navigateur s'ouvre, clique « Allow »." -ForegroundColor Cyan
npx --yes wrangler@4 login
if ($LASTEXITCODE -ne 0) { throw "Connexion refusée ou interrompue." }

Write-Host ""
Write-Host "2/4  Mise en ligne du serveur (si Cloudflare demande un sous-domaine, choisis-en un)." -ForegroundColor Cyan
$sortie = npx wrangler@4 deploy 2>&1 | Tee-Object -Variable journal
$journal | Out-String | Write-Host
$adresse = ([regex]::Match(($journal | Out-String), 'https://repcore-serveur\.[a-z0-9-]+\.workers\.dev')).Value
if (-not $adresse) { throw "Adresse du serveur introuvable dans la sortie de wrangler." }

Write-Host ""
Write-Host "3/4  Clé des notifications (automatique)." -ForegroundColor Cyan
(Get-Content $vapid -Raw).Trim() | npx wrangler@4 secret put VAPID_PRIVATE_KEY
if ($LASTEXITCODE -ne 0) { throw "La clé des notifications n'a pas été posée." }

Write-Host ""
Write-Host "4/4  Code secret de la base Firebase." -ForegroundColor Cyan
Write-Host "     Console Firebase > ⚙ Paramètres du projet > Comptes de service >"
Write-Host "     Codes secrets de la base de données > Afficher > copier, puis colle-le ici."
npx wrangler@4 secret put FIREBASE_DB_SECRET
if ($LASTEXITCODE -ne 0) { throw "Le code secret de la base n'a pas été posé." }

Set-Content -Path (Join-Path $PSScriptRoot 'adresse.txt') -Value $adresse -Encoding ascii
Start-Sleep -Seconds 5
Write-Host ""
Write-Host "Vérification : $adresse/sante" -ForegroundColor Cyan
try { (Invoke-WebRequest -UseBasicParsing "$adresse/sante").Content | Write-Host } catch { Write-Host "Pas encore joignable, réessaie dans une minute." }
Write-Host ""
Write-Host "Terminé. Dis à Claude : « c'est fait »." -ForegroundColor Green
