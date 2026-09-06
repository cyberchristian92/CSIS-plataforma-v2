# CSIS Platform v2

Plataforma de gestão de casos periciais com trilha de integridade verificável — cadastro de
Projetos/Missões, fluxo de Entrega → Revisão com Segregação de Funções, explorador de
arquivos/documentos com hash de integridade (Merkle Tree) e laudo em PDF gerado a partir de
Markdown.

Evolução pós-defesa da Plataforma CSIS original (TCC, Flutter Web). Este repositório é
**paralelo e independente** do `csis-platform` original — aquele é o artefato acadêmico
defendido e não é tocado a partir daqui.

## Colocar no ar em 5 minutos (Docker)

Pré-requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e
rodando, [Node.js 20+](https://nodejs.org/) (só para o frontend — o backend roda inteiro dentro
do container).

```bash
git clone https://github.com/cyberchristian92/CSIS-TCC-v2.git
cd CSIS-TCC-v2

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

## Papéis de usuário

O sistema implementa os cinco papéis descritos no TCC (seção "Papéis e responsabilidades"), com
os seguintes nomes técnicos no código:

| Papel no TCC     | Nome no sistema (`papel_global`) | Responsabilidade                                                             |
| ---------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Administrador     | `ADMIN`                          | Gerencia usuários, ajusta permissões, acompanha auditoria, configura a marca (nome/logo). |
| Coordenador       | `LIDER`                          | Planeja o caso, cria/atribui Missões, gerencia Projetos e Áreas.              |
| Especialista       | `COLABORADOR`                    | Executa as Missões atribuídas a ele e produz as entregas.                    |
| Revisor            | `REVISOR`                        | Avalia as entregas (aprova/rejeita) — nunca a própria (Segregação de Funções). |
| Cliente            | — *(ainda não implementado)*     | Solicita o serviço e recebe o resultado final.                               |

> O papel **Cliente** está descrito no TCC mas ainda não tem uma tela/permissão própria no
> sistema — hoje ele existe só como conceito de processo (quem contrata a perícia), sem login na
> plataforma. Ver `docs/adr/` para decisões futuras sobre isso.

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
- **Código aberto / auto-hospedável**: qualquer empresa pode subir sua própria instância com seus
  próprios dados, nome e logo (ver Configurações, admin).

Lista completa de decisões e o porquê de cada uma: [`docs/adr/`](docs/adr/).
