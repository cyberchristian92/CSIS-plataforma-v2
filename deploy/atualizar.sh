#!/usr/bin/env bash
# Traz a versão mais nova do GitHub e reconstrói só o que mudou.
# As migrations do banco rodam sozinhas quando o backend sobe.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
sudo docker image prune -f
