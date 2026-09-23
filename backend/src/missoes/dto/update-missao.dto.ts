import { PartialType } from '@nestjs/mapped-types';
import { CreateMissaoDto } from './create-missao.dto';

export class UpdateMissaoDto extends PartialType(CreateMissaoDto) {}
