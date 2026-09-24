import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
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

export class ConfiguracaoInscricaoDto {
  /// Link do formulário externo (Google Forms, Typeform...). null remove.
  @IsOptional()
  @ValidateIf((_, valor) => valor !== null)
  @IsUrl(
    { protocols: ['https', 'http'], require_protocol: true },
    { message: 'O link precisa começar com https://.' },
  )
  @MaxLength(1000)
  link_externo?: string | null;

  @IsOptional()
  @ValidateIf((_, valor) => valor !== null)
  @IsString()
  @MaxLength(2000)
  instrucao_externa?: string | null;
}
