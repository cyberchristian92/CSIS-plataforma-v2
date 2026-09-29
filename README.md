# CSIS Platform

Plataforma de gestão de casos periciais (perícia digital) com trilha de integridade
verificável. Organiza o trabalho de uma equipe de peritos em Projetos e Missões, obriga toda
entrega a passar por revisão técnica antes de virar resultado final, e garante que qualquer
arquivo ou documento anexado ao caso não pode ser adulterado sem deixar rastro — sem depender de
confiar na palavra de quem mexeu nele.

É código aberto (AGPL-3.0) e auto-hospedada: cada empresa sobe a própria instância, com os
próprios dados, nome e logo — não existe uma conta compartilhada num serviço de terceiro
guardando o caso de ninguém.

## Rodar na sua máquina

Precisa só do [Git](https://git-scm.com/downloads) e do
[Docker Desktop](https://www.docker.com/products/docker-desktop/) (no Windows, pelo WSL 2 —
veja o guia). Nada de Node, Postgres ou LaTeX instalados à mão.

```bash
git clone https://github.com/cyberchristian92/CSIS-plataforma-v2.git
cd CSIS-plataforma-v2
docker compose up -d --build
```

Abra **http://localhost:5174** e entre com `admin@csis.local` / `TrocarSenha123`.

> A **primeira** subida leva de 10 a 30 minutos: o motor de PDF baixa ~5 GB de TeX Live. Para
> usar antes disso, suba só o essencial com `docker compose up -d --build db backend web`.

Travou em algum passo? O **[guia de desenvolvimento](docs/desenvolvimento.md)** tem o passo a
passo para Windows, Mac e Linux, o dia a dia (hot-reload, migrations, testes), o mapa do código e
uma tabela de [problemas comuns](docs/desenvolvimento.md#10-problemas-comuns) com a solução de
cada um.

## Documentação

| Quero... | Leia |
|---|---|
| rodar, desenvolver, testar, entender o código | [docs/desenvolvimento.md](docs/desenvolvimento.md) |
| colocar no ar para outras pessoas usarem | [docs/hospedagem.md](docs/hospedagem.md) |
| entender por que algo foi feito de certo jeito | [docs/adr/](docs/adr/) |
| o levantamento bibliográfico do TCC | [docs/pesquisa/](docs/pesquisa/) |

## O que a plataforma resolve

Um caso de perícia digital normalmente concentra tudo numa única pessoa: quem coleta a
evidência, quem analisa, quem escreve o laudo e, na prática, quem revisa o próprio trabalho antes
de assinar. Isso funciona enquanto o volume é baixo. Quando cresce, a revisão deixa de ser um
segundo olhar de verdade e vira formalidade — e ninguém sabe reconstituir depois quem mexeu em
quê, quando, ou se um arquivo foi alterado entre a coleta e a entrega.

A CSIS resolve isso com quatro mecanismos, todos aplicados no servidor (não é convenção de
equipe, é regra que o sistema recusa violar):

- **Missões menores, dono único.** Um caso (Projeto) se divide em unidades de trabalho menores
  (Missões), cada uma atribuída a um responsável e com critério de aceite explícito.
- **Segregação de Funções (SoD).** Quem entrega uma Missão não pode aprovar a própria entrega —
  o servidor bloqueia a tentativa, não só a interface.
- **Integridade verificável.** Todo Arquivo, Documento, Pasta, Missão, Projeto, Área e Workspace
  carrega um hash de conteúdo (formato CID, como o IPFS) organizado em árvore de Merkle: mudar
  qualquer coisa recalcula o hash de tudo acima dela, automaticamente. Qualquer adulteração feita
  fora da plataforma quebra essa cadeia de forma detectável.
- **Auditoria imutável.** Toda ação relevante (criar, mover, aprovar, rejeitar, editar) vira um
  registro de log com autor, ação, data/hora e o que mudou — consultável por qualquer usuário com
  permissão, sem opção de apagar.

## Principais recursos

- **Hierarquia flexível** inspirada no método PARA (Workspace → Área → Projeto → Missão): Pastas,
  Arquivos e Documentos podem viver em qualquer um desses níveis, não só dentro de um Projeto —
  a mesma interface serve tanto pra um caso específico quanto pra "Recursos" da empresa inteira
  (logos, templates, prompts) ou ativos de uma Área.
- **Kanban** estilo Trello (colunas livres, arrastar e soltar) desacoplado do status oficial da
  Missão — mover um card de coluna é só organização; aprovar ou rejeitar uma entrega é uma ação
  explícita, validada no servidor, que não acontece por engano ao arrastar um card.
- **Fluxo de Entrega → Revisão** com histórico completo: cada Missão guarda todas as entregas
  feitas e todas as revisões recebidas (aprovada, rejeitada, com comentário), não só o estado
  atual.
- **Editor de documentos em Markdown** com barra de ferramentas e pré-visualização lado a lado.
- **Laudo em PDF a partir de Markdown**, via Pandoc + LaTeX, com template customizável: qualquer
  arquivo `.latex` enviado na raiz do Projeto aparece como opção de template (o Eisvogel já vem
  configurado como padrão).
- **Exportar projeto inteiro** num único `.zip`: `manifesto.json` (dados estruturados, com hash
  de cada arquivo), `relatorio.md` (o mesmo conteúdo em leitura corrida), e a árvore real de
  pastas/arquivos/documentos do projeto — documentos viram `.md` de verdade, não só texto
  embutido num JSON.
- **Sincronizar de volta**: reenviar um pacote exportado (depois de editado localmente — novos
  arquivos, documentos ou missões) cria só o que é novo no projeto, sem duplicar ou sobrescrever
  o que já existia. O formato exato vem documentado dentro do próprio pacote exportado
  (`COMO_SINCRONIZAR.md`).
- **Controle de acesso por papel** (RBAC) e **Listas de Acesso** configuráveis por Projeto, Área
  ou Pasta — visibilidade restrita além do papel do usuário, quando o caso exigir.
- **White-label**: nome e logo da instância editáveis pelo admin, refletidos até na tela de
  login.
- **Resumo visual do Projeto**: capa e vídeo do YouTube embutido na Visão Geral, pra dar contexto
  rápido de um caso sem precisar abrir os detalhes.

## Colocar no ar

Duas formas, as duas gratuitas — passo a passo em **[docs/hospedagem.md](docs/hospedagem.md)**:

- **Servidor com IP público** (Oracle Cloud "Always Free" + DuckDNS + HTTPS automático):
  `bash deploy/instalar.sh` no servidor faz tudo.
- **Sua própria máquina atrás de um túnel** (notebook, PC de casa — mesmo sem IP público):
  `docker-compose.tunel.yml` + Tailscale Funnel ou Cloudflare Tunnel.

## Stack técnica

| Camada | Tecnologia |
| --- | --- |
| Backend | NestJS + TypeScript, Prisma ORM, PostgreSQL |
| Frontend | React + Vite + TypeScript, TanStack Query, Tailwind CSS, dnd-kit (Kanban) |
| Autenticação | JWT em cookie `HttpOnly` (não `localStorage`) + senha com hash Bcrypt |
| Integridade | Hash de conteúdo em formato CID (`multiformats`, sem daemon IPFS) organizado em árvore de Merkle |
| Laudo em PDF | Pandoc + LaTeX (template Eisvogel por padrão, customizável por Projeto) |
| Infraestrutura | Docker Compose (Postgres + backend + frontend + motor de laudo); Caddy com HTTPS em produção |

## Papéis de usuário

| Papel | Nome no sistema (`papel_global`) | Responsabilidade |
| --- | --- | --- |
| Administrador | `ADMIN` | Gerencia usuários, ajusta permissões, acompanha auditoria, configura a marca (nome/logo) da instância. |
| Coordenador | `LIDER` | Planeja o caso, cria/atribui Missões, gerencia Projetos e Áreas. |
| Especialista | `COLABORADOR` | Executa as Missões atribuídas a ele e produz as entregas. |
| Revisor | `REVISOR` | Avalia as entregas (aprova/rejeita) — nunca a própria, por Segregação de Funções. |

Não existe hoje um papel de acesso externo (cliente/solicitante) com login próprio na
plataforma — quem contrata a perícia acompanha por fora, não dentro do sistema.

## Decisões de arquitetura

- **Hierarquia**: inspirada no método PARA (Workspace → Área → Projeto → Missão) — Pastas,
  Arquivos e Documentos podem viver em qualquer um desses níveis, não só dentro de Projetos
  (permite gerenciar "Recursos" da empresa inteira e ativos de uma Área com a mesma interface).
- **Kanban**: quadro de Missões livre estilo Trello, desacoplado do status oficial da Missão —
  mover um card não aprova nem reprova nada; essas transições são ações explícitas, validadas no
  servidor.
- **Integridade**: cada Arquivo, Documento, Pasta, Missão, Projeto, Área e Workspace tem um hash
  (CID, formato IPFS) que se propaga em cascata — mudar qualquer conteúdo recalcula o hash de
  tudo acima dele, automaticamente. Ver `docs/adr/0002-motor-de-integridade-sem-daemon-ipfs.md`.
- **Sem blockchain**: a plataforma é auto-hospedada por uma única empresa por instância — não há
  o problema de confiança entre múltiplas organizações que blockchain resolve. Ver
  `docs/adr/0001-sem-blockchain-postgres-ipfs.md`.
- **Auto-hospedável**: qualquer empresa pode subir sua própria instância com seus próprios dados,
  nome e logo (ver Configurações, admin) — sem depender de conta num serviço de terceiro.

Lista completa de decisões e o porquê de cada uma: [`docs/adr/`](docs/adr/).

## Licença

[AGPL-3.0](LICENSE). Resumo: pode usar, estudar, modificar e auto-hospedar livremente. Se você
modificar o código e oferecê-lo como serviço hospedado para terceiros, é obrigado a disponibilizar
o código-fonte das suas modificações sob a mesma licença — a cláusula de uso em rede da AGPL existe
justamente para isso, diferente da GPL comum.
