import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePastaDto {
  @IsString()
  @MinLength(1)
  nome: string;

  @IsOptional()
  @IsString()
  pastaPaiId?: string;

  @IsOptional()
  @IsString()
  missaoId?: string;
}
