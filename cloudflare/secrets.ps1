# Les secrets du serveur léger : notifications, base, et (facultatif) l'assistant IA.
#   powershell -ExecutionPolicy Bypass -File C:\RepCore-web\cloudflare\secrets.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$vapid = Join-Path $env:USERPROFILE 'RepCore-secrets\vapid-privee.txt'
Write-Host "1/3  Clé des notifications (automatique)." -ForegroundColor Cyan
(Get-Content $vapid -Raw).Trim() | npx --yes wrangler@4 secret put VAPID_PRIVATE_KEY
if ($LASTEXITCODE -ne 0) { throw "La clé des notifications n'a pas été posée." }
Write-Host ""
Write-Host "2/3  Accès à la base : compte de service (README, « Accès à la base »)." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'compte-service.ps1')
Write-Host ""
Write-Host "3/3  Assistant IA : la clé de l'API Claude." -ForegroundColor Cyan
Write-Host "     Colle la clé TOI-MÊME quand wrangler la demande (console.anthropic.com, API Keys)."
Write-Host "     Elle ne s'écrit nulle part ailleurs : ni dans le dépôt, ni dans un fichier, ni à Claude."
Write-Host "     Entrée vide : étape sautée, l'assistant reste « en pause »."
$poser = Read-Host "     Poser ANTHROPIC_API_KEY maintenant ? (o/N)"
if ($poser -eq 'o') {
  npx --yes wrangler@4 secret put ANTHROPIC_API_KEY
  if ($LASTEXITCODE -ne 0) { throw "La clé de l'API Claude n'a pas été posée." }
  # L'interrupteur : '0' ouvert. Pour couper l'assistant sans redéployer :
  #   '1' | npx wrangler@4 secret put IA_COUPEE
  '0' | npx --yes wrangler@4 secret put IA_COUPEE
}
Start-Sleep -Seconds 5
(Invoke-WebRequest -UseBasicParsing 'https://repcore-serveur.repcore.workers.dev/sante').Content | Write-Host
Write-Host "Terminé. Dis à Claude : « c'est fait »." -ForegroundColor Green
