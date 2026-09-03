import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

interface ArquivoParaZip {
  id: string;
  nomeOriginal: string;
  caminhoNoDisco: string;
  caminhoNoZip: string;
}

@Injectable()
export class ExportacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
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

    return { manifesto, relatorioMd, arquivosParaZip };
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
}
