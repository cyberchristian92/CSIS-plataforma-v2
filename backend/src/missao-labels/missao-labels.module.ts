import { Module } from '@nestjs/common';
import { MissaoLabelsService } from './missao-labels.service';
import { MissaoLabelsController } from './missao-labels.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [MissaoLabelsController],
  providers: [MissaoLabelsService],
  exports: [MissaoLabelsService],
})
export class MissaoLabelsModule {}
