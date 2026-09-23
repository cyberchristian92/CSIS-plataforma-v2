import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { PAPEIS } from '../../common/constants/papeis';
import type { Papel } from '../../common/constants/papeis';

export class ConvidarDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @IsEmail()
  email: string;

  @IsIn(PAPEIS)
  papelGlobal: Papel;
}
