import { Module } from '@nestjs/common';
import { IntegridadeService } from './integridade.service';
import { IntegridadeController } from './integridade.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [IntegridadeController],
  providers: [IntegridadeService],
  exports: [IntegridadeService],
})
export class IntegridadeModule {}
