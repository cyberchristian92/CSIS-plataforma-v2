/// Estrutura com que todo projeto novo nasce: o fluxo de trabalho
/// Material → Processamento → Produção, uma pasta por etapa, cada uma com um
/// Leia-me explicando para que serve e como usar bem. A ordem alfabética dos
/// nomes já coincide com a ordem do fluxo.
///
/// Os textos são genéricos o bastante para qualquer área (perícia, marketing,
/// cursos...) e usam exemplos de perícia digital, o caso de uso principal.

const FLUXO = `\`\`\`
  MATERIAL  ──────▶  PROCESSAMENTO  ──────▶  PRODUÇÃO
  o que entra        o que está sendo         o que foi entregue
  (base, fontes,     feito (rascunhos,        (versões finais,
  evidências)        análises, versões)       aprovadas, congeladas)
        ▲                                            │
        └────────── inspira os próximos projetos ◀───┘
\`\`\``;

const MATERIAL = `# Leia-me — Material

> **Em uma frase:** tudo o que **chegou** ao projeto e serve de base — o que foi pedido, as fontes, as evidências e as referências que vão orientar o trabalho (inclusive o trabalho feito com ajuda de IA). Nada aqui é produzido pela equipe; aqui só entra.

${FLUXO}

## O que colocar aqui

| Tipo | Exemplos |
|---|---|
| **A demanda** | solicitação do cliente, edital, termo de referência, quesitos do juízo, briefing, e-mails que definem o escopo |
| **Evidências e dados de origem** | imagens forenses (.E01, .dd), extrações de celular, prints, logs, planilhas recebidas |
| **Documentos do caso** | peças processuais, contratos, atas, laudos anteriores de terceiros |
| **Referências e inspiração** | normas (ex.: ISO/IEC 27037), artigos, laudos-modelo, templates, apresentações de referência |
| **Instruções para IA** | prompts de base, guias de estilo, glossário de termos do caso |

Sugestão de subpastas (crie só as que fizerem sentido):

- \`Demanda\` — o pedido e tudo o que define o escopo;
- \`Evidências originais\` — o que foi recebido para análise, **exatamente como chegou**;
- \`Referências\` — normas, modelos, exemplos e inspiração;
- \`IA\` — prompts, guia de estilo e glossário.

## Regras de ouro

1. **Material é somente leitura.** Nunca edite, converta ou "limpe" um arquivo aqui dentro. Precisa trabalhar em cima dele? Faça uma **cópia** em *Processamento* (baixe o arquivo e envie-o lá). É a regra básica da perícia (ISO/IEC 27037): analisa-se a cópia, preserva-se o original.
2. **A integridade já começa aqui.** Ao enviar, a plataforma calcula o **SHA-256** de cada arquivo e registra quem enviou e quando. Use **Verificar integridade** (painel ⓘ) sempre que precisar provar que a evidência não mudou — por exemplo, antes de citá-la no laudo. Se possível, confira também o hash informado por quem entregou o material.
3. **Registre a origem.** Para cada entrada relevante, anote de onde veio, quem entregou, quando e por qual meio — use a descrição do projeto, um comentário na missão ou um documento *Origem do material* nesta pasta. Isso é o começo da cadeia de custódia.
4. **Nome que se explica sozinho.** Padrão sugerido: \`AAAA-MM-DD_origem_descricao.ext\` — ex.: \`2026-09-24_cliente_extracao-whatsapp.zip\`. Evite "novo", "final", "arquivo1".
5. **Não duplique.** Se o mesmo material serve a várias missões, ele fica aqui uma vez só; as missões apontam para ele.

## Usando este material com IA (LLMs)

A qualidade do que a IA produz depende mais **do que você dá a ela** do que do pedido em si. Por isso esta pasta é também a "biblioteca de contexto" do projeto:

- **Pouco e bom vence muito e médio.** Modelos perdem precisão quando recebem contexto demais. Separe os **3 a 5 documentos mais representativos** de cada assunto em vez de despejar a pasta inteira.
- **Exemplos ensinam mais do que descrições.** Um laudo-modelo bem escrito comunica tom, estrutura e nível de detalhe melhor do que qualquer instrução. Guarde em \`Referências\` exemplos **reais e de alta qualidade**, e de tipos diferentes.
- **Prefira texto a imagem de texto.** PDFs escaneados e fotos de documentos rendem pouco; quando possível, guarde também uma versão em texto ou Markdown (a transcrição vai para *Processamento*, o original fica aqui).
- **Resuma antes de usar.** Para documentos longos, escreva um resumo curto do que importa para o caso (em *Processamento*) e use o resumo como contexto — o documento inteiro fica aqui, para consulta.
- **Sigilo vem antes.** Não envie evidências, dados pessoais ou material sob NDA para serviços de IA externos sem autorização do responsável pelo caso. A LGPD e os termos de confidencialidade continuam valendo quando o destinatário é uma IA.

## Quando algo sai desta pasta

Nunca "sai": o original fica. O que acontece é uma **cópia** ir para *Processamento* para ser trabalhada. Quando o caso termina, o Material continua sendo a prova de onde tudo começou.

## Checklist rápido

- [ ] A demanda (o que foi pedido) está aqui?
- [ ] Cada evidência tem origem registrada e hash conferido?
- [ ] Os nomes dos arquivos dizem o que eles são?
- [ ] Há exemplos de referência bons o suficiente para servir de modelo?
- [ ] Ficou claro o que pode e o que não pode ir para uma IA externa?
`;

