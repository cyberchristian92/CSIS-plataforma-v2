# ADR-0001: Postgres versionado + IPFS, sem blockchain

**Status**: Aceita
**Data**: 2026-09-03

## Contexto

A Plataforma CSIS precisa garantir integridade e rastreabilidade de evidências digitais e do
histórico de estados de Missões/Projetos — requisito central tanto do TCC original quanto da v2.
O levantamento bibliográfico feito em `docs/ipfs-chain-of-custody-research.md` mostrou um padrão
consistente: praticamente todo sistema publicado que combina armazenamento endereçado por
conteúdo (IPFS) com evidência sensível também usa blockchain (ex.: Viswanathan & Udhaya Kumar,
2024; Shilpa & Shanthakumara, 2023; Onyeashie et al., 2025 — este último usando Hyperledger
Fabric, a mesma tecnologia já usada por Christian na Polícia Civil do Pará).

A pergunta que este ADR resolve: **a v2 deveria usar blockchain também, ou o par
Postgres-versionado + IPFS é suficiente?**

## Decisão

A v2 **não usa blockchain**. A integridade e o histórico de estados são garantidos por:

1. **IPFS** para a árvore de pastas/arquivos (Workspace → Área → Projeto → Missão → Arquivo),
   dando hash de conteúdo nativo em cada nível (Merkle DAG), sem custo de implementação de
   estrutura de hash customizada.
2. **Postgres/Prisma versionado/encadeado** para o histórico de estados de entidades
   (transições de Missão, aprovações, revisões) — cada mudança relevante gera um novo registro
   imutável referenciando o anterior, funcionando como um livro-razão local de auditoria.

## Justificativa

A razão pela qual a literatura usa blockchain nesses sistemas não é a integridade do conteúdo em
si (isso o IPFS já resolve por endereçamento por hash) — é resolver **confiança entre
organizações que não confiam umas nas outras**: múltiplos laboratórios periciais, múltiplas
polícias, múltiplos tribunais, cada um querendo verificar que ninguém alterou o registro sem
depender da boa-fé de uma única parte custodiante. Blockchain existe pra prover consenso
distribuído quando não há uma parte central confiável.

A Plataforma CSIS, na v2, é pensada para ser **auto-hospedada por uma única empresa por
instância** — não uma rede compartilhada entre organizações mutuamente desconfiadas. Dentro de
uma única instância, o Postgres da própria empresa já é a fonte de verdade confiável; não existe
o problema de "quem eu confio pra validar o consenso" que o blockchain resolve. Adicionar
blockchain aqui importaria a complexidade operacional (nós, consenso, latência) de um problema
que a v2 não tem.

## Alternativas consideradas

- **IPFS + blockchain** (padrão dominante na literatura): rejeitada por ora — resolve um problema
  de confiança multi-organizacional que não existe no cenário de instância única self-hosted.
  Fica como extensão válida se a CSIS um dia operar uma rede compartilhada entre múltiplas
  organizações (ex.: consórcio de laboratórios periciais trocando evidência entre si) — nesse
  cenário, este ADR deve ser revisitado.
- **Substituir Postgres por um armazenamento endereçado por conteúdo completo** (tipo Git puro):
  rejeitada — perde a capacidade de consulta relacional rápida (quem está atribuído a quê,
  status, permissões), que a operação do dia a dia precisa.
- **IPFS puro, sem nenhum histórico versionado**: rejeitada — não sustenta a alegação de "log de
  auditoria imutável" central ao argumento técnico da plataforma (ver TCC, Capítulo 4).

## Consequências

- A árvore de arquivos ganha integridade e portabilidade de backup "de graça" via IPFS (export
  em formato CAR), sem reescrever o banco relacional.
- O histórico de estados de Missões/Revisões continua vivendo no Postgres, versionado.
- **Revisitar esta decisão se**: a CSIS evoluir para operar como rede compartilhada entre
  múltiplas organizações que precisam de garantia de integridade sem depender de confiar umas
  nas outras — nesse caso, blockchain volta a fazer sentido técnico, não só por moda.
- Como o levantamento bibliográfico não encontrou nenhum sistema publicado que faça IPFS puro
  (sem blockchain) especificamente para perícia digital, esta arquitetura é original nesse
  ponto — não há uma receita da literatura pra seguir; validação prática extra é recomendada
  antes de confiar dados de produção reais a este desenho.
