# Les quatre secrets des paiements et des vidéos.
#   powershell -ExecutionPolicy Bypass -File C:\RepCore-web\cloudflare\secrets-paiements.ps1
# Chaque valeur se colle dans une petite FENÊTRE (Ctrl+V y marche : l'invite
# de wrangler tronquait les collages), est ESSAYÉE depuis ce PC, puis envoyée
# au serveur par l'entrée standard. Rien n'est écrit sur le disque.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$PAYPAL_ID = 'AS9pdM1fxqdyzKzvuiQB3mTPAIHZW12rW_KWAOKB8XkalJXV8kEyWWBzwHPUxCBZtMMzqjJNnAjfa1f1'
$CLOUD = 'dntu57ml'

function Demander($titre, $aide) {
  $f = New-Object Windows.Forms.Form
  $f.Text = $titre; $f.Width = 560; $f.Height = 190; $f.StartPosition = 'CenterScreen'; $f.TopMost = $true
  $l = New-Object Windows.Forms.Label
  $l.Text = $aide; $l.Left = 12; $l.Top = 10; $l.Width = 520; $l.Height = 40
  $t = New-Object Windows.Forms.TextBox
  $t.Left = 12; $t.Top = 55; $t.Width = 520; $t.UseSystemPasswordChar = $true
  $b = New-Object Windows.Forms.Button
  $b.Text = 'Valider'; $b.Left = 432; $b.Top = 90; $b.Width = 100
  $b.DialogResult = [Windows.Forms.DialogResult]::OK
  $f.AcceptButton = $b
  $f.Controls.AddRange(@($l, $t, $b))
  if ($f.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) { throw 'Annulé.' }
  return $t.Text.Trim()
}

function Poser($nom, $valeur) {
  $valeur | npx --yes wrangler@4 secret put $nom | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "$nom n'a pas été posé." }
  Write-Host "     $nom posé." -ForegroundColor Green
}

function Basic($a, $b) { 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${a}:${b}")) }

# 1. Le secret PayPal : essayé en demandant un jeton à PayPal.
while ($true) {
  $ppSecret = Demander '1/4  Secret PayPal' 'developer.paypal.com > Apps & Credentials > LIVE > CoachingPro_Link > Secret key 1 (cliquer les points pour l''afficher, puis copier).'
  try {
    Invoke-RestMethod -Method Post -Uri 'https://api-m.paypal.com/v1/oauth2/token' -Headers @{ Authorization = (Basic $PAYPAL_ID $ppSecret) } -Body 'grant_type=client_credentials' -ContentType 'application/x-www-form-urlencoded' | Out-Null
    Write-Host "1/4  PayPal accepte le secret ($($ppSecret.Length) caractères)." -ForegroundColor Green; break
  } catch { Write-Host "1/4  PayPal REFUSE ce secret ($($ppSecret.Length) caractères). Recommence." -ForegroundColor Red }
}
Poser 'PAYPAL_CLIENT_SECRET' $ppSecret

# 2. Le Webhook ID : lettres majuscules et chiffres.
while ($true) {
  $wh = Demander '2/4  Webhook ID PayPal' 'Même page, en bas, section Live Webhooks : le code sous https://repcore-serveur.repcore.workers.dev/paypal'
  if ($wh -match '^[A-Z0-9]{10,30}$') { break }
  Write-Host "2/4  Ça ne ressemble pas à un Webhook ID ($($wh.Length) caractères). Recommence." -ForegroundColor Red
}
Poser 'PAYPAL_WEBHOOK_ID' $wh

# 3-4. Cloudinary : la paire essayée ensemble (ping authentifié).
while ($true) {
  $ck = Demander '3/4  Cloudinary API Key' "console.cloudinary.com > Settings > API Keys (compte $CLOUD) : la colonne API Key."
  $cs = Demander '4/4  Cloudinary API Secret' 'Même ligne : API Secret (cliquer l''œil pour l''afficher, puis copier).'
  try {
    Invoke-RestMethod -Uri "https://api.cloudinary.com/v1_1/$CLOUD/ping" -Headers @{ Authorization = (Basic $ck $cs) } | Out-Null
    Write-Host "3-4/4  Cloudinary accepte la paire." -ForegroundColor Green; break
  } catch { Write-Host "3-4/4  Cloudinary REFUSE cette paire. Recommence les deux." -ForegroundColor Red }
}
Poser 'CLOUDINARY_API_KEY' $ck
Poser 'CLOUDINARY_API_SECRET' $cs

Start-Sleep -Seconds 10
Write-Host ""
Write-Host "Contrôle par le serveur (ok attendu pour les deux) :" -ForegroundColor Cyan
(Invoke-WebRequest -UseBasicParsing "https://repcore-serveur.repcore.workers.dev/sante?cles=1&t=$(Get-Random)").Content | Write-Host
Write-Host "Terminé. Dis à Claude : « c'est fait »." -ForegroundColor Green
