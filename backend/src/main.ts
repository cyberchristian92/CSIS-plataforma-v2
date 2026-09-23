import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    // Além do localhost, libera o IP da rede local — necessário pra acessar
    // o app pelo navegador do celular durante testes (mesma rede Wi-Fi).
    origin: [process.env.FRONTEND_ORIGIN ?? 'http://localhost:5000', 'http://192.168.1.18:5000'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
