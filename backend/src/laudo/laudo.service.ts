import { Injectable, NotFoundException } from '@nestjs/common';
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

  async compilar(documentoId: string, userId: string) {
    const documento = await this.buscarDocumento(documentoId);
    const resultado = await this.compilerService.compilar(documentoId, documento.projeto_id, documento.conteudo);

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
