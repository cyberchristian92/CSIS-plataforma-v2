import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { sha256Buffer } from '../arquivos/utils/hash.util';
import { LaudoCompilerService } from './laudo-compiler.service';

@Injectable()
export class LaudoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly compilerService: LaudoCompilerService,
  ) {}

  private async buscarDocumento(documentoId: string) {
    const documento = await this.prisma.documento.findUnique({ where: { id: documentoId } });
    if (!documento) {
      throw new NotFoundException('Documento não encontrado.');
    }
    return documento;
  }

  async compilar(documentoId: string, userId: string, templateArquivoId?: string) {
    const documento = await this.buscarDocumento(documentoId);
    // Compilação de laudo resolve referências de arquivo relativas ao Projeto
    // (ver LaudoCompilerService.materializarArquivosDoProjeto) — só faz
    // sentido pra documento escopado a um Projeto, não pra um documento
    // solto em Workspace/Área (pasta de Recursos, por exemplo).
    if (!documento.projeto_id) {
      throw new BadRequestException('Só é possível compilar laudo de um documento vinculado a um projeto.');
    }

    let templateCaminho: string | undefined;
    if (templateArquivoId) {
      const template = await this.prisma.arquivo.findUnique({ where: { id: templateArquivoId } });
      // Só aceita template que já esteja na raiz do MESMO projeto do documento
      // — evita que alguém referencie por id um arquivo de outro projeto/área
      // ao qual não tem acesso.
      if (!template || template.projeto_id !== documento.projeto_id || template.pasta_id) {
        throw new BadRequestException('Template inválido: precisa ser um arquivo na raiz deste projeto.');
      }
      templateCaminho = template.caminho;
    }

    const resultado = await this.compilerService.compilar(
      documentoId,
      documento.projeto_id,
      documento.conteudo,
      templateCaminho,
    );

    // Amarra o PDF gerado à cadeia de custódia: o hash do binário resultante
    // fica registrado junto do hash do markdown de origem (o `conteudo` do
    // Documento já é rastreado a cada PATCH pela auditoria existente).
    let hashPdf: string | null = null;
    if (resultado.sucesso) {
      const bytesPdf = await readFile(this.compilerService.caminhoPdf(documentoId));
      hashPdf = sha256Buffer(bytesPdf);
    }

    await this.auditoriaService.registrar(userId, 'COMPILAR_LAUDO', 'Documento', documentoId, null, {
      sucesso: resultado.sucesso,
      hash_pdf_sha256: hashPdf,
    });

    return { sucesso: resultado.sucesso, log: resultado.log };
  }

  async caminhoPdf(documentoId: string) {
    await this.buscarDocumento(documentoId);
    return this.compilerService.caminhoPdf(documentoId);
  }
}
