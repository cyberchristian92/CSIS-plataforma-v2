import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const STATUS_REVISAO = ['APROVADO', 'REJEITADO'] as const;

export class CreateRevisaoDto {
  @IsIn(STATUS_REVISAO)
  status: (typeof STATUS_REVISAO)[number];

  @IsOptional()
  @IsString()
  comentario?: string;

  /// Quem executou a missão aprovando a própria entrega (exceção do TCC v4).
  @IsOptional()
  @IsBoolean()
  autoaprovacao?: boolean;

  /// Obrigatória na autoaprovação: por que não houve revisão por outra pessoa.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  justificativa?: string;
}
