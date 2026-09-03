# CSIS Platform v2

Evolução pós-defesa da Plataforma CSIS. Este repositório é **paralelo e independente** do
[`csis-platform`](../csis-platform) original — aquele é o artefato acadêmico defendido no TCC
(Flutter Web + NestJS + Prisma + PostgreSQL) e **não é tocado** a partir daqui. Este projeto
nasce sem prazo de defesa em cima, para evoluir o produto com calma.

## Por que um repositório novo

O `csis-platform` original tem duas limitações que motivaram esta v2:

1. **Frontend Flutter Web** é fraco para o tipo de conteúdo que a plataforma mais precisa
   (editor de markdown, dashboards densos, tabelas de auditoria) — bom ecossistema web já
   existe em React para isso.
2. **Mobile precisa ser um app de captura rápida** (texto, áudio, foto) em campo, alimentando
   dados para o web — não precisa do Flutter Web, só do Flutter mobile (já existe, será
   reaproveitado e enxugado).

## Decisões de arquitetura já tomadas nesta conversa

- **Backend**: NestJS + Prisma + PostgreSQL — mesma base do original, mas com extensão do
  modelo de dados para suportar a árvore de hash (ver seção abaixo — **em aberto**).
- **Web**: React + Vite + TypeScript + TanStack Query + shadcn/ui (Tailwind).
- **Mobile**: o app Flutter existente, copiado para este repositório, com o alvo `web`
  removido e as telas reduzidas ao essencial de campo (login, minhas missões, captura rápida
  de texto/áudio/foto anexando na Missão ativa).
- **Hierarquia**: inspirada no método PARA (Workspace → Área → Projeto → Missão), organizada
  como estrutura de pastas e arquivos — cada nível é uma "pasta", contém sub-pastas/arquivos.
- **Kanban**: quadro de Missões tão livre quanto o Trello — colunas e *cards* reorganizáveis
  sem restrição. **Desacoplado do estado oficial**: mover um card não muda status. As
  transições que importam (enviar para revisão, aprovar, reprovar) são ações explícitas na
  interface, sempre validadas no servidor, independentes da posição visual do card.
- **Integridade**: hash em todo arquivo *e* em toda pasta/contêiner da hierarquia (árvore de
  Merkle — mesmo princípio do Git/IPFS). O hash de uma pasta deriva do hash do que está dentro
  dela; qualquer alteração em qualquer nível se propaga pra cima. Isso faz da estrutura inteira
  algo autoverificável.
- **Backup/portabilidade**: fazer backup é literalmente exportar a árvore inteira (pastas reais
  + arquivos + manifesto de hashes), independente do tamanho.
- **Código aberto / auto-hospedável**: qualquer empresa pode subir sua própria instância e
  seus próprios dados. O *moat* de negócio deixa de ser "o software é proprietário" e passa a
  ser a rede de talento curada, a marca e o histórico de casos (ver discussão de
  *bridge decay* no plano de negócios) — decisão consciente, não um descuido.

## Em aberto — decisões técnicas do modelo de hash (ver conversa)

1. **Granularidade**: todo tipo de entidade recebe hash (Workspace, Área, Projeto, Missão,
   Documento, Arquivo, Comentário, Revisão), ou só os níveis de "contêiner" (pastas) e as
   "folhas" de conteúdo (arquivos/documentos)?
2. **Hash versionado ou recalculado ao vivo?** Se uma Missão muda de estado, isso precisa gerar
   um *novo* hash encadeado ao anterior (histórico completo, tipo commits do Git), ou o hash é
   sempre recalculado sobre o estado atual (perde a capacidade de provar "nada mudou entre X e
   Y")? A proposta default: **versionado/encadeado**, porque é isso que sustenta o argumento de
   auditoria imutável já escrito no TCC.
3. **Onde a árvore de hash vive**: substitui o modelo relacional (Postgres/Prisma) por um
   armazenamento endereçado por conteúdo (mais parecido com Git/IPFS, mais complexo, mais difícil
   de consultar), ou o Postgres/Prisma continua sendo a fonte da verdade e a árvore de hash é
   uma camada computada em cima (hash armazenado como coluna/tabela, recalculado quando o
   conteúdo muda)? A proposta default: **manter o relacional como fonte da verdade**, com a
   árvore de hash como camada derivada — mais simples, mais fácil de consultar, entrega os
   mesmos benefícios de integridade/backup sem reescrever o banco do zero.

## Estrutura planejada

```
csis-platform-v2/
├── backend/     # NestJS + Prisma (evolução do schema original)
├── web/         # React + Vite (novo)
├── mobile/      # Flutter (copiado e enxugado do original)
└── docs/        # decisões de arquitetura, ADRs
```
