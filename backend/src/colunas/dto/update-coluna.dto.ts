import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateColunaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  // `undefined` = não mexe; `null` = limpa o limite; número = define o limite.
  @IsOptional()
  @IsInt()
  @Min(1)
  limiteWip?: number | null;
}
