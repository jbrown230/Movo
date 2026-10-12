#!/usr/bin/env bash
# Actualiza Movo en un VPS con nginx: baja el código de GitHub, compila la app y reinicia la API.
#
# Uso, en el servidor y desde cualquier carpeta:
#   bash /opt/movo/deploy/update.sh
#
# Qué hace, en orden:
#   1. Baja la última versión de la rama main (descarta cambios locales: el servidor no debe tener ninguno).
#   2. Compila la app con Vite dentro de Docker (así el servidor no necesita tener Node instalado).
#      El resultado queda en web/dist, que es la carpeta que sirve nginx.
#   3. Reconstruye y reinicia la API, Redis y MongoDB.
#   4. Comprueba que la API responda.
#
# Requisitos: Docker con Compose, y un archivo .env en la raíz del proyecto (ver .env.example).
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE_FILE="docker-compose.nginx.yml"
API_URL="http://127.0.0.1:3002/api/health"

if [ ! -f .env ]; then
  echo "Falta el archivo .env. Copia .env.example a .env y completa DOMAIN y GOOGLE_CLIENT_ID." >&2
  exit 1
fi

echo "==> 1/4 Bajando el código"
# fetch + reset (y no pull): la historia de main se reescribe al publicar versiones, y pull fallaría.
git fetch --prune origin
git reset --hard origin/main
echo "    versión: $(git log -1 --format='%h %s')"

echo "==> 2/4 Compilando la app"
docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -c "npm ci --no-audit --no-fund && npm run build"

echo "==> 3/4 Reiniciando los servicios"
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "==> 4/4 Comprobando la API"
for attempt in $(seq 1 20); do
  if response=$(curl -fsS "$API_URL" 2>/dev/null); then
    echo "    $response"
    echo "Listo: Movo está actualizado."
    exit 0
  fi
  sleep 2
done

echo "La API no respondió a tiempo. Revisa: docker compose -f $COMPOSE_FILE logs api" >&2
exit 1
