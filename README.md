# CSIS Platform

Plataforma de gestão de casos periciais (perícia digital) com trilha de integridade
verificável. Organiza o trabalho de uma equipe de peritos em Projetos e Missões, obriga toda
entrega a passar por revisão técnica antes de virar resultado final, e garante que qualquer
arquivo ou documento anexado ao caso não pode ser adulterado sem deixar rastro — sem depender de
confiar na palavra de quem mexeu nele.

É auto-hospedada: cada empresa sobe a própria instância, com os próprios dados, nome e logo —
não existe uma conta compartilhada num serviço de terceiro guardando o caso de ninguém.

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

## Colocar no ar em 5 minutos (Docker)

Pré-requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e
rodando, [Node.js 20+](https://nodejs.org/) (só para o frontend — o backend roda inteiro dentro
do container).

```bash
git clone https://github.com/cyberchristian92/CSIS-plataforma-v2.git
cd CSIS-plataforma-v2

# 1. Banco + backend (aplica as migrations e cria o usuário admin sozinho)
cp .env.example .env
docker compose up -d --build

# 2. Frontend (janela/aba de terminal separada)
cd web
npm install
npm run dev
```

Abra **http://localhost:5174** e entre com:

- **E-mail**: `admin@csis.local`
- **Senha**: `TrocarSenha123`

(Troque a senha assim que entrar — são as credenciais padrão de qualquer instância nova, definidas
em `.env`.)

Para acompanhar os logs do backend: `docker compose logs -f backend`. Para desligar tudo:
`docker compose down` (os dados do banco continuam guardados no volume `pgdata` — some só com
`docker compose down -v`).

> **Limitação conhecida**: a geração de PDF roda um `docker exec` no container `pandoc` a partir
> do próprio backend — isso só funciona quando o **backend roda fora do Docker** (seção
> seguinte), porque o container do backend não tem acesso ao Docker do host (precisaria montar
> `/var/run/docker.sock` e instalar o CLI do Docker na imagem, o que ainda não foi feito).
> Rodando com `docker compose up`, todo o resto funciona normalmente — só o botão "Gerar PDF" vai
> falhar.
>
> **No Windows, suba o backend a partir do PowerShell/cmd, não do Git Bash**: já foi observado o
> `docker exec` falhar silenciosamente (erro genérico "Command failed", sem stderr/stdout) quando
> o processo do `npm run start:dev` é iniciado dentro de uma sessão Git Bash/MSYS — o mesmo
> comando funciona normalmente rodado à mão no PowerShell. Causa raiz não confirmada (suspeita:
> diferença de `PATH`/resolução do binário `docker` entre os dois shells), mas reiniciar o
> backend a partir do PowerShell resolve.

## Rodando sem Docker (desenvolvimento)

Útil se você quer editar o backend com hot-reload em vez de reconstruir a imagem a cada mudança.

```bash
# Banco de dados (ainda via Docker, só o Postgres)
docker compose up -d db

# Backend
cd backend
npm install
cp .env.example .env   # copie backend/.env.example — ajuste DATABASE_URL se mudou DB_PORT
npx prisma migrate deploy
npx prisma db seed
npm run start:dev      # http://localhost:3000

# Frontend (outro terminal)
cd web
npm install
npm run dev             # http://localhost:5174
```

Variáveis de ambiente relevantes (documentadas com comentário em `.env.example` e
`backend/.env.example`): `DB_PORT`/`BACKEND_PORT` (portas expostas), `JWT_SECRET` (nunca
reaproveitar o valor de exemplo fora de localhost), `FRONTEND_ORIGIN` (CORS), e
`SEED_ADMIN_NOME`/`SEED_ADMIN_EMAIL`/`SEED_ADMIN_SENHA` (usuário admin criado só no primeiro boot
com banco vazio).

## Stack técnica

| Camada | Tecnologia |
| --- | --- |
| Backend | NestJS + TypeScript, Prisma ORM, PostgreSQL |
| Frontend | React + Vite + TypeScript, TanStack Query, Tailwind CSS, dnd-kit (Kanban) |
| Autenticação | JWT em cookie `HttpOnly` (não `localStorage`) + senha com hash Bcrypt |
| Integridade | Hash de conteúdo em formato CID (`multiformats`, sem daemon IPFS) organizado em árvore de Merkle |
| Laudo em PDF | Pandoc + LaTeX (template Eisvogel por padrão, customizável por Projeto) |
| Infraestrutura | Docker Compose (Postgres + backend + motor de laudo) |

## Papéis de usuário

| Papel | Nome no sistema (`papel_global`) | Responsabilidade |
| --- | --- | --- |
| Administrador | `ADMIN` | Gerencia usuários, ajusta permissões, acompanha auditoria, configura a marca (nome/logo) da instância. |
| Coordenador | `LIDER` | Planeja o caso, cria/atribui Missões, gerencia Projetos e Áreas. |
| Especialista | `COLABORADOR` | Executa as Missões atribuídas a ele e produz as entregas. |
| Revisor | `REVISOR` | Avalia as entregas (aprova/rejeita) — nunca a própria, por Segregação de Funções. |

Não existe hoje um papel de acesso externo (cliente/solicitante) com login próprio na
plataforma — quem contrata a perícia acompanha por fora, não dentro do sistema.

## Estrutura do repositório

```
csis-platform-v2/
├── backend/     # NestJS + Prisma + PostgreSQL
├── web/         # React + Vite + TypeScript + TanStack Query
├── docs/adr/    # decisões de arquitetura (por que cada coisa foi feita do jeito que foi)
└── docker-compose.yml
```

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
