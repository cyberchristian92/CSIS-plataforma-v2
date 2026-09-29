import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { EmailService } from './email.service';
import { TokensService } from './tokens.service';
import { GoogleService } from './google.service';
import { GoogleAuthController } from './google-auth.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    PassportModule,
    AuditoriaModule,
    ThrottlerModule.forRoot([{ ttl: 15 * 60 * 1000, limit: 5 }]),
    JwtModule.registerAsync({
      useFactory: (): JwtModuleOptions => ({
        secret: process.env.JWT_SECRET,
        signOptions: {
          expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as NonNullable<
            JwtModuleOptions['signOptions']
          >['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthService,
    JwtStrategy,
    EmailService,
    TokensService,
    GoogleService,
  ],
  exports: [AuthService, EmailService, TokensService, GoogleService],
})
export class AuthModule {}
