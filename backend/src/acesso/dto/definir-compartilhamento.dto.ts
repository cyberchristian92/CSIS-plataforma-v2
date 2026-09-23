import { IsArray, IsBoolean, IsString } from 'class-validator';

export class DefinirCompartilhamentoDto {
  @IsBoolean()
  restrito: boolean;

  @IsArray()
  @IsString({ each: true })
  listaIds: string[];

  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
