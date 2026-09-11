import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as yauzl from 'yauzl';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EVT_CONTEUDO_ALTERADO, EVT_HIERARQUIA_ALTERADA } from '../integridade/integridade.events';
import { sha256Buffer } from '../arquivos/utils/hash.util';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');

interface ArquivoParaZip {
  id: string;
  nomeOriginal: string;
  caminhoNoDisco: string;
  caminhoNoZip: string;
}

// Formato aceito em manifesto.json ao SINCRONIZAR um pacote de volta (ver
// sincronizarLocal). São os mesmos objetos que já aparecem no manifesto
// exportado — uma entrada "nova" é simplesmente uma cópia desse formato SEM
// o campo `id`. `chave_local` é opcional e serve só pra uma missão nova
// poder ser referenciada por um documento/arquivo novo no mesmo pacote,
// antes de existir um id de verdade (ver COMO_SINCRONIZAR.md, gerado no
// próprio pacote exportado).
interface ManifestoMissaoEntrada {
  id?: string;
  chave_local?: string;
  titulo?: string;
  descricao?: string;
  prazo?: string;
  criterio_aceite?: string;
  valor_bounty?: number;
  tags?: string[];
  coluna?: string;
}

interface ManifestoDocumentoEntrada {
  id?: string;
  conteudo?: string;
  tags?: string[];
  missao_id?: string;
}

interface ManifestoArquivoEntrada {
  id?: string;
  nome?: string;
  caminho_no_pacote?: string;
  missao_id?: string;
}

export interface ResultadoSincronizacao {
  missoes_criadas: number;
  documentos_criados: number;
  arquivos_criados: number;
  avisos: string[];
}

