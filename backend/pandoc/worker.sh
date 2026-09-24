#!/usr/bin/env bash
# Motor de compilação do laudo — fila em pasta compartilhada.
#
# O backend grava /work/<documento>/pedido.json (com laudo.md e anexos ao
# lado) e espera por resultado.json. Este loop pega cada pedido, compila com
# Pandoc + XeLaTeX e escreve o resultado. Assim o backend nunca precisa de
# acesso ao Docker (antes era `docker exec`, que exigiria montar o socket do
# Docker no backend — equivalente a dar root no servidor a ele).
#
# Isolamento: um laudo é código LaTeX, e LaTeX lê qualquer arquivo que o
# processo enxergue (\input{/work/<outro-documento>/laudo.md}). O modo
# "paranoico" do TeX (openin_any=p) NÃO impede leitura por caminho absoluto,
# então o isolamento é feito pelo sistema de arquivos: este worker (root, num
# container sem rede) fecha /work e copia cada pedido para uma pasta privada;
# o Pandoc roda lá como o usuário "compilador", que não enxerga /work nem as
# pastas de outras compilações.
set -uo pipefail

WORK=${WORK:-/work}
TIMEOUT=${LAUDO_TIMEOUT_S:-120}
USUARIO=compilador

compilar() {
  local dir=$1
  local pedido="$dir/pedido.json"
  local processando="$dir/pedido.processando"
  # rename é atômico: se houver dois workers, só um pega o pedido.
  mv "$pedido" "$processando" 2>/dev/null || return 0

  local template
  template=$(sed -n 's/.*"template"[[:space:]]*:[[:space:]]*"\([A-Za-z0-9._-]*\)".*/\1/p' "$processando")
  template=${template:-eisvogel}

  local area
  area=$(mktemp -d /tmp/laudo.XXXXXXXX)
  find "$dir" -mindepth 1 -maxdepth 1 ! -name pedido.processando -exec cp -R {} "$area"/ \;
  chown -R "$USUARIO:$USUARIO" "$area"
  chmod 700 "$area"

  local log sucesso
  if log=$(cd "$area" && timeout --kill-after=5 "$TIMEOUT" \
      setpriv --reuid="$USUARIO" --regid="$USUARIO" --init-groups \
      env -i PATH="$PATH" HOME="/home/$USUARIO" LANG=C.UTF-8 \
      pandoc laudo.md -o laudo.pdf --template "$template" --pdf-engine=xelatex 2>&1); then
    sucesso=true
  else
    [ $? -eq 124 ] && log="A compilação passou de ${TIMEOUT}s e foi cancelada."
    sucesso=false
  fi
  [ -f "$area/laudo.pdf" ] || sucesso=false

  # Só o PDF volta: fontes e anexos copiados saem do diretório compartilhado.
  find "$dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  [ "$sucesso" = true ] && cp "$area/laudo.pdf" "$dir/laudo.pdf"
  rm -rf "$area"
  printf '%s' "$log" | tail -c 20000 > "$dir/laudo.log"
  printf '{"sucesso": %s}\n' "$sucesso" > "$dir/resultado.json.tmp"
  mv "$dir/resultado.json.tmp" "$dir/resultado.json"
}

# O compilador não pode listar nem entrar em /work.
chmod 700 "$WORK"

echo "[laudo] aguardando pedidos em $WORK"
while true; do
  for pedido in "$WORK"/*/pedido.json; do
    [ -e "$pedido" ] || continue
    compilar "$(dirname "$pedido")"
  done
  sleep 1
done
