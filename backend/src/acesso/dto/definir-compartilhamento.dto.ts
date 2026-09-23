import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class DefinirCompartilhamentoDto {
  @IsBoolean()
  restrito: boolean;

  /// Projeto/Área: visível para todos os usuários ativos (ignorado em Pasta
  /// e quando `restrito` for true).
  @IsOptional()
  @IsBoolean()
  publico?: boolean;

  @IsArray()
  @IsString({ each: true })
  listaIds: string[];

  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
