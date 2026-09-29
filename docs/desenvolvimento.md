# Guia de desenvolvimento

Tudo o que você precisa para rodar a CSIS na sua máquina, mexer no código e testar. Se é sua
primeira vez no projeto, leia as seções 1 a 3 na ordem. O resto é consulta.

- [1. Instalar o que precisa](#1-instalar-o-que-precisa)
- [2. Rodar pela primeira vez](#2-rodar-pela-primeira-vez)
- [3. O dia a dia](#3-o-dia-a-dia)
- [4. Modo híbrido: backend fora do Docker](#4-modo-híbrido-backend-fora-do-docker)
- [5. Banco de dados e migrations](#5-banco-de-dados-e-migrations)
- [6. Testes](#6-testes)
- [7. Onde fica cada coisa](#7-onde-fica-cada-coisa)
- [8. Variáveis de ambiente](#8-variáveis-de-ambiente)
- [9. Enviar sua mudança](#9-enviar-sua-mudança)
- [10. Problemas comuns](#10-problemas-comuns)

---

## 1. Instalar o que precisa

| Ferramenta | Para quê | Obrigatório? |
|---|---|---|
| [Git](https://git-scm.com/downloads) | baixar o código | sim |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ou Docker Engine no Linux) | rodar banco, backend, frontend e motor de PDF | sim |
| [Node.js 20](https://nodejs.org/) | rodar testes, criar migrations, modo híbrido (seção 4) | só para essas tarefas |

Reserve **uns 15 GB de disco livre**: o motor de PDF (TeX Live completo) sozinho ocupa ~5 GB.

### Windows

Use o **WSL 2** — o projeto roda em containers Linux e scripts de shell.

1. No PowerShell como administrador: `wsl --install` e reinicie. Isso instala o Ubuntu.
2. Instale o Docker Desktop e, em *Settings → Resources → WSL integration*, ligue a
   integração com o Ubuntu.
3. **Abra o terminal do Ubuntu (WSL) e faça tudo por ele**, inclusive o `git clone`. Clone
   dentro da sua pasta do Linux (`cd ~`), **não** em `/mnt/c/...`: numa pasta do Windows o
   Docker fica muito mais lento e o hot-reload do frontend pode não funcionar.
4. Para editar no VS Code: dentro da pasta do projeto no WSL, rode `code .` (instala a extensão
   WSL sozinho).

### Mac

Funciona igual em Intel e Apple Silicon (M1/M2/M3...) — as imagens são multi-arquitetura.
No Docker Desktop, em *Settings → Resources*, deixe pelo menos **4 GB de memória**.

### Linux

Instale o Docker Engine e o plugin Compose (`docker compose version` precisa responder) e
adicione seu usuário ao grupo `docker` (`sudo usermod -aG docker $USER`, depois saia e entre
de novo na sessão).

---

## 2. Rodar pela primeira vez

```bash
git clone https://github.com/cyberchristian92/CSIS-plataforma-v2.git
cd CSIS-plataforma-v2
cp .env.example .env          # opcional: os padrões já funcionam
docker compose up -d --build
```

Isso sobe quatro serviços:

| Serviço | O que é | Endereço na sua máquina |
|---|---|---|
| `db` | PostgreSQL 15 | `localhost:5433` |
| `backend` | API NestJS (aplica as migrations e cria o admin sozinha ao subir) | `localhost:3000` |
| `web` | Frontend React/Vite com hot-reload | **http://localhost:5174** |
| `pandoc` | Motor que gera o PDF do laudo (sem acesso à rede) | — |

### Quanto demora

**A primeira vez leva de 10 a 30 minutos**, quase tudo baixando o TeX Live para o `pandoc`.
Depois disso, subir de novo leva segundos.

Se quiser começar a usar antes de o motor de PDF ficar pronto, suba em duas etapas:

```bash
docker compose up -d --build db backend web   # ~2–5 min; já dá para usar tudo menos o PDF
docker compose up -d --build pandoc            # o PDF, quando der
```

### Como saber se está pronto

```bash
docker compose ps                 # todos devem estar "running" / "healthy"
curl http://localhost:3000/branding   # a API responde com um JSON
docker compose logs -f web        # espere aparecer "Local: http://localhost:5174/"
```

Abra **http://localhost:5174** e entre com:

- E-mail: `admin@csis.local`
- Senha: `TrocarSenha123`

(São definidos em `.env` — `SEED_ADMIN_*` — e só valem na criação do banco. Veja
[Problemas comuns](#10-problemas-comuns) se o login não entrar.)

---

## 3. O dia a dia

| Você mexeu em... | O que fazer |
|---|---|
| `web/src/**` | nada: o navegador atualiza sozinho |
| `web/package.json` (nova dependência) | `docker compose restart web` |
| `backend/src/**` | `docker compose up -d --build backend` (~1 min) — ou use o [modo híbrido](#4-modo-híbrido-backend-fora-do-docker), que recarrega sozinho |
| `backend/prisma/schema.prisma` | crie uma migration ([seção 5](#5-banco-de-dados-e-migrations)) e depois reconstrua o backend |
| `backend/pandoc/**` | `docker compose up -d --build pandoc` |

Comandos úteis:

```bash
docker compose logs -f backend        # acompanhar os logs (Ctrl+C para sair)
docker compose ps                     # o que está rodando
docker compose stop                   # parar tudo (os dados continuam)
docker compose up -d                  # voltar
docker compose down -v                # APAGAR banco, uploads e laudos e começar do zero
```

---

## 4. Modo híbrido: backend fora do Docker

Para trabalhar no backend com recarga automática (`nest start --watch`) e depurador. O banco e o
motor de PDF continuam no Docker; backend e frontend rodam direto na sua máquina (precisa do
Node 20).

```bash
# 1. Tirar backend e web do Docker (liberam as portas 3000 e 5174)
docker compose stop backend web

# 2. Fazer o motor de PDF enxergar a pasta que o backend local usa
echo "LAUDO_VOLUME=./backend/laudo-workdir" >> .env
docker compose up -d db pandoc

# 3. Backend (terminal 1)
cd backend
cp .env.example .env            # este é o .env DO BACKEND — já aponta para localhost:5433
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run start:dev               # http://localhost:3000, recarrega a cada mudança

# 4. Frontend (terminal 2)
cd web
npm install
npm run dev                     # http://localhost:5174
```

> **Dois `.env`, dois papéis.** O `.env` da **raiz** é lido pelo `docker compose`. O
> `backend/.env` só é lido quando o backend roda fora do Docker (`npm run start:dev`,
> comandos `npx prisma ...`). No modo 100% Docker da seção 2 você não precisa do
> `backend/.env`.

Para voltar ao modo só Docker: apague a linha `LAUDO_VOLUME` do `.env`, pare os
`npm run ...` e rode `docker compose up -d`.

---

## 5. Banco de dados e migrations

O esquema fica em `backend/prisma/schema.prisma`; o histórico de mudanças, em
`backend/prisma/migrations/`. **Nunca edite uma migration que já foi para o GitHub** — crie uma
nova.

Para mudar o banco (precisa do Node e do `backend/.env` da seção 4, com o `db` rodando):

```bash
cd backend
# 1. edite prisma/schema.prisma
npx prisma migrate dev --name descreva_a_mudanca   # cria a migration e aplica no seu banco
# 2. commite o schema.prisma e a pasta nova em prisma/migrations/
```

O backend aplica migrations pendentes sozinho sempre que sobe (no Docker e em produção), então
quem baixar sua mudança não precisa rodar nada à mão.

Para olhar os dados: `npx prisma studio` (abre no navegador), ou conecte qualquer cliente
PostgreSQL em `localhost:5433`, usuário `csis_user`, senha `csis_password`, banco `csis_db`.

---

## 6. Testes

Os testes de ponta a ponta (`backend/test/*.e2e-spec.ts`) sobem o backend de verdade contra um
banco **separado**, `csis_test`, e falam com ele por HTTP. Precisam do Node 20 e do `db`
rodando.

```bash
docker compose up -d db
docker compose exec db createdb -U csis_user csis_test   # só na primeira vez ("already exists" = ok)

cd backend
npm install
npm run test:e2e              # todos
npx jest --config ./test/jest-e2e.json test/auth.e2e-spec.ts   # um arquivo só
npm test                      # testes unitários (src/**/*.spec.ts)
```

Os testes não apagam nada entre rodadas: cada um cria os próprios dados. O banco de
desenvolvimento (`csis_db`) nunca é tocado.

Antes de abrir um PR, rode também:

```bash
cd backend && npm run lint
cd web && npm run build     # checa os tipos e gera o build
```

(O `web/` ainda não tem configuração de ESLint — `npm run lint` lá falha por isso.)

---

## 7. Onde fica cada coisa

```
csis-platform-v2/
├── backend/                 API — NestJS + Prisma
│   ├── prisma/
│   │   ├── schema.prisma    modelo do banco (comece por aqui para entender os dados)
│   │   ├── migrations/      histórico de mudanças do banco
│   │   └── seed.ts          cria o admin e o workspace inicial num banco vazio
│   ├── pandoc/              imagem do motor de PDF (TeX Live + Pandoc + worker.sh)
│   ├── src/                 um módulo NestJS por pasta (controller + service + dto)
│   └── test/                testes de ponta a ponta
├── web/                     Frontend — React + Vite + TanStack Query + Tailwind
│   └── src/
│       ├── pages/           uma tela por arquivo (rotas em App.tsx)
│       ├── components/      peças reutilizáveis (ui/ = componentes base)
│       └── lib/             cliente da API (api.ts), login (auth-context.tsx), tipos
├── deploy/                  scripts e Caddyfile de produção
├── docs/
│   ├── desenvolvimento.md   este guia
│   ├── hospedagem.md        colocar no ar (Oracle Cloud, túnel)
│   ├── adr/                 decisões de arquitetura e o porquê delas
│   ├── pesquisa/            levantamento bibliográfico (TCC)
│   └── historico/           resumos de sessões de desenvolvimento
├── docker-compose.yml       ambiente de desenvolvimento
├── docker-compose.prod.yml  produção (servidor com IP público + HTTPS)
└── docker-compose.tunel.yml produção atrás de túnel (notebook, PC de casa)
```

Módulos do backend (`backend/src/`), pelo domínio:

| Domínio | Pastas |
|---|---|
| Login, convite, sessão | `auth` |
| Cadastro público com aprovação | `inscricao` |
| Hierarquia de trabalho | `workspaces`, `areas`, `projetos`, `missoes`, `missao-labels`, `checklist` |
| Kanban | `colunas` |
| Entrega e revisão (com Segregação de Funções) | `entregas`, `revisoes`, `comentarios` |
| Arquivos e documentos | `pastas`, `arquivos`, `documentos` |
| Permissões e listas de acesso | `acesso` |
| Hash de conteúdo / árvore de Merkle | `integridade` |
| Log de auditoria | `auditoria` |
| PDF do laudo | `laudo` |
| Exportar / sincronizar projeto | `exportacao` |
| Infraestrutura compartilhada | `prisma`, `common`, `types`, `configurar-app.ts`, `main.ts` |

No frontend, as chamadas à API passam todas por `web/src/lib/api.ts`, sempre com o prefixo
`/api` — o Vite (no desenvolvimento) e o Caddy (em produção) repassam para o backend.

---

## 8. Variáveis de ambiente

| Arquivo | Lido por | Quando mexer |
|---|---|---|
| `.env` (raiz) — modelo em `.env.example` | `docker compose` | trocar portas, admin inicial, `VITE_POLLING` |
| `backend/.env` — modelo em `backend/.env.example` | backend fora do Docker, `npx prisma` | modo híbrido, migrations, testes |
| `.env.prod` — modelo em `.env.prod.example` | `docker-compose.prod.yml` | só em produção; gerado pelo `deploy/instalar.sh` |

Cada variável está explicada com comentário no respectivo `.example`. As que mais aparecem:

| Variável | Para quê |
|---|---|
| `DB_PORT`, `BACKEND_PORT`, `WEB_PORT` | portas na sua máquina (mude se já estiverem ocupadas) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_SENHA` | admin criado **só** quando o banco está vazio |
| `JWT_SECRET` | assina as sessões; em produção, sempre um valor aleatório |
| `FRONTEND_ORIGIN` | endereço do frontend (CORS e base dos links nos e-mails) |
| `SMTP_*` | envio de e-mail; sem isso os links de convite aparecem na tela |
| `LAUDO_VOLUME` | só no modo híbrido (seção 4) |

**Nunca commite** `.env`, `backend/.env` ou `.env.prod` — já estão no `.gitignore`.

---

## 9. Enviar sua mudança

1. Atualize e crie uma branch a partir da `master`:
   `git switch master && git pull && git switch -c minha-mudanca`
2. Faça a mudança com teste (novo comportamento no backend → um caso em `backend/test/`).
3. Rode testes, lint e build (seção 6).
4. Commits em português, dizendo o que muda para quem usa (veja `git log` para o estilo).
5. `git push -u origin minha-mudanca` e abra o Pull Request no GitHub, explicando o que mudou e
   como testar.

Mudou alguma decisão de arquitetura (banco, integridade, permissões)? Registre em
`docs/adr/` seguindo o formato dos que já existem.

---

## 10. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `port is already allocated` / `address already in use` | outra coisa usa 5433, 3000 ou 5174 | troque `DB_PORT`, `BACKEND_PORT` ou `WEB_PORT` no `.env` e rode `docker compose up -d` |
| `container name "/csis_v2_pandoc_engine" is already in use` | outra cópia do projeto (outra pasta) já está rodando | `docker rm -f csis_v2_pandoc_engine`, ou pare a outra cópia com `docker compose down` na pasta dela |
| `pandoc` reinicia sem parar; log com `bad interpreter` ou `\r` | clone feito no Windows convertendo quebras de linha | apague a pasta e clone de novo **pelo WSL** (o `.gitattributes` já evita isso em clones novos) |
| Build falha com `Unable to connect to deb.debian.org`, `npm install` trava no container, `timed out` | os containers perderam a internet (acontece ao trocar de Wi-Fi, ligar/desligar VPN, acordar o computador) | reinicie o Docker Desktop (baleia na barra → *Restart*); se persistir, desligue a VPN e reinicie de novo. Teste: `docker run --rm alpine wget -qO- https://example.com` |
| Login diz senha inválida com `admin@csis.local` | o banco já existia quando você mudou `SEED_ADMIN_*` (o admin só é criado com banco vazio) | use a senha de quando o banco foi criado, ou recomece do zero com `docker compose down -v` (apaga todos os dados locais) |
| Mudei `web/src` e a tela não atualiza | eventos de arquivo não chegam ao container (Windows com o projeto em `/mnt/c`) | mova o projeto para dentro do WSL (`~`), ou ponha `VITE_POLLING=true` no `.env` e `docker compose up -d web` |
| Tela branca / erro 502 nas chamadas `/api` | backend ainda subindo ou caiu | `docker compose logs backend` — erros de migration aparecem logo no começo |
| `Cannot find module '@prisma/client'` / tipos do Prisma desatualizados (modo híbrido) | cliente do Prisma não gerado após mudar o schema | `cd backend && npx prisma generate` |
| "Gerar PDF" fica rodando ou dá erro | motor ainda sendo construído, ou erro no LaTeX | `docker compose ps pandoc` e `docker compose logs pandoc` |
| Tudo muito lento no Mac/Windows | pouca memória para o Docker | Docker Desktop → *Settings → Resources*: 4 GB ou mais |

Não achou aqui? Rode `docker compose ps` e `docker compose logs <serviço>` e mande a saída
junto com a pergunta — resolve 90% das dúvidas mais rápido.
