import { IsDateString, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

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
}
