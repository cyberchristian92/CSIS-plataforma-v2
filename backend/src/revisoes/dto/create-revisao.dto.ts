import { IsIn, IsOptional, IsString } from 'class-validator';

export const STATUS_REVISAO = ['APROVADO', 'REJEITADO'] as const;

export class CreateRevisaoDto {
  @IsIn(STATUS_REVISAO)
  status: (typeof STATUS_REVISAO)[number];

  @IsOptional()
  @IsString()
  comentario?: string;
}
