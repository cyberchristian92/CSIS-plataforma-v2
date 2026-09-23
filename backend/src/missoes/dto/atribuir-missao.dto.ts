import { IsArray, IsString } from 'class-validator';

export class AtribuirMissaoDto {
  @IsArray()
  @IsString({ each: true })
  responsavelIds: string[];
}
