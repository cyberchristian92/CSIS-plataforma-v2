import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class ColunaOrdemDto {
  @IsString()
  id: string;

  @IsInt()
  @Min(0)
  ordem: number;
}

export class ReorderColunasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ColunaOrdemDto)
  ordens: ColunaOrdemDto[];
}
