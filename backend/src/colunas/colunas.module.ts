import { Module } from '@nestjs/common';
import { ColunasService } from './colunas.service';
import { ColunasController } from './colunas.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [ColunasController],
  providers: [ColunasService],
  exports: [ColunasService],
})
export class ColunasModule {}
