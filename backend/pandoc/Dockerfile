# Motor de compilação do Laudo Pericial: TeX Live "scheme-full" (todos os
# pacotes LaTeX, evita ficar caçando pacote faltante um por um via tlmgr) +
# Pandoc (instalado via .deb oficial, não pelo apt, pra garantir uma versão
# recente o bastante pro Eisvogel — que exige Pandoc 3) + template Eisvogel.
#
# Multi-arquitetura: funciona em Intel/AMD (amd64) e em ARM (arm64 — ex.:
# Oracle Cloud Ampere, Apple Silicon). TARGETARCH vem do `docker build`.
FROM texlive/texlive:latest

ARG TARGETARCH
ARG PANDOC_VERSION=3.10.1
ARG EISVOGEL_VERSION=3.5.1

RUN apt-get update && \
    apt-get install -y --no-install-recommends wget ca-certificates && \
    ARQ="${TARGETARCH:-$(dpkg --print-architecture)}" && \
    wget -qO /tmp/pandoc.deb "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-1-${ARQ}.deb" && \
    apt-get install -y /tmp/pandoc.deb && \
    rm -rf /tmp/pandoc.deb /var/lib/apt/lists/*

# Usuário sem privilégios que roda o Pandoc/XeLaTeX; o template fica no
# diretório de dados do Pandoc dele.
RUN useradd --create-home compilador && \
    mkdir -p /home/compilador/.local/share/pandoc/templates && \
    wget -qO /tmp/eisvogel.tar.gz "https://github.com/Wandmalfarbe/pandoc-latex-template/releases/download/v${EISVOGEL_VERSION}/Eisvogel-${EISVOGEL_VERSION}.tar.gz" && \
    tar -xzf /tmp/eisvogel.tar.gz -C /tmp && \
    cp "/tmp/Eisvogel-${EISVOGEL_VERSION}/eisvogel.latex" /home/compilador/.local/share/pandoc/templates/ && \
    rm -rf /tmp/eisvogel.tar.gz "/tmp/Eisvogel-${EISVOGEL_VERSION}" && \
    chown -R compilador:compilador /home/compilador

# O worker roda como root só para mover arquivos entre a fila e a cópia
# privada de cada compilação; quem compila é o "compilador" (ver worker.sh).
COPY --chmod=755 worker.sh /usr/local/bin/laudo-worker
ENTRYPOINT ["/usr/local/bin/laudo-worker"]
