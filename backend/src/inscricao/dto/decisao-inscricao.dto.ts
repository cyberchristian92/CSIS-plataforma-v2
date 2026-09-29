import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PAPEIS } from '../../common/constants/papeis';
import type { Papel } from '../../common/constants/papeis';

export class AprovarInscricaoDto {
  @IsIn(PAPEIS)
  papelGlobal: Papel;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;

  /// Equipes (Listas de Acesso) em que a pessoa entra já na aprovação.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  listaIds?: string[];

  /// Áreas liberadas para a pessoa (acesso individual à Área).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  areaIds?: string[];
}

export class RecusarInscricaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;
}