const PROCESSAMENTO = `# Leia-me — Processamento

> **Em uma frase:** a **bancada de trabalho** do projeto — tudo o que está sendo feito e ainda não está pronto: cópias de trabalho, análises parciais, rascunhos, anotações e saídas de ferramentas (inclusive de IA).

${FLUXO}

## O que colocar aqui

| Tipo | Exemplos |
|---|---|
| **Cópias de trabalho** | cópia da evidência para análise, planilha tratada, transcrição de um PDF |
| **Resultados parciais** | relatório parcial de uma missão, extração filtrada, linha do tempo em construção |
| **Rascunhos** | versões do laudo, do relatório ou da apresentação antes da revisão |
| **Saídas de ferramentas** | exportações de ferramentas forenses, resultados de scripts, textos gerados por IA |
| **Notas de trabalho** | diário de análise, hipóteses, decisões tomadas e o porquê |

Sugestão de subpastas: uma por **missão** ou por **frente de trabalho** (ex.: \`M01 - Extração WhatsApp\`, \`M02 - Linha do tempo\`) — assim cada especialista sabe onde está o seu trabalho e o revisor sabe onde procurar.

## Como trabalhar bem aqui

1. **Versione no nome, não por cima.** Rascunhos usam \`v0.1\`, \`v0.2\`...; a versão aprovada vira \`v1.0\` (e vai para *Produção*). Ex.: \`laudo_v0.3_rascunho.md\`, \`linha-do-tempo_v0.2_em-revisao.xlsx\`. Evite "final", "final2", "agora-vai": a versão e a data dizem mais.
2. **Deixe o status visível.** Acrescente \`_rascunho\`, \`_em-revisao\` ou \`_aprovado\` ao nome — quem abre a pasta entende o estado de cada coisa sem precisar perguntar.
3. **Anote o raciocínio, não só o resultado.** Mantenha um documento *Notas de trabalho* (use **Novo → Novo documento**): o que foi feito, com qual ferramenta e versão, o que se concluiu e o que ficou pendente. É isso que torna a análise **repetível** e **auditável** — um terceiro precisa conseguir refazer o caminho — e é o melhor contexto para retomar o trabalho depois (seu ou de uma IA).
4. **Toda cópia aponta para o original.** Ao trabalhar numa cópia de evidência, registre de qual arquivo de *Material* ela veio (nome e hash). O histórico de atividade de cada arquivo (painel ⓘ) mostra quem enviou, baixou ou renomeou.
5. **Faça faxina.** Rascunhos abandonados e saídas intermediárias que não servem mais só confundem. Antes de concluir uma missão, remova o que não tem mais uso (quem enviou ou a coordenação podem excluir).

## Trabalhando com IA nesta pasta

- **Texto gerado por IA é rascunho, sempre.** Ele entra aqui, é conferido por uma pessoa e só depois segue adiante. Nunca vai direto para *Produção*.
- **Registre como foi gerado.** Anote nas notas de trabalho qual ferramenta/modelo, qual prompt e quais documentos de contexto foram usados. Se alguém questionar um trecho do laudo, dá para mostrar de onde veio.
- **Confira fatos, números e citações.** IAs inventam referências e erram números com confiança. Tudo o que for afirmado precisa ter base em *Material*.
- **Reaproveite o contexto.** Resumos, glossários e transcrições feitos aqui servem de contexto enxuto para as próximas interações — melhor do que reenviar documentos inteiros.

## Quando algo sai desta pasta

Quando um resultado fica pronto, ele passa pela **revisão** (entrega da missão → Fila de Revisão). Aprovado, envie a versão final (\`v1.0\`) para *Produção* — de preferência em formato fechado (PDF), que não se altera por acidente. O rascunho pode ficar aqui como histórico ou ser removido.

## Checklist rápido

- [ ] Cada arquivo tem versão e status no nome?
- [ ] As notas de trabalho explicam o que foi feito e com quais ferramentas?
- [ ] Cada cópia de evidência indica o original de onde veio?
- [ ] O que foi gerado por IA foi conferido e está marcado como tal?
- [ ] O que está pronto já foi enviado para revisão?
`;

