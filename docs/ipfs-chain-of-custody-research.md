# IPFS aplicado a integridade de evidência / cadeia de custódia — levantamento

Pesquisa feita via acesso institucional UFPA/CAPES (ACM Digital Library e IEEE Xplore
confirmados funcionando). Objetivo: fundamentar a decisão de arquitetura da v2 (Postgres/Prisma
como fonte da verdade relacional + IPFS como camada de armazenamento endereçado por conteúdo
para a árvore de pastas/arquivos). Não é para o texto do TCC — o TCC já lista IPFS como fora de
escopo/trabalho futuro; isto é para a v2 e para uma eventual continuação de pesquisa.

## Achado mais importante, antes dos detalhes

**Praticamente todo paper real de "IPFS + evidência/dado sensível" combina IPFS com blockchain
— nenhum usa IPFS puro.** Isso apareceu de forma consistente nas quatro frentes de busca (ver
abaixo). A razão técnica: IPFS por si só não impede que alguém desfixe (unpin) ou apague
conteúdo, nem prova *quando* um CID foi criado pela primeira vez — ele garante que o conteúdo
não foi alterado (endereçamento por hash), mas não garante presença/tempo. Blockchain é
tipicamente adicionado só para resolver esse segundo problema: um registro imutável e
com timestamp de "este CID existia neste momento", atestado por consenso.

**Isso é relevante pra decisão da v2**: a proposta atual (Postgres versionado/encadeado, sem
blockchain) pode cumprir o mesmo papel que o blockchain cumpre nesses papers — MAS só porque a
v2 é uma instância única, de uma organização confiável, sem múltiplas partes que não confiam
umas nas outras. O motivo de existir blockchain nesses sistemas é justamente resolver confiança
entre partes mutuamente desconfiadas (múltiplos labs, múltiplas polícias, etc.) — que não é o
cenário do CSIS self-hosted por empresa. Ou seja: a escolha de não usar blockchain parece
justificável tecnicamente para o caso de uso da v2, mas vale documentar esse raciocínio
explicitamente, porque é a razão pela qual a arquitetura diverge do padrão dominante na
literatura.

---

## 1. IPFS aplicado especificamente a perícia digital / cadeia de custódia

Terreno bem menos batido do que "blockchain + evidência" em geral, mas existe:

- **Viswanathan, J.; Udhaya Kumar, S.** (2024). "Blockchain-based Decentralized Digital
  Forensics Case Management System using IPFS." *2024 IEEE International Conference on
  Blockchain and Distributed Systems Security (ICBDS)*. Acesso aberto (IEEE Xplore).
  **Achado mais direto de toda a busca** — sistema de gestão de casos de perícia digital
  combinando blockchain + IPFS. DOI não confirmado nesta sessão (página de detalhe não abriu
  via automação; buscar manualmente antes de citar formalmente).
- **Shilpa, C.; Shanthakumara, A.H.** (2023). "An Implementation of Blockchain Technology in
  Combination with IPFS for Crime Evidence Management System." *2023 International Conference
  on Computer Communication and Informatics (ICCCI)*. Citado por 3 trabalhos. DOI não
  confirmado nesta sessão.
- **Mishra, R.; Arya, P.; Narwaria, M.; Kaur, I.** (2025). "Blockchain-Enhanced Chain of Custody
  for Digital Forensic Evidence Management." *2025 IEEE ICBDS*. Foco em blockchain, não
  especificamente IPFS, mas mesmo domínio de aplicação exata (cadeia de custódia forense).
- **Onyeashie, B.I.; Abubakar, M.; Leimich, P.; McKeown, S.; Russell, G.** (2025).
  "Privacy-Preserving and Scalable Digital Evidence Management: A Hyperledger Fabric
  Architecture with Growth Projections for Law Enforcement." *2025 ICTCS*. Usa Hyperledger
  Fabric especificamente — a mesma tecnologia que Christian já tem experiência prática (Polícia
  Civil do Pará). Vale ler com atenção própria, não só como citação.

**Referência fundacional do próprio IPFS** (não verificada via base paga nesta sessão, mas é o
whitepaper padrão, extremamente citado — seguro citar):
- **Benet, J.** (2014). "IPFS - Content Addressed, Versioned, P2P File System." arXiv:1407.3561.

## 2. Merkle DAG / armazenamento endereçado por conteúdo para trilhas de auditoria (geral)

- **Snodgrass, R.T.; Yao, S.S.; Collberg, C.** (2004). "Tamper detection in audit logs." *VLDB
  '04: Proceedings of the 30th International Conference on Very Large Data Bases*, pp. 504–515.
  Paper clássico/fundacional sobre detecção de adulteração em logs de auditoria — base teórica
  forte pra qualquer alegação de "log imutável", independente de usar IPFS ou não. DOI não
  confirmado nesta sessão.
- **Zheng, N.; Ives, Z.G.** (2020). "Compact, tamper-resistant archival of fine-grained
  provenance." *Proceedings of the VLDB Endowment (PVLDB)*, Vol. 14, Issue 4, pp. 485–497.
  DOI: 10.14778/3436905.3436909. Proveniência resistente a adulteração — conceito irmão de
  cadeia de custódia, mesma preocupação técnica.