@Injectable()
export class ExportacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  async exportarProjeto(projetoId: string, solicitanteId: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      include: { area: { include: { workspace: true } } },
    });
    if (!projeto) {
      throw new NotFoundException('Projeto não encontrado.');
    }

    const missoes = await this.prisma.missao.findMany({
      where: { projeto_id: projetoId },
      orderBy: { titulo: 'asc' },
      include: {
        responsaveis: { include: { user: { select: { id: true, nome: true, email: true } } } },
        entregas: {
          orderBy: { criado_em: 'asc' },
          include: {
            autor: { select: { id: true, nome: true, email: true } },
            revisoes: { orderBy: { criado_em: 'asc' }, include: { revisor: { select: { id: true, nome: true, email: true } } } },
          },
        },
        comentarios: { orderBy: { criado_em: 'asc' }, include: { autor: { select: { id: true, nome: true } } } },
        itens_checklist: { orderBy: { ordem: 'asc' } },
      },
    });

    const documentos = await this.prisma.documento.findMany({
      where: { projeto_id: projetoId },
      orderBy: { criado_em: 'asc' },
      include: { autor: { select: { id: true, nome: true, email: true } } },
    });

    const arquivos = await this.prisma.arquivo.findMany({ where: { projeto_id: projetoId }, orderBy: { enviado_em: 'asc' } });

    const pastas = await this.prisma.pasta.findMany({ where: { projeto_id: projetoId } });

    // enviado_por é um id "solto" (sem relação no schema) — resolve os nomes manualmente.
    const idsEnviadoPor = [...new Set(arquivos.map((a) => a.enviado_por))];
    const usuariosEnviaram = await this.prisma.user.findMany({
      where: { id: { in: idsEnviadoPor } },
      select: { id: true, nome: true, email: true },
    });
    const mapaUsuarios = new Map(usuariosEnviaram.map((u) => [u.id, u]));

    const entidadeIds = [
      projetoId,
      ...missoes.map((m) => m.id),
      ...missoes.flatMap((m) => m.entregas.map((e) => e.id)),
      ...arquivos.map((a) => a.id),
      ...documentos.map((d) => d.id),
      ...pastas.map((p) => p.id),
    ];
    const auditoria = await this.auditoriaService.listarPorEntidades(entidadeIds);

    const arquivosParaZip: ArquivoParaZip[] = arquivos.map((a) => ({
      id: a.id,
      nomeOriginal: a.nome,
      caminhoNoDisco: a.caminho,
      caminhoNoZip: `arquivos/${a.id.slice(0, 8)}-${a.nome}`,
    }));
    const caminhoZipPorId = new Map(arquivosParaZip.map((a) => [a.id, a.caminhoNoZip]));

    const manifesto = {
      gerado_em: new Date().toISOString(),
      gerado_por: solicitanteId,
      projeto: {
        id: projeto.id,
        nome: projeto.nome,
        descricao: projeto.descricao,
        status: projeto.status,
        prazo: projeto.prazo,
        area: projeto.area.nome,
        workspace: projeto.area.workspace.nome,
      },
      missoes: missoes.map((m) => ({
        id: m.id,
        titulo: m.titulo,
        descricao: m.descricao,
        status: m.status,
        prazo: m.prazo,
        criterio_aceite: m.criterio_aceite,
        valor_bounty: m.valor_bounty,
        tags: m.tags,
        responsaveis: m.responsaveis.map((r) => r.user),
        checklist: m.itens_checklist.map((i) => ({ texto: i.texto, concluido: i.concluido })),
        comentarios: m.comentarios.map((c) => ({ autor: c.autor.nome, texto: c.texto, criado_em: c.criado_em })),
        entregas: m.entregas.map((e) => ({
          id: e.id,
          autor: e.autor,
          conteudo: e.conteudo,
          status: e.status,
          criado_em: e.criado_em,
          revisoes: e.revisoes.map((r) => ({ revisor: r.revisor, status: r.status, comentario: r.comentario, criado_em: r.criado_em })),
        })),
      })),
      documentos: documentos.map((d) => ({
        id: d.id,
        autor: d.autor,
        conteudo: d.conteudo,
        tags: d.tags,
        missao_id: d.missao_id,
        criado_em: d.criado_em,
        atualizado_em: d.atualizado_em,
      })),
      arquivos: arquivos.map((a) => ({
        id: a.id,
        nome: a.nome,
        hash_sha256: a.hash_sha256,
        tamanho: a.tamanho,
        tipo_mime: a.tipo_mime,
        missao_id: a.missao_id,
        enviado_por: mapaUsuarios.get(a.enviado_por) ?? { id: a.enviado_por },
        enviado_em: a.enviado_em,
        caminho_no_pacote: caminhoZipPorId.get(a.id),
      })),
      auditoria: auditoria.map((log) => ({
        timestamp: log.timestamp,
        acao: log.acao,
        entidade: log.entidade,
        entidade_id: log.entidade_id,
        usuario: log.user ?? null,
        dados_anteriores: log.dados_anteriores,
        dados_novos: log.dados_novos,
      })),
      nota_integridade:
        'Para verificar a integridade de um arquivo, recalcule o SHA-256 do arquivo correspondente em arquivos/ (caminho em "caminho_no_pacote") e compare com "hash_sha256".',
    };

    const relatorioMd = this.gerarRelatorioMarkdown(manifesto);

    await this.auditoriaService.registrar(solicitanteId, 'EXPORTAR', 'Projeto', projetoId, null, {
      total_missoes: missoes.length,
      total_arquivos: arquivos.length,
      total_documentos: documentos.length,
    });

    const guiaSincronizacaoMd = this.gerarGuiaSincronizacao();

    return { manifesto, relatorioMd, guiaSincronizacaoMd, arquivosParaZip };
  }

  // Explica, dentro do próprio pacote, como usar este mesmo manifesto.json
  // pra ADICIONAR coisas de volta no projeto (ver sincronizarLocal) — sem
  // isso, o formato de "entrada sem id = coisa nova" e "@chave_local" não é
  // óbvio pra quem for editar o JSON à mão.
  private gerarGuiaSincronizacao(): string {
    return [
      '# Como sincronizar mudanças locais de volta pro projeto',
      '',
      'Este pacote pode ser reenviado pro CSIS (botão "Sincronizar do computador" na tela',
      'do projeto) pra ADICIONAR coisas novas que você criou aqui fora — sem duplicar o que',
      'já existia. Nada que já existe no projeto é alterado por essa sincronização; só o que',
      'é novo entra.',
      '',
      '## Adicionar uma missão nova',
      '',
      'Edite `manifesto.json` e adicione um objeto no array `missoes`, sem o campo `id`',
      '(um `id` presente significa "isso já existe", e a sincronização ignora essa entrada):',
      '',
      '```json',
      '{',
      '  "chave_local": "minha-missao-1",',
      '  "titulo": "Título da missão nova",',
      '  "descricao": "Opcional",',
      '  "tags": ["opcional"]',
      '}',
      '```',
      '',
      '`chave_local` é opcional — só é necessário se você quiser que um documento ou arquivo',
      'novo, no mesmo pacote, seja anexado a essa missão (ver abaixo).',
      '',
      '## Adicionar um documento novo',
      '',
      'Adicione um objeto no array `documentos`, sem `id`:',
      '',
      '```json',
      '{',
      '  "conteudo": "# Conteúdo em markdown",',
      '  "missao_id": "@minha-missao-1"',
      '}',
      '```',
      '',
      '`missao_id` é opcional. Use `"@chave_local"` (com arroba) pra anexar a uma missão nova',
      'do mesmo pacote, ou o id real de uma missão que já existe no projeto. Sem esse campo,',
      'o documento fica solto na raiz do projeto.',
      '',
      '## Adicionar um arquivo novo',
      '',
      'Coloque o arquivo de verdade dentro da pasta `arquivos/` deste pacote, e adicione uma',
      'entrada correspondente no array `arquivos` de `manifesto.json`, sem `id`:',
      '',
      '```json',
      '{',
      '  "nome": "evidencia.png",',
      '  "caminho_no_pacote": "arquivos/evidencia.png",',
      '  "missao_id": "@minha-missao-1"',
      '}',
      '```',
      '',
      '`caminho_no_pacote` precisa apontar pro arquivo real dentro do zip. `missao_id` segue',
      'a mesma regra do documento (opcional, aceita `@chave_local` ou um id real).',
      '',
      '## Depois de editar',
      '',
      'Rezipe a pasta inteira (mantendo `manifesto.json` na raiz e os arquivos novos dentro de',
      '`arquivos/`) e envie pelo botão "Sincronizar do computador". O resultado mostra quantas',
      'missões, documentos e arquivos novos foram criados — e avisa sobre qualquer entrada',
      'com problema (referência quebrada, campo obrigatório faltando) sem travar o resto.',
    ].join('\n');
  }

  private gerarRelatorioMarkdown(m: any): string {
    const linhas: string[] = [];
    const fmt = (d: unknown) => (d ? new Date(d as string).toLocaleString('pt-BR') : '—');

    linhas.push(`# Relatório do Projeto: ${m.projeto.nome}`);
    linhas.push('');
    linhas.push(`- **Status:** ${m.projeto.status}`);
    linhas.push(`- **Área:** ${m.projeto.area} (Workspace: ${m.projeto.workspace})`);
    linhas.push(`- **Prazo:** ${fmt(m.projeto.prazo)}`);
    if (m.projeto.descricao) linhas.push(`- **Descrição:** ${m.projeto.descricao}`);
    linhas.push(`- **Exportado em:** ${fmt(m.gerado_em)}`);
    linhas.push('');
    linhas.push(`## Missões (${m.missoes.length})`);

    for (const missao of m.missoes) {
      linhas.push('');
      linhas.push(`### ${missao.titulo} — ${missao.status}`);
      const nomesResponsaveis = missao.responsaveis?.map((r: { nome: string }) => r.nome).join(', ');
      linhas.push(`- Responsáveis: ${nomesResponsaveis || 'Sem responsável'}`);
      linhas.push(`- Prazo: ${fmt(missao.prazo)}`);
      if (missao.criterio_aceite) linhas.push(`- Critério de aceite: ${missao.criterio_aceite}`);
      if (missao.descricao) linhas.push(`- Descrição: ${missao.descricao}`);
      if (missao.tags?.length) linhas.push(`- Tags: ${missao.tags.join(', ')}`);

      if (missao.checklist?.length) {
        linhas.push(`- Checklist:`);
        for (const item of missao.checklist) linhas.push(`  - [${item.concluido ? 'x' : ' '}] ${item.texto}`);
      }

      if (missao.comentarios?.length) {
        linhas.push(`- Comentários:`);
        for (const c of missao.comentarios) linhas.push(`  - **${c.autor}** (${fmt(c.criado_em)}): ${c.texto}`);
      }

      if (missao.entregas?.length) {
        linhas.push(`- Entregas:`);
        for (const e of missao.entregas) {
          linhas.push(`  - Entrega de **${e.autor.nome}** em ${fmt(e.criado_em)} — status: ${e.status}`);
          if (e.conteudo) linhas.push(`    > ${e.conteudo}`);
          for (const r of e.revisoes) {
            linhas.push(`    - Revisão de **${r.revisor.nome}** (${fmt(r.criado_em)}): ${r.status}${r.comentario ? ` — ${r.comentario}` : ''}`);
          }
        }
      }
    }

    linhas.push('');
    linhas.push(`## Documentos (${m.documentos.length})`);
    for (const doc of m.documentos) {
      const primeiraLinha = (doc.conteudo as string).split('\n')[0].replace(/#/g, '').trim();
      linhas.push(`- **${primeiraLinha || 'Documento sem título'}** — autor: ${doc.autor.nome}, criado em ${fmt(doc.criado_em)}${doc.tags?.length ? `, tags: ${doc.tags.join(', ')}` : ''}`);
    }

    linhas.push('');
    linhas.push(`## Arquivos (${m.arquivos.length})`);
    linhas.push('');
    linhas.push('| Nome | Hash SHA-256 | Tamanho (bytes) | Enviado por | Enviado em |');
    linhas.push('| --- | --- | --- | --- | --- |');
    for (const a of m.arquivos) {
      linhas.push(`| ${a.nome} | \`${a.hash_sha256}\` | ${a.tamanho} | ${a.enviado_por?.nome ?? '—'} | ${fmt(a.enviado_em)} |`);
    }

    linhas.push('');
    linhas.push(`## Trilha de Auditoria (${m.auditoria.length} eventos)`);
    linhas.push('');
    linhas.push('| Data/Hora | Ação | Entidade | Usuário |');
    linhas.push('| --- | --- | --- | --- |');
    for (const log of m.auditoria) {
      linhas.push(`| ${fmt(log.timestamp)} | ${log.acao} | ${log.entidade} | ${log.usuario?.nome ?? 'Sistema'} |`);
    }

    linhas.push('');
    linhas.push('---');
    linhas.push(
      '_Este relatório foi gerado automaticamente a partir do `manifesto.json` incluído neste mesmo pacote — os dois têm exatamente a mesma informação, um em formato de leitura corrida e outro estruturado. Para verificar a integridade de um arquivo, recalcule o SHA-256 do arquivo correspondente em `arquivos/` e compare com o hash listado acima._',
    );

    return linhas.join('\n');
  }

  // Lê um .zip inteiro em memória (não grava nada em disco durante a leitura)
  // e devolve um mapa caminho-dentro-do-zip -> bytes. Usa yauzl (não
  // `adm-zip`): a função de extração do adm-zip segue links simbólicos do
  // destino e pode sobrescrever arquivo arbitrário fora da pasta de destino
  // (GHSA-vwc7-r8mq-g2x9) — grave justamente pro caso de uso de "extrair zip
  // enviado por usuário no servidor". yauzl não tem esse problema porque a
  // leitura aqui nunca escreve em disco usando nome vindo do zip; quem decide
  // onde cada arquivo NOVO é gravado é sincronizarLocal, com nome saneado.
  private async lerZip(buffer: Buffer): Promise<Map<string, Buffer>> {
    const zip = await yauzl.fromBufferPromise(buffer, { lazyEntries: true });
    const entradas = new Map<string, Buffer>();
    for await (const entry of zip.eachEntry()) {
      // Normaliza separador de caminho: o formato do ZIP exige "/", mas
      // ferramentas do Windows (ex.: Compress-Archive do PowerShell) às
      // vezes gravam "\" — sem normalizar aqui, um "caminho_no_pacote":
      // "arquivos/x.png" no manifesto nunca bateria com a entrada real do
      // zip dependendo de qual ferramenta a pessoa usou pra compactar.
      const nomeNormalizado = entry.fileName.replace(/\\/g, '/');
      if (nomeNormalizado.endsWith('/')) continue; // diretório, sem conteúdo
      const stream = await zip.openReadStreamPromise(entry);
      const partes: Buffer[] = [];
      for await (const parte of stream) partes.push(parte as Buffer);
      entradas.set(nomeNormalizado, Buffer.concat(partes));
    }
    return entradas;
  }

  // Sincroniza um pacote baixado (e editado localmente) de volta pro MESMO
  // projeto: cria só o que é novo (missão/documento/arquivo sem "id" no
  // manifesto), nunca mexe no que já existe. Ver gerarGuiaSincronizacao()
  // pro formato exato aceito. Deliberadamente não é um "importar genérico" —
  // recusa qualquer pacote cujo manifesto.projeto.id não bata com o
  // projetoId do endpoint, pra não misturar dados de projetos diferentes.
  async sincronizarLocal(projetoId: string, zipBuffer: Buffer, userId: string): Promise<ResultadoSincronizacao> {
    const projeto = await this.prisma.projeto.findUnique({ where: { id: projetoId } });
    if (!projeto) {
      throw new NotFoundException('Projeto não encontrado.');
    }

    const entradasZip = await this.lerZip(zipBuffer);
    const manifestoBytes = entradasZip.get('manifesto.json');
    if (!manifestoBytes) {
      throw new BadRequestException('O pacote enviado não contém um manifesto.json na raiz.');
    }

    let manifesto: {
      projeto?: { id?: string };
      missoes?: ManifestoMissaoEntrada[];
      documentos?: ManifestoDocumentoEntrada[];
      arquivos?: ManifestoArquivoEntrada[];
    };
    try {
      manifesto = JSON.parse(manifestoBytes.toString('utf8'));
    } catch {
      throw new BadRequestException('manifesto.json não é um JSON válido.');
    }

    if (manifesto.projeto?.id !== projetoId) {
      throw new BadRequestException(
        'Este pacote foi exportado de outro projeto (o id em manifesto.json não bate com o projeto atual) — sincronize um pacote baixado deste mesmo projeto.',
      );
    }

    const avisos: string[] = [];
    const chaveParaMissaoId = new Map<string, string>();
    const missoesExistentesIds = new Set(
      (await this.prisma.missao.findMany({ where: { projeto_id: projetoId }, select: { id: true } })).map((m) => m.id),
    );

    const resolverMissaoId = (ref: string | undefined): string | undefined => {
      if (!ref) return undefined;
      if (ref.startsWith('@')) {
        const chave = ref.slice(1);
        const id = chaveParaMissaoId.get(chave);
        if (!id) {
          avisos.push(`Referência "${ref}" não encontrada (nenhuma missão nova com chave_local "${chave}" neste pacote) — item ficará sem missão associada.`);
          return undefined;
        }
        return id;
      }
      if (missoesExistentesIds.has(ref)) return ref;
      avisos.push(`Referência de missão "${ref}" não encontrada neste projeto — item ficará sem missão associada.`);
      return undefined;
    };

    const missoesNovas = (manifesto.missoes ?? []).filter((m) => !m.id);
    const documentosNovos = (manifesto.documentos ?? []).filter((d) => !d.id);
    const arquivosNovos = (manifesto.arquivos ?? []).filter((a) => !a.id);

    const primeiraColuna = await this.prisma.coluna.findFirst({ where: { projeto_id: projetoId }, orderBy: { ordem: 'asc' } });
    const colunasPorNome = new Map(
      (await this.prisma.coluna.findMany({ where: { projeto_id: projetoId } })).map((c) => [c.nome, c.id]),
    );

    const missoesCriadasIds: string[] = [];
    const documentosCriadosIds: string[] = [];
    const arquivosCriadosIds: string[] = [];
    const arquivosParaGravar: { caminho: string; buffer: Buffer }[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const entrada of missoesNovas) {
        try {
          if (!entrada.titulo?.trim()) {
            avisos.push('Uma entrada em "missoes" foi ignorada por não ter "titulo".');
            continue;
          }
          const colunaId = entrada.coluna ? colunasPorNome.get(entrada.coluna) : primeiraColuna?.id;
          const ordem = colunaId ? await tx.missao.count({ where: { coluna_id: colunaId } }) : 0;
          const missao = await tx.missao.create({
            data: {
              projeto_id: projetoId,
              titulo: entrada.titulo,
              descricao: entrada.descricao,
              criterio_aceite: entrada.criterio_aceite,
              valor_bounty: entrada.valor_bounty,
              prazo: entrada.prazo ? new Date(entrada.prazo) : undefined,
              tags: entrada.tags ?? [],
              coluna_id: colunaId ?? null,
              ordem,
            },
          });
          missoesCriadasIds.push(missao.id);
          if (entrada.chave_local) chaveParaMissaoId.set(entrada.chave_local, missao.id);
        } catch (erro) {
          avisos.push(`Missão "${entrada.titulo ?? '(sem título)'}" não pôde ser criada: ${(erro as Error).message}`);
        }
      }

      for (const entrada of documentosNovos) {
        try {
          if (!entrada.conteudo?.trim()) {
            avisos.push('Uma entrada em "documentos" foi ignorada por não ter "conteudo".');
            continue;
          }
          const documento = await tx.documento.create({
            data: {
              projeto_id: projetoId,
              missao_id: resolverMissaoId(entrada.missao_id),
              autor_id: userId,
              conteudo: entrada.conteudo,
              tags: entrada.tags ?? [],
            },
          });
          documentosCriadosIds.push(documento.id);
        } catch (erro) {
          avisos.push(`Um documento novo não pôde ser criado: ${(erro as Error).message}`);
        }
      }

      for (const entrada of arquivosNovos) {
        try {
          if (!entrada.nome?.trim() || !entrada.caminho_no_pacote) {
            avisos.push('Uma entrada em "arquivos" foi ignorada por não ter "nome" ou "caminho_no_pacote".');
            continue;
          }
          const bytes = entradasZip.get(entrada.caminho_no_pacote.replace(/\\/g, '/'));
          if (!bytes) {
            avisos.push(`Arquivo "${entrada.caminho_no_pacote}" referenciado em manifesto.json não foi encontrado dentro do pacote.`);
            continue;
          }
          const id = randomUUID();
          const nomeSeguro = entrada.nome.replace(/[\\/]/g, '_').replace(/^\.+/, '_');
          const caminho = join(UPLOADS_DIR, `${id}-${nomeSeguro}`);
          const arquivo = await tx.arquivo.create({
            data: {
              id,
              projeto_id: projetoId,
              missao_id: resolverMissaoId(entrada.missao_id),
              nome: entrada.nome,
              caminho,
              hash_sha256: sha256Buffer(bytes),
              tamanho: bytes.length,
              tipo_mime: 'application/octet-stream',
              enviado_por: userId,
            },
          });
          arquivosParaGravar.push({ caminho, buffer: bytes });
          arquivosCriadosIds.push(arquivo.id);
        } catch (erro) {
          avisos.push(`Arquivo "${entrada.nome ?? '(sem nome)'}" não pôde ser criado: ${(erro as Error).message}`);
        }
      }
    });

    // Só grava em disco depois que a transação confirmou os registros no
    // banco — evita deixar arquivo órfão em disco se a transação falhar.
    if (arquivosParaGravar.length > 0) {
      await mkdir(UPLOADS_DIR, { recursive: true });
      await Promise.all(arquivosParaGravar.map((a) => writeFile(a.caminho, a.buffer)));
    }

    await this.auditoriaService.registrar(userId, 'SINCRONIZAR_LOCAL', 'Projeto', projetoId, null, {
      missoes_criadas: missoesCriadasIds.length,
      documentos_criados: documentosCriadosIds.length,
      arquivos_criados: arquivosCriadosIds.length,
    });

    for (const id of missoesCriadasIds) this.eventos.emit(EVT_HIERARQUIA_ALTERADA, { tipo: 'missao', id, userId });
    for (const id of documentosCriadosIds) this.eventos.emit(EVT_CONTEUDO_ALTERADO, { tipo: 'documento', id, userId });
    for (const id of arquivosCriadosIds) this.eventos.emit(EVT_CONTEUDO_ALTERADO, { tipo: 'arquivo', id, userId });

    return {
      missoes_criadas: missoesCriadasIds.length,
      documentos_criados: documentosCriadosIds.length,
      arquivos_criados: arquivosCriadosIds.length,
      avisos,
    };
  }
}
