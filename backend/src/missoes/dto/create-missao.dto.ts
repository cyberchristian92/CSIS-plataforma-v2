import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateMissaoDto {
  @IsString()
  @MinLength(2)
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  criterio_aceite?: string;

  @IsOptional()
  @IsDateString()
  prazo?: string;

  @IsOptional()
  @IsNumber()
  valor_bounty?: number;

  /// Lista do quadro em que o cartão nasce ("Adicionar um cartão" no pé da
  /// lista). Sem ela, vai para a primeira lista do projeto.
  @IsOptional()
  @IsUUID()
  colunaId?: string;
}
