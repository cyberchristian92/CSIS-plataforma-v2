import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const TIPOS_CAMPO = [
  'TEXTO',
  'TEXTO_LONGO',
  'NUMERO',
  'DATA',
  'EMAIL',
  'TELEFONE',
  'URL',
  'SELECAO',
  'MULTIPLA',
  'ARQUIVO',
  'ACEITE',
] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export class CriarCampoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  rotulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  ajuda?: string;

  @IsIn(TIPOS_CAMPO)
  tipo: TipoCampo;

  @IsOptional()
  @IsBoolean()
  obrigatorio?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  opcoes?: string[];
}

export class AtualizarCampoDto extends PartialType(CriarCampoDto) {}

export class OrdenarCamposDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
