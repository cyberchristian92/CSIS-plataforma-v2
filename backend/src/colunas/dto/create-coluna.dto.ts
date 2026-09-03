import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateColunaDto {
  @IsString()
  @MinLength(1)
  nome: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limiteWip?: number;
}
