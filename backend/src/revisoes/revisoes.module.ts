import { Module } from '@nestjs/common';
import { RevisoesService } from './revisoes.service';
import { RevisoesController } from './revisoes.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [RevisoesController],
  providers: [RevisoesService],
  exports: [RevisoesService],
})
export class RevisoesModule {}
