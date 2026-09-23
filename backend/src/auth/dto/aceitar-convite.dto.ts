import { IsString, MaxLength, MinLength } from 'class-validator';

export class AceitarConviteDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  senha: string;
}
