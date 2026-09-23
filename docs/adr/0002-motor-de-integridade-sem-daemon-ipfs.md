# ADR-0002: Motor de integridade (Merkle Tree) sem daemon IPFS

**Status**: Aceita
**Data**: 2026-09-05

## Contexto

O ADR-0001 decidiu que a v2 usaria "IPFS para a árvore de pastas/arquivos", e o schema
(`prisma/schema.prisma`) já reservava um campo `ipfs_cid` em cada nível da árvore (Workspace,
Área, Projeto, Missão, Pasta, Arquivo, Documento). Até esta decisão, porém, nenhum código
calculava ou escrevia nesse campo — a camada de integridade existia só como intenção documentada,
não como comportamento real do sistema.

A pergunta que este ADR resolve: **como implementar o cálculo e a propagação desses hashes**, e
**se isso exige rodar um daemon IPFS de verdade** (ex.: Kubo/go-ipfs) ao lado da aplicação.

## Decisão

1. **Sem daemon IPFS.** Os CIDs são calculados com a biblioteca `multiformats` (o pacote
   TypeScript oficial e mantido pela comunidade IPFS/Protocol Labs, zero dependências externas),
   diretamente em processo, sem nenhum node IPFS rodando. Os CIDs gerados (CIDv1, codec `raw`,
   multihash sha2-256) são formatados exatamente como um `ipfs add --cid-version 1 --raw-leaves`
   produziria para o mesmo conteúdo — se um dia a CSIS quiser publicar esse conteúdo num node IPFS
   de verdade, os endereços já batem, sem precisar recalcular nada.
2. **Hash de "diretório" é uma simplificação do UnixFS real.** Um nó de diretório (Workspace,
   Área, Projeto, Missão, Pasta) tem seu CID derivado de um blob JSON determinístico com os pares
   `{nome, cid}` de todos os filhos diretos, ordenados por nome, e então hasheado como um blob
   `raw`. Isso **não** produz o mesmo CID que um `ipfs add -r` de um diretório real (que usa o
   codec `dag-pb`/UnixFS) — é uma escolha deliberada: implementar o formato UnixFS completo exigia
   trazer `@ipld/dag-pb` e toda a cadeia de dependências do `js-ipfs` antigo, que na prática (ver
   abaixo) está abandonada e cheia de vulnerabilidades críticas. O que a v2 precisa é que o hash
   seja determinístico e sensível a qualquer mudança em qualquer filho — não que seja bit-a-bit
   compatível com a implementação de referência do IPFS.
3. **Merkle Tree única, sobre a hierarquia relacional inteira.** A cascata de recálculo não para
   no "diretório" mais próximo — ela sobe através de toda a hierarquia Pasta → (Missão) → Projeto
   → Área → Workspace, com o hash de cada nível incorporando os hashes de todos os seus filhos
   relacionais (não só pastas/arquivos soltos). Isso é o que o ADR-0001 já havia descrito como
   objetivo ("árvore de pastas/arquivos Workspace → Área → Projeto → Missão → Arquivo").
4. **Recálculo assíncrono via eventos, não síncrono na requisição.** Os services de conteúdo
   (Arquivo, Documento, Pasta) e de hierarquia (Missão, Projeto, Área) emitem eventos
   (`@nestjs/event-emitter`) após criar/atualizar/remover; um listener no `IntegridadeService`
   recalcula a árvore em segundo plano. O Postgres continua sendo a fonte da verdade primária (ver
   ADR-0001) — o CID é "eventualmente consistente" dentro do mesmo processo (tipicamente
   milissegundos), o que é aceitável porque nada no sistema depende do CID estar atualizado de
   forma síncrona para funcionar corretamente.
5. **Histórico de mudança de CID via `LogAuditoria`** (`acao = 'CID_ATUALIZADO'`), reaproveitando
   o mecanismo de auditoria já existente em vez de criar uma tabela nova — conforme o ADR-0001 já
   previa.
6. **Ação manual de recálculo completo** (`POST /integridade/recalcular-tudo`, só ADMIN) cobre
   dois casos que os eventos automáticos não resolvem sozinhos: (a) popular hashes de dados que já
   existiam no banco antes desta camada existir; (b) qualquer lacuna futura de cobertura de
   eventos, sem depender de rodar uma migração de dados.

## Por que não `ipfs-only-hash` (ou qualquer wrapper do `js-ipfs` clássico)

A primeira tentativa de implementação usou o pacote `ipfs-only-hash`, que calcula CIDs sem
precisar de um node rodando — exatamente o comportamento desejado. Ele foi descartado após
`npm audit` acusar **2 vulnerabilidades críticas e 14 altas** introduzidas pela sua árvore de
dependências (`protobufjs`, `ipld-dag-pb`, `ipfs-unixfs-importer`, `tar` — todos avisados como
"superseded"/depreciados no próprio log do npm). Para uma plataforma de perícia digital, onde a
integridade da cadeia de custódia é o argumento central do produto, introduzir uma dependência com
vulnerabilidades críticas de execução arbitrária de código na própria camada que prova integridade
seria contraditório. `multiformats` sozinho não adiciona nenhuma vulnerabilidade nova ao projeto.

## Alternativas consideradas

- **Rodar um daemon IPFS real (Kubo) ao lado do backend**: rejeitada por ora — adiciona um
  processo extra, complexidade de deploy/operação (self-hosted, ver ADR-0001) e superfície de
  ataque, sem nenhum ganho funcional imediato: ninguém está publicando este conteúdo numa rede
  IPFS pública ainda. Fica como extensão válida se um dia isso for necessário — os CIDs já
  calculados continuam válidos, o node só precisaria "adotar" o conteúdo já endereçado.
- **`@ipld/dag-pb` + UnixFS completo, sem daemon**: rejeitada por ora pelo custo de implementação
  (replicar o formato binário exato de diretório do IPFS) sem benefício prático — o objetivo é
  detectabilidade de adulteração, não compatibilidade bit-a-bit com um node externo.
- **Recálculo síncrono na própria requisição HTTP**: rejeitada — deixaria upload de arquivo e
  edição de documento mais lentos proporcionalmente à profundidade da árvore (cada nível precisa
  de uma query), sem necessidade real de consistência imediata.

## Consequências

- `ipfs_cid` agora é escrito de verdade em cada nível da árvore, e muda automaticamente a cada
  mudança de conteúdo — confirmado em teste manual (criar um documento solto no Workspace mudou o
  `ipfs_cid` do Workspace sem nenhuma ação manual).
- Dados que existiam antes desta camada (todo o banco de desenvolvimento/demo atual) foram
  populados via `POST /integridade/recalcular-tudo`.
- **Revisitar esta decisão se**: a CSIS decidir publicar conteúdo num node IPFS real (aí vale
  considerar UnixFS completo, pra que o CID sirva de endereço de recuperação de verdade, não só de
  selo de integridade) — ver também a condição de revisão já registrada no ADR-0001 sobre operar
  como rede multi-organizacional.
