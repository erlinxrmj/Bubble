#!/usr/bin/env bash
# Erstellt die .env mit zufälligen Schlüsseln. Einmal auf dem Server ausführen.
set -e
cd "$(dirname "$0")"

if [ -f .env ]; then
  echo ".env existiert schon – nichts geändert."
  exit 0
fi

read -rp "Deine Domain (z.B. meinegruppe.duckdns.org): " DOMAIN
read -rp "Registrierungs-Code für deine Freunde (frei wählbar): " CODE

cat > .env <<EOF
DOMAIN=${DOMAIN}
REGISTRATION_CODE=${CODE}
JWT_SECRET=$(openssl rand -hex 32)
LIVEKIT_API_KEY=API$(openssl rand -hex 6)
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 .env
mkdir -p data

echo
echo "Fertig! Jetzt starten mit:"
echo "  docker compose up -d --build"
echo
echo "In der App als Server-Adresse eintragen:  https://${DOMAIN}"
