# Histórico da sessão — CSIS Platform v2

Resumo de contexto de uma sessão longa de trabalho (Claude Code) construindo a v2 da
plataforma CSIS. Escrito para servir de handoff — para outra pessoa ou outra IA que precise
entender rapidamente o que é o projeto, o que já foi decidido e construído, e o que falta.

Repositório: https://github.com/cyberchristian92/CSIS-TCC-v2

## 1. O que é o CSIS

CSIS é uma plataforma de gestão de casos periciais (perícia digital) — nasceu como o artefato
prático de um TCC (Trabalho de Conclusão de Curso, graduação em Ciência da Computação, UFPA) e
está sendo evoluída, no pós-defesa, para se tornar também um produto real. O usuário (Christian)
é o autor do TCC e é quem toca este projeto.

**Duas plataformas distintas, no mesmo diretório pai:**
- `csis-platform` (original): Flutter Web + NestJS + Prisma + PostgreSQL. É o artefato **já
  defendido** academicamente. Não deve ser tocado.
- `csis-platform-v2` (este repositório): evolução pós-defesa, sem prazo de banca em cima.
  Reaproveita o backend NestJS/Prisma quase integralmente, mas troca o frontend Flutter Web por
  React. Nasceu de uma decisão explícita: Flutter Web era fraco para o tipo de conteúdo que a
  plataforma mais precisa (editor de markdown, dashboards densos, tabelas de auditoria).

O TCC descreve um fluxo de perícia colaborativa com múltiplos papéis, revisão técnica obrigatória
antes de qualquer laudo ser consolidado, e integridade de evidência garantida por hash
criptográfico. A v2 implementa esse fluxo de verdade, com testes reais (não só desenho).

### Requisitos do TCC (citados no texto, seção "Papéis e responsabilidades" / requisitos)

| Papel no TCC | Responsabilidade |
|---|---|
| Cliente | Solicita o serviço e recebe o resultado final |
| Coordenador | Planeja o caso, fragmenta o trabalho, distribui tarefas, consolida o laudo |
| Especialista | Executa missões específicas, produz relatórios técnicos parciais |
| Revisor | Avalia completude/consistência/qualidade do material produzido |
| Administrador | Gerencia usuários, ajusta permissões, acompanha auditoria do sistema |

| Requisito | Descrição |
|---|---|
| RF01 | Registrar uma solicitação de serviço |
| RF02 | Fragmentar a solicitação em missões menores |
| RF03 | Exigir revisão técnica antes da consolidação |
| RF04 | Permitir correção e reenvio de entregas reprovadas |
| RF05 | Preservar a integridade por meio de hash criptográfico |
| RNF01 | Manter rastreabilidade das ações relevantes |
| RNF02 | Restringir acesso conforme papel e escopo |
| RNF03 | Impedir conflitos básicos entre autoria e aprovação (Segregação de Funções) |

**No código, os papéis viraram 4** (`papel_global`): `ADMIN` (=Administrador), `LIDER`
(=Coordenador), `REVISOR` (=Revisor), `COLABORADOR` (=Especialista). **O papel Cliente nunca foi
implementado** — Christian propôs (nesta sessão) reformulá-lo como um papel "Visitante": alguém
sem login que vê Áreas públicas (ex.: Cibersegurança, IA, Jogos Sérios, Perícia) com sua própria
estrutura de pastas/documentos, igual à que já existe para Projetos/Áreas internas. Isso ainda
**não foi implementado**, ficou registrado como próxima etapa.

## 2. Arquitetura e decisões

- **Backend**: NestJS + Prisma (driver adapters, `@prisma/adapter-pg`) + PostgreSQL.
- **Frontend**: React + Vite + TypeScript + TanStack Query + Tailwind + componentes estilo
  shadcn/ui (hand-rolled, não é o pacote npm) + dnd-kit para drag-and-drop.
- **Hierarquia de dados**: inspirada no método PARA (Projetos / Áreas / Recursos / Arquivamento)
  — é a taxonomia de navegação da Sidebar, não uma árvore Workspace→Área→Projeto tipo Google
  Drive. Pasta/Arquivo/Documento são **polimórficos**: podem pertencer a Workspace, Área,
  Projeto ou Missão (exatamente um desses, mutuamente exclusivo) — isso é o que permite "Recursos"
  (pastas no nível da empresa: logos, templates, prompts) e pastas dentro de uma Área (ex.:
  "Marketing" reunindo tudo daquela área) usarem a mesma UI genérica que já existia para dentro de
  Projetos.
