import { Module } from '@nestjs/common';
import { PastasService } from './pastas.service';
import { PastasController } from './pastas.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [PastasController],
  providers: [PastasService],
  exports: [PastasService],
})
export class PastasModule {}
