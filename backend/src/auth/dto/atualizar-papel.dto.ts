import { IsIn } from 'class-validator';
import { PAPEIS } from '../../common/constants/papeis';
import type { Papel } from '../../common/constants/papeis';

export class AtualizarPapelDto {
  @IsIn(PAPEIS)
  papelGlobal: Papel;
}
