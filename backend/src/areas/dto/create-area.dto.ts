import { IsIn, IsString, MinLength } from 'class-validator';

export const TIPOS_AREA = ['PERICIA', 'MARKETING', 'CURSOS'] as const;

export class CreateAreaDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsIn(TIPOS_AREA)
  tipo: (typeof TIPOS_AREA)[number];
}
