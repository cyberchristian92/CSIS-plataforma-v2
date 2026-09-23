import { IsIn, IsString, MinLength } from 'class-validator';
import { PALETA_HEX } from '../../common/constants/paleta-cores';

export class CreateMissaoLabelDto {
  @IsString()
  @MinLength(1)
  nome: string;

  @IsIn(PALETA_HEX)
  cor: string;
}
