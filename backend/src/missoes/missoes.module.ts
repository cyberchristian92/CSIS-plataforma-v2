import { Module } from '@nestjs/common';
import { MissoesService } from './missoes.service';
import { MissoesController } from './missoes.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [MissoesController],
  providers: [MissoesService],
  exports: [MissoesService],
})
export class MissoesModule {}
