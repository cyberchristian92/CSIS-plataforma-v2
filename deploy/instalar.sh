#!/usr/bin/env bash
# Prepara um servidor Ubuntu (ex.: Oracle Cloud Always Free) e sobe a
# instância. Rode de dentro da pasta do repositório clonado:
#
#   bash deploy/instalar.sh
#
# Pode rodar de novo sem problema: não recria o .env.prod se ele já existir.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "==> Firewall do sistema (portas 80 e 443)"
# As imagens Ubuntu da Oracle vêm com iptables bloqueando tudo menos SSH —
# além da "Security List" no painel, é preciso liberar aqui também.
for porta in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$porta" -j ACCEPT 2>/dev/null ||
    sudo iptables -I INPUT 5 -p tcp --dport "$porta" -j ACCEPT
done
sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null ||
  sudo iptables -I INPUT 5 -p udp --dport 443 -j ACCEPT
if command -v netfilter-persistent >/dev/null; then
  sudo netfilter-persistent save
fi

if [ ! -f .env.prod ]; then
  echo "==> Configuração (.env.prod)"
  read -rp "Endereço público, sem https:// (ex.: csis-suaempresa.duckdns.org): " dominio
  read -rp "E-mail do primeiro administrador: " email
  aleatorio() { openssl rand -hex "$1"; }
  senha_admin=$(aleatorio 9)
  sed -e "s|^DOMINIO=.*|DOMINIO=${dominio}|" \
      -e "s|^DB_SENHA=.*|DB_SENHA=$(aleatorio 24)|" \
      -e "s|^JWT_SECRET=.*|JWT_SECRET=$(aleatorio 48)|" \
      -e "s|^SEED_ADMIN_EMAIL=.*|SEED_ADMIN_EMAIL=${email}|" \
      -e "s|^SEED_ADMIN_SENHA=.*|SEED_ADMIN_SENHA=${senha_admin}|" \
      .env.prod.example > .env.prod
  chmod 600 .env.prod
  echo
  echo "   Senha inicial do administrador: ${senha_admin}"
  echo "   Anote e troque no primeiro login (fica também em .env.prod)."
  echo
fi

echo "==> Subindo (a primeira vez demora: o motor de PDF baixa ~5 GB de TeX Live)"
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

dominio=$(sed -n 's/^DOMINIO=//p' .env.prod)
echo
echo "Pronto: https://${dominio}"
echo "Logs:   sudo docker compose -f docker-compose.prod.yml logs -f backend caddy"
