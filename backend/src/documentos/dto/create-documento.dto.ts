import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateDocumentoDto {
  @IsString()
  conteudo: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  missaoId?: string;

  @IsOptional()
  @IsString()
  pastaId?: string;
}
