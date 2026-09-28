#!/bin/sh
# Le Worker dans le vrai moteur de Cloudflare (workerd), contre la fausse base.
#   sh cloudflare/test/essai-workerd.sh <dossier de travail>
# Clés d'ESSAI générées pour l'occasion ; rien ne sort de la machine.
set -u
D="$1"; PB=8791; PW=8792
cd "$(dirname "$0")/.."
PUB=$(node test/scenario-local.mjs prep "$D" $PB)
cp "$D/.dev.vars" ./.dev.vars
node test/serveur-local.mjs $PB "$D/scenario.json" "$D/sortie.json" > "$D/base.log" 2>&1 &
PBASE=$!
npx --yes wrangler@4 dev --port $PW --test-scheduled --var FIREBASE_DB_URL:http://127.0.0.1:$PB --var VAPID_PUBLIC_KEY:$PUB > "$D/wrangler.log" 2>&1 &
PWR=$!
i=0; while [ $i -lt 90 ] && ! grep -q "Ready on" "$D/wrangler.log" 2>/dev/null; do sleep 1; i=$((i+1)); done
echo "santé : $(curl -s http://127.0.0.1:$PW/sante)"
echo "paypal sans signature : $(curl -s -o /dev/null -w '%{http_code}' -X POST -d '{"id":"WH-1"}' http://127.0.0.1:$PW/paypal) (401 attendu)"
echo "appel sans jeton : $(curl -s -o /dev/null -w '%{http_code}' -X POST -d '{"data":{}}' http://127.0.0.1:$PW/fn/cloudinaryDestroy) (401 attendu)"
echo "clés sans secret : $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PW/sante?cles=1) (401 attendu)"
n429=0; for k in $(seq 1 35); do c=$(curl -s -o /dev/null -w '%{http_code}' -H 'CF-Connecting-IP: 9.9.9.9' "http://127.0.0.1:$PW/arrivee?src=essai"); [ "$c" = 429 ] && n429=$((n429+1)); done
# L'aperçu d'une page publique, demandé comme le robot de WhatsApp : la page
# (relue sur l'hébergement réel) avec son aperçu, ou, sans réseau, la
# redirection vers la page statique. Jamais une 500.
ap=$(curl -s -A 'WhatsApp/2.23.20.0' -o "$D/apercu.html" -w '%{http_code}' "http://127.0.0.1:$PW/@julie?ref=JULIE7K2")
echo "aperçu /@julie : $ap, $(grep -o 'og:title" content="[^"]*' "$D/apercu.html" | head -1) (200 et l'aperçu, ou 302 sans réseau)"
echo "arrivées limitées : $n429 refus sur 35 appels d'une même IP (5 attendus : 30 par minute)"
curl -s "http://127.0.0.1:$PW/__scheduled?cron=*+*+*+*+*" > /dev/null
sleep 5
node test/scenario-local.mjs verif "$D"
grep -i "error\|exceeded\|exception" "$D/wrangler.log" | head -5
kill $PWR $PBASE 2>/dev/null
rm -f ./.dev.vars
