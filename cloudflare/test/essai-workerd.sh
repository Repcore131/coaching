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
curl -s "http://127.0.0.1:$PW/__scheduled?cron=*+*+*+*+*" > /dev/null
sleep 5
node test/scenario-local.mjs verif "$D"
grep -i "error\|exceeded\|exception" "$D/wrangler.log" | head -5
kill $PWR $PBASE 2>/dev/null
rm -f ./.dev.vars
