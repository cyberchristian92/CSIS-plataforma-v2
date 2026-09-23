import { IsString } from 'class-validator';

export class ConfirmarEmailDto {
  @IsString()
  token: string;
}