const PRODUCAO = `# Leia-me — Produção

> **Em uma frase:** o que o projeto **entregou** — versões finais, revisadas e aprovadas, que não mudam mais. E, depois de entregue, a melhor fonte de exemplos para inspirar os próximos trabalhos.

${FLUXO}

## O que colocar aqui

| Tipo | Exemplos |
|---|---|
| **Entregas finais** | laudo pericial assinado, relatório final, parecer, apresentação ao cliente |
| **Anexos oficiais** | anexos do laudo, tabelas e linhas do tempo na versão entregue |
| **Registros de entrega** | comprovante de protocolo, e-mail de envio, termo de recebimento |
| **Lições aprendidas** | o que funcionou, o que deu errado e o que mudar no próximo caso |

## Regras de ouro

1. **Só entra o que foi aprovado.** Nada chega aqui sem passar pela revisão (Fila de Revisão). Se algo foi aprovado em caráter excepcional (autoaprovação), isso já fica registrado na auditoria.
2. **Final é congelado.** Prefira formatos fechados (**PDF**) e o nome com versão \`v1.0\` e data: \`2026-10-02_laudo-pericial_v1.0.pdf\`. A plataforma guarda o **SHA-256** de cada arquivo — é a prova de que o documento entregue é exatamente este.
3. **Corrigir é versionar.** Precisa de retificação? **Não substitua o arquivo**: a correção volta para *Processamento*, passa pela revisão e entra aqui como \`v1.1\` (ajuste) ou \`v2.0\` (mudança relevante). A versão anterior fica — ela é o que foi entregue naquela data.
4. **Registre a entrega.** Guarde junto a prova de envio (protocolo, e-mail, termo). Para entregar ao cliente, a opção **Exportar** do projeto gera um pacote com os arquivos e o manifesto de hashes.

## Produção como inspiração para os próximos trabalhos

Um trabalho bem feito é o melhor modelo para o próximo — para as pessoas e para a IA:

- **Exemplos canônicos.** Ao começar um caso parecido, leve para o *Material* do novo projeto (subpasta \`Referências\`; baixe daqui e envie lá) de **2 a 5 entregas** que representem bem o padrão desejado — de preferência variadas entre si. Poucos exemplos ótimos ensinam mais do que muitos medianos.
- **Anonimize antes de reaproveitar.** Nomes, CPFs, números de processo e dados do cliente saem antes de um documento virar exemplo para outro caso ou contexto de IA. Sigilo profissional e LGPD não acabam quando o caso termina.
- **Escreva as lições aprendidas.** Um documento curto — *o que funcionou, o que não funcionou, o que mudar* — é o contexto mais valioso para o próximo projeto e alimenta a melhoria contínua do processo.

## Quando algo sai desta pasta

Não sai. Quando o projeto termina, ele é **arquivado** (seção *Arquivamento*) com tudo o que tem — e o que está em *Produção* continua disponível como referência.

## Checklist rápido

- [ ] Tudo aqui passou pela revisão?
- [ ] Os arquivos estão em formato final (PDF), com versão e data no nome?
- [ ] Houve correção? Ela entrou como nova versão, sem apagar a anterior?
- [ ] A prova de entrega está guardada?
- [ ] As lições aprendidas foram registradas?
- [ ] O que pode servir de exemplo foi anonimizado?
`;

export const ESTRUTURA_INICIAL_PROJETO: { pasta: string; leiame: string }[] = [
  { pasta: 'Material', leiame: MATERIAL },
  { pasta: 'Processamento', leiame: PROCESSAMENTO },
  { pasta: 'Produção', leiame: PRODUCAO },
];
