import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditoriaService } from './auditoria.service';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @Roles('ADMIN', 'LIDER')
  listar(@Query() query: QueryAuditoriaDto) {
    return this.auditoriaService.listar(query);
  }
}
