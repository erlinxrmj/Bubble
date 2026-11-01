#!/usr/bin/env bash
# Richtet Bubble ein: prüft das System und erstellt die .env mit zufälligen Schlüsseln.
# Einmal auf dem Server (Raspberry Pi, Oracle, Linux-PC) im Ordner Bubble ausführen.
set -e
cd "$(dirname "$0")"

echo "== Bubble-Setup =="
echo

# 64-Bit nötig (LiveKit gibt es nur für 64-Bit)
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "x86_64" ]; then
  echo "FEHLER: Dein System ist $ARCH (32-Bit)."
  echo "Bubble braucht ein 64-Bit-System. Auf dem Raspberry Pi: 'Raspberry Pi OS (64-bit)' neu aufspielen."
  exit 1
fi

# Docker vorhanden?
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker fehlt. Installieren mit:"
  echo "  curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker \$USER"
  echo "Danach einmal ab- und wieder anmelden und setup.sh erneut starten."
  exit 1
fi

# Ports frei? (Caddy braucht 80/443, LiveKit 7880/7881)
BUSY=""
for p in 80 443 7880 7881; do
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$p\$"; then BUSY="$BUSY $p"; fi
done
if [ -n "$BUSY" ]; then
  echo "ACHTUNG: Diese Ports werden schon von einem anderen Programm benutzt:$BUSY"
  echo "Welches Programm es ist, siehst du mit:  sudo ss -ltnp | grep -E ':(80|443|7880|7881) '"
  echo "Bubble kann erst starten, wenn sie frei sind (siehe Anleitung, Abschnitt Probleme)."
  echo
fi

if [ -f .env ]; then
  echo ".env existiert schon – nichts geändert."
  echo "Starten mit:  docker compose up -d --build"
  exit 0
fi

read -rp "Deine Domain (z.B. meinegruppe.duckdns.org): " DOMAIN
DOMAIN=$(echo "$DOMAIN" | sed -E 's#^https?://##; s#/.*$##' | tr 'A-Z' 'a-z')
read -rp "Registrierungs-Code für deine Freunde (frei wählbar): " CODE

DUCK_LINES=""
case "$DOMAIN" in
  *.duckdns.org)
    echo
    echo "Läuft der Server bei dir zu Hause (z.B. Raspberry Pi), kann Bubble die DuckDNS-Adresse"
    echo "automatisch aktuell halten, wenn sich deine IP ändert."
    read -rp "Dein DuckDNS-Token (steht oben auf duckdns.org; leer lassen bei Oracle): " DTOKEN
    if [ -n "$DTOKEN" ]; then
      SUB=${DOMAIN%.duckdns.org}
      DUCK_LINES="COMPOSE_PROFILES=duckdns
DUCKDNS_SUBDOMAIN=${SUB}
DUCKDNS_TOKEN=${DTOKEN}"
    fi
    ;;
esac

cat > .env <<EOF
DOMAIN=${DOMAIN}
REGISTRATION_CODE=${CODE}
JWT_SECRET=$(openssl rand -hex 32)
LIVEKIT_API_KEY=API$(openssl rand -hex 6)
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
${DUCK_LINES}
EOF
chmod 600 .env
mkdir -p data

echo
echo "Fertig! Jetzt starten mit:"
echo "  docker compose up -d --build"
echo
echo "In der App als Server-Adresse eintragen:  ${DOMAIN}"