- **Kanban duplo, propositalmente diferente**:
  1. **Board livre** (estilo Trello): colunas e cards organizáveis sem restrição nenhuma —
     `Coluna` + `Missao.coluna_id`/`ordem`. Mover um card aqui **nunca** muda o status oficial da
     Missão.
  2. **Kanban fixo de status** (Pendente/Em Andamento/Em Revisão/Aprovada), usado em "Minhas
     Missões" — a coluna É o `Missao.status`. Só um drag é permitido de verdade (Pendente → Em
     Andamento, equivalente a "Iniciar"); os demais movimentos de status só acontecem por ações
     explícitas (Fazer Entrega, Aprovar, Rejeitar), sempre validadas no servidor.
- **Integridade / hash (Merkle Tree)** — ver `docs/adr/0001-*` e `docs/adr/0002-*`:
  - Sem blockchain: a plataforma é auto-hospedada por uma única empresa por instância, não há o
    problema de confiança entre múltiplas organizações que blockchain resolveria.
  - Sem daemon IPFS: os CIDs são calculados com a biblioteca `multiformats` (oficial, mantida,
    zero dependências) diretamente em processo. Uma primeira tentativa usou `ipfs-only-hash` e foi
    **descartada** por trazer 2 vulnerabilidades críticas e 14 altas via dependências abandonadas
    (`protobufjs`, `tar`).
  - Cada nível (Workspace, Área, Projeto, Missão, Pasta) guarda em `ipfs_cid` um hash derivado dos
    CIDs dos filhos; Arquivo/Documento são as folhas. Qualquer mudança dispara recálculo em
    cascata até o Workspace, via eventos assíncronos (`@nestjs/event-emitter`) — não trava a
    requisição HTTP original.
  - Histórico de mudança de CID vive em `LogAuditoria` (`acao = 'CID_ATUALIZADO'`), reaproveitando
    o mecanismo de auditoria já existente.
  - `POST /integridade/recalcular-tudo` (ADMIN) popula retroativamente dados que já existiam antes
    dessa camada, e cobre lacunas de eventos não implementados ainda.
- **Listas de Acesso** (permissões configuráveis, análogo ao "Compartilhar" do Google Drive):
  - `Lista`/`ListaMembro`/`AcessoRecurso` — grupos de nome livre, criados pelo Admin em
    Configurações, com membros. Um Projeto/Área/Pasta tem um campo `restrito: boolean` (padrão
    `false` — visível pra qualquer autenticado, comportamento histórico inalterado). Quando
    `restrito = true`, só ADMIN, quem criou o recurso, e quem está numa Lista com acesso (ou
    listado diretamente) conseguem ver.
  - Testado via curl e via UI: criar projeto → restringir → usuário de teste recebe 403 →
    adicionado à Lista → passa a ver → removido → volta a bloquear. Funciona ponta a ponta.
- **White-label**: `Workspace.logo_data_url` (data URI base64, sem precisar de storage de arquivo
  separado) + `nome` editáveis pelo Admin em Configurações. Endpoint público `/branding` (sem
  autenticação) expõe nome+logo pra aparecerem até na tela de login, antes de qualquer sessão
  existir.
- **Laudo em PDF**: Markdown → PDF via Pandoc + LaTeX (template Eisvogel), rodando num container
  Docker de vida longa (`sleep infinity`) controlado via `docker exec` a partir do backend.
  Funciona só quando o **backend roda fora do Docker** (não montamos o socket do Docker do host no
  container do backend ainda).

## 3. Tema visual

A v2 replica fielmente a identidade visual do protótipo Flutter original — não é um redesign.
Valores exatos extraídos do Flutter (`app_theme.dart`):

- `background: #050F1C`, `surface: #091A2D`, `surfaceRaised: #112844`
- `primary (ciano): #49C3D1`, hover `#66E0EE`, dim `#2A7E87`
- Texto: `#F1F5F9` (principal), `#9CA3AF` (secundário), `#6B7280` (desabilitado)
- Status: Pendente `#64748B`, Em Andamento `#49C3D1`, Em Revisão `#F59E0B`, Aprovada `#16A34A`,
  Rejeitada `#DC2626`, Arquivado `#94A3B8`