- **Shi, R.; Cheng, R.; Han, B.; Cheng, Y.; Chen, S.** (2024). "A Closer Look into IPFS:
  Accessibility, Content, and Performance." *ACM POMACS*, Vol. 8, Issue 2, Art. 20.
  DOI: 10.1145/3656015. Estudo empírico rigoroso da rede IPFS pública real — útil pra entender
  o que o IPFS de fato garante e não garante na prática, antes de decidir arquitetura.

## 3. IPFS privado/permissionado — controle de acesso e criptografia para dado sensível

Este é o ponto crítico de segurança que precisa entrar no desenho desde o início (a rede IPFS
pública não é confidencial — ver ressalva já discutida na conversa).

- **Jo, Y.; Cho, Y.; Kim, H.** (2023). "Secure and Lightweight Access Control for Highly
  Decentralized and Distributed File Systems." *Mid4CC '23: Proceedings of the 1st
  International Workshop on Middleware for the Computing Continuum*, pp. 1–6.
  DOI: 10.1145/3631309.3632832. Controle de acesso pra sistemas de arquivo descentralizados
  tipo IPFS — achado mais direto desta frente.
- **Shi, R.; Fu, Y.; Cheng, R.; Han, B.; Cheng, Y.; Chen, S.** (2025). "The Decentralization
  Dilemma: Performance Trade-Offs in IPFS and Breakpoints." *IMC '25: Proceedings of the ACM
  Internet Measurement Conference*, pp. 662–676. DOI: 10.1145/3730567.3764453. Mesmo grupo de
  pesquisa do item acima da seção 2 — trade-offs reais de performance/descentralização,
  relevante pra decidir se um IPFS privado de pequena escala (uma empresa self-hosted) sofre os
  mesmos problemas da rede pública gigante (provavelmente não, mas vale entender por quê).
- **Pulmano, C.; Fernandez, P.** (2025). "A Hybrid Architecture for a Secured Health Information
  Exchange using FHIR, Blockchain, and IPFS." *ICMHI '25*, pp. 187–191.
  DOI: 10.1145/3761712.3761751. Não é forense, é saúde — mas é o mesmo padrão de problema
  (dado pessoal sensível e regulado, precisa de IPFS + criptografia + controle de acesso
  layered), bom precedente análogo.

## 4. IPFS + blockchain — padrão dominante, e por que a v2 pode justificar não usar blockchain

- **Carolina, B.; Khifzan, F.; Choi, J.** (2026). "Towards Dynamic QR Representation of Large
  Verifiable Documents via IPFS Driven Decentralized Storage and Blockchain State Commitments."
  *IAIT '26*, Art. 12, pp. 1–16. DOI: 10.1145/3816713.3816784.
- **Singh, A.; Sural, S.; Sengupta, T.; Sural, S.** (2023). "Trusted Sharing of Autonomous
  Vehicle Crash Data using Enterprise Blockchain and IPFS." *BSCI '23*, pp. 11–24.
  DOI: 10.1145/3594556.3594623 — e sua extensão de periódico, **"AVChain: Trusted Sharing of
  Autonomous Vehicle Crash Incident Data using Interoperating HyperLedger Fabric Networks and
  IPFS"** (2026), *Distributed Ledger Technologies (DLT)*, Vol. 5, Issue 3, Art. 31,
  DOI: 10.1145/3709158. Caso de uso muito próximo do CSIS por analogia: dado de incidente
  (colisão de veículo autônomo) que precisa de integridade e compartilhamento confiável entre
  partes — praticamente o mesmo problema de forma de "evidência de incidente".

Esses dois exemplos (mais os da seção 1) sustentam o argumento central desta pesquisa: IPFS
sozinho, nesse tipo de aplicação, quase nunca aparece sem blockchain na literatura — o
blockchain resolve confiança *entre organizações*. Como a v2 é pensada pra ser self-hosted por
uma única empresa (não uma rede de múltiplas organizações que não confiam umas nas outras), a
decisão de ficar só com Postgres versionado + IPFS, sem blockchain, é defensável — mas é uma
divergência consciente do padrão da literatura, não uma omissão, e vale documentar isso
explicitamente na v2 (por exemplo, no próprio README ou num ADR).

## Gaps encontrados (honestidade, não escondido)

- **IPFS puro (sem blockchain) para perícia digital**: não encontrado nenhum paper que faça
  exatamente isso. É genuinamente um espaço pouco explorado — o que é uma boa notícia pra uma
  eventual continuação de pesquisa (o TCC já lista isso como trabalho futuro), mas significa que
  a v2 não tem um paper prévio pra "copiar a receita" — a arquitetura vai ser original nesse
  ponto específico.
- **CAR files (export/backup de subárvore IPFS) especificamente para cadeia de custódia**: não
  encontrada literatura acadêmica tratando disso como mecanismo de backup forense. É
  funcionalidade padrão do protocolo IPFS (não precisa de paper pra existir), só não tem
  publicação acadêmica avaliando seu uso nesse contexto específico.
