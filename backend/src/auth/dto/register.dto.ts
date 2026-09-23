import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PAPEIS } from '../../common/constants/papeis';
import type { Papel } from '../../common/constants/papeis';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  senha: string;

  @IsOptional()
  @IsIn(PAPEIS)
  papelGlobal?: Papel;
}
