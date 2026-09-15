import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength, Matches, ValidateIf } from 'class-validator';
import { CreateProjetoDto } from './create-projeto.dto';

export const STATUS_PROJETO = ['ATIVO', 'ARQUIVADO', 'CONCLUIDO'] as const;

export class UpdateProjetoDto extends PartialType(CreateProjetoDto) {
  @IsOptional()
  @IsIn(STATUS_PROJETO)
  status?: (typeof STATUS_PROJETO)[number];

  // Resumo visual da Visão Geral (estilo capa/embed do Notion). null limpa o
  // campo (Prisma grava NULL); undefined (campo ausente do corpo) não mexe.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4_000_000) // ~3MB em base64 — capa é maior que um logo, mas ainda cabe numa linha de tabela sem susto
  @Matches(/^data:image\/(png|jpeg|jpg|webp);base64,/, {
    message: 'capa_url precisa ser uma data URI de imagem (png/jpeg/webp).',
  })
  capa_url?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({}, { message: 'video_url precisa ser uma URL válida.' })
  @Matches(/(youtube\.com|youtu\.be)/, { message: 'video_url precisa ser um link do YouTube.' })
  video_url?: string | null;
}
