# Motor de compilação do Laudo Pericial: TeX Live "scheme-full" (todos os
# pacotes LaTeX, evita ficar caçando pacote faltante um por um via tlmgr) +
# Pandoc (instalado via .deb oficial, não pelo apt, pra garantir uma versão
# recente o bastante pro Eisvogel — que exige Pandoc 3) + template Eisvogel.
FROM texlive/texlive:latest

ARG PANDOC_VERSION=3.10.1
ARG EISVOGEL_VERSION=3.5.1

RUN apt-get update && \
    apt-get install -y --no-install-recommends wget ca-certificates && \
    wget -qO /tmp/pandoc.deb "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-1-amd64.deb" && \
    apt-get install -y /tmp/pandoc.deb && \
    rm -rf /tmp/pandoc.deb /var/lib/apt/lists/*

RUN mkdir -p /root/.local/share/pandoc/templates && \
    wget -qO /tmp/eisvogel.tar.gz "https://github.com/Wandmalfarbe/pandoc-latex-template/releases/download/v${EISVOGEL_VERSION}/Eisvogel-${EISVOGEL_VERSION}.tar.gz" && \
    tar -xzf /tmp/eisvogel.tar.gz -C /tmp && \
    cp "/tmp/Eisvogel-${EISVOGEL_VERSION}/eisvogel.latex" /root/.local/share/pandoc/templates/ && \
    rm -rf /tmp/eisvogel.tar.gz "/tmp/Eisvogel-${EISVOGEL_VERSION}"
