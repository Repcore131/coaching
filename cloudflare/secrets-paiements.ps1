# Les quatre secrets des paiements et des vidéos, collés un par un.
#   powershell -ExecutionPolicy Bypass -File C:\RepCore-web\cloudflare\secrets-paiements.ps1
# Où les trouver : cloudflare/README.md, « Brancher les paiements ».
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$liste = @(
  @('PAYPAL_CLIENT_SECRET',  'PayPal : le Secret de l''application RepCore (developer.paypal.com > Apps & Credentials, mode Live).'),
  @('PAYPAL_WEBHOOK_ID',     'PayPal : le Webhook ID du webhook qui pointe vers /paypal.'),
  @('CLOUDINARY_API_KEY',    'Cloudinary : API Key (console.cloudinary.com > Settings > API Keys).'),
  @('CLOUDINARY_API_SECRET', 'Cloudinary : API Secret (même page, bouton pour l''afficher).')
)
$i = 0
foreach ($s in $liste) {
  $i++
  Write-Host ""
  Write-Host "$i/4  $($s[1])" -ForegroundColor Cyan
  Write-Host "     Colle-le avec un CLIC DROIT (Ctrl+V ne colle pas toujours ici) puis Entrée ; rien ne s affiche, c est normal."
  npx --yes wrangler@4 secret put $s[0]
  if ($LASTEXITCODE -ne 0) { throw "$($s[0]) n'a pas été posé." }
}
Start-Sleep -Seconds 5
Start-Sleep -Seconds 10
Write-Host ""
Write-Host "Controle reel des cles ("ok" attendu pour les deux) :" -ForegroundColor Cyan
(Invoke-WebRequest -UseBasicParsing "https://repcore-serveur.repcore.workers.dev/sante?cles=1&t=$(Get-Random)").Content | Write-Host
Write-Host "Terminé. Dis à Claude : « c'est fait »." -ForegroundColor Green
