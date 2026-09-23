// Carrega o .env ANTES de qualquer outro import: vários módulos leem
// process.env no carregamento (ex.: diretório de uploads, limites do multer)
// e, sem isto, só enxergariam variáveis já exportadas no shell.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp, validarSegredoJwt } from './configurar-app';

async function bootstrap() {
  validarSegredoJwt();
  const app = await NestFactory.create(AppModule);
  configurarApp(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
