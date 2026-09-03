import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PALETA_HEX } from '../../common/constants/paleta-cores';

export class UpdateMissaoLabelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsIn(PALETA_HEX)
  cor?: string;
}