- Paleta de labels/capa (10 cores fixas, estilo Trello): `#4BCE97 #F5CD47 #FAA53D #F87168 #9F8FEF
  #579DFF #6CC3E0 #94C748 #E774BB #8590A2`
- Fontes: Sora (títulos), DM Sans (corpo), JetBrains Mono (hashes/código)
- Border radius: 10px em tudo

Tema escuro é o **padrão**; existe alternância para um tema claro (persistida em localStorage).

## 4. O que já está construído e testado

- Login/logout via cookie HttpOnly JWT (não localStorage).
- Dashboard com estatísticas, últimos projetos, auditoria recente (gated ADMIN/LIDER).
- Sidebar com visibilidade por papel (Áreas/Recursos somem para REVISOR/COLABORADOR).
- CRUD de Workspace → Área → Projeto → Missão (a maior parte; excluir Projeto/Área/Missão pela UI
  ainda falta, ver seção 6).
- Explorador de arquivos genérico (`FileExplorer`), reutilizado em Projeto, Área e Workspace
  (Recursos) — upload de arquivo com hash SHA-256, criação de pasta, criação de documento
  markdown.
- Editor de markdown real (biblioteca `marked` + `dompurify`, substituindo um parser manual que
  não cobria tabelas/código/links) com barra de ferramentas.
- Painel de detalhe da Missão: capa, labels (com criação inline), tags, responsáveis (atribuir),
  ações de transição de status, checklist, histórico de Entregas + Revisões com Aprovar/Rejeitar,
  comentários.
- **Segregação de Funções testada de verdade**: um usuário tentou aprovar a própria entrega e o
  servidor bloqueou com 403, mesmo o botão estando visível (o padrão do Flutter original é não
  esconder o botão preventivamente, só mostrar o erro do servidor inline — replicado de propósito).
- Kanban fixo (Minhas Missões) e Fila de Revisão (todas as entregas pendentes, entre projetos).
- Board livre (Kanban estilo Trello) por projeto, com colunas editáveis (nome/limite WIP/excluir).
- Exportação de projeto em ZIP (manifesto + arquivos + trilha de auditoria).
- Motor de integridade (seção 2) — testado ao vivo: criar um documento muda o CID do Workspace
  sozinho, sem ação manual.
- Configurações: nome/logo do Workspace (white-label) + Listas de Acesso (CRUD + membros).
- Botão "Compartilhar" (estilo Drive) em Projeto e Área.
- Laudo em PDF: botão "Compilar Laudo" no editor de documento, com log de erro inline e link
  direto pro PDF quando dá certo — testado gerando um PDF real via LaTeX.
- `docker-compose.yml` na raiz do v2, autossuficiente (banco + backend + motor de laudo), testado
  de ponta a ponta (build, migrations automáticas, seed do admin, login).
- README com quickstart de 5 minutos.

## 5. Bugs reais encontrados e corrigidos nesta sessão

1. **Versão do Prisma Client desalinhada** (`@prisma/client` resolvendo diferente de `prisma`
   CLI) — corrigido fixando ambos em `7.8.0`.
2. **Bug de cache do `nest start --watch`**: toda vez que `node_modules/.prisma/client` é
   regravado (migration, `npm install`) enquanto o watch já está rodando, ele passa a reportar
   `Cannot find module '@prisma/client'` mesmo com os pacotes corretos em disco. Recuperação:
   matar o processo, rodar `npx nest build` uma vez (one-shot), só depois `npm run start:dev` de
   novo. Aconteceu várias vezes na sessão; a causa raiz nunca foi resolvida, só o contorno.
2. **`window.prompt`/`window.alert` travavam a aba inteira** em automação de navegador (e eram
   feios) — substituídos por um diálogo React reutilizável (`usePromptDialog`).
4. **`ipfs-only-hash` introduzia vulnerabilidades críticas** — descartado a favor de
   `multiformats`.
5. **Bug de leitura de env var**: `PANDOC_ENGINE_CONTAINER` e `LAUDO_WORKDIR` eram lidos como
   constante no topo do módulo `laudo-compiler.service.ts`, antes do `ConfigModule.forRoot()` do
   Nest carregar o `.env` (ordem de resolução de imports do Node) — a variável de ambiente nunca
   era respeitada de fato. Corrigido lendo em runtime (dentro das funções).
