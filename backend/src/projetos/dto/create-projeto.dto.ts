import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProjetoDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  prazo?: string;
}
