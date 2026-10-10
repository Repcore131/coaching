# Adresse d'import par club (réception e-mail)

## Choix : Cloudflare Email Workers

Recommandé face à Mailgun Routes et SendGrid Inbound Parse :
1. le domaine et les Workers sont déjà chez Cloudflare (pages publiques), aucun nouveau fournisseur ni compte ;
2. le message reste dans le Worker le temps du relais, sans boîte ni stockage chez un tiers, et la réception est gratuite ;
3. le refus se fait pendant la session SMTP (`setReject`), donc l'expéditeur est prévenu, et SPF et DKIM sont déjà évalués par Cloudflare.

## Mise en place

1. Domaine `import.fitpulse.app` dans Cloudflare, Email Routing activé, règle « catch-all » : envoyer au Worker.
2. `cp wrangler.toml.exemple wrangler.toml`, renseigner `INGEST_MAIL_URL`, puis
   `npx wrangler secret put FP_INGEST_MAIL_SECRET` (même valeur que le secret `FP_INGEST_MAIL_SECRET`
   de Secret Manager, lu par la fonction `ingestMail`).
3. `npm install && npx wrangler deploy`.

Chaque club reçoit son adresse à la création de son canal e-mail (Réglages, Club, Arrivée des exports),
régénérable par le manager. Les expéditeurs autorisés se règlent dans la même carte ; un expéditeur
hors liste est mis en quarantaine, visible dans Imports, Automatique.
