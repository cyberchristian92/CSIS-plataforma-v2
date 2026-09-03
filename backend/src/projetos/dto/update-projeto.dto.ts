import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { CreateProjetoDto } from './create-projeto.dto';

export const STATUS_PROJETO = ['ATIVO', 'ARQUIVADO', 'CONCLUIDO'] as const;

export class UpdateProjetoDto extends PartialType(CreateProjetoDto) {
  @IsOptional()
  @IsIn(STATUS_PROJETO)
  status?: (typeof STATUS_PROJETO)[number];
}
