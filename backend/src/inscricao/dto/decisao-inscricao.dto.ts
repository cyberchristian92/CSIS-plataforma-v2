import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PAPEIS } from '../../common/constants/papeis';
import type { Papel } from '../../common/constants/papeis';

export class AprovarInscricaoDto {
  @IsIn(PAPEIS)
  papelGlobal: Papel;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;
}

export class RecusarInscricaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;
}