6. **Container `pandoc` do v2 tinha nome colidindo/reaproveitando o do repositório original** —
   como os volumes de cada repo apontam pra pastas físicas diferentes no host, reaproveitar o
   container errado quebrava a compilação de laudo com "no such file or directory". Corrigido
   subindo um container próprio (`csis_v2_pandoc_engine`) e configurando a env var certa.
7. **Bug de dados pré-existente**: nome do Workspace estava salvo com encoding corrompido
   ("Per�cias 2026") — corrigido de bônus ao testar a tela de Configurações (só editar e salvar
   de novo resolveu, já que o campo agora é editável pela UI).
8. **Docker Desktop travou** (motor não respondia, engine backend sumido) durante a sessão —
   resolvido com `wsl --shutdown` + reabrir o Docker Desktop.
9. **Conflito de porta 5173** com outro projeto do usuário (`sinarca`) rodando via Docker — o
   frontend do v2 foi movido pra rodar em 5174 por padrão.

## 6. O que falta (lista de gaps, levantada nesta sessão)

**Ações de CRUD que existem no backend mas não têm botão na interface:**
- Arquivo: renomear e verificar integridade (`GET /verificar`) já existem no backend, sem UI.
  **Excluir arquivo nem existe como rota no backend ainda.**
- Pasta: renomear/mover e excluir (backend não-destrutivo já pronto) sem botão.
- Documento: excluir (backend pronto) sem botão.
- Missão: editar título/descrição e excluir sem botão.
- Projeto / Área: excluir sem botão.
- Coluna do board: só dá pra arrastar cards entre colunas, não reordenar as colunas em si.
- Label de missão: só dá pra criar; editar cor/nome e excluir não têm UI.

**Requisitos do TCC parcialmente cobertos:**
- RNF02 (restringir por papel e escopo): papel sim; escopo (Listas de Acesso) só cobre
  Projeto/Área — falta estender pra Pasta e Missão na UI (o schema já suporta).

**Features grandes nunca iniciadas:**
- Papel **Cliente/Visitante** do TCC — conceito discutido nesta sessão (ver seção 1), mas zero
  código.
- **Campos customizados por Tipo de Projeto/Missão** — existem 4 tabelas reservadas no schema
  (`TipoProjeto`, `TipoMissao`, `CampoCustomizado`, `ValorCampo`) com **zero código de backend
  usando-as**. É por isso que a tela "Tipos de Projeto" é intencionalmente um stub vazio (honesto,
  não é um bug).
- Tabela `Permissao` (mais antiga, `user_id`+`papel`+`workspace_id?`+`projeto_id?`) também está
  reservada no schema sem nenhum código usando — provavelmente superada pelo desenho de Listas de
  Acesso, candidata a ser removida ou formalmente descontinuada.
- **App mobile Flutter** — não iniciado (planejado: reaproveitar o app Flutter existente,
  reduzido a Login + Minhas Missões + captura rápida de campo).
- **Anexos dentro do painel de Missão** — hoje só dá pra anexar arquivo numa Pasta/Projeto, não
  direto pelo diálogo da Missão.

**Polimento menor:**
- Busca (barra de cima) e sino de notificação são decorativos, sem função.
- `[[Wikilink]]` no editor de markdown já vira link mas não navega pra lugar nenhum ainda.
- Sem avatar empilhado / indicador de vencimento no card do board livre.
- Convite de usuário existe, mas sem reenvio de senha/e-mail de boas-vindas de fato (o backend tem
  `esqueci-senha`/`redefinir-senha`, mas não dispara e-mail real — não conferido nesta sessão se
  há integração de envio de e-mail configurada).

**Limitação de infraestrutura:**
- Laudo em PDF só compila com o backend rodando fora do Docker — dentro do `docker-compose up`,
  falta montar `/var/run/docker.sock` e instalar o CLI do Docker na imagem do backend.

## 7. Como rodar

Ver `README.md` na raiz do repositório — quickstart via `docker compose up -d --build` (banco +
backend) + `cd web && npm run dev` (frontend), ou tudo local sem Docker (ver seção "Rodando sem
Docker" do README). Credenciais padrão: `admin@csis.local` / `TrocarSenha123`.
