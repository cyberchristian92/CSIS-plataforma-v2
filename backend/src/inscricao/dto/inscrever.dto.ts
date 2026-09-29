import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/// Campos fixos do cadastro. As respostas do formulário configurável chegam
/// em `respostas` (JSON { campoId: valor }) e os anexos como arquivos
/// `anexo_<campoId>` no mesmo multipart.
export class InscreverDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @IsEmail()
  email: string;

  /// Obrigatória, exceto no cadastro pelo Google (a pessoa entra pelo
  /// Google; pode criar uma senha depois em "Esqueci minha senha").
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  senha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  respostas?: string;

  /// Campo-armadilha: invisível para pessoas, preenchido por robôs.
  @IsOptional()
  @IsString()
  site?: string;
}
